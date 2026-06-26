// mobile.js — LifeOS mobile companion
// Reads/writes via Supabase store (same data as desktop)

import { load, get, save, getSession, signIn } from './core/store.js';

let _mobileData = null;

const SYMPTOM_GROUPS = [
  { label: 'General', items: [
    { key: 'appetite_change', label: 'Appetite change' },
    { key: 'mood_change',     label: 'Mood change' },
    { key: 'sleep_change',    label: 'Sleep change' },
    { key: 'fatigue',         label: 'Fatigue' },
    { key: 'memory_lapse',    label: 'Memory lapse' },
    { key: 'hot_flashes',     label: 'Hot flashes' },
    { key: 'night_sweats',    label: 'Night sweats' },
    { key: 'chills',          label: 'Chills' },
  ]},
  { label: 'Skin & Hair', items: [
    { key: 'acne',      label: 'Acne' },
    { key: 'dry_skin',  label: 'Dry skin' },
    { key: 'hair_loss', label: 'Hair loss' },
    { key: 'itchy',     label: 'Itchy' },
  ]},
  { label: 'Pain', items: [
    { key: 'abdominal_cramp', label: 'Abdominal cramp' },
    { key: 'breast_pain',     label: 'Breast pain' },
    { key: 'headache',        label: 'Headache' },
    { key: 'lower_back_pain', label: 'Lower back pain' },
    { key: 'pelvic_pain',     label: 'Pelvic pain' },
  ]},
  { label: 'Digestive & Other', items: [
    { key: 'bloating',             label: 'Bloating' },
    { key: 'constipation',         label: 'Constipation' },
    { key: 'diarrhea',             label: 'Diarrhea' },
    { key: 'nausea',               label: 'Nausea' },
    { key: 'cravings',             label: 'Cravings' },
    { key: 'vaginal_dryness',      label: 'Vaginal dryness' },
    { key: 'bladder_incontinence', label: 'Bladder incontinence' },
  ]},
];

// ── State ───────────────────────────────────────────────────────────
let _tab      = 'day';
let _selDate  = _todayStr();
let _calMonth = { y: +_selDate.slice(0, 4), m: +_selDate.slice(5, 7) };
let _expandedNote = null;

// ── Data ────────────────────────────────────────────────────────────
function _D() {
  return _mobileData ?? get();
}

function _saveD(d) {
  _mobileData = d;
  save({ period: d.period });
  _render();
}

function _todayStr() {
  const tz = get().settings?.timezone ?? 'Asia/Tokyo';
  return new Date().toLocaleDateString('sv-SE', { timeZone: tz });
}

