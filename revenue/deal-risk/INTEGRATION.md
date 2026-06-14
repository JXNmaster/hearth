# MLS → Deal-Risk → Outreach integration

Wires the Acuna ConnectMLS feed into the deal-risk engine and out to listing
agents. Built 2026-06-13. Zero-dependency Node 20+ throughout.

## The chain
```
ConnectMLS export (TSV, from Acuna scraper)
  └─ src/mls/connectmls-to-csv.mjs   → listings.csv  (address + PIN [+ agent if present])
       └─ src/batch.mjs              → out/*.html agent reports + out/summary.csv
            └─ src/outreach/send.mjs → emails each listing agent (EMAIL-ONLY, dry-run by default)
src/run-daily.mjs orchestrates all three; deploy/com.hearth.dealrisk.plist runs it daily.
```

## Run it
```bash
# one listing, end to end (outreach dry-run):
node src/run-daily.mjs --limit 5

# pieces individually:
node src/mls/connectmls-to-csv.mjs <export.TSV> --out out/listings.csv
node src/batch.mjs out/listings.csv --out ./out --firm "Firm" --contact "email"
node src/outreach/send.mjs --summary ./out/summary.csv          # dry-run
node src/outreach/send.mjs --summary ./out/summary.csv --send   # live (gated)
```

## Configuration (`.env.local`, see `.env.example`)
`FIRM_NAME`, `FIRM_CONTACT`, `FIRM_ADDRESS` (physical — required for live send),
`EMAIL_FROM`, `RESEND_API_KEY`, optional `MLS_EXPORT_DIR`, `SOCRATA_APP_TOKEN`,
`DEALRISK_SEND=1` (flip outreach live in the launchd run).

## Schedule (Mac Mini, launchd)
```bash
cp deploy/com.hearth.dealrisk.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.hearth.dealrisk.plist
launchctl enable gui/$(id -u)/com.hearth.dealrisk
```
Runs 7:00 AM local (after the 4 AM Acuna scrape). Logs → `~/logs/dealrisk-daily.log`.

## Compliance gates (built in — do not weaken)
- **Email only.** No SMS path exists here (TCPA).
- **Dry-run by default.** Live send needs `--send` *and* `FIRM_NAME`+`FIRM_ADDRESS`+`EMAIL_FROM`+`RESEND_API_KEY`, or it refuses.
- **CAN-SPAM**: every email carries firm name + physical address, a clear opt-out, and a `List-Unsubscribe` header. Opt-outs go in `out/suppression.txt` (one email per line) and are honored on the next run.
- **Dedup**: never emails the same (agent, PIN) twice (`out/sent-log.csv`).
- **Precision posture (VALIDATION.md)**: reports assert only low-false-positive findings; name-only liens stay "review recommended." The engine fails safe — if a county source is down it reports "not established," never a false/blank-as-clean cloud.

## Status / open items (2026-06-13)
- ✓ Adapter, batch, outreach, orchestrator, launchd — built; outreach + chain smoke-tested in dry-run.
- ✓ PIN present in the MLS export (100% on sample) → address→PIN resolution bypassed.
- ⏳ **Real report validation** pending Socrata recovery (was in a scheduled maintenance window 2026-06-13 21:00–2026-06-14 01:00 UTC). When up, the engine populates with no code change.
- ☐ **Agent email**: NOT in the current ConnectMLS export. Add List Agent Name/Email columns to the export template (the adapter already auto-maps them) — and confirm **MRED TOS permits emailing agents** before flipping `DEALRISK_SEND=1`.
- ☐ **FIRM_NAME / FIRM_CONTACT / FIRM_ADDRESS** — fill in `.env.local`.
- ☐ Resilience: optional Socrata-down fallback to the treasurer-portal owner lookup (reuse Acuna's Puppeteer) so an outage never zeros a night's reports.
