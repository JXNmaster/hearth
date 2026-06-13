#!/usr/bin/env node
// Batch runner — the outreach engine's core.
//
// Input: a CSV of listings (header row). Recognized columns (case-insensitive):
//   address       free-text street address (used if pin is empty)
//   pin           14-digit PIN (dashed or bare) — preferred when present
//   zip           optional, improves address disambiguation
//   city          optional, improves address disambiguation
//   agent_name    optional, printed on the agent report
//   agent_email   optional, carried through to summary.csv for later outreach
//   firm          optional per-row firm override
//
// For each row: resolve PIN -> run pipeline -> write an AGENT-edition HTML report
// into ./out/ -> append a line to ./out/summary.csv.
//
// Designed to drop in MLS-scraper output later: just produce a CSV with an
// `address` column (and optionally `pin`). This NEVER sends email — it only
// prepares reports + a summary the human/outreach step consumes.
//
// Politeness: the live recorder takes ~3-8s/call. We process rows sequentially
// with a small delay between rows so we don't hammer the county site.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { runPipeline } from "./pipeline.mjs";
import { renderAgentHtml } from "./reportAgent.mjs";
import { formatPin } from "./normalize.mjs";

// ---- minimal CSV parsing (RFC-4180-ish: quotes, escaped quotes, commas/newlines) ----
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim() !== ""));
}

function toObjects(rows) {
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const o = {};
    header.forEach((h, i) => { o[h] = (r[i] ?? "").trim(); });
    return o;
  });
}

function csvField(v) {
  const s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function slug(s) { return String(s || "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40); }

async function main() {
  const argv = process.argv.slice(2);
  const inPath = argv.find((a) => !a.startsWith("--"));
  const opt = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1]?.startsWith("--") || argv[i + 1] === undefined ? true : argv[++i];
  if (!inPath) { console.error("Usage: node src/batch.mjs <listings.csv> [--out ./out] [--firm \"Firm\"] [--contact email] [--delay 1500]"); process.exit(1); }

  const outDir = (typeof opt.out === "string" && opt.out) || "./out";
  const firmDefault = (typeof opt.firm === "string" && opt.firm) || "[Your Firm Name]";
  const contactDefault = (typeof opt.contact === "string" && opt.contact) || "[email / phone]";
  const betweenRows = Number(opt.delay) || 1500;
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const listings = toObjects(parseCsv(readFileSync(inPath, "utf8")));
  console.log(`Loaded ${listings.length} listing(s) from ${inPath}. Writing reports to ${outDir}/\n`);

  const summary = [["address", "pin", "owner", "HIGH", "MED", "INFO", "top_flags", "report_path", "agent_name", "agent_email", "status"]];

  for (let idx = 0; idx < listings.length; idx++) {
    const L = listings[idx];
    const label = L.address || L.pin || `row ${idx + 1}`;
    process.stdout.write(`[${idx + 1}/${listings.length}] ${label} ... `);

    let res;
    try {
      res = await runPipeline({
        pin: L.pin || undefined,
        address: L.address || undefined,
        zip: L.zip || undefined,
        city: L.city || undefined,
        seller: L.seller || undefined,
      });
    } catch (e) {
      res = { ok: false, error: String(e.message || e) };
    }

    if (!res.ok) {
      const status = res.ambiguous ? "ambiguous-address" : `error: ${res.error}`;
      console.log(status);
      summary.push([L.address || "", L.pin || "", "", "", "", "", "", "", L.agent_name || "", L.agent_email || "", status]);
      if (idx < listings.length - 1) await delay(betweenRows);
      continue;
    }

    const firm = L.firm || firmDefault;
    const html = renderAgentHtml(res, { firm, firmContact: L.firm_contact || contactDefault, agentName: L.agent_name || "" });
    const fname = `report-${slug(res.record.addresses?.prop_address_full || formatPin(res.pin))}-${res.pin}.html`;
    const fpath = join(outDir, fname);
    writeFileSync(fpath, html);

    const topFlags = res.flags
      .filter((f) => f.severity !== "INFO")
      .slice(0, 3)
      .map((f) => `${f.severity}:${f.code}`)
      .join("; ");
    const owner = res.record.owner?.owner || "";

    summary.push([
      res.record.addresses?.prop_address_full || L.address || "",
      formatPin(res.pin),
      owner,
      res.summary.counts.HIGH, res.summary.counts.MED, res.summary.counts.INFO,
      topFlags, fpath,
      L.agent_name || "", L.agent_email || "", "ok",
    ]);

    console.log(`ok  HIGH ${res.summary.counts.HIGH}/MED ${res.summary.counts.MED}/INFO ${res.summary.counts.INFO} -> ${fname}`);
    if (idx < listings.length - 1) await delay(betweenRows); // be polite to the live recorder
  }

  const summaryPath = join(outDir, "summary.csv");
  writeFileSync(summaryPath, summary.map((r) => r.map(csvField).join(",")).join("\n") + "\n");
  console.log(`\nSummary -> ${summaryPath} (${summary.length - 1} row(s))`);
}

main();
