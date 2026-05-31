# LifeOS 2.0 — Status

## Built

- [x] Repo init, CLAUDE.md, .gitignore — *17 May*
- [x] `scripts/import-health.py` — Apple Health XML to `_local/period-seed.json` (gitignored) — *17 May*
- [x] `modules/period/period-data.js` — all period math (mergeEntry, EWMA stats, predictions, fertile window) — *17 May*
- [x] `period-standalone.html` — standalone prototype: year calendar, stats panel, day logger, JSON export (gitignored) — *17 May*
- [x] Color palette — heavy/medium/light (reds), spotting (purple), predicted (blue x3 fading), fertile (green) — *17 May*
- [x] `index.html` — app shell, tab bar, panel — *17 May*
- [x] `style/base.css` — all CSS variables, reset, typography, light theme — *17 May*
- [x] `style/layout.css` — tab bar, panel layout, notes sidebar — *17 May*
- [x] `core/store.js` — localStorage load/save, subscribe, export/import JSON — *17 May*
- [x] `core/app.js` — tab routing, dynamic module import, gesture nav, theme toggle, settings button — *17 May*
- [x] `landing.html` — hero, preview carousel (4 scenes), feature cards with hover float, period ink trail, dark/light theme, scroll reveal — *18 May*
- [x] `setup.html` — onboarding: name, birthday, timezone, nationalities, locations, currencies, period toggle — *18 May*
- [x] `privacy.html` — privacy policy — *18 May*
- [x] `terms.html` — terms of use — *18 May*
- [x] `license.html` — full PolyForm NonCommercial license — *18 May*
- [x] `style/pages.css` + `style/setup.css` — CSS refactor for landing/setup pages — *18 May*
- [x] `style/landing.css` — landing page styles — *18 May*
- [x] `core/gestures.js` — horizontal swipe navigation between tabs, axis-locked to prevent browser back/forward — *18 May*
- [x] `lib/Sortable.min.js` — SortableJS 1.15.3, local copy — *18 May*
- [x] `modules/calendar/calendar.js` + `calendar.css` — week, month, and year views; 9 built-in categories; event add/edit/delete; drag-and-drop between days; park-for-later — *18 May*
- [x] `modules/notes/notes.js` + `notes.css` — collapsible sidebar, parking lot for unscheduled events, countdowns, free-form notes with markdown and inline editing — *18 May*
- [x] `core/settings.js` + `style/settings.css` — full settings modal: profile, calendar (first day of week, categories), spending categories, appearance (theme + accent color), data (export/import/v1/clear) — *18 May*
- [x] `coming-soon.html` — public-facing not-ready page — *18 May*
- [x] `import-data.html` — browser-based import: Apple Health XML parser, Seratus v1 JSON importer; all local, nothing leaves device — *18 May*
- [x] `vercel.json` — redirects app.html and setup.html to coming-soon.html on production — *18 May*
- [x] `index.html` → landing page, `app.html` → app shell — *18 May*
- [x] `download.html` — guide: use in browser, offline ZIP download, fork for developers — *18 May*
- [x] `style/import.css` — import page styles — *18 May*
- [x] Landing page polish — feature grid, card jiggle, ink trail, philosophy section, footer — *18 May*
- [x] Theme toggle on all sub-pages — *18 May*
- [x] Consistent footer across all sub-pages — *18 May*
- [x] `changelog.html` — public feature history — *18 May*
- [x] Mobile responsive landing — *18 May*
- [x] `modules/period/period-ui.js` — year calendar, day logger, stats panel, mood/symptom/BBT tracking, predictions — *22 May*
- [x] `modules/finance/finance.js` + sub-views — income ledger, spend totals, savings, currency, investment (bonds, deposits, NISA) — *22 May*
- [x] EN/ID language toggle on all public pages — *23 May*
- [x] `core/import-v1.js` — v1 to v2 JSON converter: events, spend, period, notes, finance, bank, bonds, currency — *25 May*
- [x] Notes sidebar delete button fix — sidebar-edge z-index was intercepting clicks — *28 May*
- [x] Period entry migration — v1 import used `length` field; v2 expects `end`; auto-migrated on first open — *28 May*
- [x] Settings: first day of week toggle (Mon/Sun) — *31 May*
- [x] Settings: accent color picker (6 presets, dark/light variants) — *31 May*
- [x] Bank module removed — Finance covers what was planned for Bank — *31 May*

## In progress

(none)

## Next

- [ ] `core/debug.js` — hidden debug panel (secret key combo): localStorage inspector, store state dump, simulate day change, date override for testing
- [ ] `import-data.html` — Clue JSON parser
- [ ] `import-data.html` — Natural Cycles CSV parser
- [ ] `import-data.html` — Flo JSON parser

## Decisions

- localStorage primary (no download-per-save)
- Timezone is a user setting (`settings.timezone`), default `Asia/Tokyo`
- Period standalone first — proved data model before building app shell
- `mergeEntry` merges adjacent entries automatically (gap <= 1 day)
- `period-standalone.html` and `scripts/` are gitignored (local prototypes / personal health data)
- EWMA lambda=0.88 for cycle prediction — all history counts, recent weighted more
- Only filter cycles < 21 days (artifacts); long cycles (50-90d) are real
- BBT, symptoms, discharge stored globally (not per-entry) so off-period data is not lost
- Finance income fields adapt per country (Japan: salary, health insurance, pension, resident tax, etc.)
- No hardcoded hex values in JS — all colors via CSS variables
- Import tool is browser-only — no GDPR consent needed, inline privacy badge sufficient
- Apple Health XML parsed with regex (not DOMParser) for performance on large exports
- Calendar events with `date: null` are "parked" — live in `calendar.events`, filtered by notes sidebar
- Every user-created record gets `createdAt` (ISO) on create, `updatedAt` (ISO) on edit
- Calendar categories: 9 fixed defaults (CSS-var colors) + unlimited custom (stored hex)
- `settings.weekStart`: 0 = Sunday, 1 = Monday (default)
- Gesture axis locking: `e.preventDefault()` fires as soon as `|deltaX| > |deltaY|`
- Bank module dropped — no separate bank tab; bank account data from v1 import is preserved in store but unused
