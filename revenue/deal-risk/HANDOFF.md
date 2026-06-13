# HANDOFF — Deal-Risk / Title Pre-Clearance engine + MLS integration brief

**Purpose of this file:** a self-contained briefing so another Claude session — one
that has access to the Acuna MLS scraper and tooling — can (1) pull and run what's
already built here, (2) understand the strategy, and (3) wire the MLS listing feed
into this pipeline to make it an automatic new-listing → report → agent-outreach engine.

**Where the code lives:** repo `JXNmaster/hearth`, branch
`claude/revenue-folder-setup-jerou0`, path `revenue/deal-risk/`. Pull the latest of
that branch first — a background agent may still be committing hardening work
(address resolution, agent report, batch runner, validation).

---

## 1. Strategy in one screen

**Owner/operator:** Ben Jackson — lawyer (Chicago-Kent) + AI-enablement builder
(ndMAX/NetDocuments) + full-stack shipper. Live client: **Acuna Law** (Cook County
real-estate firm; Ben built an MLS scraper + Lob direct-mail engine for them).

**The product:** an automated **"Deal-Risk / Title Pre-Clearance Report"** for Cook
County, IL properties. One engine, two uses:

- **FREE, agent-facing lead magnet.** In Illinois (an attorney-closing state), the
  **listing real-estate agent is the referral gatekeeper** — they steer the deal to
  an attorney/title person they like, and **speed wins the referral**. We send the
  listing agent a free, fast, branded report flagging likely title clouds on *their*
  new listing → proves value → pries them away from their usual vendor.
- **PAID fulfillment (internal).** Once the deal lands with the attorney
  (Chris Acuna), the firm — which acts (or can act) as an IL **title agent**
  (via ATG/an underwriter) — does the actual title work, now AI-triaged and turned
  around in ~24 hours, earning **legal + title-agent fees**.

**Why two tiers matter:** the free tier must have **~$0 data COGS** (so we can blast
many agents) → that's what the public-data scrapers in this repo are for. The paid
tier should use a **wholesale title-data API** (DataTree/DataTrace/Pippin) under the
attorney's license for full fidelity (see §6). Don't reinvent the title plant by
scraping for the paid tier; rent it.

**Revenue framing:** productized per-firm/per-territory (exclusive county) retainer,
~$2.5k/mo/firm + per-file; ~10–15 firms ⇒ ~$300k/yr. The MLS feed is the top of the
funnel that makes outreach automatic.

**Hard compliance rules (keep in everything):** preliminary **attorney work product
from public records — NOT a title commitment, title insurance, abstract, or legal
advice**; disclaimer on every report; **never assert a false cloud** to an agent
(precision over recall); **outreach is EMAIL-ONLY** (cold SMS to MLS-listed numbers
is a TCPA landmine, $500–1,500/text).

---

## 2. What's built (and how to run it)

Zero-dependency **Node 20+** (native `fetch`). No `npm install` needed.

```bash
cd revenue/deal-risk
node src/cli.mjs --pin 16-26-210-007-0000 --html report.html --json out.json
node src/cli.mjs --address "3445 W 23RD ST" --seller "JANE DOE"
node src/cli.mjs --pin <PIN> --agent --html agent.html   # agent-facing edition (added by background agent)
node src/test-sources.mjs 12                              # source performance harness
node src/batch.mjs listings.csv                           # batch runner (added by background agent) -> ./out/
node src/validate.mjs 25                                  # validation pass (added by background agent)
```

