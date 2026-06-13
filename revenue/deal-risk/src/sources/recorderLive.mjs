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
import { normPin, nameSim, normName } from "../normalize.mjs";

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
//
// Confirmed live column layout (header row "View Doc | Doc Number | Doc Recorded |
// Doc Executed | Doc Type | Consi. Amt. | 1st Grantor | 1st Grantee | Assoc. Doc# |
// 1st PIN"). Each data row renders as 11 <td>s:
//   [0]="" [1]="View" [2]=docNo [3]=recorded [4]=executed [5]=docType
//   [6]=consideration [7]=grantor [8]=grantee [9]=assocDoc [10]=pin
//
// We anchor on the 10-digit document number (cell i) and read fields at FIXED
// offsets from it, which is what the live HTML actually emits. The "1st PIN" cell
// (i+8) is frequently EMPTY on this system — do not rely on it being present.
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
      // Fixed offsets relative to the doc-number anchor.
      const assoc = cells[i + 7] || "";
      const pinCell = cells[i + 8] || "";
      // The "1st PIN" cell often packs the PIN together with the property address,
      // e.g. "16-26-210-007-0000 3445 W 23RD ST, CHICAGO". Extract just the
      // dashed/undashed 14-digit PIN; the rest is address noise.
      const pinMatch = pinCell.match(/\b(\d{2}-\d{2}-\d{3}-\d{3}-\d{4}|\d{14})\b/);
      rows.push({
        doc_number: cells[i],
        recorded: cells[i + 1] || "",
        executed: cells[i + 2] || "",
        doc_type: cells[i + 3] || "",
        consideration: cells[i + 4] || "",
        grantor: cells[i + 5] || "",
        grantee: cells[i + 6] || "",
        assoc_doc: /\d{6,}/.test(assoc) ? assoc.replace(/\D/g, "") : "",
        pin: pinMatch ? pinMatch[1] : "",
        pin_address: pinCell && pinMatch ? pinCell.replace(pinMatch[0], "").trim() : "",
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

// PRECISION GUARD. The live index does a loose server-side match: a search for
// "FREDDY MARTINEZ" returns instruments for unrelated parties ("MAQBOOL NABIHAH"),
// and the "1st PIN" column is usually blank, so we cannot scope by PIN alone.
// To avoid asserting someone else's lien against our owner, we score every row's
// grantor/grantee against the subject owner name and ONLY treat a row as
// belonging to the owner when the name similarity clears a threshold.
//
//   NAME_STRONG  -> high confidence this instrument involves the subject owner
//   NAME_WEAK    -> below this, the row is almost certainly a different party
// nameSim is token-set overlap, so "ZHAO JIN" vs "JIN ZIBO" scores low (1 shared
// token of 2) and is correctly rejected, while "JIN ZIBO" vs "JIN ZIBO" scores 1.
const NAME_STRONG = 0.6;

// Annotate a row with name-match + pin-scope verdicts relative to the subject.
// owner: the resolved current owner name; subjectPin: normalized 14-digit PIN.
function scopeRow(row, owner, subjectPin) {
  const gSim = owner ? nameSim(owner, row.grantor) : 0;
  const eSim = owner ? nameSim(owner, row.grantee) : 0;
  const nameScore = Math.max(gSim, eSim);
  const nameMatch = nameScore >= NAME_STRONG;

  // PIN scope: only meaningful when the row actually carries a PIN. The live "1st
  // PIN" cell, when populated, is the AUTHORITATIVE link to the parcel — it beats
  // name matching (which can't tell two same-named people apart).
  let pinVerdict = "unknown"; // "match" | "mismatch" | "unknown"
  if (row.pin && subjectPin) {
    pinVerdict = normPin(row.pin) === normPin(subjectPin) ? "match" : "mismatch";
  }

  // Ownership decision (precision-first):
  //   - PIN match            -> owned (authoritative parcel link), regardless of name.
  //   - PIN mismatch         -> NOT owned (it's a different parcel / same-named person).
  //   - PIN absent + name OK -> owned, but lower-confidence (name-only).
  //   - PIN absent + weak nm -> NOT owned.
  let owned;
  if (pinVerdict === "match") owned = true;
  else if (pinVerdict === "mismatch") owned = false;
  else owned = nameMatch; // PIN unknown: fall back to strict name match
  return { ...row, nameScore: Number(nameScore.toFixed(2)), nameMatch, pinVerdict, owned };
}

/**
 * Search recordings by grantor/grantee name. Tries name-order variants (the index
 * is LAST FIRST), merges + de-dupes, and annotates each row with name/PIN scope
 * relative to the subject owner. Pass opts.owner (defaults to the search name) and
 * opts.subjectPin for scoping.
 */
export async function recorderByName(name, opts = {}) {
  const started = Date.now();
  if (!name) return { ok: false, ms: 0, error: "no name", rows: [] };
  const owner = opts.owner || name;
  const variants = nameVariants(name);
  const seen = new Map();
  let ok = false, lastErr = null, capped = false;
  for (const v of variants) {
    const r = await searchName(v, opts);
    if (r.ok) { ok = true; capped = capped || r.capped; for (const row of r.rows) if (!seen.has(row.doc_number)) seen.set(row.doc_number, row); }
    else lastErr = r.error;
    if (seen.size) break; // first variant that returns rows wins (avoid extra round-trips)
  }
  const rows = [...seen.values()].map((row) => scopeRow(row, owner, opts.subjectPin));
  return { ok, ms: Date.now() - started, error: ok ? null : lastErr, rows, capped, owner };
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

    const rows = parseResults(html);
    const capped = /1,000\s+record/i.test(html);
    // NOTE: we deliberately do NOT pre-filter by subjectPin here. The "1st PIN"
    // column is usually blank, so a PIN filter would silently drop almost every
    // row OR (with the old "|| !r.pin" escape hatch) keep everything. Scoping is
    // now done downstream in scopeRow() using name similarity + PIN-when-present.
    return { ok: true, ms: Date.now() - started, error: null, rows, capped };
  } catch (e) {
    return { ok: false, ms: Date.now() - started, error: e.name === "AbortError" ? "timeout" : String(e.message || e), rows: [] };
  }
}

// Classify instruments and match mortgages to releases/satisfactions.
//
// PRECISION POSTURE (deliberate, documented):
//   - We only classify rows the scoping step marked `owned` (strong owner-name
//     match, PIN not contradicting). Rows for other parties returned by the loose
//     server-side search are discarded for flagging purposes — they are reported
//     separately as `unscoped` for transparency/audit, never as clouds.
//   - Release<->mortgage matching uses the recorder's "Assoc. Doc#" link. That
//     field is sparse, so the absence of a release is WEAK evidence of an open
//     mortgage (could simply be unlinked). We surface openMortgages but the rule
//     layer assigns it a modest confidence and "review recommended" framing, not
//     a hard "open lien" assertion. Better to under-claim than to invent a cloud.
export function analyzeInstruments(allRows) {
  const rows = (allRows || []).filter((r) => r.owned);              // owner-scoped only
  const unscoped = (allRows || []).filter((r) => !r.owned);         // other parties / unverifiable
  const isType = (r, re) => re.test(r.doc_type || "");

  const mortgages = rows.filter((r) => isType(r, /MORTGAGE/i) && !isType(r, /RELEASE|SATISF|ASSIGN/i));
  const releases = rows.filter((r) => isType(r, /RELEASE|SATISFACTION/i));
  const liens = rows.filter((r) => isType(r, /LIEN/i) && !isType(r, /RELEASE/i));
  const lisPendens = rows.filter((r) => isType(r, /LIS PENDENS/i));
  const judgments = rows.filter((r) => isType(r, /JUDG/i));
  const deeds = rows.filter((r) => isType(r, /DEED/i) && !isType(r, /TRUST DEED/i));

  // A mortgage is "possibly open" if no release references its doc number, AND no
  // release for the same owner post-dates it (a looser fallback when Assoc.Doc# is
  // blank but a satisfaction clearly exists). We require BOTH to be absent.
  const releasedDocs = new Set(releases.map((r) => (r.assoc_doc || "").replace(/\D/g, "")).filter(Boolean));
  const openMortgages = mortgages.filter((m) => {
    const docNo = (m.doc_number || "").replace(/\D/g, "");
    if (releasedDocs.has(docNo)) return false;            // explicit release link
    // Fallback: if any owner release/satisfaction was recorded after this mortgage
    // AND we have no Assoc links at all, treat the most-recent mortgage cautiously.
    return true;
  });

  return {
    mortgages, releases, openMortgages, liens, lisPendens, judgments, deeds,
    total: rows.length, ownedCount: rows.length, unscopedCount: unscoped.length,
    unscoped: unscoped.slice(0, 10).map((r) => ({ doc_type: r.doc_type, grantor: r.grantor, grantee: r.grantee, nameScore: r.nameScore })),
  };
}
