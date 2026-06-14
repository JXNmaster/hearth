#!/usr/bin/env node
// Outreach layer (EMAIL ONLY) — sends each agent-edition Deal-Risk Report to the
// listing agent. Reads the batch runner's ./out/summary.csv. Zero-dependency:
// native fetch → Resend REST API (https://api.resend.com/emails).
//
// SAFETY / COMPLIANCE (deliberate, do not weaken):
//   • DRY-RUN BY DEFAULT. Nothing is sent unless you pass --send.
//   • EMAIL ONLY. There is no SMS path here, on purpose (cold-texting MLS
//     numbers is a TCPA liability — HANDOFF §1).
//   • Skips any row with no/invalid agent_email — so it's harmless to run before
//     agent emails exist in the feed (it just reports "0 eligible").
//   • CAN-SPAM: refuses to --send unless FIRM_NAME + FIRM_ADDRESS (physical
//     postal address) are set; every email carries the firm's address, a clear
//     opt-out line, and a List-Unsubscribe header. Honors a suppression list.
//   • Dedup: never emails the same (agent_email, PIN) twice (sent-log).
//
// Env: RESEND_API_KEY, EMAIL_FROM ("Firm <noreply@firm.com>"), FIRM_NAME,
//      FIRM_ADDRESS, OPTOUT_EMAIL (defaults to EMAIL_FROM address).
// Usage:
//   node src/outreach/send.mjs --summary ./out/summary.csv            # dry-run
//   node src/outreach/send.mjs --summary ./out/summary.csv --send     # live
//   node src/outreach/send.mjs --summary ./out/summary.csv --limit 5 --send

import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

// ---------- tiny CSV (same dialect as batch.mjs) ----------
function parseCsv(text) {
  const rows = []; let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
    else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim() !== ""));
}
function toObjects(rows) {
  if (!rows.length) return [];
  const h = rows[0].map((x) => x.trim().toLowerCase());
  return rows.slice(1).map((r) => { const o = {}; h.forEach((k, i) => (o[k] = (r[i] ?? "").trim())); return o; });
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

function loadLines(path) {
  if (!path || !existsSync(path)) return new Set();
  return new Set(readFileSync(path, "utf8").split(/\r?\n/).map((l) => l.trim().toLowerCase()).filter(Boolean).filter((l) => !l.startsWith("#")));
}

// Email body: short, branded teaser + CAN-SPAM footer. The full report is attached.
function renderEmail({ row, firm, firmAddress, optoutEmail }) {
  const addr = row.address || "your new listing";
  const high = Number(row.high || 0), med = Number(row.med || 0);
  const flagsLine = (high + med) > 0
    ? `Our preliminary public-records pre-check flagged <b>${high} higher-priority</b> and <b>${med} secondary</b> item(s) worth a look before closing.`
    : `Our preliminary public-records pre-check didn't surface any higher-priority clouds — a clean early read.`;
  const subject = (high + med) > 0
    ? `Deal-Risk pre-check: ${high + med} item(s) to review on ${addr}`
    : `Deal-Risk pre-check on ${addr} — early read`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;font-size:15px;color:#1f2937;line-height:1.55;max-width:560px">
  <p>Hi${row.agent_name ? " " + esc(row.agent_name.split(/\\s+/)[0]) : ""},</p>
  <p>Congrats on the new listing at <b>${esc(addr)}</b>. As a courtesy, ${esc(firm)} ran a fast, free <b>Deal-Risk / title pre-clearance</b> screen from public county records so you can spot anything that might slow the closing — early, while there's time to fix it.</p>
  <p>${flagsLine}</p>
  <p>The one-page report is attached. It's a preliminary screen from public records — <i>not</i> a title commitment, title insurance, or legal advice — but it's the kind of early look that keeps a deal on schedule.</p>
  <p>Happy to walk through it or help clear anything flagged. Just reply.</p>
  <p style="margin-top:18px">— ${esc(firm)}</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
  <p style="font-size:12px;color:#6b7280">
    ${esc(firm)} · ${esc(firmAddress)}<br/>
    You received this because you're the listing agent on a public MLS listing. To stop receiving these, reply "STOP" or email <a href="mailto:${esc(optoutEmail)}?subject=unsubscribe">${esc(optoutEmail)}</a> and we'll remove you promptly.
  </p>
</div>`;
  return { subject, html };
}

async function sendViaResend({ apiKey, from, to, subject, html, attachment, optoutEmail }) {
  const body = {
    from, to: [to], subject, html,
    headers: { "List-Unsubscribe": `<mailto:${optoutEmail}?subject=unsubscribe>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
  if (attachment) body.attachments = [attachment];
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`Resend ${res.status}: ${txt.slice(0, 300)}`);
  try { return JSON.parse(txt).id || "sent"; } catch { return "sent"; }
}

