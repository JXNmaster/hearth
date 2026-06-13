// Defect-detection rules over the gathered open-data record.
// Each flag is auditable: it carries evidence + source + confidence. Severity is
// advisory ("for attorney review"), never an insured clear/not-clear verdict.
import { nameSim } from "./normalize.mjs";

const SEV = { HIGH: "HIGH", MED: "MED", INFO: "INFO" };

export function detectFlags(record) {
  const flags = [];
  const add = (f) => flags.push(f);

  // 1. Tax sale / delinquency (HIGH) — PIN sold/offered at annual or scavenger sale.
  const ts = record.taxSale || {};
  const annualSold = (ts.annual || []).filter((r) => /yes|sold|true/i.test(String(r.sold_at_sale)));
  if ((ts.annual || []).length) {
    add({
      code: "TAX_SALE_ANNUAL",
      severity: SEV.HIGH,
      title: "Property taxes offered/sold at Annual Tax Sale",
      why: "Delinquent taxes sold at tax sale create a redemption obligation and a cloud until redeemed; unredeemed sales can ripen into a tax deed.",
      curative: "Obtain an estimate of redemption from the County Clerk; confirm redemption before closing.",
      evidence: (ts.annual || []).slice(0, 5).map((r) => ({
        tax_sale_year: r.tax_sale_year, sold_at_sale: r.sold_at_sale,
        amount: r.total_tax_and_penalty_amount_offered || r.tax_amount_offered, source: "Treasurer Annual Tax Sale (open data)",
      })),
      confidence: annualSold.length ? 0.9 : 0.7,
    });
  }
  if ((ts.scavenger || []).length) {
    add({
      code: "TAX_SALE_SCAVENGER",
      severity: SEV.HIGH,
      title: "Property appeared in Scavenger Tax Sale (multi-year delinquency)",
      why: "Scavenger sale indicates 3+ years of delinquent taxes — a serious title cloud.",
      curative: "Verify redemption/forfeiture status with County Clerk; resolve before closing.",
      evidence: (ts.scavenger || []).slice(0, 5).map((r) => ({
        tax_sale_year: r.tax_sale_year, from_year: r.from_year, to_year: r.to_year,
        sold_at_sale: r.sold_at_sale, source: "Treasurer Scavenger Tax Sale (open data)",
      })),
      confidence: 0.85,
    });
  }

  // 2. Foreclosure on record (HIGH if recent; archive is dated — mark as such).
  const forc = (record.recorder && record.recorder.foreclosures) || [];
  if (forc.length) {
    add({
      code: "FORECLOSURE_RECORD",
      severity: SEV.HIGH,
      title: "Foreclosure-related instrument on record (archive 2011–2015)",
      why: "A recorded foreclosure (lis pendens/judgment) can encumber title and indicate unresolved liens.",
      curative: "Confirm disposition (dismissed, completed, redeemed) via live court + recordings search.",
      evidence: forc.slice(0, 5).map((r) => ({
        document_number: r.document_number, document_type: r.document_type, recorded_date: r.recorded_date,
        source: "Recorder Foreclosures (open-data archive)",
      })),
      confidence: 0.5, // dated source
    });
  }

  // 3. Mortgage on record without observable release (open-data archive only — LIMITED).
  const morts = (record.recorder && record.recorder.mortgages) || [];
  if (morts.length) {
    add({
      code: "MORTGAGE_UNVERIFIED_RELEASE",
      severity: SEV.MED,
      title: `${morts.length} recorded mortgage(s) found (release not verifiable in open data)`,
      why: "Open mortgages must be paid/released at closing. Open-data archive does not include releases, so payoff/release status cannot be confirmed here.",
      curative: "Run live recordings search to match each mortgage to a release/satisfaction; order payoffs as needed.",
      evidence: morts.slice(0, 5).map((r) => ({
        document_number: r.document_number, recorded_date: r.recorded_date,
        amount: r.consideration_amount, source: "Recorder Mortgages (open-data archive)",
      })),
      confidence: 0.4, // coverage-limited
    });
  }

  // 4. Quitclaim deed in chain (MED) — elevated fraud/vesting scrutiny.
  const sales = record.sales || [];
  const quitSales = sales.filter((s) => /quit/i.test(String(s.deed_type)) || /quit/i.test(String(s.mydec_deed_type)));
  const quitArchive = (record.recorder && record.recorder.quitclaims) || [];
  if (quitSales.length || quitArchive.length) {
    add({
      code: "QUITCLAIM_IN_CHAIN",
      severity: SEV.MED,
      title: "Quitclaim deed present in chain of title",
      why: "Quitclaims convey only whatever interest the grantor had (no warranty) and are common in fraud, divorce, and informal transfers — warrant closer chain review.",
      curative: "Examine the quitclaim grantor's authority and consideration; confirm no missing parties.",
      evidence: [
        ...quitSales.slice(0, 3).map((s) => ({ doc_no: s.doc_no, deed_type: s.deed_type, sale_date: s.sale_date, source: "Assessor Parcel Sales" })),
        ...quitArchive.slice(0, 2).map((r) => ({ document_number: r.document_number, source: "Recorder QuitClaim (archive)" })),
      ],
      confidence: 0.6,
    });
  }

  // 5. Rapid resale / flip (INFO) — multiple sales within ~12 months.
  const dated = sales.filter((s) => s.sale_date).map((s) => new Date(s.sale_date)).sort((a, b) => b - a);
  if (dated.length >= 2) {
    const gapDays = (dated[0] - dated[1]) / 86400000;
    if (gapDays <= 365) {
      add({
        code: "RAPID_RESALE",
        severity: SEV.INFO,
        title: `Two sales within ${Math.round(gapDays)} days`,
        why: "Rapid resale can indicate a flip, related-party transfer, or pricing anomaly worth a second look.",
        curative: "Confirm arm's-length consideration and identity of parties.",
        evidence: dated.slice(0, 2).map((d) => ({ sale_date: d.toISOString().slice(0, 10) })),
        confidence: 0.5,
      });
    }
  }

  // 6. Vesting / name mismatch (MED) — current owner vs prospective seller (if provided).
  // Only when we have a USABLE owner name (placeholder owners are skipped upstream).
  if (record.input && record.input.seller && record.owner && record.owner.owner && !record.owner.ownerUnresolved) {
    const sim = nameSim(record.input.seller, record.owner.owner);
    if (sim < 0.5) {
      add({
        code: "VESTING_MISMATCH",
        severity: SEV.MED,
        title: "Prospective seller does not match vested owner of record",
        why: "The person listing/selling differs from the last recorded owner — possible undisclosed transfer, estate, or authority issue.",
        curative: "Confirm seller's authority to convey (deed, POA, trustee, estate letters).",
        evidence: [{ vested_owner: record.owner.owner, prospective_seller: record.input.seller, name_similarity: Number(sim.toFixed(2)) }],
        confidence: 0.6,
      });
    }
  }

  // 8. LIVE recordings (current) — open mortgage, lis pendens, liens, judgments.
  //
  // PRECISION POSTURE: analyzeInstruments() already discarded rows that did not
  // strongly match the subject owner's name (the live index returns unrelated
  // parties). So everything below is owner-scoped. We STILL keep confidences
  // moderate and framing as "review recommended", because:
  //   (a) name search can miss instruments recorded under a name variant, and
  //   (b) it can include a different person who shares the owner's name.
  // Confidence is nudged up only when an owner-PIN actually appears on the row.
  const live = record.recorderLive && record.recorderLive.analysis;
  if (live) {
    const pinSeen = (arr) => arr.some((m) => m.pinVerdict === "match");
    if (live.openMortgages.length) {
      // WEAK signal: "no matching release" relies on the sparse Assoc.Doc# link.
      // Frame as needs-verification (MED), not a hard open-lien assertion (HIGH).
      add({
        code: "OPEN_MORTGAGE_LIVE",
        severity: SEV.MED,
        title: `${live.openMortgages.length} owner mortgage(s) without a confirmed release (live recordings)`,
        why: "A recorded mortgage tied to this owner has no satisfaction/release linked in the live index. The release link field is sparse, so this is a flag to VERIFY a payoff/release, not a confirmed open lien.",
        curative: "Confirm whether each mortgage was satisfied; order payoff and confirm release recording as needed.",
        evidence: live.openMortgages.slice(0, 5).map((m) => ({ doc_number: m.doc_number, recorded: m.recorded, grantee: m.grantee, name_match: m.nameScore, source: "Cook County Clerk Recordings (live)" })),
        confidence: pinSeen(live.openMortgages) ? 0.6 : 0.45,
      });
    }
    if (live.lisPendens.length) {
      // Lis pendens is high-signal AND owner-scoped -> keep HIGH but evidence-tag.
      add({
        code: "LIS_PENDENS_LIVE",
        severity: SEV.HIGH,
        title: `${live.lisPendens.length} lis pendens / foreclosure notice(s) tied to owner (live recordings)`,
        why: "A lis pendens signals pending litigation (often foreclosure) affecting the property — a direct cloud on title.",
        curative: "Confirm case status/disposition; resolve or obtain release before closing.",
        evidence: live.lisPendens.slice(0, 5).map((m) => ({ doc_number: m.doc_number, recorded: m.recorded, grantor: m.grantor, doc_type: m.doc_type, name_match: m.nameScore, source: "Cook County Clerk Recordings (live)" })),
        confidence: pinSeen(live.lisPendens) ? 0.8 : 0.65,
      });
    }
    if (live.liens.length || live.judgments.length) {
      const items = [...live.liens, ...live.judgments];
      add({
        code: "LIEN_JUDGMENT_LIVE",
        // Judgments/liens are name-indexed against a PERSON, not a parcel, so a
        // same-name different-person risk remains. MED + verify framing.
        severity: SEV.MED,
        title: `${items.length} lien/judgment instrument(s) recorded against owner name (live recordings)`,
        why: "Recorded liens/judgments (tax, mechanic's, municipal, money judgments) can attach to property of the named person. These are indexed by NAME, so verify this is the same individual before treating as a property lien.",
        curative: "Verify identity (same person), amounts, and payoff; obtain releases at closing if confirmed.",
        evidence: items.slice(0, 6).map((m) => ({ doc_number: m.doc_number, recorded: m.recorded, doc_type: m.doc_type, grantor: m.grantor, name_match: m.nameScore, source: "Cook County Clerk Recordings (live)" })),
        confidence: pinSeen(items) ? 0.55 : 0.4,
      });
    }
  }

  // 7. Absentee owner (INFO) — mailing address differs from property address.
  const a = record.addresses;
  if (a && a.prop_address_full && a.mail_address_full) {
    const sameZip = (a.prop_address_zipcode_1 || "") === (a.mail_address_zipcode_1 || "");
    if (!sameZip) {
      add({
        code: "ABSENTEE_OWNER",
        severity: SEV.INFO,
        title: "Owner mailing address differs from property location",
        why: "Absentee ownership correlates with estates, investors, and out-of-state parties — context for outreach and curative effort.",
        curative: "Note for contact strategy; not itself a defect.",
        evidence: [{ property: a.prop_address_full, mailing: a.mail_address_full }],
        confidence: 0.8,
      });
    }
  }

  return flags;
}

export function summarize(flags) {
  const order = { HIGH: 0, MED: 1, INFO: 2 };
  flags.sort((a, b) => order[a.severity] - order[b.severity]);
  const counts = { HIGH: 0, MED: 0, INFO: 0 };
  for (const f of flags) counts[f.severity]++;
  return { counts, total: flags.length };
}
