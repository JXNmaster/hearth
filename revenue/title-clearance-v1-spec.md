# Deal-Risk Report — v1 Spec (Cook County, IL)

**Product:** An automated "Title Deal-Risk / Pre-Clearance Report" that pulls public
records for a property, flags likely title clouds, and produces a one-page report.
Two uses from one engine: (1) **internal curative accelerator** for the attorney,
(2) **outbound lead magnet** to listing agents.

**v1 goal:** Single-property input (PIN or address) → pull 4 core Cook County
sources → detect the ~6 highest-frequency defects → generate a one-page PDF,
attorney-reviewed before anything leaves. Prove accuracy on 10–20 real files
before automating ingestion or outreach.

---

## 1. Data sources (Cook County)

| Source | What it gives | Access | Notes |
|---|---|---|---|
| **Cook County Assessor** | PIN, owner of record, property characteristics, address↔PIN | Open data portal / API (free) | Start here — resolves address→PIN→owner |
| **Cook County Treasurer** | Property-tax payment status, delinquencies, **sold taxes / tax-sale redemption** | Web lookup by PIN (free) | Unpaid/sold taxes = major cloud |
| **Cook County Clerk's Office (Recorder of Deeds)** | Deeds, mortgages, **releases/satisfactions**, liens, lis pendens, UCC | Online recordings search; doc images may cost | Core: chain of title + open mortgages + recorded liens |
| **Circuit Court of Cook County (Clerk of Court)** | Civil judgments, **foreclosure, probate, divorce**, mechanic's-lien suits, evictions | Online case search (some paywalled) | Search by owner name + address |
| *(Phase 2)* **Illinois Secretary of State** | UCC filings, **LLC/entity good-standing** | Online (free) | When owner is an entity |
| *(Phase 2)* **City of Chicago** (Finance / Buildings) | **Water/sewer liens**, code-violation & demolition liens, housing court | Open data + lookups | Chicago water liens run with the land — high-signal |
| *(Phase 2)* **PACER** | **Bankruptcy** (auto-stay blocks sale), federal tax liens/judgments | PACER (per-page fee) | Bankruptcy is a deal-killer; high value |

**Hard rule:** No MLS scraping. MLS is licensed (RESO Web API/IDX) — get listing
data via Chris's MLS membership or a licensed feed. Defect data comes from
**public records only.**

---

## 2. Canonical data model

Normalize everything to one record so rules are source-agnostic:

```
Property { pin, address, legal_desc, current_vested_owner, last_deed_ref }
Party    { name_raw, name_normalized, role: grantor|grantee|seller|lienholder|... }
Instrument { type: deed|mortgage|release|lien|judgment|lispendens|ucc,
             doc_number, recorded_date, amount, grantor, grantee, source, source_url }
TaxStatus { tax_year, amount_due, status: current|delinquent|sold, redemption_deadline }
CourtCase { case_no, type: foreclosure|probate|divorce|mechanics|judgment,
            parties[], status, filed_date, court, source_url }
Flag      { defect_code, severity, evidence[instrument|case|tax], why_it_matters,
            typical_curative_step, est_curative_time, confidence }
```

Entity resolution: fuzzy name matching (owner-of-record ↔ deed grantee ↔ seller ↔
court parties), with middle-initial/suffix/married-name handling. LLM (Claude)
assists parsing unstructured doc text and generating the plain-English narrative —
**not** the pass/fail decision (keep detection deterministic + auditable).

---

## 3. Defect-detection rules (v1 set)

| # | Defect | Signal | Sources | Severity |
|---|---|---|---|---|
| 1 | **Open / unreleased mortgage** | Mortgage recorded with no matching release/satisfaction | Recorder | High |
| 2 | **Tax delinquency / sold taxes** | Treasurer status = delinquent/sold; redemption pending | Treasurer | High |
| 3 | **Judgment lien on owner** | Money judgment vs owner name, docketed/attaches to RE | Court + Recorder | High |
| 4 | **Mechanic's / municipal lien** | Recorded mechanic's lien or city lien on PIN | Recorder | Med-High |
| 5 | **Lis pendens / active litigation** | Foreclosure/partition/quiet-title naming property or owner | Court + Recorder | High |
| 6 | **Vesting / name mismatch** | Seller ≠ vested owner; missing spouse (homestead); chain gap | Assessor + Recorder | Med |
| *(P2)* | Probate/heirship gap | Owner deceased / open estate, title not passed | Court | High |
| *(P2)* | Bankruptcy (auto-stay) | Active BK case naming owner | PACER | Critical |

