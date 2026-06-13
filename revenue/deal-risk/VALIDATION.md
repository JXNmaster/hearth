# Validation & honest precision posture

_Last run: 2026-06-13, from this environment, against live Cook County sources._

This summarizes what the pipeline actually does on real data, and — importantly —
what we trust enough to put in front of a listing agent vs. what still needs the
paid wholesale-title tier. Reproduce with `node src/validate.mjs [N]`.

## How it was measured

`src/validate.mjs` samples N real **recent residential sales** (Assessor Parcel
Sales `wvhk-k5uv`, class 2xx, since 2023-06) and runs the full pipeline per PIN. It
records per-source HTTP success, hit-rate (parcels with ≥1 row), latency p50/p95,
flag-type distribution, and runs a small self-audit for false-positive patterns.

> There is **no public ground-truth oracle** for title status, so "hit%" measures
> source _coverage_, not _correctness_. Live-recorder flags are review prompts, not
> verdicts. The address-resolver match rate (below) IS measured against ground
> truth (the dataset's own PIN↔address rows).

## Address → PIN resolution (deliverable 1)

`src/resolve.mjs` tokenizes number/dir/name/suffix/unit (+ trailing ZIP), queries
Parcel Addresses, ranks/dedupes, and returns `match | ambiguous | none`.

On 11 real Cook County addresses (7 plain + 4 condo-unit), with ZIP supplied:

| metric | value |
|---|---|
| confident exact match | **8/11 (73%)** |
| **wrong PIN returned** | **0/11 (0%)** ← the metric that matters |
| correctly returned "ambiguous" | 3/11 |

The 3 ambiguous cases were genuinely ambiguous and the resolver _correctly refused
to guess_: two were distinct PINs sharing the identical literal address
(`311 E MAIN ST`, `410 GROVE AVE` — adjacent parcels), and one was a condo unit
number not present in the data. This is the intended **precision-over-recall**
behavior: better to ask the agent to disambiguate than to silently pick the wrong
parcel (a wrong parcel → wrong owner → a false cloud → lost trust).

## Per-source coverage & latency (N=12–15 sample)

| source | HTTP ok% | hit% | p50 | p95 |
|---|---|---|---|---|
| Assessor: Parcel Universe | 100 | 100 | ~155ms | ~300–640ms |
| Assessor: Parcel Addresses | 100 | 100 | ~135ms | ~300–450ms |
| Assessor: Parcel Sales | 100 | 100 | ~140ms | ~200–930ms |
| Assessor: Assessed Values | 100 | 100 | ~150ms | ~330–430ms |
| Treasurer: Tax Sale (annual+scavenger) | 100 | 0* | ~155ms | ~330–620ms |
| Recorder: Archive (2011–2015) | 100 | ~50 | ~200ms | ~560–840ms |
| **Clerk Recordings: LIVE (by owner)** | 100 | **67–75** | **~5.6–7.4s** | **~8.3–9.7s** |

\* Tax-sale hit% is 0 on a clean recent-sale sample — expected; these parcels
aren't delinquent. The flag _does_ fire on delinquent parcels (see batch test:
two CASTLE RIDGE BUILDERS parcels triggered `TAX_SALE_ANNUAL` HIGH).

**Pipeline:** 100% of runs completed; full-pipeline latency p50 ~6–8s, p95 ~10–13s
— dominated entirely by the live recorder. Throttle batch/validate accordingly.

## Flag distribution (after precision tuning)

After tuning (see below), a clean recent-sale sample produces almost entirely
context-level INFO flags, with HIGH/MED reserved for genuine signals:

```
ABSENTEE_OWNER        ~50%  (INFO — mailing ≠ property; context only)
RAPID_RESALE          ~17%  (INFO — two sales <12mo)
FORECLOSURE_RECORD     ~8%  (HIGH — but archive-dated, conf 0.5)
OPEN_MORTGAGE_LIVE     ~8%  (MED — owner+PIN-scoped, conf 0.45–0.6)
```

## False positives we found and fixed (deliverable 2)

