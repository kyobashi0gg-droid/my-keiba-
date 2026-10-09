# MY KEIBA LAB Odds Bridge (experimental)

Separate Render web service prototype. Run: `gunicorn app:app --bind 0.0.0.0:$PORT`.

Routes: `/health`, `/probe`, `/odds?track=東京&raceNo=1&raceId=202605040301`.

**Not production-ready.** SmartRC data is a dynamic client page; no verified odds API has been identified. Netkeiba's odds page may deny server access; its parser has not been validated against live HTML. The app refuses to invent odds or map dates to race IDs heuristically. The existing green button does not supply `raceId`, so this API cannot be connected as-is. Probe does not validate actual prices. No secrets or API keys required. Do not configure a live endpoint until a complete verified race is fetched.

Safety: only origin https://kyobashi0gg-droid.github.io allowed by CORS; 15-second in-memory cache; explicit numeric odds; rejects partial horse lists.
