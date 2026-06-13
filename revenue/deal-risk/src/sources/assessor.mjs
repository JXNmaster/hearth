// Cook County Assessor (via Socrata open data) — the spine of the pipeline.
// Datasets:
//   Parcel Universe   nj4t-kc8j  (pin -> location, municipality, class, tax_code)
//   Parcel Addresses  3723-97qp  (pin -> property/owner/mailing addresses)
//   Parcel Sales      wvhk-k5uv  (pin -> sale history incl. buyer/seller names + deed doc_no)
//   Assessed Values   uzyt-m557  (pin -> assessed value)
import { soda, soqlLit } from "../socrata.mjs";
import { normPin, normAddress } from "../normalize.mjs";
import { resolveAddress } from "../resolve.mjs";

const DS = {
  universe: "nj4t-kc8j",
  addresses: "3723-97qp",
  sales: "wvhk-k5uv",
  assessed: "uzyt-m557",
};

// Resolve a free-text street address to candidate PINs.
// Delegates to the hardened resolver (tokenize + rank + dedupe + disambiguate).
// Returns the resolver's full result so callers can detect "ambiguous" vs "match".
export async function addressToPins(address, opts = {}) {
  return resolveAddress(address, opts);
}

export async function parcelInfo(pin) {
  const p = normPin(pin);
  const res = await soda(DS.universe, { pin: p, "$order": "year DESC", "$limit": 1 });
  return { ok: res.ok, ms: res.ms, error: res.error, info: res.rows[0] || null };
}

export async function parcelAddresses(pin) {
  const p = normPin(pin);
  const res = await soda(DS.addresses, { pin: p, "$order": "year DESC", "$limit": 1 });
  return { ok: res.ok, ms: res.ms, error: res.error, addr: res.rows[0] || null };
}

export async function salesHistory(pin, limit = 25) {
  const p = normPin(pin);
  const res = await soda(DS.sales, { pin: p, "$order": "sale_date DESC", "$limit": limit });
  return { ok: res.ok, ms: res.ms, error: res.error, sales: res.rows };
}

export async function assessedValue(pin) {
  const p = normPin(pin);
  const res = await soda(DS.assessed, { pin: p, "$order": "year DESC", "$limit": 1 });
  return { ok: res.ok, ms: res.ms, error: res.error, value: res.rows[0] || null };
}

// Current vested owner = buyer on the most recent recorded sale (best open-data proxy).
export function currentOwnerFromSales(sales) {
  for (const s of sales || []) {
    if (s.buyer_name) {
      return { owner: s.buyer_name, via_doc: s.doc_no, deed_type: s.deed_type, sale_date: s.sale_date };
    }
  }
  return null;
}
