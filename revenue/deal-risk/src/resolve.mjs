// Address -> PIN resolution, hardened.
//
// Agents type addresses, not PINs. This module tokenizes a free-text street
// address (number / directional / name / suffix / unit), queries the Assessor
// "Parcel Addresses" dataset (3723-97qp) robustly, then ranks + dedupes the
// candidate PINs and decides whether we have a confident single match or an
// ambiguous set the caller must disambiguate.
//
// Design notes / gotchas baked in here:
//   - prop_address_full is a single string like "4501 N DAMEN AVE 146" where the
//     trailing token is the UNIT for condos. There is no separate unit column, so
//     unit handling is string-level.
//   - The dataset has one row per (pin, year); we keep the most recent year per PIN.
//   - We never silently pick a winner when the field is genuinely ambiguous (e.g.
//     a multi-unit building where the agent gave no unit). False precision here =
//     wrong owner = wrong report = a false cloud. Precision over recall.

import { soda, soqlLit } from "./socrata.mjs";
import { normPin } from "./normalize.mjs";

const ADDRESSES = "3723-97qp";

// USPS-ish street-suffix synonyms -> canonical token. Kept small + practical;
// the goal is to match the way Cook County stores suffixes (mostly abbreviated).
const SUFFIX = new Map(Object.entries({
  STREET: "ST", ST: "ST",
  AVENUE: "AVE", AVE: "AVE", AV: "AVE",
  ROAD: "RD", RD: "RD",
  DRIVE: "DR", DR: "DR",
  BOULEVARD: "BLVD", BLVD: "BLVD", BLV: "BLVD",
  COURT: "CT", CT: "CT",
  LANE: "LN", LN: "LN",
  PLACE: "PL", PL: "PL",
  TERRACE: "TER", TER: "TER", TERR: "TER",
  PARKWAY: "PKWY", PKWY: "PKWY", PKY: "PKWY",
  WAY: "WAY",
  CIRCLE: "CIR", CIR: "CIR",
  TRAIL: "TRL", TRL: "TRL",
  HIGHWAY: "HWY", HWY: "HWY",
  SQUARE: "SQ", SQ: "SQ",
  PARK: "PARK",
}));

const DIRECTIONAL = new Map(Object.entries({
  NORTH: "N", N: "N",
  SOUTH: "S", S: "S",
  EAST: "E", E: "E",
  WEST: "W", W: "W",
  NORTHEAST: "NE", NE: "NE",
  NORTHWEST: "NW", NW: "NW",
  SOUTHEAST: "SE", SE: "SE",
  SOUTHWEST: "SW", SW: "SW",
}));

