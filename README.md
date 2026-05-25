# Seratus 2.0

A personal life OS, yours for 100 years, starting from your birthday.

Set your name, birth date, timezone, and currencies once. Everything adapts from there. Data lives in your browser. No account. No server. No subscription.

---

## What works now

**Calendar**
Month view with 9 built-in event categories (customizable in settings). Click any day to add or edit events. Drag events between days. Park an event for later if you haven't scheduled it yet — it moves to the Notes sidebar until you're ready.

**Notes sidebar**
Always one swipe away. Holds parked (unscheduled) events and free-form notes. Collapsible. Inline editing.

**Period tracker**
Year calendar with color-coded flow, predictions, and fertile window. Day logger for flow, mood, symptoms, and BBT. Stats panel with cycle averages and EWMA-weighted predictions.

**Finance**
Monthly income ledger with Japan-specific salary breakdown (salary, transport allowance, social insurance, taxes). Spend totals pulled from calendar by category. Sub-view tabs for Savings, Currency, and Investment (in progress).

**Language**
EN/ID toggle on all public pages. Indonesian translations throughout.

**Settings**
Full settings modal accessible from the top bar.
- Profile: name, date of birth, timezone, nationalities, locations, currencies, period tracker toggle
- Calendar: rename default categories, add custom ones with a color picker, delete custom categories
- Appearance: dark and light theme
- Data: export backup as JSON, import from backup, clear all data with browser-specific guide

**First-run setup**
A guided setup page on first visit. Collects name, birth date, timezone, nationalities, locations, and currencies. Everything editable later in settings.

---

## Planned

| Module | Notes |
|---|---|
| Debug panel | Hidden key-combo panel: localStorage inspector, store dump, date override |
| Bank & e-money | Account balances, multi-country, multi-currency |
| Savings | Fixed deposits, bonds, NISA (Japan), pension |
| Calendar: week view | Mon-Sun grid with daily spend per category |
| Calendar: year view | Monthly overview, goals, age display |
| Import: Clue, Flo, Natural Cycles | Browser-based parsers, JSON download only |

---

## Stack

Vanilla JS (ES Modules) · No build step · localStorage · SortableJS (drag and drop only)

---

## Data

Everything is stored in `localStorage`. Export to JSON anytime from Settings. Nothing is sent anywhere.

Apple Health period data can be imported via the browser-based [import-data.html](import-data.html) tool. Parsed locally, nothing leaves your device. Download as JSON to review before importing.

---

## v1

[v1](https://github.com/jesdonut/lifeOS) is a working monolith and still in daily use. v2 is a full rewrite with a modular architecture.

---

## License

[PolyForm NonCommercial 1.0.0](LICENSE): free for personal use. Attribution required. Commercial use not permitted.
