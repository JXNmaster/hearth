# deal-risk

Cook County (IL) **Deal-Risk / title pre-clearance** pipeline. Takes a PIN or
address, fans out across public + live county sources, flags likely title clouds,
and renders a one-page report. Zero-dependency Node 20+ (native `fetch`).

Two intended uses from one engine:
- **Lead magnet** — a free "Deal-Risk Report" to listing agents (top of funnel).
- **Internal curative accelerator** — pre-flags issues for the attorney to clear fast.

> Preliminary attorney work product from public records. **Not** a title commitment,
> title insurance, abstract, or legal advice. See disclaimer in every report.

## Run
```bash
node src/cli.mjs --pin 16-26-210-007-0000 --html report.html --json out.json
node src/cli.mjs --address "3445 W 23RD ST" --seller "JANE DOE"
node src/test-sources.mjs 12      # source performance harness
```

Optional: `SOCRATA_APP_TOKEN` env var raises open-data rate limits.

## Sources (see SOURCES.md for the tested feasibility ranking)
- **Assessor** (Socrata): PIN ↔ address ↔ owner (via sales), sale history, value.
- **Treasurer** (Socrata): tax-sale / delinquency events.
- **Recorder archive** (Socrata): mortgages/foreclosures/quitclaims 2011–2015.
- **Clerk Recordings LIVE**: current mortgages/releases/liens/lis pendens by owner.
- Not yet wired (blocked/headless): Treasurer live balance, IL SOS UCC, Circuit
  Court (probate/divorce/judgments), PACER (bankruptcy), Chicago liens.

## Layout
```
src/
  socrata.mjs            generic SODA client (retry/timeout)
  normalize.mjs          PIN + name normalization, fuzzy name match
  sources/
    assessor.mjs         address→PIN→owner, sales, value
    treasurer.mjs        tax-sale signals
    recorderArchive.mjs  historical recorder (2011–2015)
    recorderLive.mjs     LIVE recordings scrape + instrument analysis
  rules.mjs              defect detection (auditable, severity-tagged)
  report.mjs             HTML + terminal renderers
  pipeline.mjs           orchestration
  cli.mjs                entrypoint
  test-sources.mjs       performance harness
```