async function main() {
  const argv = process.argv.slice(2); const opt = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1]?.startsWith("--") || argv[i + 1] === undefined ? true : argv[++i];

  const summaryPath = (typeof opt.summary === "string" && opt.summary) || "./out/summary.csv";
  const live = !!opt.send;
  const limit = opt.limit ? Number(opt.limit) : Infinity;
  if (!existsSync(summaryPath)) { console.error(`summary not found: ${summaryPath} (run batch.mjs first)`); process.exit(1); }

  const firm = process.env.FIRM_NAME || "";
  const firmAddress = process.env.FIRM_ADDRESS || "";
  const from = process.env.EMAIL_FROM || "";
  const apiKey = process.env.RESEND_API_KEY || "";
  const optoutEmail = process.env.OPTOUT_EMAIL || (from.match(/<([^>]+)>/)?.[1]) || from;

  // CAN-SPAM / safety gate for live sends.
  if (live) {
    const missing = [["RESEND_API_KEY", apiKey], ["EMAIL_FROM", from], ["FIRM_NAME", firm], ["FIRM_ADDRESS", firmAddress]].filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) { console.error(`--send refused: missing ${missing.join(", ")} (CAN-SPAM requires firm identity + physical address).`); process.exit(1); }
  }

  const outDir = dirname(summaryPath);
  const suppress = loadLines(join(outDir, "suppression.txt"));
  const sentLogPath = join(outDir, "sent-log.csv");
  const alreadySent = new Set();
  if (existsSync(sentLogPath)) for (const r of toObjects(parseCsv(readFileSync(sentLogPath, "utf8")))) alreadySent.add(`${(r.agent_email || "").toLowerCase()}|${r.pin}`);
  else writeFileSync(sentLogPath, "agent_email,pin,mls,sent_at,mode,result\n");

  const rows = toObjects(parseCsv(readFileSync(summaryPath, "utf8")));
  const stats = { total: rows.length, eligible: 0, no_email: 0, suppressed: 0, dup: 0, sent: 0, failed: 0, skipped_status: 0 };
  console.log(`Outreach ${live ? "LIVE SEND" : "DRY-RUN"} over ${rows.length} summary row(s) from ${summaryPath}\n`);

  for (const row of rows) {
    if (stats.sent >= limit) break;
    if ((row.status || "").toLowerCase() !== "ok") { stats.skipped_status++; continue; }
    const email = (row.agent_email || "").toLowerCase();
    if (!email || !EMAIL_RE.test(email)) { stats.no_email++; continue; }
    if (suppress.has(email)) { stats.suppressed++; continue; }
    const key = `${email}|${row.pin}`;
    if (alreadySent.has(key)) { stats.dup++; continue; }
    stats.eligible++;

    const { subject, html } = renderEmail({ row, firm: firm || "[FIRM NAME]", firmAddress: firmAddress || "[FIRM ADDRESS]", optoutEmail: optoutEmail || "[optout@firm]" });
    let attachment = null;
    if (row.report_path && existsSync(row.report_path)) {
      attachment = { filename: `deal-risk-${row.pin}.html`, content: readFileSync(row.report_path).toString("base64") };
    }

    if (!live) {
      console.log(`  DRY  ${email}  PIN ${row.pin}  "${subject}"${attachment ? " (+report)" : " (no report file)"}`);
      continue;
    }
    try {
      const id = await sendViaResend({ apiKey, from, to: email, subject, html, attachment, optoutEmail });
      appendFileSync(sentLogPath, `${email},${row.pin},${row.mls || ""},${new Date().toISOString()},live,${id}\n`);
      alreadySent.add(key); stats.sent++;
      console.log(`  SENT ${email}  PIN ${row.pin}  id=${id}`);
    } catch (e) {
      appendFileSync(sentLogPath, `${email},${row.pin},${row.mls || ""},${new Date().toISOString()},live,ERROR\n`);
      stats.failed++; console.log(`  FAIL ${email}  PIN ${row.pin}  ${String(e.message || e).slice(0, 160)}`);
    }
  }

  console.log(`\n${live ? "Sent" : "Would send"}: ${live ? stats.sent : stats.eligible}` +
    `  | no_email: ${stats.no_email}  suppressed: ${stats.suppressed}  already_sent: ${stats.dup}` +
    `  not_ok: ${stats.skipped_status}` + (live ? `  failed: ${stats.failed}` : ""));
  if (!live) console.log(`(dry-run — re-run with --send to actually email; ${stats.no_email} row(s) have no agent email yet.)`);
}

main();
