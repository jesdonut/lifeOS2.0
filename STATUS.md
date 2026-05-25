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
- [x] `modules/calendar/calendar.js` + `calendar.css` — month view, 9 built-in categories, event add/edit/delete, drag-and-drop between days, park-for-later, view switcher (week/year stubs) — *18 May*
- [x] `modules/notes/notes.js` + `notes.css` — collapsible sidebar, parking lot for unscheduled events (schedule from sidebar), free-form notes with inline editing — *18 May*
- [x] `core/settings.js` + `style/settings.css` — full settings modal: profile (name, birth, timezone, nationalities, locations, currencies, period toggle), calendar categories (rename/add with color picker/delete custom), appearance (dark/light theme), data (export/import/clear + browser guide) — *18 May*
- [x] `coming-soon.html` — public-facing not-ready page; CTAs on landing point here; Vercel blocks `/app.html` and `/setup.html` to this — *18 May*
- [x] `import-data.html` — browser-based data import tool: Apple Health XML parser (flow, spotting, BBT, mucus, ovulation, contraceptive), coming soon cards for Clue/Flo/Natural Cycles/v1. Parsed locally, JSON download only, no data leaves device — *18 May*
- [x] `vercel.json` — redirects app.html and setup.html to coming-soon.html on production — *18 May*
- [x] `index.html` → landing page, `app.html` → app shell (renamed so Vercel serves landing at `/`) — *18 May*
- [x] `download.html` — plain-language guide: use in browser (no setup), offline ZIP download (Mac/Windows steps), fork for developers — *18 May*
- [x] `style/import.css` — CSS extracted from import-data.html; centered layout (640px max-width), panel/tab structure, drop zone, results, coming-soon panel — *18 May*
- [x] `style/pages.css` — `.nav-right`, `.nav-theme-btn` (min-width: 76px, stable), `.doc-page h3`, `ol/ul/li`, `.highlight p`, `.page-footer`, `.page-footer-links` — *18 May*
- [x] Landing page polish — feature grid 3×2, card jiggle (0.2s cycle, ±1deg, slow zoom separate), ink trail stationary fix, philosophy heading, tagline "yours for 100 years", footer cleanup — *18 May*
- [x] Theme toggle on all sub-pages (privacy, terms, license, coming-soon, import-data, download) — stable min-width, consistent IIFE pattern — *18 May*
- [x] Consistent footer across all sub-pages — 5 identical links: Download, License, Privacy, Terms, Import data — *18 May*
- [x] `privacy.html` — expanded import section (all sources), em dash fixes — *18 May*
- [x] `license.html` — em dash fixes — *18 May*
- [x] `changelog.html` — public feature history page: v1 origin, v2 milestones by date — *18 May*
- [x] Mobile responsive landing — preview carousel 2-col on ≤640px, features grid 2-col/1-col, period stats — *18 May*
- [x] `modules/period/period-ui.js` — period module UI: year calendar, day logger, stats panel, mood/symptom/BBT tracking, flow logging, cycle predictions — *22 May*
- [x] `modules/finance/finance.js` + `currency-view.js` + `finance.css` — sub-view tabs (Finance/Savings/Currency/Investment), income ledger with Japan salary breakdown (salary, transport allowance, health/care/pension/employment insurance, income tax, resident tax), spend totals from calendar by category — *22 May*
- [x] EN/ID language toggle on all public pages — `core/lang.js`, translations inline, stable button sizing, mobile fix — *23 May*
- [x] Indonesian translations for all public pages — *23 May*

## In progress

(none)

## Next

- [ ] `core/debug.js` — hidden debug panel (secret key combo): localStorage inspector, store state dump, simulate day change, date override for testing
- [ ] `modules/calendar/` — week view (Mon-Sun grid, daily spending per category, day totals)
- [ ] `modules/calendar/` — year view (monthly overview, goals, age display)
- [ ] `modules/bank/` — account balances, multi-country, multi-currency
- [ ] `modules/savings/` — fixed deposits, bonds, NISA (JP only), pension contributions
- [ ] `import-data.html` — Clue JSON parser
- [ ] `import-data.html` — Natural Cycles CSV parser
- [ ] `import-data.html` — Flo JSON parser
- [ ] `import-data.html` — LifeOS v1 JSON importer

## Decisions

- localStorage primary (no download-per-save)
- Timezone is a user setting (`settings.timezone`), default `Asia/Tokyo`
- Period standalone first — proved data model before building app shell
- `mergeEntry` merges adjacent entries automatically (gap <= 1 day)
- `period-standalone.html` and `scripts/` are gitignored (local prototypes / personal health data)
- EWMA lambda=0.88 for cycle prediction — all history counts, recent weighted more
- Only filter cycles < 21 days (artifacts); long cycles (50-90d) are real
- BBT, symptoms, discharge stored globally (not per-entry) so off-period data is not lost
- NISA and country-specific savings schemes rendered conditionally inside `savings/` based on `settings.country`
- Finance income fields adapt per country (Japan: salary, health insurance, pension, resident tax, etc.)
- No hardcoded hex values in JS — all colors via CSS variables
- Import tool is browser-only (no server, no data controller status) — no GDPR consent needed, inline privacy badge is sufficient
- Apple Health XML parsed with regex (not DOMParser) for performance on large exports; only period-related record types extracted
- Import output is JSON download only, not written directly to localStorage — user reviews before importing
- Calendar events with `date: null` are "parked" — live in `calendar.events`, filtered by notes sidebar
- Every user-created record gets `createdAt` (ISO) on create, `updatedAt` (ISO) on edit
- Calendar categories: 9 fixed defaults (CSS-var colors) + unlimited custom (stored hex). Managed in settings, read by calendar module
- `settings.weekStart = 'mon'` default; week view will use this
- Gesture axis locking: `e.preventDefault()` fires as soon as `|deltaX| > |deltaY|`, not after axis lock — prevents browser back/forward during accumulation