Each fired flag records its **evidence + source URL + confidence** for defensibility.

---

## 4. Report format — one page

- **Header:** Address · PIN · abbreviated legal · current vested owner (per last deed) · data-as-of date
- **Summary line:** "N items flagged for attorney review" (avoid an insured-sounding
  "clear/not clear" verdict; use review-oriented language)
- **Sections:** Ownership & Vesting · Mortgages & Releases · Liens & Judgments ·
  Tax Status · Litigation / Probate · *(P2)* Municipal & Code
- **Per flagged item:** what it is · doc/case number + date + amount · **why it
  matters** · **typical curative step** · est. turnaround
- **Footer (required):** "Prepared from public records as preliminary attorney work
  product for [Firm]. Not a title commitment, title insurance, or legal advice.
  Issues should be reviewed with counsel." + source list + as-of date.

Deliverable = HTML → PDF (reuse Resend for email, Lob for any print).

---

## 5. Architecture & stack (reuse existing)

```
[Trigger: PIN/address]
   → Ingestion adapters (one per source; API where available, Playwright where not;
     cache + rate-limit + log provenance)
   → Normalizer → canonical model (Supabase/Postgres)
   → Entity resolution
   → Rules engine (deterministic defect detection)
   → LLM pass (parse unstructured docs + write narrative/curative notes)
   → Report generator (HTML→PDF)
   → [HUMAN GATE: attorney review queue]  ← required before send
   → Outbound (email-first, CAN-SPAM, opt-out) OR internal curative worklist
```

- **Stack:** TypeScript · Supabase (Postgres) · Cloudflare Workers · Playwright
  (scrape) · Claude (parse/narrative) · Resend (email) · Lob (print) · GitHub
  Actions cron for daily new-listing pulls (same pattern as `acuna-law`).
- **Scraping discipline:** respect each site's ToS/robots, throttle, cache, store
  source URLs. Prefer official APIs/open-data portals over HTML scraping wherever
  they exist (Assessor, Treasurer open data).

---

## 6. Compliance guardrails (baked into v1)

1. **Attorney-review gate** — no report leaves until Chris confirms. v1 is
   manual-trigger, human-in-the-loop by design.
2. **Framing** — informational, public-records-derived, attorney work product,
   under Chris's firm. Never a title commitment / insured product / legal advice.
3. **Outreach** — **email only** (B2B, CAN-SPAM compliant, clear opt-out). **No
   automated cold SMS** (TCPA: $500–1,500/text). SMS only with opt-in.
4. **Provenance** — every flag stores source + doc/case number + URL + confidence.
   Accuracy protects trust and limits liability.
5. **No MLS scraping** — licensed feed or Chris's access only.

---

## 7. Build plan

**Week 1 (prove the artifact):**
- [ ] Address→PIN→owner via Assessor
- [ ] Treasurer tax-status pull
- [ ] Recorder pull: deeds + mortgages + releases + recorded liens
- [ ] Court search by owner name (foreclosure/judgment/lis pendens)
- [ ] Rules 1–6; canonical model in Supabase
- [ ] One-page PDF generator + disclaimer
- [ ] Run on 10–20 real Acuna files; Chris validates accuracy (precision/recall)

**Week 2–3 (operationalize):** automate daily new-listing ingestion (cron),
attorney review queue UI, email outreach with sample report + opt-out.

**Phase 2 (moat):** SOS/UCC + entity good-standing, Chicago liens, PACER
bankruptcy, probate/heirship; curative worklist that tracks each issue to cleared.

---

## 8. Open questions
- MLS access path for new-listing triggers (Chris's membership vs licensed feed)?
- Which records require paid image pulls, and per-file budget?
- Court-search coverage: how much is behind the paid portal vs free index?
- Target precision before any report is agent-facing (recommend high-precision,
  low-recall to start — never flag a false cloud to an agent).
