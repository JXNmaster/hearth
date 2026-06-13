// Cook County Treasurer tax-sale signals (via Socrata open data).
// NOTE: the live Treasurer site (current tax balance) is anti-bot blocked from
// datacenter IPs (HTTP 503). These open datasets give the high-signal *events*:
// a PIN that appears here had delinquent taxes sold/offered at a tax sale.
//   Annual Tax Sale     55ju-2fs9  (pin, tax_sale_year, sold_at_sale, amounts)
//   Scavenger Tax Sale  ydgz-vkrp  (pin, tax_sale_year, sold_at_sale, buyer, years)
import { soda } from "../socrata.mjs";
import { normPin, formatPin } from "../normalize.mjs";

const DS = { annual: "55ju-2fs9", scavenger: "ydgz-vkrp" };

// These datasets store PINs WITH dashes; match either format defensively.
function pinWhere(pin) {
  return `pin in('${normPin(pin)}','${formatPin(pin)}')`;
}

export async function taxSaleHistory(pin) {
  const where = pinWhere(pin);
  const [annual, scav] = await Promise.all([
    soda(DS.annual, { "$where": where, "$order": "tax_sale_year DESC", "$limit": 25 }),
    soda(DS.scavenger, { "$where": where, "$order": "tax_sale_year DESC", "$limit": 25 }),
  ]);
  return {
    ok: annual.ok && scav.ok,
    ms: Math.max(annual.ms, scav.ms),
    error: annual.error || scav.error,
    annual: annual.rows,
    scavenger: scav.rows,
  };
}
