# ZOMBI Dashboard Upgrade — 2026-09-28

## Implemented
- Dashboard now exposes all 25 games including the 10 new interactive games.
- Per-game controls: Enable/Disable, rounds, round time, cooldown, reward min, reward max, XP reward, allowed text channels, allowed starter roles.
- Owner plan matrix automatically includes the 10 new games for Free / Premium / Premium+ policy control.
- `/games` command sync payload now contains all 25 choices.
- Dashboard-sent Games Panel includes a dedicated select menu for the 10 new interactive games.
- Dashboard panel renderer now uses the new animated header and thin animated divider.
- Existing JSON config/database structure is retained; no destructive migration is used.

## Validation
- `npm run check` passes for the dashboard.
- Command payload test confirms 25 `/games` choices.

## Environment note
No production `.env` was included in the uploaded archive, so OAuth login and live database save tests could not be executed safely in this sandbox.