// Tokens that introduce a unit/apt designator. The value after one of these
// (or a bare trailing number after the suffix) is treated as the unit.
const UNIT_WORDS = /^(UNIT|APT|APARTMENT|STE|SUITE|#|NO|FL|FLOOR)$/;

/**
 * Tokenize a raw address string into { number, dir, name, suffix, unit }.
 * Robust to: missing directionals, missing suffix, "#3B" / "UNIT 3B" / trailing
 * "AVE 146" condo style, and extra whitespace/punctuation.
 */
export function tokenizeAddress(raw) {
  const cleaned = String(raw || "")
    .toUpperCase()
    .replace(/[.,]/g, " ")
    .replace(/#\s*/g, "# ")     // ensure "#3B" -> "# 3B"
    .replace(/[^A-Z0-9# ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return { number: "", dir: "", name: "", suffix: "", unit: "", raw: cleaned };

  let toks = cleaned.split(" ").filter(Boolean);

  // Trailing 5-digit ZIP (and "CITY, IL 60618" style state). Pull it off the end
  // so it isn't mistaken for a unit. We surface it as `zip` for the caller to use
  // as a disambiguating filter.
  let zip = "";
  if (toks.length && /^\d{5}$/.test(toks[toks.length - 1])) zip = toks.pop();
  if (toks.length && /^IL$/.test(toks[toks.length - 1])) toks.pop(); // drop trailing state

  // Street number: leading token that is mostly digits (allow "123A").
  let number = "";
  if (toks.length && /^\d+[A-Z]?$/.test(toks[0])) { number = toks.shift(); }

  // Explicit unit anywhere: "UNIT 3B", "APT 2", "# 4", "STE 200".
  let unit = "";
  for (let i = 0; i < toks.length; i++) {
    if (UNIT_WORDS.test(toks[i])) {
      unit = toks.slice(i + 1).join(" ").trim();
      toks = toks.slice(0, i);
      break;
    }
  }

  // Leading directional.
  let dir = "";
  if (toks.length && DIRECTIONAL.has(toks[0])) { dir = DIRECTIONAL.get(toks.shift()); }

  // Trailing tokens: figure out suffix and any trailing bare unit (condo style).
  // Walk from the end: a final bare number/short alnum after a suffix is a unit.
  let suffix = "";
  // If there's a trailing token that is a unit-ish bare value AND a suffix before it.
  if (toks.length >= 2) {
    const last = toks[toks.length - 1];
    const beforeLast = toks[toks.length - 2];
    const lastIsUnitish = /^\d+[A-Z]?$/.test(last) || /^[A-Z]\d+$/.test(last);
    if (lastIsUnitish && SUFFIX.has(beforeLast)) {
      if (!unit) unit = last;
      toks = toks.slice(0, -1);
    }
  }
  // Now trailing suffix.
  if (toks.length >= 2 && SUFFIX.has(toks[toks.length - 1])) {
    suffix = SUFFIX.get(toks[toks.length - 1]);
    toks = toks.slice(0, -1);
  }
  // Trailing directional that some records carry (e.g. "60TH ST" no — leave alone).

  const name = toks.join(" ").trim();
  return { number, dir, name, suffix, unit, zip, raw: cleaned };
}

// Build the canonical "number dir name suffix" core (no unit) for comparison.
function coreString(t) {
  return [t.number, t.dir, t.name, t.suffix].filter(Boolean).join(" ").trim();
}

// Compare a query token-set against a candidate's parsed full address. Returns a
// score 0..1 plus boolean component matches used for ranking + confidence.
function scoreCandidate(q, candFull) {
  const c = tokenizeAddress(candFull);
  let score = 0;
  const parts = {};

  // Street number is the strongest anchor — must match to score meaningfully.
  parts.number = q.number && c.number && q.number === c.number;
  if (parts.number) score += 0.45;
  else if (q.number && c.number && q.number !== c.number) return { score: 0, parts, cand: c };

  // Street name (the discriminating text).
  parts.name = q.name && c.name && q.name === c.name;
  if (parts.name) score += 0.30;
  else if (q.name && c.name) {
    // partial: all query name tokens present in candidate name
    const qn = q.name.split(" "), cn = new Set(c.name.split(" "));
    if (qn.every((w) => cn.has(w))) { score += 0.18; parts.name = "partial"; }
  }

  // Directional: reward match, lightly penalize a real conflict.
  if (q.dir && c.dir) { if (q.dir === c.dir) { score += 0.1; parts.dir = true; } else { score -= 0.15; parts.dir = false; } }
  else { score += 0.03; } // missing on either side: neutral-ish

  // Suffix.
  if (q.suffix && c.suffix) { if (q.suffix === c.suffix) { score += 0.07; parts.suffix = true; } else { parts.suffix = false; } }
  else { score += 0.02; }

  // Unit: if the query specified a unit, the candidate's unit must match to be
  // the right parcel. If it doesn't, this is a different unit -> heavily penalize.
  if (q.unit) {
    if (c.unit && c.unit === q.unit) { score += 0.12; parts.unit = true; }
    else { score -= 0.25; parts.unit = false; }
  } else if (c.unit) {
    // Query gave no unit but candidate is a specific unit: this is the
    // multi-unit ambiguity case. Don't reward; flag it.
    parts.unitAmbiguous = true;
  }

  return { score: Math.max(0, Math.min(1, score)), parts, cand: c };
}

/**
 * Resolve a free-text address to ranked PIN candidates.
 *
 * Returns:
 *   {
 *     ok, ms, error,
 *     status: "match" | "ambiguous" | "none" | "error",
 *     pin,                         // best PIN when status === "match"
 *     confidence,                  // 0..1 for the chosen/best candidate
 *     candidates: [{ pin, address, city, zip, year, score, parts }...],
 *     query: <parsed tokens>,
 *     reason,                      // human-readable note (esp. for ambiguous)
 *   }
 */
export async function resolveAddress(address, { zip, city, limit = 60, minScore = 0.6 } = {}) {
  const q = tokenizeAddress(address);
  if (!q.number || !q.name) {
    return { ok: false, status: "error", error: "could not parse a street number + name from address", query: q, candidates: [] };
  }
  // A ZIP embedded in the address string disambiguates as well as an explicit one.
  if (!zip && q.zip) zip = q.zip;

  // Query strategy: anchor on the street NUMBER + a LIKE on the street NAME token.
  // We avoid leading-% on the whole string (slow + imprecise). The number prefix
  // is exact; the name is matched with a contains to tolerate suffix/dir variance.
  // We pull a generous candidate set and rank locally.
  const nameNeedle = q.name.split(" ")[0] || q.name; // most-distinctive name token
  const whereParts = [
    `prop_address_full like '${soqlLit(q.number)} %'`,
    `upper(prop_address_full) like '%${soqlLit(nameNeedle)}%'`,
  ];
  if (zip) whereParts.push(`prop_address_zipcode_1 = '${soqlLit(String(zip))}'`);
  if (city) whereParts.push(`upper(prop_address_city_name) = '${soqlLit(String(city).toUpperCase())}'`);

  const res = await soda(ADDRESSES, {
    "$select": "pin, prop_address_full, prop_address_city_name, prop_address_zipcode_1, year",
    "$where": whereParts.join(" AND "),
    "$order": "year DESC",
    "$limit": limit,
  });
  if (!res.ok) return { ok: false, status: "error", ms: res.ms, error: res.error, query: q, candidates: [] };

  // Keep most-recent-year row per PIN.
  const byPin = new Map();
  for (const r of res.rows) {
    const prev = byPin.get(r.pin);
    if (!prev || Number(r.year) > Number(prev.year)) byPin.set(r.pin, r);
  }

  // Score + rank.
  const scored = [];
  for (const r of byPin.values()) {
    const { score, parts, cand } = scoreCandidate(q, r.prop_address_full);
    if (score <= 0) continue;
    scored.push({
      pin: normPin(r.pin),
      address: r.prop_address_full,
      city: r.prop_address_city_name || "",
      zip: r.prop_address_zipcode_1 || "",
      year: r.year,
      score: Number(score.toFixed(3)),
      parts,
      unit: cand.unit || "",
    });
  }
  scored.sort((a, b) => b.score - a.score || (Number(b.year) - Number(a.year)));

  if (!scored.length) {
    return { ok: true, status: "none", ms: res.ms, query: q, candidates: [], reason: "no parcel address matched the street number + name" };
  }

  const top = scored[0];
  const runnerUp = scored[1];

  // Decide match vs ambiguous.
  // Ambiguous if: top score below threshold, OR the top two are near-tied and
  // point to different PINs (e.g. multi-unit building, no unit given).
  const nearTie = runnerUp && (top.score - runnerUp.score) < 0.08 && runnerUp.pin !== top.pin;
  const multiUnitNoUnit = !q.unit && scored.filter((s) => s.score >= top.score - 0.08).length > 1 &&
    scored.some((s) => s.unit);

  if (top.score < minScore || nearTie || multiUnitNoUnit) {
    let reason = "multiple candidate parcels — please disambiguate (add unit #, ZIP, or pick a PIN)";
    if (top.score < minScore) reason = "no high-confidence match; review candidates";
    return {
      ok: true, status: "ambiguous", ms: res.ms, query: q,
      pin: null, confidence: top.score,
      candidates: scored.slice(0, 8), reason,
    };
  }

  return {
    ok: true, status: "match", ms: res.ms, query: q,
    pin: top.pin, confidence: top.score,
    candidates: scored.slice(0, 8),
    reason: null,
  };
}
