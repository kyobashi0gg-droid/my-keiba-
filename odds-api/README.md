# MY KEIBA LAB — Odds Bridge (experimental)

Branch: `experiment/odds-api-20261009`. Production GitHub Pages / `main` is unchanged.

## State (2026-10-09)

- Render test service exists and was healthy. **The running Render deploy is older than this branch**; later improvements are staged, not deployed.
- SmartRC v3 is publicly reachable from the Render test server, but its initial HTML includes no actual horse odds. The Ext JS app manifest names `app.js`, which defines `odds_tan` and `pop_tan` and has several `smartrc.php` calls. None is verified as a permissible odds API.
- Netkeiba's desktop odds URL returned an empty/short response in the earlier connectivity probe. The mobile odds HTML can be a placeholder without horse odds.
- The current server must return an error, not guessed horse odds: source, date, identity and full horse count are not yet verified.
- `GET /health` is only a server liveness check, not a verified-upstream indicator. `GET /probe` is connectivity-only.
- The site button in `odds-live-v49.js` on this branch now rejects incomplete or wrong-race snapshots, including different date/year, incomplete names/ranks, and duplicate rank.
- The frontend expects **track, raceNo, raceDate (YYYY-MM-DD), full horses (number,name,odds,popularity)**. Each value must come from the upstream and be matched to the current race; no guessed data.
- The site's newspaper `v3DateLabel` has a month/day but no year (e.g. `10/10(土)`). A full upstream date plus a near-current window is required.

## How to run repeatable guard tests

From repository root, with Node.js 18+:

`node --test tests/odds-snapshot.test.mjs`

Reference snapshot is the **Tokyo 1R 2026-10-10, 16-runner SmartRC screen updated 20:45:44 JST** provided by the user.

## Remaining before enabling auto-import

1. Verify an authorized, stable way to retrieve actual race-specific win odds from SmartRC or netkeiba.
2. Confirm race date, place and meeting/race identity from the same upstream source.
3. Validate all horses vs the screenshot at the same source update time. Avoid comparing old and new snapshots as if simultaneous.
4. Confirm response origin, access terms, rate limits, cache semantics and Render connectivity.
5. Deploy tested branch, set endpoint explicitly, and observe button success/failure without changing unrelated MY KEIBA LAB data.

**Never put stale, predicted, partial or fabricated odds into automatic import.**
