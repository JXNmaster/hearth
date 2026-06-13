// Render the one-page Deal-Risk Report (HTML) + a terminal summary.
import { formatPin } from "./normalize.mjs";

const DISCLAIMER =
  "Prepared from public records as preliminary attorney work product. NOT a title " +
  "commitment, title insurance, abstract of title, or legal advice. Open-data coverage " +
  "is incomplete (notably: current mortgages, releases, liens, judgments, probate, and " +
  "current tax balances require live recordings/court searches). Items below are issues " +
  "to review with counsel, not a determination that title is clear or unclear.";

const SEV_COLOR = { HIGH: "#b00020", MED: "#b26a00", INFO: "#3b6ea5" };

export function renderHtml(result, firm = "[Firm Name]") {
  const r = result;
  const owner = r.record.owner;
  const addr = r.record.addresses;
  const info = r.record.info;
  const asOf = new Date().toISOString().slice(0, 10);

  const flagRows = r.flags
    .map(
      (f) => `
    <div class="flag">
      <div class="flag-h"><span class="sev" style="background:${SEV_COLOR[f.severity]}">${f.severity}</span>
        <strong>${esc(f.title)}</strong>
        <span class="conf">confidence ${Math.round(f.confidence * 100)}%</span></div>
      <div class="why"><b>Why it matters:</b> ${esc(f.why)}</div>
      <div class="cure"><b>Typical curative step:</b> ${esc(f.curative)}</div>
      <details><summary>Evidence (${f.evidence.length})</summary>
        <pre>${esc(JSON.stringify(f.evidence, null, 2))}</pre></details>
    </div>`
    )
    .join("\n");

  return `<!doctype html><html><head><meta charset="utf-8"><title>Deal-Risk Report ${formatPin(r.pin)}</title>
<style>
 body{font:14px/1.5 -apple-system,Segoe UI,Arial,sans-serif;color:#1a1a1a;max-width:820px;margin:24px auto;padding:0 16px}
 h1{font-size:20px;margin:0 0 2px} .muted{color:#666;font-size:12px}
 .summary{margin:14px 0;padding:10px 14px;background:#f5f7fa;border:1px solid #e2e8f0;border-radius:8px}
 .pill{display:inline-block;padding:2px 8px;border-radius:12px;color:#fff;font-size:12px;margin-right:6px}
 .flag{border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin:10px 0}
 .flag-h{display:flex;align-items:center;gap:8px} .sev{color:#fff;font-size:11px;padding:1px 7px;border-radius:10px}
 .conf{margin-left:auto;color:#888;font-size:11px} .why,.cure{font-size:13px;margin-top:4px}
 pre{background:#0d1117;color:#c9d1d9;padding:8px;border-radius:6px;overflow:auto;font-size:11px}
 .kv{display:grid;grid-template-columns:160px 1fr;gap:2px 12px;font-size:13px}
 footer{margin-top:18px;border-top:1px solid #e2e8f0;padding-top:8px;color:#666;font-size:11px}
 .sources{font-size:11px;color:#555;margin-top:8px}
</style></head><body>
 <h1>Deal-Risk Report</h1>
 <div class="muted">Prepared for ${esc(firm)} · Data as of ${asOf} · PIN ${formatPin(r.pin)}</div>

 <div class="summary">
   <span class="pill" style="background:${SEV_COLOR.HIGH}">HIGH ${r.summary.counts.HIGH}</span>
   <span class="pill" style="background:${SEV_COLOR.MED}">MED ${r.summary.counts.MED}</span>
   <span class="pill" style="background:${SEV_COLOR.INFO}">INFO ${r.summary.counts.INFO}</span>
   <strong>${r.summary.total} item(s) flagged for attorney review.</strong>
 </div>

 <div class="kv">
   <div>Property address</div><div>${esc(addr?.prop_address_full || "—")}</div>
   <div>Vested owner (latest sale)</div><div>${esc(owner?.owner || "—")} ${owner?.deed_type ? `<span class="muted">(${esc(owner.deed_type)}, ${esc((owner.sale_date||"").slice(0,10))}, doc ${esc(owner.via_doc||"—")})</span>` : ""}</div>
   <div>Municipality / class</div><div>${esc(info?.cook_municipality_name || "—")} / ${esc(info?.class || "—")}</div>
   <div>Owner mailing</div><div>${esc(addr?.mail_address_full || "—")}</div>
 </div>

 <h3>Flagged items</h3>
 ${flagRows || "<p>No items detected from the available open-data sources.</p>"}

 <div class="sources"><b>Sources queried:</b><br>${r.sourceStatus
   .map((s) => `${s.ok ? "✓" : "✗"} ${esc(s.source)} — ${s.rows} row(s), ${s.ms}ms${s.error ? " · " + esc(s.error) : ""}`)
   .join("<br>")}</div>

 <footer>${esc(DISCLAIMER)}</footer>
</body></html>`;
}

export function renderTerminal(result) {
  const r = result;
  const lines = [];
  lines.push(`\nDEAL-RISK REPORT  PIN ${r.pinFormatted}  (${r.ms}ms total)`);
  lines.push(`Address : ${r.record.addresses?.prop_address_full || "—"}`);
  lines.push(`Owner   : ${r.record.owner?.owner || "—"}  ${r.record.owner ? `(${r.record.owner.deed_type||""} ${(r.record.owner.sale_date||"").slice(0,10)} doc ${r.record.owner.via_doc||""})` : ""}`);
  lines.push(`Flags   : HIGH ${r.summary.counts.HIGH} · MED ${r.summary.counts.MED} · INFO ${r.summary.counts.INFO}`);
  for (const f of r.flags) lines.push(`  [${f.severity}] ${f.title} (conf ${Math.round(f.confidence*100)}%)`);
  lines.push(`Sources :`);
  for (const s of r.sourceStatus) lines.push(`  ${s.ok ? "✓" : "✗"} ${s.source} — ${s.rows} row(s) ${s.ms}ms ${s.error||""}`);
  return lines.join("\n");
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
