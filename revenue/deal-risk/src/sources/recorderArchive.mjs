// Cook County Recorder of Deeds — ARCHIVE (Socrata open data).
// IMPORTANT COVERAGE LIMIT: the Recorder stopped publishing to open data in 2015.
// These datasets cover ~2011 through 2015-03-27 only. They are used here to
// (a) exercise/validate the mortgage & foreclosure matching logic, and
// (b) surface older recorded instruments. CURRENT deeds/mortgages/releases/liens
// require the live Clerk recordings system (crs.cookcountyclerkil.gov) — see SOURCES.md.
//   Mortgages 2013      pu79-z8ux  (pin, document_number, document_type, recorded_date, consideration_amount)
//   Mortgages 2011      33fu-uwca
//   Foreclosures 2013   nk2q-7kjv
//   QuitClaim 2013      7aey-b5t6
import { soda } from "../socrata.mjs";
import { normPin, formatPin } from "../normalize.mjs";

const DS = {
  mort2013: "pu79-z8ux",
  mort2011: "33fu-uwca",
  forc2013: "nk2q-7kjv",
  quit2013: "7aey-b5t6",
};

// Archive datasets store PINs WITH dashes; match either format defensively.
function pinWhere(pin) {
  return `pin in('${normPin(pin)}','${formatPin(pin)}')`;
}

export async function recorderArchive(pin) {
  const where = pinWhere(pin);
  const [m13, m11, f13, q13] = await Promise.all([
    soda(DS.mort2013, { "$where": where, "$limit": 25 }),
    soda(DS.mort2011, { "$where": where, "$limit": 25 }),
    soda(DS.forc2013, { "$where": where, "$limit": 25 }),
    soda(DS.quit2013, { "$where": where, "$limit": 25 }),
  ]);
  return {
    ok: [m13, m11, f13, q13].every((r) => r.ok),
    ms: Math.max(m13.ms, m11.ms, f13.ms, q13.ms),
    error: m13.error || m11.error || f13.error || q13.error,
    mortgages: [...m13.rows, ...m11.rows],
    foreclosures: f13.rows,
    quitclaims: q13.rows,
    coverageNote: "archive 2011–2015-03-27 only; not current",
  };
}
