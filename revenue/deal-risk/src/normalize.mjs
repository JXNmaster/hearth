// Normalization helpers: PINs, party names, addresses.

// Cook County PIN = 14 digits. Strip dashes/spaces; left-pad defensively.
export function normPin(pin) {
  const d = String(pin || "").replace(/\D/g, "");
  return d;
}

export function pin10(pin) {
  return normPin(pin).slice(0, 10);
}

export function formatPin(pin) {
  const d = normPin(pin);
  if (d.length !== 14) return d;
  return `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4, 7)}-${d.slice(7, 10)}-${d.slice(10)}`;
}

// Normalize a party name for fuzzy matching across sources.
// Uppercase, drop punctuation, collapse whitespace, strip common entity suffixes.
const NAME_NOISE = /\b(LLC|L L C|INC|CORP|CO|TRUST|TR|TRUSTEE|ESTATE|ET AL|ETAL|AKA|FKA|N\/?K\/?A)\b/g;
export function normName(name) {
  return String(name || "")
    .toUpperCase()
    .replace(/[.,]/g, " ")
    .replace(NAME_NOISE, " ")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Token-set overlap similarity (0..1) — order-independent, good for "LAST FIRST" vs "FIRST LAST".
export function nameSim(a, b) {
  const ta = new Set(normName(a).split(" ").filter((w) => w.length > 1));
  const tb = new Set(normName(b).split(" ").filter((w) => w.length > 1));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  return inter / Math.max(ta.size, tb.size);
}

export function normAddress(a) {
  return String(a || "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
