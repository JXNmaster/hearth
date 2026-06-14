#!/usr/bin/env node
// Daily orchestrator: ConnectMLS export -> batch reports -> outreach.
// Chains the three steps so a single cron/launchd entry runs the whole funnel.
// Zero-dependency (node:child_process).
//
// Steps:
//   1. Locate the latest ConnectMLS TSV (from the Acuna scraper's downloads dir).
//   2. connectmls-to-csv.mjs  -> listings.csv  (active listings, address + PIN [+ agent if present])
//   3. batch.mjs              -> ./out/*.html + ./out/summary.csv  (live county lookups, throttled)
//   4. outreach/send.mjs      -> emails agents  (DRY-RUN by default; pass --send to go live)
//
// Env:
//   MLS_EXPORT_DIR  dir to scan for ConnectMLS_export*.TSV
//                   (default: /Users/benm4mini/Documents/Projects/10_AcunaLaw/scraper/downloads)
//   FIRM_NAME, FIRM_CONTACT, FIRM_ADDRESS, EMAIL_FROM, RESEND_API_KEY (for outreach)
// Usage:
//   node src/run-daily.mjs                 # full chain, outreach dry-run
//   node src/run-daily.mjs --send          # outreach live (gated by CAN-SPAM env checks)
//   node src/run-daily.mjs --tsv <path> --limit 10 --out ./out

import { execFileSync } from "node:child_process";
import { readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_EXPORT_DIR = process.env.MLS_EXPORT_DIR || "/Users/benm4mini/Documents/Projects/10_AcunaLaw/scraper/downloads";

function latestTsv(dir) {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => /ConnectMLS_export.*\.TSV$/i.test(f)).map((f) => join(dir, f));
  if (!files.length) return null;
  return files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}

function run(label, file, args) {
  console.log(`\n=== ${label} ===`);
  try {
    const out = execFileSync("node", [file, ...args], { stdio: "pipe", encoding: "utf8" });
    process.stdout.write(out);
    return true;
  } catch (e) {
    process.stdout.write(e.stdout || "");
    process.stderr.write(e.stderr || String(e.message || e));
    console.error(`\n[run-daily] step "${label}" failed.`);
    return false;
  }
}

function main() {
  const argv = process.argv.slice(2); const opt = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1]?.startsWith("--") || argv[i + 1] === undefined ? true : argv[++i];

  const tsv = (typeof opt.tsv === "string" && opt.tsv) || latestTsv(DEFAULT_EXPORT_DIR);
  if (!tsv) { console.error(`No ConnectMLS TSV found in ${DEFAULT_EXPORT_DIR}. Run the Acuna scraper first or pass --tsv.`); process.exit(1); }
  const outDir = (typeof opt.out === "string" && opt.out) || "./out";
  const csv = join(outDir, "listings.csv");
  const limitArgs = opt.limit ? ["--limit", String(opt.limit)] : [];
  const firm = process.env.FIRM_NAME || "[FIRM NAME]";
  const contact = process.env.FIRM_CONTACT || "[FIRM CONTACT]";

  console.log(`run-daily @ ${new Date().toISOString()}\n  TSV:  ${tsv}\n  out:  ${outDir}\n  firm: ${firm}\n  mode: ${opt.send ? "LIVE SEND" : "dry-run outreach"}`);

  try { execFileSync("mkdir", ["-p", outDir]); } catch {}

  if (!run("1/3 map ConnectMLS -> listings.csv", join(HERE, "mls/connectmls-to-csv.mjs"), [tsv, "--out", csv, ...limitArgs])) process.exit(1);
  if (!run("2/3 batch -> reports + summary.csv", join(HERE, "batch.mjs"), [csv, "--out", outDir, "--firm", firm, "--contact", contact])) process.exit(1);
  // Outreach: dry-run unless --send. Safe to run regardless — it skips rows with no agent email.
  run("3/3 outreach (email-only)", join(HERE, "outreach/send.mjs"), ["--summary", join(outDir, "summary.csv"), ...(opt.send ? ["--send"] : [])]);

  console.log(`\nrun-daily done. Reports in ${outDir}/, summary.csv, and (if live) sent-log.csv.`);
}

main();
