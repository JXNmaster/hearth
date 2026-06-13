// Agent-facing "Deal-Risk Report" edition.
//
// This is the LEAD-MAGNET version: a print-ready, branded, plain-English report a
// listing agent actually wants to read. Design constraints (from the business):
//   - plain English, not legalese — agents are not title examiners
//   - NEVER assert a false cloud; uncertain items read as "worth a quick check",
//     not "your deal is broken". We translate severity into a traffic light.
//   - a soft CTA ("typical clearance in 24 hours — contact [firm]")
//   - the required compliance disclaimer in every report
//   - print-to-PDF clean via @media print (no Playwright; print-CSS only for v1).
//
// Server-side PDF rendering is a later step (note in VALIDATION.md). For now,
// "Print to PDF" from a browser on this HTML produces a clean one/two-pager.

import { formatPin } from "./normalize.mjs";

const DISCLAIMER =
  "This complimentary Deal-Risk Report is prepared from public records as preliminary " +
  "attorney work product. It is NOT a title commitment, title insurance, an abstract of " +
  "title, or legal advice, and it does not guarantee that title is clear. Public-record " +
  "data is incomplete and may lag actual filings. Any items noted are for review with " +
  "counsel before closing.";

// Map our internal flag codes to plain-English, agent-friendly language.
// `slow`: short label for "what could slow this closing".
// `note`: one calm sentence — never alarming, never a false certainty.
const AGENT_COPY = {
  TAX_SALE_ANNUAL:   { slow: "Unpaid property taxes were sold at a tax sale", note: "The taxes will need to be redeemed (paid off) before closing. This is common and usually clears quickly once addressed." },
  TAX_SALE_SCAVENGER:{ slow: "A multi-year tax delinquency is on record", note: "Several years of back taxes appear unpaid. Worth confirming the payoff/redemption status early so it doesn't surprise anyone at closing." },
  FORECLOSURE_RECORD:{ slow: "An older foreclosure-related filing is on record", note: "This is from historical records (2011–2015) and may already be resolved. A quick current search confirms its status." },
  MORTGAGE_UNVERIFIED_RELEASE: { slow: "An older mortgage's payoff isn't confirmed in free records", note: "We can confirm whether it was paid off and released. Routine to check." },
  QUITCLAIM_IN_CHAIN:{ slow: "A quitclaim deed appears in the ownership history", note: "Quitclaim deeds carry no warranty, so the chain of ownership is worth a closer look. Often perfectly fine." },
  RAPID_RESALE:      { slow: "The property changed hands twice in a short window", note: "Just context — quick resales sometimes warrant a second look at the paperwork." },
  VESTING_MISMATCH:  { slow: "The seller's name doesn't match the last recorded owner", note: "We'll want to confirm the seller has authority to sell (e.g., trust, estate, or a recent unrecorded transfer)." },
  OPEN_MORTGAGE_LIVE:{ slow: "A mortgage may still be open on the property", note: "We didn't find a recorded release for it. Usually just needs a payoff confirmed — standard at closing." },
  LIS_PENDENS_LIVE:  { slow: "A pending legal filing (lis pendens) is tied to the owner", note: "This often signals litigation such as a foreclosure. Worth confirming its current status early." },
  LIEN_JUDGMENT_LIVE:{ slow: "A lien or judgment is recorded against the owner's name", note: "We'll verify it's the same person and whether it's been satisfied. Many resolve with a simple payoff/release." },
  ABSENTEE_OWNER:    { slow: "The owner's mailing address is elsewhere", note: "Not a problem — just useful context (out-of-area or investor owner)." },
};

// Traffic light: GREEN (nothing notable), YELLOW (a few items to check),
// RED (a high-severity item that genuinely needs attention before closing).
// We are deliberately conservative: a single HIGH -> RED, otherwise MED/INFO -> YELLOW.
function trafficLight(summary) {
  if (summary.counts.HIGH > 0) {
    return { color: "#c62828", label: "Needs a closer look", lead: "We spotted at least one item that should be cleared before closing." };
  }
  if (summary.counts.MED > 0 || summary.counts.INFO > 0) {
    return { color: "#f29900", label: "A few quick checks", lead: "Nothing alarming — just a handful of items worth confirming." };
  }
  return { color: "#2e7d32", label: "Looking clean", lead: "We didn't surface anything notable in the public record. A full title search still applies." };
}

