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

### View content padding — shared token (added 2026-06-28)
A view's scrollable content area uses `padding: var(--view-pad)` (= `s4 / s5 / s6` top/sides/bottom),
defined once in `base.css :root`. Applied to `.cal-month`, `.pr-content`, `.fin-body`, `.ak-view-body`.
Notes is a different sidebar/editor layout and keeps its own spacing. Change the standard in one place.

### Cleanup TODO for this step
- [x] Promote `.cal-header` container into `base.css` (was only in calendar.css; now shared)
- [x] Add `--view-pad` token + apply to calendar/period/finance/gacha bodies; remove duplicate `.pr-top`
- [ ] Optionally rename the `cal-*` shared classes to a neutral prefix (e.g. `view-head-*`) since
      they're app-wide, not calendar-specific — defer if risky, it touches every module's CSS+JS
- [x] Add a one-line pointer to this rule in `CLAUDE.md` so "create" always triggers it

---

## STEP 1 — Organize (do in levels, low risk first)

### Level 0 — Zero risk (delete confirmed dead, fix gitignore)
- [x] Confirm `modules/tasks/` truly unused, then remove it — DONE (live tasks UI lives in notes-tab.js)
- [x] `.DS_Store` — already gitignored and untracked, nothing to do
- [x] Commit

### Level 1 — Low risk (consistency moves, few refs each)
- [x] Move `style/period.css` → `modules/period/period.css`; refs updated in `period-ui.js` (`./period.css`) + `sw.js`
- [x] Group import feature: `import-v1.js` + `import-delta.js` → `core/import/`; refs updated in settings.js, import-data.html, sw.js
- [x] Bumped sw.js cache `seratus-v10` → `v11` so clients fetch the moved files
- [x] Smoke test: files exist at new paths, old gone, `node --check` passes on edited JS

### Level 2 — Group the mobile build (DECISION: marketing pages stay at root)
Jessica's call: marketing/static pages stay at root (normal, conventional, avoids URL churn).
Only the loose mobile build gets foldered.
- [x] ~~Move marketing pages to site/~~ — DECIDED AGAINST. They stay at root on purpose.
- [x] Move mobile build → `mobile/` (mobile.html, mobile.js, mobile.css)
- [x] Fix internal paths: mobile.html `../manifest.json ../icons ../style/base.css`; mobile.js `../core/store.js`
- [x] Update inbound refs: index.html + app.js redirects → `mobile/mobile.html`, sw.js shell, manifest `start_url`
- [x] Add `vercel.json` redirect `/mobile.html` → `/mobile/mobile.html` (protects installed PWA + bookmarks)
- [x] Bump sw cache v11 → v12
- [x] Smoke test: no stale refs, `node --check` on mobile.js/app.js/sw.js, manifest JSON valid

**Actual layout now:**
```
/  app.html  index.html  + marketing pages (about, terms, …)   ← stay at root
   core/        app.js store.js settings.js gestures.js lang.js
     import/    import-v1.js import-delta.js
   modules/     (period.css now lives here too)
   mobile/      mobile.html mobile.js mobile.css                ← grouped
   style/       base layout pages landing settings setup import
   lib/ icons/ scripts/
```

---

## STEP 2 — Identify used vs unused — FINDINGS (2026-06-28)

### 🔴🔴 CRITICAL: mobile and desktop store period FLOW in different shapes
Not just duplicated logic — the DATA MODELS differ, so the two devices misread each other's data.
- Desktop (`period-data.js` mergeEntry): entry = `{ id:'p_2026_06_28', start, end,
  flow:{ '2026-06-28':'heavy' }, symptoms:{}, bbt:{}, discharge:{}, notes }`. flow is a DATE-KEYED MAP.
- Mobile (`mobile.js` `_logFlow` ~L125): entry = `{ id:'mob_xxx', start, end, flow:'heavy' }`.
  flow is a SINGLE STRING for the whole entry. No bbt/discharge/notes.
- They share `period.entries` via the synced store, so: log flow on mobile → desktop sees the day as a
  period but `entry.flow[dateStr]` is undefined (no intensity), and vice versa. Symptoms (top-level
  `period.symptoms[date]`) DO line up; flow/bbt/discharge/notes/id do NOT.
- This is the likely real cause of "mobile and desktop feel slightly different."

**Two-part fix — DONE (2026-06-28, pending Jessica's phone test):**
1. [x] mobile.js now imports prediction math + write helpers from period-data.js (mergeEntry, removeDay,
   addSpotting/removeSpotting, setSymptom, periodStats, currentWindow, getPhase). Deleted its inline
   `_logFlow` merge copy, `_removeDate`, `_cycleStatus`, and dead `_shiftDate`.
2. [x] `migratePeriod()` added to period-data.js; runs in store.js `load()` (`_finishLoad`), converts
   old string-flow entries to the per-day map shape, idempotent, persists once if changed.
3. [x] 13 logic tests pass (scratchpad/ptest.mjs): migration correctness, idempotency, write path, guards.
4. [x] sw cache bumped to v13.
5. [ ] **PENDING: Jessica tests period flow on her phone after push** (log flow, symptoms, check desktop
   shows same). She exported a JSON backup first as rollback.

### mobile.js also reimplements (lower priority — different mobile UX, not pure dupes)
- mini calendar (`_buildMiniCal`), week view (`_buildWeekView`), notes tab (`_buildNotesTab`).
- These are simplified mobile renders, not 1:1 with desktop. Dedup is harder and less urgent than
  the period LOGIC above. Leave UI alone; only share the data/logic layer.

### Orphan page candidates (verify intent before deleting — both outward-facing)
- `changelog.html` — 191-byte stub that `<meta refresh>` redirects to `about.html`. No inbound links,
  no JS ref. Likely leftover for an old `/changelog` bookmark. Safe-ish to delete; low value either way.
- `coming-soon.html` — no inbound links, no JS ref. Either a Vercel destination for unbuilt features
  or dead. Confirm with Jessica before removing.

### NOT orphans (explained)
- `app.html` — 0 static hrefs but reached via JS (`index.html` sets `a.href='app.html'`, app.js redirects). Live.
- `period-standalone.html` — gitignored (local only), not in repo. Ignore.
- `scripts/import-health.py` — `scripts/` is gitignored; local cron tooling. Leave alone.

### Remaining for Step 2
- [ ] Dead-function scan inside the 3 giants (do as part of Step 3, right before splitting each)

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
- 2026-06-28 — Period dedup: unified mobile+desktop on period-data.js, added migratePeriod, 13 tests pass, sw v13. Pending phone test.
- 2026-06-28 — Step 2 analysis: found period-logic duplication (mobile.js vs period-data.js) + 2 orphan page candidates. Recorded, nothing deleted.
- 2026-06-28 — Level 2: grouped mobile build into mobile/, fixed paths, vercel redirect for old PWA URL, sw v12. Marketing pages stay at root (decided).
- 2026-06-28 — Level 1: moved period.css into modules/period/, grouped import files into core/import/, sw cache v11.
- 2026-06-28 — Level 0: removed dead `modules/tasks/` (orphan; real tasks UI is in notes-tab.js). DS_Store already clean.
- 2026-06-28 — Step 0: promoted `.cal-header` from calendar.css → base.css (now app-wide). Rename of cal-* deferred.
- 2026-06-28 — Added Step 0 CSS base template + "create" rule (also pinned in CLAUDE.md).
- 2026-06-28 — Investigated mobile build: confirmed ACTIVE (device-split, not legacy). Recorded above.
- 2026-06-28 — Audit complete, this doc created. No files moved yet.