These are the real failure modes observed against live data, and the mitigations:

1. **Loose live-recorder name search.** Searching `FREDDY MARTINEZ` returned **45**
   instruments for many _different_ people named Martinez. Naively this would
   assert other people's mortgages/liens as this owner's clouds.
   **Fix:** the live "1st PIN" cell actually carries the PIN (packed with the
   address, e.g. `16-26-210-007-0000 3445 W 23RD ST`). We now parse it out and use
   **PIN match as the authoritative scope**; name similarity (`nameSim ≥ 0.6`) is a
   fallback only when the PIN cell is blank. That 45-row search collapses to **1**
   correctly-owned instrument. True open mortgages still surface (validated on
   JASON HERBST, DEJAN VUKASIN — each: 2 mortgages, 1 released via Assoc.Doc#, 1
   correctly flagged open & PIN-matched).

2. **Placeholder owner names.** `buyer_name` is sometimes the literal string
   `UNKNOWN`. Searching that returned random parties.
   **Fix:** `isUsableOwnerName()` skips placeholders; the live search is skipped and
   owner is reported "not clearly established" rather than guessed.

3. **Stale archive-mortgage noise.** The 2011–2015 archive mortgage flag fired on
   **~40%** of recently-sold parcels — nearly all paid off at the later sale.
   **Fix:** suppress when a sale post-dates the mortgage; otherwise demote to INFO
   "historical". Dropped to ~0% on the recent-sale sample. Current mortgages are now
   the live recorder's job.

4. **Confidence/severity framing.** Live lien/judgment and open-mortgage flags are
   MED + "verify identity / confirm payoff" language unless an owner-PIN is on the
   evidence row (then nudged up). Lis pendens stays HIGH (high-signal) but
   PIN-aware. Comments in `rules.mjs` document each tradeoff.

## Honest precision posture — what to send an agent vs. what needs the paid tier

**Trustworthy enough for the free agent-facing report (low false-positive risk):**
- Address → PIN → owner-of-record → sale history → value (Assessor open data). The
  reliable spine; 100% coverage on the sample.
- **Tax-sale delinquency** (Treasurer open data). Authoritative _events_, dashed/
  bare PIN both handled. When present, it's real.
- **Lis pendens / foreclosure** and **owner+PIN-matched open mortgages** from the
  live recorder. When PIN-scoped, these are high-trust.
- "Absentee owner", "rapid resale", "quitclaim in chain" — fine as soft context.

**Use with care / "review recommended" only (do NOT assert as fact to an agent):**
- **Liens/judgments by name with NO PIN on the row.** Name-indexed against a person;
  same-name-different-person risk remains. We label these "verify it's the same
  individual." Acceptable as a prompt, not a verdict.
- **"Open mortgage" where the release link (Assoc.Doc#) is blank.** Absence of a
  linked release is weak evidence. Flagged MED, framed as "confirm payoff".

**Known gaps that genuinely need the paid wholesale-title tier or headless:**
- **Name-variant / prior-owner instruments** can be missed by name search entirely
  (e.g. a lien recorded under a maiden name or a prior owner). A PIN-based examiner
  search is the only reliable fix.
- **Current tax balance** (Treasurer LIVE) — 503 anti-bot blocked here; needs a
  residential proxy or a paid property-data API.
- **IL SOS** (UCC, LLC good-standing) — 503 blocked; needs proxy / bulk access.
- **Circuit Court** (probate, divorce, judgments, active foreclosure status) —
  Tyler Odyssey JS portal behind F5; needs headless Playwright (out of scope here).
- **PACER** (bankruptcy / auto-stay, federal tax liens) — needs an account.
- **Document images** for the live recorder are paid; we only read the index.

**Bottom line:** the open-data spine + PIN-scoped live recordings are a strong,
low-false-positive **screening / lead-magnet** product. They are explicitly **not**
a substitute for a PIN-based, examiner-reviewed title search — which is the right
spine for the paid fulfillment tier. The report disclaimer says exactly this and
ships on every edition.