function _ds(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function _uid() {
  return 'mob_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function _shiftDate(s, n) {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return _ds(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

// ── Period logic ─────────────────────────────────────────────────────
function _getFlow(date) {
  const { entries = [], spotting = [] } = _D().period || {};
  if (spotting.includes(date)) return 'spotting';
  const e = entries.find(e => e.start <= date && date <= e.end);
  return e?.flow ?? 'none';
}

function _logFlow(date, flow) {
  const d = _D();
  const p = d.period || { entries: [], spotting: [], symptoms: {} };
  p.spotting = (p.spotting || []).filter(s => s !== date);

  if (flow === 'spotting') {
    p.entries = _removeDate(p.entries || [], date);
    p.spotting.push(date);
    d.period = p; _saveD(d); return;
  }
  if (flow === 'none') {
    p.entries = _removeDate(p.entries || [], date);
    d.period = p; _saveD(d); return;
  }

  const entries = p.entries || [];
  const within  = entries.find(e => e.start <= date && date <= e.end);
  if (within) { within.flow = flow; d.period = p; _saveD(d); return; }

  const prev = _shiftDate(date, -1);
  const next = _shiftDate(date, 1);
  const A = entries.find(e => e.end   === prev);
  const B = entries.find(e => e.start === next);

  if (A && B) { A.end = B.end; p.entries = entries.filter(e => e !== B); }
  else if (A)  { A.end   = date; }
  else if (B)  { B.start = date; B.flow = flow; }
  else         { entries.push({ id: _uid(), start: date, end: date, flow }); }

  d.period = p; _saveD(d);
}

function _removeDate(entries, date) {
  const out = [];
  for (const e of entries) {
    if (date < e.start || date > e.end)    { out.push(e); continue; }
    if (date === e.start && date === e.end) continue;
    if (date === e.start) { out.push({ ...e, start: _shiftDate(date, 1) }); continue; }
    if (date === e.end)   { out.push({ ...e, end:   _shiftDate(date, -1) }); continue; }
    out.push({ ...e, end: _shiftDate(date, -1) });
    out.push({ ...e, id: _uid(), start: _shiftDate(date, 1) });
  }
  return out;
}

function _toggleSymptom(date, key) {
  const d    = _D();
  const p    = d.period || {};
  const syms = p.symptoms || {};
  if (!syms[date]) syms[date] = {};
  if (syms[date][key]) {
    delete syms[date][key];
    if (!Object.keys(syms[date]).length) delete syms[date];
  } else {
    syms[date][key] = true;
  }
  p.symptoms = syms;
  d.period   = p;
  _saveD(d);
}

function _cycleStatus() {
  const { entries = [] } = _D().period || {};
  const today = _todayStr();
  const past  = entries.filter(e => e.start <= today).sort((a, b) => b.start.localeCompare(a.start));
  if (!past.length) return null;

  const last = past[0];
  const [ly, lm, ld] = last.start.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const startDate = new Date(ly, lm - 1, ld);
  const todayDate = new Date(ty, tm - 1, td);
  const cycleDay  = Math.floor((todayDate - startDate) / 86400000) + 1;

  let avgCycle = 28;
  if (past.length >= 2) {
    const gaps = [];
    for (let i = 0; i < Math.min(past.length - 1, 5); i++) {
      const [ay, am, ad] = past[i].start.split('-').map(Number);
      const [by, bm, bd] = past[i + 1].start.split('-').map(Number);
      gaps.push(Math.floor((new Date(ay, am - 1, ad) - new Date(by, bm - 1, bd)) / 86400000));
    }
    avgCycle = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
  }

  const nextDate = new Date(startDate);
  nextDate.setDate(nextDate.getDate() + avgCycle);
  const nextStr = nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  let phase;
  if (cycleDay <= 5)       phase = 'Menstrual';
  else if (cycleDay <= 13) phase = 'Follicular';
  else if (cycleDay <= 16) phase = 'Ovulation';
  else                     phase = 'Luteal';

  return { cycleDay, phase, nextStr };
}

// ── DOM helpers ──────────────────────────────────────────────────────
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls)             e.className   = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function btn(cls, text, onClick) {
  const b = el('button', cls, text);
  b.addEventListener('click', onClick);
  return b;
}

// ── Mini calendar ────────────────────────────────────────────────────
function _buildMiniCal(showPeriod) {
  const d = _D();
  const { entries = [], spotting = [] } = d.period || {};
  const events = d.calendar?.events        || [];
  const spend  = d.calendar?.spendEntries  || {};
  const today  = _todayStr();
  const { y, m } = _calMonth;

  const firstDow    = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const wrap        = el('div', 'mc-wrap');

  // Header
  const hdr = el('div', 'mc-hdr');
  hdr.appendChild(btn('mc-nav', '‹', () => {
    let nm = m - 1, ny = y;
    if (nm < 1) { nm = 12; ny--; }
    _calMonth = { y: ny, m: nm }; _render();
  }));
  hdr.appendChild(el('span', 'mc-month-label',
    new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  ));
  hdr.appendChild(btn('mc-nav', '›', () => {
    let nm = m + 1, ny = y;
    if (nm > 12) { nm = 1; ny++; }
    _calMonth = { y: ny, m: nm }; _render();
  }));
  wrap.appendChild(hdr);

  // Day-of-week labels
  const dowRow = el('div', 'mc-dow-row');
  for (const d of ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'])
    dowRow.appendChild(el('span', 'mc-dow', d));
  wrap.appendChild(dowRow);

  // Grid
  const grid = el('div', 'mc-grid');
  for (let i = 0; i < firstDow; i++)
    grid.appendChild(el('div', 'mc-cell mc-empty'));

  for (let day = 1; day <= daysInMonth; day++) {
    const ds   = _ds(y, m, day);
    const cell = el('div', 'mc-cell');

    if (showPeriod) {
      if (entries.some(e => e.start <= ds && ds <= e.end)) cell.classList.add('mc-period');
      if (spotting.includes(ds))                           cell.classList.add('mc-spotting');
    }
    if (ds === today)    cell.classList.add('mc-today');
    if (ds === _selDate) cell.classList.add('mc-sel');

    cell.appendChild(el('span', 'mc-num', String(day)));

    if (!showPeriod) {
      const hasEvent = events.some(e => e.date === ds);
      const hasSpend = !!(spend[ds]?.length);
      if (hasEvent || hasSpend) {
        const dots = el('div', 'mc-dots');
        if (hasEvent) dots.appendChild(el('span', 'mc-dot mc-dot-ev'));
        if (hasSpend) dots.appendChild(el('span', 'mc-dot mc-dot-sp'));
        cell.appendChild(dots);
      }
    }

    cell.addEventListener('click', () => { _selDate = ds; _render(); });
    grid.appendChild(cell);
  }

  wrap.appendChild(grid);
  return wrap;
}

// ── Day tab ──────────────────────────────────────────────────────────
function _buildDayTab() {
  const d    = _D();
  const wrap = el('div', 'tab-content');
  wrap.appendChild(_buildMiniCal(false));

  const [sy, sm, sd] = _selDate.split('-').map(Number);
  wrap.appendChild(el('div', 'day-date-label',
    new Date(sy, sm - 1, sd).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  ));

  // Events section
  const events = (d.calendar?.events || []).filter(e => e.date === _selDate);
  const evSec  = el('div', 'day-section');
  evSec.appendChild(el('div', 'day-sec-title', 'Events'));
  if (events.length) {
    const list = el('div', 'day-list');
    for (const ev of events) {
      const item = el('div', 'day-item');
      const dot  = el('span', 'day-dot');
      dot.style.background = `var(--cat-ev-${ev.categoryId ?? ev.category ?? 'personal'})`;
      item.appendChild(dot);
      const info = el('div', 'day-item-info');
      info.appendChild(el('span', 'day-item-title', ev.title));
      if (ev.startTime) info.appendChild(el('span', 'day-item-meta', ev.startTime));
      item.appendChild(info);
      list.appendChild(item);
    }
    evSec.appendChild(list);
  } else {
    evSec.appendChild(el('div', 'day-empty', 'No events'));
  }
  wrap.appendChild(evSec);

  // Spend section
  const spendEntries = d.calendar?.spendEntries?.[_selDate] || [];
  const total  = spendEntries.reduce((s, e) => s + (e.amount || 0), 0);
  const spSec  = el('div', 'day-section');
  const spHdr  = el('div', 'day-sec-hdr');
  spHdr.appendChild(el('span', 'day-sec-title', 'Spend'));
  if (total) spHdr.appendChild(el('span', 'day-sec-total', '¥' + total.toLocaleString()));
  spSec.appendChild(spHdr);
  if (spendEntries.length) {
    const list = el('div', 'day-list');
    for (const entry of spendEntries) {
      const item = el('div', 'day-item');
      const dot  = el('span', 'day-dot');
      dot.style.background = `var(--cat-${entry.categoryId})`;
      item.appendChild(dot);
      const catLabel = entry.categoryId
        ? entry.categoryId.charAt(0).toUpperCase() + entry.categoryId.slice(1)
        : '';
      const info = el('div', 'day-item-info');
      info.appendChild(el('span', 'day-item-title', catLabel + (entry.subcategory ? ' · ' + entry.subcategory : '')));
      if (entry.note) info.appendChild(el('span', 'day-item-meta', entry.note));
      item.appendChild(info);
      item.appendChild(el('span', 'day-item-amt', '¥' + (entry.amount || 0).toLocaleString()));
      list.appendChild(item);
    }
    spSec.appendChild(list);
  } else {
    spSec.appendChild(el('div', 'day-empty', 'No spend'));
  }
  wrap.appendChild(spSec);

  return wrap;
}

// ── Period tab ───────────────────────────────────────────────────────
function _buildPeriodTab() {
  const d    = _D();
  const syms = d.period?.symptoms || {};
  const wrap = el('div', 'tab-content');

  // Cycle status
  const status = _cycleStatus();
  if (status) {
    const bar = el('div', 'cycle-bar');
    bar.appendChild(el('span', 'cycle-day', `Day ${status.cycleDay}`));
    bar.appendChild(el('span', 'cycle-phase', status.phase));
    bar.appendChild(el('span', 'cycle-next', `Next ~${status.nextStr}`));
    wrap.appendChild(bar);
  }

  wrap.appendChild(_buildMiniCal(true));

  // Selected date label
  const [sy, sm, sd] = _selDate.split('-').map(Number);
  wrap.appendChild(el('div', 'day-date-label',
    new Date(sy, sm - 1, sd).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  ));

  // Flow
  const flowSec = el('div', 'period-section');
  flowSec.appendChild(el('div', 'period-sec-label', 'Flow'));
  const flowRow = el('div', 'flow-btns');
  const curFlow = _getFlow(_selDate);
  for (const f of ['none', 'light', 'medium', 'heavy', 'spotting']) {
    flowRow.appendChild(btn(
      'flow-btn' + (f === curFlow ? ' active' : '') + (f === 'spotting' ? ' spotting' : ''),
      f.charAt(0).toUpperCase() + f.slice(1),
      () => _logFlow(_selDate, f)
    ));
  }
  flowSec.appendChild(flowRow);
  wrap.appendChild(flowSec);

  // Symptoms
  const symSec = el('div', 'period-section');
  symSec.appendChild(el('div', 'period-sec-label', 'Symptoms'));
  const daySym = syms[_selDate] || {};
  for (const group of SYMPTOM_GROUPS) {
    symSec.appendChild(el('div', 'sym-group-label', group.label));
    const chips = el('div', 'sym-chips');
    for (const { key, label } of group.items) {
      chips.appendChild(btn(
        'sym-chip' + (daySym[key] ? ' active' : ''),
        label,
        () => _toggleSymptom(_selDate, key)
      ));
    }
    symSec.appendChild(chips);
  }
  wrap.appendChild(symSec);

  return wrap;
}

// ── Notes tab ────────────────────────────────────────────────────────
function _buildNotesTab() {
  const d     = _D();
  const notes = (d.notes?.notes || [])
    .slice()
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const wrap  = el('div', 'tab-content');

  if (!notes.length) {
    wrap.appendChild(el('div', 'day-empty', 'No notes yet'));
    return wrap;
  }

  const list = el('div', 'notes-list');
  for (const note of notes) {
    const isOpen = _expandedNote === note.id;
    const card   = el('div', 'note-card' + (isOpen ? ' expanded' : ''));
    card.appendChild(el('div', 'note-title', note.title || 'Untitled'));
    if (isOpen) {
      card.appendChild(el('div', 'note-body', note.body || ''));
    } else if (note.body) {
      card.appendChild(el('div', 'note-preview',
        note.body.slice(0, 140) + (note.body.length > 140 ? '…' : '')
      ));
    }
    card.addEventListener('click', () => { _expandedNote = isOpen ? null : note.id; _render(); });
    list.appendChild(card);
  }
  wrap.appendChild(list);
  return wrap;
}

// ── Bottom nav ───────────────────────────────────────────────────────
function _buildBottomNav() {
  const nav = el('div', 'bottom-nav');
  for (const { id, label, icon } of [
    { id: 'day',    label: 'Day',    icon: 'calendar_today' },
    { id: 'period', label: 'Period', icon: 'water_drop' },
    { id: 'notes',  label: 'Notes',  icon: 'note' },
  ]) {
    const b = el('button', 'nav-btn' + (_tab === id ? ' active' : ''));
    b.innerHTML = `<span class="material-symbols-outlined">${icon}</span><span class="nav-label">${label}</span>`;
    b.addEventListener('click', () => { _tab = id; _render(); });
    nav.appendChild(b);
  }
  return nav;
}

// ── Render (defined below with tap handler) ───────────────────────────────

function _showMobileLogin() {
  return new Promise(resolve => {
    const app = document.getElementById('mob-app');
    app.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100dvh;padding:24px;">
        <form id="mob-login" style="display:flex;flex-direction:column;gap:16px;width:100%;max-width:320px;">
          <span style="font-size:20px;font-weight:600;margin-bottom:8px;">Seratus</span>
          <input id="mob-email" type="email" placeholder="Email" autocomplete="email"
            style="padding:12px 16px;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:15px;">
          <input id="mob-pw" type="password" placeholder="Password" autocomplete="current-password"
            style="padding:12px 16px;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:15px;">
          <button type="submit"
            style="padding:12px 16px;border-radius:10px;border:none;background:var(--accent);color:#fff;font-size:15px;font-weight:600;">
            Sign in
          </button>
          <p id="mob-err" style="color:var(--red);font-size:13px;margin:0;min-height:1em;"></p>
        </form>
      </div>
    `;
    app.querySelector('#mob-login').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = app.querySelector('button[type=submit]');
      const err = app.querySelector('#mob-err');
      btn.disabled = true;
      btn.textContent = 'Signing in...';
      err.textContent = '';
      try {
        await signIn(app.querySelector('#mob-email').value, app.querySelector('#mob-pw').value);
        resolve();
      } catch (ex) {
        err.textContent = ex.message;
        btn.disabled = false;
        btn.textContent = 'Sign in';
      }
    });
  });
}

let _mobTaps = 0, _mobTapTimer = null;

function _onTitleTap() {
  _mobTaps++;
  clearTimeout(_mobTapTimer);
  _mobTapTimer = setTimeout(() => { _mobTaps = 0; }, 2000);
  if (_mobTaps >= 10) {
    _mobTaps = 0;
    getSession().then(s => { if (!s) _showMobileLogin().then(() => load().then(d => { _mobileData = d; _render(); })); });
  }
}

function _render() {
  const app = document.getElementById('mob-app');
  app.innerHTML = '';

  const hdr = el('div', 'mob-header');
  const title = el('span', 'mob-title', 'LifeOS');
  title.addEventListener('click', _onTitleTap);
  hdr.appendChild(title);
  app.appendChild(hdr);

  const main = el('div', 'mob-main');
  if (_tab === 'day')    main.appendChild(_buildDayTab());
  if (_tab === 'period') main.appendChild(_buildPeriodTab());
  if (_tab === 'notes')  main.appendChild(_buildNotesTab());
  app.appendChild(main);

  app.appendChild(_buildBottomNav());
}

load().then(data => { _mobileData = data; _render(); });
