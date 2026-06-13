// Cook County Assessor (via Socrata open data) — the spine of the pipeline.
// Datasets:
//   Parcel Universe   nj4t-kc8j  (pin -> location, municipality, class, tax_code)
//   Parcel Addresses  3723-97qp  (pin -> property/owner/mailing addresses)
//   Parcel Sales      wvhk-k5uv  (pin -> sale history incl. buyer/seller names + deed doc_no)
//   Assessed Values   uzyt-m557  (pin -> assessed value)
import { soda, soqlLit } from "../socrata.mjs";
import { normPin, normAddress } from "../normalize.mjs";

const DS = {
  universe: "nj4t-kc8j",
  addresses: "3723-97qp",
  sales: "wvhk-k5uv",
  assessed: "uzyt-m557",
};

// Resolve a free-text street address to candidate PINs (most-recent year first).
export async function addressToPins(address, limit = 10) {
  const q = normAddress(address);
  const res = await soda(DS.addresses, {
    "$select": "pin, prop_address_full, year",
    "$where": `upper(prop_address_full) like '%${soqlLit(q)}%'`,
    "$order": "year DESC",
    "$limit": limit,
  });
  // De-dupe PINs keeping the most recent year row.
  const seen = new Map();
  for (const r of res.rows) if (!seen.has(r.pin)) seen.set(r.pin, r);
  return { ok: res.ok, ms: res.ms, error: res.error, candidates: [...seen.values()] };
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
