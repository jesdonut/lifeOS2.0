# LifeOS 2.0 — Cleanup Tracking

Living doc for the codebase cleanup. **Read this after CLAUDE.md** if cleanup work is the task.
Work top to bottom. Check boxes as you go. Never skip a level. Commit after each chunk.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Why

Root directory mixes three separate things: the **app** (`app.html` → `core/app.js` → `modules/*`),
a parallel **mobile build** (`mobile.html` + `mobile.js` + `mobile.css`, shares only `core/store.js`),
and a **static marketing site** (`index.html` + ~12 pages on `style/pages.css` + `core/lang.js`).
Plus a few oversized files. Goal: separate concerns into folders, kill dead code, shrink the giants.

---

## Audit snapshot (2026-06-28)

**Dead / unused**
- `modules/tasks/tasks.js` + `modules/tasks/tasks.css` — referenced by nothing. Confirmed dead.
- `.DS_Store` at root — should be gitignored, not tracked.

**Misplaced / inconsistent**
- `style/period.css` — every other module keeps CSS in `modules/<name>/`; period's is in `style/`.
- `core/import-v1.js` + `core/import-delta.js` — an import feature living loose in core/.
- `mobile.js` + `mobile.css` at root — the entire mobile app, ungrouped.

**Used but non-obvious**
- `modules/budget/` — IS used (imported by `finance.js` as a sub-view). Do NOT delete.
- `style/period.css` — loaded by `period-ui.js` at runtime AND listed in `sw.js`. Two refs to update if moved.
- `mobile.js` / `mobile.css` — ACTIVE, not legacy. Device split: `index.html:271` and `app.js:236`
  redirect mobile user-agents to `mobile.html`; desktop uses `app.html`. Keep both builds.
  Biggest dedup opportunity is shared logic between mobile.js and the desktop modules (see Step 2).

**Deploy note:** `vercel.json` is `{}` (no custom routing) and `.vercel/` project is `lifeosv2`.
Moving entry HTML out of root is therefore safe-ish but every internal `href` must be updated.

**Giants (split candidates, Level 3)**
- `modules/calendar/calendar.js` — 1890 lines
- `core/settings.js` — 1222 lines
- `modules/period/period-ui.js` — 1231 lines
- CSS: `finance.css` 1584, `calendar.css` 1302, `style/period.css` 1137

**Files that break if paths move** (update refs when moving anything):
- Every `*.html` (src/href links), `core/app.js` (dynamic `import()` map), `sw.js` (cache list), `mobile.html`, `vercel.json`.

---

## STEP 0 — CSS base / canonical template (do this FIRST)

**RULE: when Jessica says "create [a new thing]", the FIRST thing built is this header bar.**
Every new view starts from this shared pattern so the whole app looks like one app. Do not invent
a new header layout. Reuse these classes (they already exist in `style/base.css`).

### The pattern: `< date/label >  today  [ tab tab tab ]  + add  🔍`
Used today by Calendar, Notes, Finance, Gacha. The shared building blocks:

| Element | Class | Lives in | Role |
|---|---|---|---|
| Header container | `.cal-header` | `base.css` | flex row, 48px, bottom border |
| Prev / next arrows | `.cal-year-btn` | `base.css` | `‹` `›` step the date/range |
| Center label | `.cal-year-label` (or `.cal-week-label`) | `base.css` | the `< date >` / title |
| Today reset | `.cal-today-btn` | `base.css` | jumps back to now |
| Tab switcher | `.cal-view-toggle` + `.cal-view-btn` (`.active`) | `base.css` | the tabs (week/month/…) |
| Right action | `.cal-add-btn` (`margin-left:auto`) | `calendar.css` | `+ add` pushed to the right |

### Scaffold to copy when creating a new view
```js
const header = el('div', 'cal-header');
const prev  = el('button', 'cal-year-btn'); prev.textContent = '‹';
const label = el('span',   'cal-year-label'); label.textContent = title;
const next  = el('button', 'cal-year-btn'); next.textContent = '›';
const today = el('button', 'cal-today-btn'); today.textContent = 'today';
const tabs  = el('div', 'cal-view-toggle');
TABS.forEach(t => {
  const b = el('button', 'cal-view-btn' + (active === t ? ' active' : ''));
  b.textContent = t; b.onclick = () => { active = t; render(); };
  tabs.append(b);
});
const add = el('button', 'cal-add-btn'); add.textContent = '+ add';
header.append(prev, label, next, today, tabs, add);
// then below the header: a scroll body, e.g. <div class="*-scroll">
```
Reference implementation: `modules/calendar/calendar.js` lines ~170–253.

