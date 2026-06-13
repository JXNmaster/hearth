// Source performance harness — measures each adapter against a live sample of
// real Cook County PINs: success rate, latency (p50/p95), and rows returned.
import * as assessor from "./sources/assessor.mjs";
import { taxSaleHistory } from "./sources/treasurer.mjs";
import { recorderArchive } from "./sources/recorderArchive.mjs";
import { soda } from "./socrata.mjs";

function pct(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

async function samplePins(n = 12) {
  // Real, recent residential sales (class 2xx) with buyer names — realistic inputs.
  const res = await soda("wvhk-k5uv", {
    "$select": "pin, buyer_name, sale_date",
    "$where": "buyer_name IS NOT NULL AND sale_date > '2024-01-01'",
    "$order": "sale_date DESC",
    "$limit": n,
  });
  return res.rows.map((r) => r.pin);
}

const probes = [
  { name: "Assessor: Parcel Universe", fn: (p) => assessor.parcelInfo(p), rows: (r) => (r.info ? 1 : 0) },
  { name: "Assessor: Parcel Addresses", fn: (p) => assessor.parcelAddresses(p), rows: (r) => (r.addr ? 1 : 0) },
  { name: "Assessor: Parcel Sales", fn: (p) => assessor.salesHistory(p), rows: (r) => (r.sales || []).length },
  { name: "Assessor: Assessed Values", fn: (p) => assessor.assessedValue(p), rows: (r) => (r.value ? 1 : 0) },
  { name: "Treasurer: Tax Sale", fn: (p) => taxSaleHistory(p), rows: (r) => (r.annual || []).length + (r.scavenger || []).length },
  { name: "Recorder: Archive", fn: (p) => recorderArchive(p), rows: (r) => (r.mortgages || []).length + (r.foreclosures || []).length + (r.quitclaims || []).length },
];

const pins = await samplePins(Number(process.argv[2] || 12));
console.log(`Sampled ${pins.length} real PINs from recent sales.\n`);
console.log("source".padEnd(30), "ok%".padStart(6), "p50ms".padStart(7), "p95ms".padStart(7), "avgRows".padStart(8), "hit%".padStart(6));
console.log("-".repeat(68));

for (const probe of probes) {
  const lat = [], rows = [];
  let ok = 0, hits = 0;
  for (const p of pins) {
    const r = await probe.fn(p);
    if (r.ok) ok++;
    lat.push(r.ms || 0);
    const n = probe.rows(r);
    rows.push(n);
    if (n > 0) hits++;
  }
  const avgRows = (rows.reduce((a, b) => a + b, 0) / rows.length).toFixed(1);
  console.log(
    probe.name.padEnd(30),
    `${Math.round((ok / pins.length) * 100)}`.padStart(6),
    `${pct(lat, 50)}`.padStart(7),
    `${pct(lat, 95)}`.padStart(7),
    `${avgRows}`.padStart(8),
    `${Math.round((hits / pins.length) * 100)}`.padStart(6)
  );
}
console.log("\nLegend: ok% = HTTP success · hit% = PINs with >=1 row · avgRows = mean rows/PIN");
