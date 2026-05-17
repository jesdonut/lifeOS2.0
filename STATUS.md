# LifeOS 2.0 — Status

## Built
- [x] Repo init, CLAUDE.md, .gitignore
- [x] `scripts/import-health.py` — Apple Health XML → `_local/period-seed.json`
- [x] `modules/period/period-data.js` — all period math (mergeEntry, stats, predictions, fertile window)
- [x] `period-standalone.html` — year calendar, stats, day logger, JSON export

## In progress
—

## Next
- [ ] Run the parser with real data, verify stats + calendar look correct
- [ ] `index.html` — app shell, navigation tabs
- [ ] `style/base.css` — CSS variables, reset, typography
- [ ] `core/store.js` — localStorage save/load, day-change detection
- [ ] `modules/period/period-ui.js` — integrate into main app

## Decisions
- localStorage primary (no download-per-save)
- Timezone is a user setting (`settings.timezone`), default `Asia/Tokyo`
- Period standalone first — prove data model before building app shell
- `mergeEntry` merges adjacent entries automatically (gap ≤ 1 day)
