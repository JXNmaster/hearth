# Source feasibility & accuracy ranking (tested 2026-06-13)

Ranked from live tests run from this environment. Latency = observed p50–p95.
"Accuracy" = how authoritative/complete the source is for title-clouding purposes.

## Tier A — Working now · structured · free · reliable  (Cook County open data / Socrata)
| Source | Dataset | What it gives | Latency | Accuracy | Notes / limits |
|---|---|---|---|---|---|
| Assessor Parcel Universe | `nj4t-kc8j` | PIN ↔ location, municipality, class | 150–400ms | High | bare 14-digit PIN |
| Assessor Parcel Addresses | `3723-97qp` | property / owner / **mailing** address | 140–315ms | High | no owner *name* |
| Assessor Parcel **Sales** | `wvhk-k5uv` | sale history + **buyer/seller name** + deed **doc_no** + deed type | 110–290ms | High | current owner = latest sale buyer; lags recording |
| Assessor Assessed Values | `uzyt-m557` | assessed value | 145–215ms | High | — |
| Treasurer **Tax Sale** (Annual `55ju-2fs9`, Scavenger `ydgz-vkrp`) | — | delinquency **events** (taxes sold at sale) | 120–430ms | High *when present* | **dashed** PIN; not a current balance |

**100% HTTP success across a 12-PIN sample.** This tier is the spine: address→PIN→owner→sales, plus tax-sale red flags.

## Tier B — Working now · live scrape · free · highest value
| Source | Endpoint | What it gives | Latency | Accuracy | Notes |
|---|---|---|---|---|---|
| **Cook County Clerk Recordings (LIVE)** | `crs.cookcountyclerkil.gov` GET token → POST `/Search/Additional?Index=%23collapse2` | **current** deeds, **mortgages, releases/satisfactions**, liens, **lis pendens**, assignments, by grantor/grantee name | 3–8s | High for instruments | name-indexed **LAST FIRST** (fallback handled); result cap 1,000 (narrow by date); release↔mortgage match via Assoc Doc# is heuristic; document images are **paid**. No CAPTCHA, Cloudflare present but not challenging. |

This is where real clouds surface (open mortgage w/o release, lis pendens, liens). Confirmed firing end-to-end.

## Tier C — Working now · historical only
| Source | Dataset | Coverage | Use |
|---|---|---|---|
| Recorder Archive — Mortgages / Foreclosures / Quitclaims | `pu79-z8ux`, `33fu-uwca`, `nk2q-7kjv`, `7aey-b5t6` | **2011 → 2015-03-27 only** | logic validation + old instruments; NOT current |

## Tier D — Blocked or engineering-heavy (need a key, proxy, or headless)
| Source | What it'd add | Status / blocker | Path to unblock |
|---|---|---|---|
| Treasurer **LIVE** | current tax **balance** owed | **HTTP 503** (Akamai bot-block from datacenter IP) | residential proxy, or a paid property-data API |
| **Illinois SOS** | UCC filings, **LLC/entity good-standing** | **HTTP 503** anti-bot | proxy, or IL SOS bulk/API access |
| **Circuit Court** (foreclosure/probate/divorce/judgments) | litigation + probate/heirship | Tyler Odyssey JS portal behind F5; `casesearch.*` host F5-blocked | headless Playwright + session/disclaimer handling (free to search); or LexisNexis paid docs |
| **PACER** | **bankruptcy** (auto-stay), federal tax liens | needs account, per-page fee (reasonably priced) | PACER account + API |
| Chicago Finance/Buildings | **water liens**, code/demolition liens | open data exists (separate portal) | integrate City open data |

## Headline accuracy caveat
Open data + name-indexed recordings are excellent for a **screening / lead-magnet** report, but they are **not** a substitute for a full PIN-based title search with document-image examination. Instruments recorded under a *prior* owner or a *name variant* can be missed by name search. For the **paid fulfillment** product, a wholesale title-data API or an abstractor search (PIN-based, examiner-reviewed) is the higher-fidelity spine — see the build-vs-buy note.