**File map (`src/`):**
- `socrata.mjs` — generic Cook County open-data (SODA) client: retry, timeout, `$`-param passthrough. Optional `SOCRATA_APP_TOKEN` env raises rate limits.
- `normalize.mjs` — PIN normalization (`normPin` strips to 14 digits, `formatPin` adds dashes), party-name normalization + `nameSim` token-overlap fuzzy match.
- `sources/assessor.mjs` — `addressToPins`, `parcelInfo`, `parcelAddresses`, `salesHistory`, `assessedValue`, `currentOwnerFromSales`.
- `sources/treasurer.mjs` — `taxSaleHistory` (annual + scavenger tax-sale delinquency events).
- `sources/recorderArchive.mjs` — historical recorder (mortgages/foreclosures/quitclaims, **2011–2015 only**).
- `sources/recorderLive.mjs` — **LIVE** Clerk recordings scrape (current deeds/mortgages/releases/liens/lis pendens) + `analyzeInstruments` (classifies + matches mortgages↔releases).
- `rules.mjs` — `detectFlags` (auditable, severity-tagged HIGH/MED/INFO) + `summarize`.
- `report.mjs` — HTML + terminal renderers (agent edition added by background agent).
- `pipeline.mjs` — orchestration: resolve PIN → fan out all sources concurrently → detect flags → assemble result.
- `cli.mjs` — entrypoint. `batch.mjs`, `validate.mjs` — added by background agent.

**Output shape** (`runPipeline` returns): `{ ok, pin, pinFormatted, record{ owner, addresses, sales, value, taxSale, recorder, recorderLive }, flags[], summary{counts}, sourceStatus[] }`.

---

## 3. Data sources — tested feasibility (full detail in `SOURCES.md`)

All on Socrata `datacatalog.cookcountyil.gov` unless noted. **PIN format gotcha:**
Assessor datasets use **bare 14-digit** PINs; Treasurer/Recorder-archive use
**dashed** PINs — adapters query both formats.

| Tier | Source | Dataset / endpoint | Gives | Status |
|---|---|---|---|---|
| A | Assessor Parcel Universe | `nj4t-kc8j` | PIN↔location/municipality/class | ✓ 100%, ~150-400ms |
| A | Assessor Parcel Addresses | `3723-97qp` | property/owner/mailing address | ✓ |
| A | Assessor **Parcel Sales** | `wvhk-k5uv` | sale history + **buyer/seller name** + deed `doc_no` | ✓ (current owner spine) |
| A | Assessor Assessed Values | `uzyt-m557` | assessed value | ✓ |
| A | Treasurer Tax Sale | `55ju-2fs9` (annual), `ydgz-vkrp` (scavenger) | delinquency events | ✓ (dashed PIN) |
| B | **Clerk Recordings LIVE** | `crs.cookcountyclerkil.gov` | current mortgages/releases/liens/lis pendens by owner name | ✓ working (see §4) |
| C | Recorder Archive | `pu79-z8ux`,`33fu-uwca`,`nk2q-7kjv`,`7aey-b5t6` | mortgages/foreclosures/quitclaims **2011–2015** | ✓ historical only |
| D | Treasurer LIVE (current balance) | cookcountytreasurer.com | current taxes owed | ✗ 503 anti-bot from datacenter IP |
| D | Illinois SOS (UCC/entity) | ilsos.gov | UCC, LLC good-standing | ✗ 503 anti-bot |
| D | Circuit Court (probate/divorce/judgments) | Tyler Odyssey portal | litigation | needs headless Playwright; one host F5-blocked |
| D | PACER (bankruptcy/fed liens) | pacer | bankruptcy auto-stay | needs account, per-page fee |

---

## 4. Live recorder scrape contract (reproducible)

`crs.cookcountyclerkil.gov` — server-rendered ASP.NET, **no CAPTCHA**, Cloudflare
present but not challenging. Free index search; document images are paid.

1. `GET /Search/Additional` → capture cookies (`AWSALB`, `_cfuvid`, etc.) and the
   `__RequestVerificationToken` hidden input.
2. `POST /Search/Additional?Index=%23collapse2` (the grantor/grantee-name panel),
   `application/x-www-form-urlencoded`, with cookies + `Referer`, body:
   `__RequestVerificationToken`, `GTName` (UPPERCASE), `GTGECode=''`,
   `DocumentTypes=''`, `RecordedFromDate` (`M/D/YYYY`), `RecordedToDate`,
   **`submitButton=search`** (this last field is required — without it the form just
   echoes back).