export function renderAgentHtml(result, opts = {}) {
  const firm = opts.firm || "[Your Firm Name]";
  const firmContact = opts.firmContact || "[email / phone]";
  const agentName = opts.agentName || "";
  const r = result;
  const addr = r.record.addresses;
  const owner = r.record.owner;
  const asOf = new Date().toISOString().slice(0, 10);
  const light = trafficLight(r.summary);

  // Build the "what could slow this closing" list (agent language). We sort by
  // severity (HIGH first) and translate. Unknown codes fall back to the title.
  const items = r.flags.map((f) => {
    const copy = AGENT_COPY[f.code] || { slow: f.title, note: f.why };
    return { sev: f.severity, slow: copy.slow, note: copy.note };
  });

  const sevDot = { HIGH: "#c62828", MED: "#f29900", INFO: "#2e7d32" };

  const itemRows = items.length
    ? items.map((it) => `
      <li class="item">
        <span class="dot" style="background:${sevDot[it.sev]}"></span>
        <div><div class="item-h">${esc(it.slow)}</div>
        <div class="item-n">${esc(it.note)}</div></div>
      </li>`).join("\n")
    : `<li class="item"><span class="dot" style="background:${sevDot.INFO}"></span>
        <div><div class="item-h">Nothing notable surfaced in the public record.</div>
        <div class="item-n">A full title search is still recommended before closing.</div></div></li>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Deal-Risk Report — ${esc(addr?.prop_address_full || formatPin(r.pin))}</title>
<style>
 :root{ --ink:#1f2933; --muted:#6b7280; --line:#e5e7eb; }
 *{box-sizing:border-box}
 body{font:15px/1.55 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:var(--ink);margin:0;background:#f3f4f6}
 .page{max-width:760px;margin:24px auto;background:#fff;border:1px solid var(--line);border-radius:12px;padding:28px 32px}
 .brand{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid var(--ink);padding-bottom:12px;margin-bottom:18px}
 .brand .firm{font-size:20px;font-weight:700}
 .brand .tag{font-size:12px;color:var(--muted)}
 h1{font-size:22px;margin:6px 0 2px}
 .sub{color:var(--muted);font-size:13px;margin-bottom:18px}
 .light{display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:10px;background:#fafafa;border:1px solid var(--line);margin:16px 0}
 .light .bulb{width:42px;height:42px;border-radius:50%;flex:0 0 auto;box-shadow:0 0 0 4px rgba(0,0,0,.04)}
 .light .label{font-weight:700;font-size:16px}
 .light .lead{color:var(--muted);font-size:13px}
 .facts{display:grid;grid-template-columns:150px 1fr;gap:4px 14px;font-size:14px;margin:14px 0 6px}
 .facts .k{color:var(--muted)}
 h2{font-size:16px;margin:22px 0 8px;border-bottom:1px solid var(--line);padding-bottom:4px}
 ul.items{list-style:none;margin:0;padding:0}
 .item{display:flex;gap:12px;padding:10px 0;border-bottom:1px dashed var(--line)}
 .item:last-child{border-bottom:none}
 .dot{width:12px;height:12px;border-radius:50%;margin-top:5px;flex:0 0 auto}
 .item-h{font-weight:600}
 .item-n{color:var(--muted);font-size:13px;margin-top:2px}
 .cta{margin:22px 0 6px;padding:16px 18px;background:#0f3d3e;color:#fff;border-radius:10px}
 .cta b{font-size:16px}
 .cta .small{opacity:.85;font-size:13px;margin-top:4px}
 footer{margin-top:20px;border-top:1px solid var(--line);padding-top:10px;color:var(--muted);font-size:11px;line-height:1.4}
 @media print{
   body{background:#fff}
   .page{border:none;border-radius:0;margin:0;max-width:none;padding:0 4px}
   .cta{ -webkit-print-color-adjust:exact; print-color-adjust:exact }
   .light,.dot,.bulb{ -webkit-print-color-adjust:exact; print-color-adjust:exact }
   a{color:inherit;text-decoration:none}
   h2{break-after:avoid}
   .item{break-inside:avoid}
 }
</style></head><body>
<div class="page">
  <div class="brand">
    <div><div class="firm">${esc(firm)}</div><div class="tag">Complimentary Deal-Risk Report</div></div>
    <div class="tag" style="text-align:right">Prepared ${asOf}${agentName ? `<br>for ${esc(agentName)}` : ""}</div>
  </div>

  <h1>${esc(addr?.prop_address_full || "Subject Property")}</h1>
  <div class="sub">${esc([addr?.prop_address_city_name, addr?.prop_address_state, addr?.prop_address_zipcode_1].filter(Boolean).join(", "))} · PIN ${formatPin(r.pin)}</div>

  <div class="light">
    <div class="bulb" style="background:${light.color}"></div>
    <div><div class="label">${esc(light.label)}</div><div class="lead">${esc(light.lead)}</div></div>
  </div>

  <div class="facts">
    <div class="k">Property</div><div>${esc(addr?.prop_address_full || "—")}</div>
    <div class="k">Owner of record</div><div>${esc(owner?.owner || "Not clearly established in public data")}</div>
    <div class="k">Items to review</div><div>${r.summary.total} (${r.summary.counts.HIGH} priority)</div>
  </div>

  <h2>What could slow this closing</h2>
  <ul class="items">${itemRows}</ul>

  <div class="cta">
    <b>Most of these clear in about 24 hours.</b>
    <div class="small">Want us to take care of it? We pre-clear title issues like these every day.
    Reach out to <strong>${esc(firm)}</strong> at ${esc(firmContact)} and we'll handle the rest.</div>
  </div>

  <footer>${esc(DISCLAIMER)}</footer>
</div>
</body></html>`;
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
