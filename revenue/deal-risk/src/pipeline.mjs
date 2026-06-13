// Orchestration: PIN (or address) -> gather all available sources -> normalize -> flags.
import * as assessor from "./sources/assessor.mjs";
import { taxSaleHistory } from "./sources/treasurer.mjs";
import { recorderArchive } from "./sources/recorderArchive.mjs";
import { recorderByName, analyzeInstruments } from "./sources/recorderLive.mjs";
import { detectFlags, summarize } from "./rules.mjs";
import { normPin, formatPin } from "./normalize.mjs";

export async function resolvePin({ pin, address, zip, city }) {
  if (pin) return { pin: normPin(pin), resolvedFrom: "pin", candidates: [] };
  if (address) {
    const r = await assessor.addressToPins(address, { zip, city });
    if (!r.ok) return { pin: null, error: r.error || "address lookup failed", candidates: [] };
    if (r.status === "match") {
      return { pin: r.pin, resolvedFrom: "address", confidence: r.confidence, candidates: r.candidates };
    }
    if (r.status === "ambiguous") {
      // Precision over recall: do NOT pick. Surface candidates so the caller
      // (CLI / batch / UI) can ask the agent to disambiguate.
      return { pin: null, error: r.reason || "multiple candidate parcels — disambiguate", ambiguous: true, candidates: r.candidates };
    }
    return { pin: null, error: r.reason || "no PIN found for address", candidates: [] };
  }
  return { pin: null, error: "provide --pin or --address" };
}

export async function runPipeline({ pin, address, seller, zip, city }) {
  const t0 = Date.now();
  const resolved = await resolvePin({ pin, address, zip, city });
  if (!resolved.pin) return { ok: false, error: resolved.error || "could not resolve PIN", ambiguous: resolved.ambiguous, candidates: resolved.candidates };
  const P = resolved.pin;

  // Fan out across sources concurrently.
  const [info, addrs, sales, value, taxSale, recorder] = await Promise.all([
    assessor.parcelInfo(P),
    assessor.parcelAddresses(P),
    assessor.salesHistory(P),
    assessor.assessedValue(P),
    taxSaleHistory(P),
    recorderArchive(P),
  ]);

  const owner = assessor.currentOwnerFromSales(sales.sales);

  // Live recordings search by current owner name (current mortgages/releases/liens/lis pendens).
  let recorderLive = { ok: false, ms: 0, error: "no owner name resolved", rows: [], analysis: null };
  if (owner?.owner) {
    const live = await recorderByName(owner.owner, { subjectPin: P });
    recorderLive = { ...live, analysis: live.ok ? analyzeInstruments(live.rows) : null };
  }

  const sourceStatus = [
    { source: "Assessor: Parcel Universe", ok: info.ok, ms: info.ms, error: info.error, rows: info.info ? 1 : 0 },
    { source: "Assessor: Parcel Addresses", ok: addrs.ok, ms: addrs.ms, error: addrs.error, rows: addrs.addr ? 1 : 0 },
    { source: "Assessor: Parcel Sales", ok: sales.ok, ms: sales.ms, error: sales.error, rows: (sales.sales || []).length },
    { source: "Assessor: Assessed Values", ok: value.ok, ms: value.ms, error: value.error, rows: value.value ? 1 : 0 },
    { source: "Treasurer: Tax Sale (annual+scavenger)", ok: taxSale.ok, ms: taxSale.ms, error: taxSale.error, rows: (taxSale.annual || []).length + (taxSale.scavenger || []).length },
    { source: "Recorder: Archive (mort/forc/quit 2011–2015)", ok: recorder.ok, ms: recorder.ms, error: recorder.error, rows: (recorder.mortgages || []).length + (recorder.foreclosures || []).length + (recorder.quitclaims || []).length },
    { source: "Clerk Recordings: LIVE (by owner name)", ok: recorderLive.ok, ms: recorderLive.ms, error: recorderLive.error, rows: (recorderLive.rows || []).length },
  ];

  const record = {
    input: { pin: P, address: address || null, seller: seller || null },
    resolvedFrom: resolved.resolvedFrom,
    info: info.info,
    addresses: addrs.addr,
    sales: sales.sales,
    value: value.value,
    owner,
    taxSale,
    recorder,
    recorderLive,
  };

  const flags = detectFlags(record);
  const summary = summarize(flags);

  return {
    ok: true,
    ms: Date.now() - t0,
    pin: P,
    pinFormatted: formatPin(P),
    record,
    flags,
    summary,
    sourceStatus,
  };
}
