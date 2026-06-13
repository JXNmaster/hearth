# Prompt for the MLS-equipped Claude session

Copy everything in the block below. Fill the [BRACKETS] first
(MLS scraper location, firm name/contact). Then paste it into the session on the
machine that has MLS access.

---

You're picking up an in-progress project. Two codebases are involved:

1. **The deal-risk title pre-clearance engine** — GitHub repo `JXNmaster/hearth`,
   branch `claude/revenue-folder-setup-jerou0`, path `revenue/deal-risk/`.
   Clone/pull that branch first.
2. **My existing Acuna MLS scraper** — at [PATH OR REPO, e.g. my `acuna-law` repo] —
   which has licensed MLS access and can pull active Cook County listings.

**FIRST, before doing anything**, read these in the deal-risk project start to finish:
`revenue/deal-risk/HANDOFF.md` (especially **Section 5 — MLS integration**), then
`SOURCES.md`, `VALIDATION.md`, and `README.md`. They explain the strategy, the data
sources, how the pipeline works, and the precision posture. Don't skip them.

**Your job:** connect my MLS scraper to the deal-risk batch runner so new listings
automatically become branded "Deal-Risk Reports" emailed to the listing agent.

Concretely:
1. From the MLS scraper, pull active/new Cook County listings. For each, extract:
   **property address**, the **tax PIN / PIN / tax ID if the MLS record carries it**
   (check for this — it removes the least-reliable step), the **listing agent's name**,
   and the **listing agent's email**.
2. Feed those into the batch runner. `revenue/deal-risk/src/batch.mjs` takes a CSV with
   columns: `address, pin (optional), agent_name (optional), agent_email (optional)`.
   Either write that CSV and run `node src/batch.mjs listings.csv`, or import
   `runPipeline` from `revenue/deal-risk/src/pipeline.mjs` and call it per listing. It
   writes agent-edition reports to `./out/` plus `./out/summary.csv`. It's
   zero-dependency Node 20+ (native fetch) — no npm install.
3. Add the **outreach layer (EMAIL ONLY)**: take each generated report + the agent's
   email and send via my existing Acuna mailer stack (Lob/Resend — reuse what's already
   wired in the scraper repo). Include a CAN-SPAM opt-out. **Do NOT send SMS/text** —
   cold-texting MLS-listed numbers is a TCPA liability.
4. Schedule it as a daily job (cron or GitHub Actions, same pattern as the Acuna Daily
   Mailer) so new listings auto-generate and send.

**Non-negotiables:**
- Honor the precision posture in `VALIDATION.md`. Only the low-false-positive findings
  (tax-sale delinquency, lis pendens, **PIN-matched** open mortgages, ownership/sales
  facts) may be presented as findings. Name-only liens/judgments with no PIN match must
  stay framed as "review recommended," never asserted. **Never show a false cloud** —
  that loses the agent.
- Keep the disclaimer on every report (preliminary attorney work product from public
  records; NOT a title commitment, insurance, or legal advice). Branding placeholders:
  firm = [FIRM NAME], contact = [FIRM CONTACT].
- Use my licensed MLS access via the scraper; don't scrape MLS in violation of its TOS.
- The live recorder is ~6–8s per property; throttle batch runs politely.

Test on a small real sample first (5–10 listings), eyeball the agent-edition reports,
then commit your integration to branch `claude/revenue-folder-setup-jerou0` and push.
Report back: listings processed, address→PIN resolution rate, and a couple of sample
reports.

(Context I'm chasing separately: whether the firm acts as an IL title agent — that
decides the paid "examiner title search" fulfillment tier. You don't need it for the
outreach engine; build that now.)
