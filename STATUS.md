# LifeOS 2.0 — Status

## Built
- [x] Repo init, CLAUDE.md, .gitignore — *17 May*
- [x] `scripts/import-health.py` — Apple Health XML → `_local/period-seed.json` (gitignored) — *17 May*
- [x] `modules/period/period-data.js` — all period math (mergeEntry, EWMA stats, predictions, fertile window) — *17 May*
- [x] `period-standalone.html` — standalone prototype: year calendar, stats panel, day logger, JSON export (gitignored) — *17 May*
- [x] Color palette — heavy/medium/light (reds), spotting (purple), predicted (blue ×3 fading), fertile (green) — *17 May*

## Built (continued)
- [x] `index.html` — app shell, tab bar, panel — *17 May*
- [x] `style/base.css` — all CSS variables, reset, typography — *17 May*
- [x] `style/layout.css` — tab bar + panel layout — *17 May*
- [x] `core/store.js` — localStorage load/save, subscribe, export/import JSON — *17 May*
- [x] `core/app.js` — tab routing, dynamic module import, lifecycle — *17 May*

## In progress
—

## Next
- [ ] `modules/period/period-ui.js` — period module for main app (integrates period-data.js)
- [ ] `style/components.css` — shared buttons, modals, chips, inputs

## Decisions
- localStorage primary (no download-per-save)
- Timezone is a user setting (`settings.timezone`), default `Asia/Tokyo`
- Period standalone first — proved data model before building app shell ✓
- `mergeEntry` merges adjacent entries automatically (gap ≤ 1 day)
- `period-standalone.html` and `scripts/` are gitignored (local prototypes / personal health data)
- EWMA λ=0.88 for cycle prediction — all history counts, recent weighted more
- Only filter cycles < 21 days (artifacts); long cycles (50–90d) are real
- BBT, symptoms, discharge stored globally (not per-entry) so off-period data isn't lost
