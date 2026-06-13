#!/usr/bin/env node
// Deal-Risk Report CLI.
// Usage:
//   node src/cli.mjs --pin 17-04-441-035-0000 [--seller "JANE DOE"] [--html out.html]
//   node src/cli.mjs --address "1060 W ADDISON ST" [--html out.html]
import { runPipeline } from "./pipeline.mjs";
import { renderHtml, renderTerminal } from "./report.mjs";
import { writeFileSync } from "node:fs";

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith("--")) { a[k.slice(2)] = argv[i + 1]?.startsWith("--") || argv[i + 1] === undefined ? true : argv[++i]; }
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));
if (!args.pin && !args.address) {
  console.error("Usage: node src/cli.mjs --pin <PIN> | --address <addr> [--seller <name>] [--html <file>] [--json <file>]");
  process.exit(1);
}

const result = await runPipeline({ pin: args.pin, address: args.address, seller: args.seller });
if (!result.ok) { console.error("ERROR:", result.error); process.exit(2); }

console.log(renderTerminal(result));
if (args.html) { writeFileSync(args.html === true ? `deal-risk-${result.pin}.html` : args.html, renderHtml(result, args.firm)); console.log(`\nHTML report -> ${args.html === true ? `deal-risk-${result.pin}.html` : args.html}`); }
if (args.json) { writeFileSync(args.json === true ? `deal-risk-${result.pin}.json` : args.json, JSON.stringify(result, null, 2)); }
