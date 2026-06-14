#!/usr/bin/env node
// ConnectMLS (MRED) export -> deal-risk batch CSV adapter.
//
// The Acuna MLS scraper downloads ConnectMLS saved-search exports as TSV. This
// maps that TSV into the CSV shape `src/batch.mjs` consumes:
//     address, pin, zip, city, agent_name, agent_email, mls, status
//
// IMPORTANT (verified 2026-06-13 against a real 18-column ConnectMLS export):
//   ✓ PIN is column "PIN" (bare 14-digit) — present on listings, so the
//     address→PIN resolution step is bypassed entirely (highest-fidelity input).
//   ✓ Full address components: Street #, CP (direction), Str Name, Sfx, Unit #,
//     City, State, Zip.
//   ✗ The export carries NO listing-agent name and NO listing-agent email.
//     agent_name/agent_email are emitted BLANK. Outreach cannot target the agent
//     until those columns are added to the ConnectMLS export template (and MRED
//     TOS for agent solicitation is confirmed). See HANDOFF §5 / §8.
//
// Usage:
//   node src/mls/connectmls-to-csv.mjs <export.TSV> [--out listings.csv]
//        [--status NEW,A/I,PCHG,AUCT] [--limit N]
// Zero-dependency Node 20+.

import { readFileSync, writeFileSync } from "node:fs";

// ConnectMLS status codes we treat as "active / actionable" by default.
const ACTIVE_DEFAULT = new Set(["NEW", "A/I", "PCHG", "AUCT", "ACTV", "A", "ACTIVE"]);

function csvField(v) {
  const s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Find a column index by exact (case-insensitive) header label.
function col(header, label) {
  return header.findIndex((h) => h.trim().toLowerCase() === label.toLowerCase());
}

function buildAddress(get) {
  // Street # + CP (compass direction) + Str Name + Sfx, then Unit, then City State Zip.
  const line1 = [get("Street #"), get("CP"), get("Str Name"), get("Sfx")]
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .join(" ");
  const unit = (get("Unit #") || "").trim();
  const withUnit = unit ? `${line1} UNIT ${unit}` : line1;
  const city = (get("City") || "").trim();
  const state = (get("State") || "").trim();
  const zip = (get("Zip") || "").trim();
  const tail = [city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return tail ? `${withUnit}, ${tail}` : withUnit;
}

function main() {
  const argv = process.argv.slice(2);
  const inPath = argv.find((a) => !a.startsWith("--"));
  const opt = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const k = argv[i].slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      opt[k] = v;
    }
  }
  if (!inPath) {
    console.error("Usage: node src/mls/connectmls-to-csv.mjs <export.TSV> [--out listings.csv] [--status NEW,A/I] [--limit N]");
    process.exit(1);
  }

  const outPath = (typeof opt.out === "string" && opt.out) || "listings.csv";
  const statuses = typeof opt.status === "string"
    ? new Set(opt.status.split(",").map((s) => s.trim().toUpperCase()))
    : ACTIVE_DEFAULT;
  const limit = opt.limit ? Number(opt.limit) : Infinity;

  const text = readFileSync(inPath, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!lines.length) { console.error("empty TSV"); process.exit(1); }
  const header = lines[0].split("\t");

  const idx = {
    stat: col(header, "Stat"), pin: col(header, "PIN"), mls: col(header, "MLS #"),
    zip: col(header, "Zip"), city: col(header, "City"),
  };
  const getter = (cells) => (label) => { const i = col(header, label); return i >= 0 ? cells[i] : ""; };

  // Forward-compatible agent/seller capture: the current export has none of
  // these, but the moment List Agent columns are added to the ConnectMLS export
  // template, this maps them with ZERO code change. Tries common header spellings.
  const firstCol = (...labels) => { for (const l of labels) { const i = col(header, l); if (i >= 0) return i; } return -1; };
  const aIdx = {
    name: firstCol("List Agent", "List Agent Name", "LA Name", "Agent Name", "Listing Agent", "Listing Agent Name"),
    email: firstCol("List Agent Email", "LA Email", "Agent Email", "Listing Agent Email"),
    phone: firstCol("List Agent Phone", "LA Phone", "Agent Phone", "List Agent Cell", "LA Cell"),
  };
  if (aIdx.email < 0) console.log("note: no agent-email column in this export (outreach audience absent until added).");

  const out = [["address", "pin", "zip", "city", "agent_name", "agent_email", "agent_phone", "mls", "status"]];
  let total = 0, kept = 0, withPin = 0, withAgentEmail = 0;

  for (const line of lines.slice(1)) {
    total++;
    const cells = line.split("\t");
    const stat = (cells[idx.stat] || "").trim().toUpperCase();
    if (statuses.size && !statuses.has(stat)) continue;
    const get = getter(cells);
    const pinRaw = (idx.pin >= 0 ? cells[idx.pin] : "").replace(/[^0-9]/g, "");
    const pin = pinRaw.length === 14 ? pinRaw : ""; // only trust a clean 14-digit PIN
    if (pin) withPin++;
    const address = buildAddress(get);
    if (!address && !pin) continue; // nothing usable
    const agentName = aIdx.name >= 0 ? (cells[aIdx.name] || "").trim() : "";
    const agentEmail = aIdx.email >= 0 ? (cells[aIdx.email] || "").trim() : "";
    const agentPhone = aIdx.phone >= 0 ? (cells[aIdx.phone] || "").trim() : "";
    if (agentEmail) withAgentEmail++;
    out.push([
      address, pin, (cells[idx.zip] || "").trim(), (cells[idx.city] || "").trim(),
      agentName, agentEmail, agentPhone, (cells[idx.mls] || "").trim(), stat,
    ]);
    kept++;
    if (kept >= limit) break;
  }

  writeFileSync(outPath, out.map((r) => r.map(csvField).join(",")).join("\n") + "\n");
  const pinPct = kept ? Math.round((withPin / kept) * 100) : 0;
  console.log(`Parsed ${total} listing(s); kept ${kept} active; wrote ${outPath}`);
  console.log(`PIN present on ${withPin}/${kept} (${pinPct}%) — these bypass address→PIN resolution.`);
  console.log(`agent_email present on ${withAgentEmail}/${kept} — these are outreach-eligible.`);
}

main();
