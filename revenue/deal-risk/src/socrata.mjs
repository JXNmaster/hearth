// Generic Socrata (SODA) client for the Cook County open-data portal.
// Zero-dependency: Node 18+ native fetch. No API token required for these volumes,
// but an app token raises rate limits — set SOCRATA_APP_TOKEN to use one.

const HOST = "https://datacatalog.cookcountyil.gov";
const APP_TOKEN = process.env.SOCRATA_APP_TOKEN || "";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/**
 * Query a Socrata dataset. `params` are SoQL params WITHOUT the leading $ where
 * appropriate — pass them as { "$where": "...", "$order": "...", "$limit": 50, pin: "..." }.
 * Returns { ok, rows, ms, status, error }.
 */
export async function soda(datasetId, params = {}, { timeoutMs = 12000, retries = 2 } = {}) {
  const url = new URL(`${HOST}/resource/${datasetId}.json`);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    url.searchParams.set(k, String(v));
  }
  const headers = { "User-Agent": UA, Accept: "application/json" };
  if (APP_TOKEN) headers["X-App-Token"] = APP_TOKEN;

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const started = Date.now();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, signal: ctrl.signal });
      clearTimeout(t);
      const ms = Date.now() - started;
      if (!res.ok) {
        lastErr = `HTTP ${res.status}`;
        // 4xx won't fix on retry; bail early.
        if (res.status >= 400 && res.status < 500) {
          return { ok: false, rows: [], ms, status: res.status, error: lastErr };
        }
        continue;
      }
      const rows = await res.json();
      return { ok: true, rows, ms, status: res.status, error: null };
    } catch (e) {
      clearTimeout(t);
      lastErr = e.name === "AbortError" ? `timeout>${timeoutMs}ms` : String(e.message || e);
    }
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  return { ok: false, rows: [], ms: 0, status: 0, error: lastErr };
}

// Escape a string for use inside a SoQL single-quoted literal.
export function soqlLit(s) {
  return String(s).replace(/'/g, "''");
}
