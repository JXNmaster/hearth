#!/bin/bash
#
# Deal-Risk daily entrypoint. Called by launchd (see com.hearth.dealrisk.plist).
# Mirrors the Acuna Daily Mailer pattern (scrape-on-mini.sh).
#
# Flow:
#   1. Source revenue/deal-risk/.env.local (FIRM_NAME/CONTACT/ADDRESS, EMAIL_FROM,
#      RESEND_API_KEY, optional MLS_EXPORT_DIR, optional SOCRATA_APP_TOKEN).
#   2. Run src/run-daily.mjs: latest ConnectMLS TSV -> reports -> outreach.
#   3. Outreach is DRY-RUN unless DEALRISK_SEND=1 (then --send; still CAN-SPAM-gated).
#
# Runs after the Acuna scraper (4 AM CT) so a fresh TSV exists. Output -> the log.

set -euo pipefail

PROJECT_DIR="/Users/benm4mini/Documents/Projects/05_Hearth/revenue/deal-risk"
LOG_PREFIX="[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [dealrisk-daily]"
cd "$PROJECT_DIR"

# Load env from .env.local if present. Use Node to parse so values with spaces/
# commas (e.g. FIRM_ADDRESS="123 W Main St, Suite 5, Chicago, IL") stay intact.
if [ -f .env.local ]; then
  eval "$(node -e "
    const fs=require('fs');
    for (const line of fs.readFileSync('.env.local','utf8').split('\n')) {
      const t=line.trim(); if(!t||t.startsWith('#')) continue;
      const i=t.indexOf('='); if(i<0) continue;
      const k=t.slice(0,i).trim(); let v=t.slice(i+1).trim();
      if((v.startsWith('\"')&&v.endsWith('\"'))||(v.startsWith(\"'\")&&v.endsWith(\"'\"))) v=v.slice(1,-1);
      console.log('export '+k+'='+JSON.stringify(v));
    }
  ")"
  echo "$LOG_PREFIX loaded .env.local"
else
  echo "$LOG_PREFIX no .env.local — outreach will stay dry-run / unconfigured"
fi

SEND_FLAG=""
if [ "${DEALRISK_SEND:-0}" = "1" ]; then SEND_FLAG="--send"; echo "$LOG_PREFIX DEALRISK_SEND=1 -> LIVE outreach"; else echo "$LOG_PREFIX outreach DRY-RUN (set DEALRISK_SEND=1 to send)"; fi

echo "$LOG_PREFIX starting run-daily"
node src/run-daily.mjs $SEND_FLAG
echo "$LOG_PREFIX done"