### Period exception (pink)
Period uses the SAME structure but its own accent. Don't fight it: the header classes pull from
`var(--accent)` / `var(--accent-2)`, and period's view sets those to pink, so the same markup just
renders pink. Keep the layout identical; only the accent variables differ.

### Cleanup TODO for this step
- [x] Promote `.cal-header` container into `base.css` (was only in calendar.css; now shared)
- [ ] Optionally rename the `cal-*` shared classes to a neutral prefix (e.g. `view-head-*`) since
      they're app-wide, not calendar-specific — defer if risky, it touches every module's CSS+JS
- [x] Add a one-line pointer to this rule in `CLAUDE.md` so "create" always triggers it

---

## STEP 1 — Organize (do in levels, low risk first)

### Level 0 — Zero risk (delete confirmed dead, fix gitignore)
- [ ] Confirm `modules/tasks/` truly unused, then remove it (or move to `_local/_archive/`)
- [ ] Remove `.DS_Store` from git tracking; ensure `.gitignore` covers `.DS_Store`
- [ ] Commit: `chore: remove dead tasks module and DS_Store`

### Level 1 — Low risk (consistency moves, few refs each)
- [ ] Move `style/period.css` → `modules/period/period.css`; update refs in `period-ui.js` + `sw.js`
- [ ] Group import feature: `core/import-v1.js` + `core/import-delta.js` → `core/import/`; update importers
- [ ] Verify app boots (load app.html locally), then commit per move

### Level 2 — Medium risk (separate the static site + mobile)
- [ ] Decide target layout (see proposal below) — get Jessica's OK on folder names
- [ ] Move marketing pages → `site/`: about, terms, privacy, license, download, coming-soon, changelog, calendar, finance, notes, period, import-data, period-standalone, setup
- [ ] Update all internal links between those pages + `vercel.json` rewrites + any nav
- [ ] Move mobile build → `mobile/` (mobile.html, mobile.js, mobile.css); update its refs + sw.js + vercel
- [ ] Full smoke test: landing → app → mobile → each marketing page

**Proposed target layout (confirm before executing):**
```
/  app.html  mobile.html  index.html       ← entry points stay at root for Vercel
   core/        app.js store.js settings.js gestures.js lang.js
     import/    import-v1.js import-delta.js
   modules/     (unchanged; period.css moves in here)
   mobile/      mobile.js mobile.css        ← if Vercel routing allows
   style/       base layout pages landing settings setup import
   site/        about terms privacy license download … (static marketing)
   lib/ icons/ scripts/
```

---

## STEP 2 — Identify used vs unused (deeper pass, after Step 1 settles structure)
- [ ] Dead-function scan in the 3 giant files before splitting them
- [ ] Confirm every `*.html` page is still linked from somewhere (orphan page check)
- [ ] Check `scripts/import-health.py` — still used by the cron pipeline?
- [ ] Check duplicated logic between `mobile.js` and `core/app.js` + modules (biggest dedup opportunity)
- [ ] Record findings here under "Audit snapshot" before deleting anything

---

## STEP 3 — Cleanup the giants (split in chunks, highest risk last)
Each split keeps the module contract (`init`/`destroy`/`onDataChange`). One file per logical piece.
- [ ] `core/settings.js` (1222) → split by settings section
- [ ] `modules/period/period-ui.js` (1231) → split render vs interaction vs sub-views
- [ ] `modules/calendar/calendar.js` (1890) → split month/week/event-edit/etc.
- [ ] CSS giants: split only if it helps; CSS size is less urgent than JS

---

## STEP 4 — Update docs (LAST, after structure is final)
- [ ] `README.md` — new structure + run instructions
- [ ] `BLUEPRINT.md` (local/gitignored) — architecture diagram of new folders
- [ ] `STATUS.md` — mark cleanup milestone
- [ ] `about.html` — only if user-facing content changed
- [ ] `CLAUDE.md` — update Key paths table + build order if folders changed

---

## Log (newest first)
- 2026-06-28 — Step 0: promoted `.cal-header` from calendar.css → base.css (now app-wide). Rename of cal-* deferred.
- 2026-06-28 — Added Step 0 CSS base template + "create" rule (also pinned in CLAUDE.md).
- 2026-06-28 — Investigated mobile build: confirmed ACTIVE (device-split, not legacy). Recorded above.
- 2026-06-28 — Audit complete, this doc created. No files moved yet.