3. Results are an HTML table; **anchor parsing on the 10-digit doc number** (a
   leading "View Doc" cell shifts fixed indices). Columns: View | Doc Number |
   Recorded | Executed | **Doc Type** | Consi. Amt. | 1st Grantor | 1st Grantee |
   Assoc. Doc# | 1st PIN. Result set **caps at 1,000** (narrow by date for prolific
   names). Index is **name-indexed LAST FIRST** — try name-order variants.

---

## 5. ★ MLS INTEGRATION — what the other (MLS-enabled) session should do

The MLS scraper supplies the **top of the funnel**: (a) new-listing **trigger**,
(b) the **listing agent's name + email** (the audience), (c) the **property
identifier** (address, and ideally **PIN/tax ID** — if present it removes the
address→PIN resolution risk entirely).

**Integration target = the batch runner.** `src/batch.mjs` consumes a CSV with these
columns (extras ignored):

```
address, pin (optional), agent_name (optional), agent_email (optional)
```

For each row it resolves the PIN (uses `pin` if given, else resolves from `address`),
runs the pipeline, writes an **agent-edition** HTML report to `./out/`, and appends to
`./out/summary.csv` (address, pin, owner, HIGH/MED/INFO counts, top flags, report path).
**It does not send email.**

**Your task in the MLS environment:**
1. Map the MLS scraper's listing output to the CSV columns above (especially pull the
   **tax PIN** if the MLS record carries it, and the **listing agent email**).
2. Either (a) write that CSV and call `node src/batch.mjs listings.csv`, or (b) import
   `runPipeline` from `pipeline.mjs` and call it per listing directly.
3. Add the **outreach layer** (email-only): take each report + agent email and send
   via the existing mailer stack (the Acuna engine already uses **Lob**/email tooling —
   reuse it; Resend is also in Ben's stack). Include opt-out (CAN-SPAM). **No SMS.**
4. Schedule it (daily cron / GitHub Actions — same pattern as the Acuna Daily Mailer)
   so new listings auto-generate + send.

**Net effect:** new listing detected → Deal-Risk Report generated → emailed to the
listing agent → inbound to the attorney. That closed loop is the business.

---

## 6. Paid fulfillment tier (build-vs-buy) — for completeness

For the *paid* in-deal product, buy wholesale title data rather than scrape:
- **Layer 1 — property/O&E API** (DataTree/First American, Black Knight SiteXPro,
  CoreLogic, TitlePoint): instant, ~$3–50/report.
- **Layer 2 — human title search** (Pippin, US Title Solutions, Mortgage Connect):
  current-owner ~$25–75, full ~$75–200, 24–72h, API/portal.
- **Layer 3 — full insurable commitment** (Qualia/Spruce/Doma/EnTitle).

These require a qualified title/legal business account — **the attorney's license
unlocks them** (Chris may already have a DataTrace/ATG account). Most TOS prohibit
*redistributing* raw data (fine to produce the firm's work product). Build a
wholesale adapter behind the same `pipeline.mjs` interface when an account/key exists.

---

## 7. Current status & what's left
- ✓ Open-data pipeline (Assessor/Treasurer/Recorder-archive) — built, tested, working.
- ✓ Live recorder scrape — built, tested, flags fire end-to-end.
- ⏳ Background agent adding: hardened address→PIN, false-positive reduction,
  agent-facing report (`--agent`), `batch.mjs`, `validate.mjs` + `VALIDATION.md`.
- ☐ MLS feed integration (this handoff) — top of funnel.
- ☐ Paid wholesale title adapter — needs an account/key (pending Chris's answer).
- ☐ Circuit Court (probate/divorce/judgments) — needs headless Playwright.
- ☐ Treasurer-live balance / ILSOS UCC — anti-bot blocked; need proxy or paid API.

## 8. Inputs still needed from Ben/Chris
- **Chris's title-agent status + current title vendor** (decides the paid tier; the
  question has been sent).
- **MLS access** (which this handoff is for) — and confirmation of whether the MLS
  record exposes the **tax PIN** and **agent email**.
```
