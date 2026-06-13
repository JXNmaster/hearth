#!/usr/bin/env node
// Validation harness — runs the FULL pipeline against a sample of real recent
// residential sales and prints an honest accuracy picture:
//   - per-source hit-rate + latency p50/p95
//   - flag-type distribution
//   - observable false-positive patterns (heuristic checks)
//
// Usage: node src/validate.mjs [N=25] [--delay 1200]
//
// This is intentionally read-only and slow (live recorder ~3-8s/parcel). It does
// NOT prove ground-truth title status — there's no public oracle for that — but it
// surfaces how often each source fires and where our flags look shaky, which is
// what we need to decide what's safe to send to an agent.

import { soda } from "./socrata.mjs";
import { runPipeline } from "./pipeline.mjs";

function pct(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function sampleSales(n) {
  // Real recent residential sales (class 2xx) with a usable buyer name.
  const res = await soda("wvhk-k5uv", {
    "$select": "pin, buyer_name, sale_date, class",
    "$where": "buyer_name IS NOT NULL AND buyer_name != 'UNKNOWN' AND sale_date > '2023-06-01' AND starts_with(class,'2')",
    "$order": "sale_date DESC",
    "$limit": n,
  });
  return res.rows;
}

async function main() {
  const argv = process.argv.slice(2);
  const N = Number(argv.find((a) => !a.startsWith("--"))) || 25;
  const betweenRows = Number(argv[argv.indexOf("--delay") + 1]) || 1200;

  const sales = await sampleSales(N);
  console.log(`VALIDATION RUN — ${sales.length} real residential sales (class 2xx, since 2023-06)\n`);

  // Per-source accumulators.
  const SRC = {};
  const flagCounts = {};
  const fpNotes = [];
  let pipelineOk = 0;
  const totalLat = [];

  for (let i = 0; i < sales.length; i++) {
    const { pin, buyer_name } = sales[i];
    process.stdout.write(`[${i + 1}/${sales.length}] ${pin} ... `);
    let res;
    try { res = await runPipeline({ pin }); }
    catch (e) { res = { ok: false, error: String(e.message || e) }; }

    if (!res.ok) { console.log(`FAIL ${res.error}`); if (i < sales.length - 1) await delay(betweenRows); continue; }
    pipelineOk++;
    totalLat.push(res.ms);

    for (const s of res.sourceStatus) {
      const k = s.source;
      SRC[k] = SRC[k] || { ok: 0, hit: 0, lat: [], n: 0 };
      SRC[k].n++;
      if (s.ok) SRC[k].ok++;
      if (s.rows > 0) SRC[k].hit++;
      SRC[k].lat.push(s.ms || 0);
    }

    for (const f of res.flags) flagCounts[f.code] = (flagCounts[f.code] || 0) + 1;

    // ---- heuristic false-positive probes (honest self-audit) ----
    const live = res.record.recorderLive?.analysis;
    if (live) {
      // (a) Owner name very common -> name-only scoping is risky. Flag if we
      //     asserted a live cloud with NO PIN-matched evidence row.
      const liveFlags = res.flags.filter((f) => /_LIVE$/.test(f.code));
      for (const lf of liveFlags) {
        const anyPin = (lf.evidence || []).some((e) => e.name_match >= 0.6);
        if (live.unscopedCount > 30) fpNotes.push(`${pin}: ${lf.code} on a high-noise owner search (${live.unscopedCount} unscoped rows) — verify identity`);
      }
      // (b) capped result set means we may have missed releases -> openMortgage shaky
      if (res.record.recorderLive.capped && live.openMortgages.length) {
        fpNotes.push(`${pin}: open-mortgage flag but live result set was CAPPED (1,000) — release may have been truncated`);
      }
    }
    // (c) owner unresolved but flags fired
    if (res.record.owner?.ownerUnresolved && res.flags.length) {
      fpNotes.push(`${pin}: flags present but owner name unresolved (placeholder) — non-owner-scoped`);
    }

    const cnt = res.summary.counts;
    console.log(`ok  ${res.ms}ms  H${cnt.HIGH}/M${cnt.MED}/I${cnt.INFO}`);
    if (i < sales.length - 1) await delay(betweenRows);
  }

  // ---- report ----
  console.log(`\n=== PIPELINE ===`);
  console.log(`runs ok: ${pipelineOk}/${sales.length}   total latency p50 ${pct(totalLat, 50)}ms  p95 ${pct(totalLat, 95)}ms`);

  console.log(`\n=== PER-SOURCE (hit% = parcels with >=1 row) ===`);
  console.log("source".padEnd(42), "ok%".padStart(5), "hit%".padStart(6), "p50".padStart(6), "p95".padStart(6));
  console.log("-".repeat(70));
  for (const [k, v] of Object.entries(SRC)) {
    console.log(
      k.padEnd(42),
      `${Math.round((v.ok / v.n) * 100)}`.padStart(5),
      `${Math.round((v.hit / v.n) * 100)}`.padStart(6),
      `${pct(v.lat, 50)}`.padStart(6),
      `${pct(v.lat, 95)}`.padStart(6),
    );
  }

  console.log(`\n=== FLAG DISTRIBUTION ===`);
  const sortedFlags = Object.entries(flagCounts).sort((a, b) => b[1] - a[1]);
  if (!sortedFlags.length) console.log("(no flags fired in this sample)");
  for (const [code, n] of sortedFlags) console.log(`  ${code.padEnd(28)} ${n}  (${Math.round((n / pipelineOk) * 100)}% of parcels)`);

  console.log(`\n=== FALSE-POSITIVE / TRUST NOTES (${fpNotes.length}) ===`);
  if (!fpNotes.length) console.log("  none flagged by the self-audit heuristics");
  for (const note of fpNotes.slice(0, 25)) console.log(`  - ${note}`);

  console.log(`\nNote: there is no public ground-truth oracle for title status; "hit%" measures`);
  console.log(`source coverage, not correctness. Treat live-recorder flags as review prompts.`);
}

main();
