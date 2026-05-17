# LifeOS 2.0

A personal life OS built to last 100 years, starting from your birthday.

Set your birth year, timezone, and currencies once. Everything adapts from there. Data lives in your browser. No account. No server. No subscription.

---

## Modules

- **Calendar** — week, month, and year views. Tracks events and daily spending in one place, with itemized breakdowns and running totals.
- **Period tracker** — optional. Built for irregular cycles. Predictions sharpen with every cycle logged, and factor in lifestyle patterns over time.
- **Finance** — income and expenses with fields that adapt to your country's tax and deduction structure. Daily spending flows in from your calendar.
- **Bank & e-money** — account balances across banks and countries. Works across currencies.
- **Currency & FX** — lot tracking, rate logging, P&L in your base currency.
- **Savings** — fixed deposits, bonds, and investment accounts. Country-specific schemes (e.g. NISA for Japan) appear based on your settings.
- **Notes** — always one swipe away from any screen.

---

## Stack

Vanilla JS (ES Modules) · No build step · localStorage · SortableJS (drag and drop only)

---

## Data

Everything is stored in `localStorage`. Export to JSON anytime. Nothing is sent anywhere.

Apple Health data can be imported via `scripts/import-health.py` — runs locally, outputs to `_local/`, never leaves your device.

---

## Status

v2 is in active development. [v1](https://github.com/jesdonut/lifeOS) is working and in daily use.

---

## License

[PolyForm NonCommercial 1.0.0](LICENSE) — free for personal use. Attribution required. Commercial use not permitted.
