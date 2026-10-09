# MY KEIBA LAB — Netkeiba odds bridge (private experiment)

**Status: the complete upstream pipeline passed in the Render test environment on 2026-10-10 JST. This is not yet connected to the production MY KEIBA LAB site.**

## Verified end-to-end

| Race on 2026-10-10 | Runner count | Status |
| --- | ---: | --- |
| Tokyo 9R 陣馬特別 | 9 | PASS |
| Tokyo 10R JRA電話 | 16 | PASS |
| Tokyo 11R サウジアラビアRC | 11 | PASS |
| Kyoto 10R 宇治川特別 | 15 | PASS |
| Kyoto 11R 御陵S | 13 | PASS |

Total: **64 / 64 runners** fetched and cross-checked in the test service. The source updatedAt values were approximately 07:09 JST at testing.

Pipeline:
1. Resolve the `dateLabel` (often `10/10(土)`) against Japanese-local current date.
2. Retrieve `race.netkeiba.com/top/race_list_sub.html?kaisai_date=YYYYMMDD`. Unlike the mobile list, this is date-scoped. Locate a **unique** meeting/race ID.
3. Retrieve `race.sp.netkeiba.com/race/shutuba.html?race_id=...`; parse the real full-field horse names and check the event date/track/race.
4. Retrieve netkeiba's JSON odds update endpoint `race.netkeiba.com/api/api_get_jra_odds.html?race_id=...&type=1&action=update`. It returns actual win odds and popularity even when HTML shows `---.-`. Check metadata `yy,jyo,kai,nichi,rno`, freshness, complete runners and unique ranks.
5. Expose a snapshot in the same contract expected by `odds-live-v49.js`: `{track, raceNo, raceDate, updatedAt, source, horses:[{number,name,odds,popularity}]}`. The frontend independently cross-checks **every** horse name against MY KEIBA LAB before invoking the legacy v12 importer.

## Protection and status

- **No scraping of paywalled content or cookies:** the test uses anonymously accessible source responses only.
- **Personal use only.** The netkeiba terms restrict sharing/distributing obtained data outside private use. Access to odds output must be limited to the individual user, not opened as a free public proxy.
- `GET /health` shows experimental service health; it **does not assert legal authorization** to redistribute odds.
- `GET /odds` remains **OFF by default**: `MYKEIBA_ODDS_ENABLED=0` and no configured `MYKEIBA_ODDS_ACCESS_KEY`.
- Private access requires server `MYKEIBA_ODDS_ENABLED=1` and `MYKEIBA_ODDS_ACCESS_KEY` of **32+ characters**. A matching key is sent in the `X-MYKEIBA-ACCESS` header. Missing/wrong keys cause 403, without accessing upstream.
- The **experiment-branch frontend** adds one-time `自動取得設定` UI for the HTTPS endpoint and private access key; the key is only stored on the individual's device, never in repository source.
- Backend caching: 30 minutes for date-scoped race list, 60 minutes for racecard, 45 seconds for odds. Frontend has 15-second duplicate-request cache.
- The data source and update timestamp must remain visible. Do not claim guaranteed final, official or near-real-time odds.
- Keep `MYKEIBA_RUN_TEST_ON_BOOT=0` normally. Enable temporarily in test service only to rerun five-race validation.

## Remaining before production

1. Confirm personal-use-only authorization, configure a strong private key in Render and a matching browser configuration; verify full browser CORS flow and response.
2. Test both successful and intentionally failing snapshots (race mismatch, missing horses, stale date, wrong key).
3. Only after private integration is tested, update the production `main` frontend and inspect the green button on mobile.
4. Continue to use the legacy manual text importer when netkeiba is unavailable.

**Existing MY KEIBA LAB production main/site remains unchanged.**
