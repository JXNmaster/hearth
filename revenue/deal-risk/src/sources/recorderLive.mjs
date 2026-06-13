// Cook County Clerk's Office — LIVE recordings search (crs.cookcountyclerkil.gov).
// This is the system of record for CURRENT deeds, mortgages, releases/satisfactions,
// liens, lis pendens, etc. Index search is FREE (document images are paid).
//
// Mechanics (reverse-engineered + confirmed working from this environment):
//   1) GET /Search/Additional  -> capture cookies + __RequestVerificationToken
//   2) POST /Search/Additional?Index=%23collapse2 (Grantor/Grantee name panel)
//      body: __RequestVerificationToken, GTName, GTGECode, DocumentTypes,
//            RecordedFromDate, RecordedToDate, submitButton=search
//   3) Results render server-side as an HTML table:
//      View Doc | Doc Number | Doc Recorded | Doc Executed | Doc Type | Consi. Amt.
//              | 1st Grantor | 1st Grantee | Assoc. Doc# | 1st PIN
// Result set caps at 1,000 rows — narrow by date range for prolific names.
import { normPin } from "../normalize.mjs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const BASE = "https://crs.cookcountyclerkil.gov";

function parseSetCookies(res, jar) {
  for (const c of res.headers.getSetCookie?.() || []) {
    const [kv] = c.split(";");
    const i = kv.indexOf("=");
    if (i > 0) jar[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  }
}
const cookieHeader = (jar) => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");

function stripTags(s) {
  return String(s).replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

// Parse the results table that contains a "Doc Number" header.
// The "View Doc" column renders as extra leading cell(s), so column indices are
// not fixed. Anchor on the 10-digit document number and read fields relative to it:
//   [docNo] Recorded | Executed | DocType | Consideration | Grantor | Grantee | (trailing: Assoc Doc# / PIN)
function parseResults(html) {
  const tables = html.match(/<table[\s\S]*?<\/table>/g) || [];
  for (const tbl of tables) {
    const headers = [...tbl.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((x) => stripTags(x[1]));
    if (!headers.some((h) => /Doc Number/i.test(h))) continue;
    const rows = [];
    const trs = tbl.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
    for (const tr of trs) {
      const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => stripTags(c[1]));
      const i = cells.findIndex((c) => /^\d{10}$/.test(c)); // doc-number anchor
      if (i === -1) continue;
      const trailing = cells.slice(i + 7).filter(Boolean);
      rows.push({
        doc_number: cells[i],
        recorded: cells[i + 1] || "",
        executed: cells[i + 2] || "",
        doc_type: cells[i + 3] || "",
        consideration: cells[i + 4] || "",
        grantor: cells[i + 5] || "",
        grantee: cells[i + 6] || "",
        assoc_doc: trailing.find((c) => /^\d{8,}$/.test(c)) || "",
        pin: trailing.find((c) => /\d{2}-?\d{2}-?\d{3}/.test(c)) || trailing[trailing.length - 1] || "",
      });
    }
    return rows;
  }
  return [];
}

// The recorder indexes person names LAST FIRST. Build candidate query strings.
function nameVariants(name) {
  const n = String(name).trim();
  const variants = [n.toUpperCase()];
  const isEntity = /\b(LLC|INC|CORP|TRUST|BANK|ASSOC|COMPANY|CO|LP|LLP|N\.?A\.?)\b/i.test(n);
  const toks = n.split(/\s+/).filter(Boolean);
  if (!isEntity && toks.length === 2) variants.push(`${toks[1]} ${toks[0]}`.toUpperCase());
  if (!isEntity && toks.length === 3) variants.push(`${toks[2]} ${toks[0]} ${toks[1]}`.toUpperCase()); // LAST FIRST MIDDLE
  return [...new Set(variants)];
}

/**
 * Search recordings by grantor/grantee name. Tries name-order variants (the index
 * is LAST FIRST), merges + de-dupes. Optionally filters to the subject PIN.
 */
export async function recorderByName(name, opts = {}) {
  const started = Date.now();
  if (!name) return { ok: false, ms: 0, error: "no name", rows: [] };
  const variants = nameVariants(name);
  const seen = new Map();
  let ok = false, lastErr = null, capped = false;
  for (const v of variants) {
    const r = await searchName(v, opts);
    if (r.ok) { ok = true; capped = capped || r.capped; for (const row of r.rows) if (!seen.has(row.doc_number)) seen.set(row.doc_number, row); }
    else lastErr = r.error;
    if (seen.size) break; // first variant that returns rows wins (avoid extra round-trips)
  }
  return { ok, ms: Date.now() - started, error: ok ? null : lastErr, rows: [...seen.values()], capped };
}

async function searchName(name, { fromDate = "01/01/1985", toDate, subjectPin } = {}) {
  const started = Date.now();
  if (!name) return { ok: false, ms: 0, error: "no name", rows: [] };
  if (!toDate) {
    const d = new Date();
    toDate = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  }
  try {
    const jar = {};
    const g = await fetch(`${BASE}/Search/Additional`, { headers: { "User-Agent": UA } });
    parseSetCookies(g, jar);
    const form = await g.text();
    const tok = form.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/)?.[1];
    if (!tok) return { ok: false, ms: Date.now() - started, error: "no CSRF token", rows: [] };

    const body = new URLSearchParams();
    body.set("__RequestVerificationToken", tok);
    body.set("GTName", String(name).toUpperCase());
    body.set("GTGECode", "");
    body.set("DocumentTypes", "");
    body.set("RecordedFromDate", fromDate);
    body.set("RecordedToDate", toDate);
    body.set("submitButton", "search");

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const p = await fetch(`${BASE}/Search/Additional?Index=%23collapse2`, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookieHeader(jar),
        Referer: `${BASE}/Search/Additional`,
      },
      body: body.toString(),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const html = await p.text();
    if (!p.ok) return { ok: false, ms: Date.now() - started, error: `HTTP ${p.status}`, rows: [] };

    let rows = parseResults(html);
    const capped = /1,000\s+record/i.test(html);
    if (subjectPin) {
      const sp = normPin(subjectPin);
      rows = rows.filter((r) => normPin(r.pin) === sp || !r.pin); // keep PIN match + name-only liens
    }
    return { ok: true, ms: Date.now() - started, error: null, rows, capped };
  } catch (e) {
    return { ok: false, ms: Date.now() - started, error: e.name === "AbortError" ? "timeout" : String(e.message || e), rows: [] };
  }
}

// Classify instruments and match mortgages to releases/satisfactions.
export function analyzeInstruments(rows) {
  const isType = (r, re) => re.test(r.doc_type || "");
  const mortgages = rows.filter((r) => isType(r, /MORTGAGE/i) && !isType(r, /RELEASE|SATISF|ASSIGN/i));
  const releases = rows.filter((r) => isType(r, /RELEASE|SATISFACTION/i));
  const liens = rows.filter((r) => isType(r, /LIEN/i));
  const lisPendens = rows.filter((r) => isType(r, /LIS PENDENS/i));
  const judgments = rows.filter((r) => isType(r, /JUDG/i));
  const deeds = rows.filter((r) => isType(r, /DEED/i) && !isType(r, /TRUST DEED/i));

  // A mortgage is "possibly open" if no release references its doc number (via Assoc. Doc#).
  const releasedDocs = new Set(releases.map((r) => (r.assoc_doc || "").replace(/\D/g, "")).filter(Boolean));
  const openMortgages = mortgages.filter((m) => !releasedDocs.has((m.doc_number || "").replace(/\D/g, "")));

  return { mortgages, releases, openMortgages, liens, lisPendens, judgments, deeds, total: rows.length };
}
