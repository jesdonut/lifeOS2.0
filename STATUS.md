# LifeOS 2.0 — Status

## Built
- [x] Repo init, CLAUDE.md, .gitignore

## In progress
—

## Next
- [ ] `index.html` — shell, navigation tabs, empty panels
- [ ] `style/base.css` — CSS variables, reset, typography
- [ ] `core/store.js` — localStorage save/load, day-change detection

## Decisions
- localStorage primary (no download-per-save)
- Timezone is a user setting (`settings.timezone`), default `Asia/Tokyo`
- Period module first after foundation — validate mergeEntry logic standalone before integrating
