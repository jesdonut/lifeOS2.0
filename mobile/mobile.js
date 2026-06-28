// mobile.js — LifeOS mobile companion
// Reads/writes via Supabase store (same data as desktop)

import { load, get, save, getSession, signIn } from '../core/store.js';

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

// ── Theme ────────────────────────────────────────────────────────────
const _THEME_KEY = 'lifeOS_landing_theme';
let _mobTheme = localStorage.getItem(_THEME_KEY) || 'dark';
function _applyTheme(t) {
  _mobTheme = t;
  document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : '');
  localStorage.setItem(_THEME_KEY, t);
}
_applyTheme(_mobTheme);

// ── State ───────────────────────────────────────────────────────────
let _tab      = 'day';
let _calView  = 'day'; // 'day' | 'week'
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

  const firstDowSun  = new Date(y, m - 1, 1).getDay(); // 0=Sun
  const firstDow     = (firstDowSun + 6) % 7;          // shift so Mon=0
  const daysInMonth  = new Date(y, m, 0).getDate();
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
  for (const d of ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'])
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

// ── Add event sheet ───────────────────────────────────────────────────
function _showAddEvent(dateStr) {
  const d    = _D();
  const cats = [
    { id: 'personal',  label: 'Personal'  },
    { id: 'work',      label: 'Work'      },
    { id: 'health',    label: 'Health'    },
    { id: 'family',    label: 'Family'    },
    { id: 'friends',   label: 'Friends'   },
    { id: 'travel',    label: 'Travel'    },
    { id: 'education', label: 'Education' },
    { id: 'project',   label: 'Project'   },
    { id: 'partner',   label: 'Partner'   },
  ];

  const overlay = el('div', 'mob-sheet-overlay');
  const sheet   = el('div', 'mob-sheet');

  sheet.innerHTML = `
    <div class="mob-sheet-hdr">
      <span class="mob-sheet-title">Add event</span>
      <button class="mob-sheet-close">✕</button>
    </div>
    <div class="mob-sheet-body">
      <input id="ms-ev-title" type="text" placeholder="Title" autocomplete="off">
      <div class="mob-field-row">
        <input id="ms-ev-time" type="time" placeholder="Time (optional)">
      </div>
      <input id="ms-ev-location" type="text" placeholder="Location (optional)" autocomplete="off">
      <div class="mob-cat-grid" id="ms-ev-cats"></div>
      <button class="mob-sheet-save" id="ms-ev-save">Add</button>
    </div>
  `;
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  let selCat = 'personal';
  const catGrid = sheet.querySelector('#ms-ev-cats');
  cats.forEach(c => {
    const btn = el('button', 'mob-cat-btn' + (c.id === selCat ? ' active' : ''), c.label);
    btn.style.setProperty('--cat-color', `var(--cat-${c.id})`);
    btn.addEventListener('click', () => {
      selCat = c.id;
      catGrid.querySelectorAll('.mob-cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
    catGrid.appendChild(btn);
  });

  const close = () => overlay.remove();
  sheet.querySelector('.mob-sheet-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  sheet.querySelector('#ms-ev-save').addEventListener('click', () => {
    const title = sheet.querySelector('#ms-ev-title').value.trim();
    if (!title) { sheet.querySelector('#ms-ev-title').focus(); return; }
    const time     = sheet.querySelector('#ms-ev-time').value;
    const location = sheet.querySelector('#ms-ev-location').value.trim();
    const event = { id: _uid(), date: dateStr, title, category: selCat, categoryId: selCat };
    if (time)     event.startTime = time;
    if (location) event.location  = location;
    const cal = { ...(d.calendar || {}), events: [...(d.calendar?.events || []), event] };
    d.calendar = cal;
    _mobileData = d;
    save({ calendar: cal });
    close();
    _render();
  });

  setTimeout(() => sheet.querySelector('#ms-ev-title').focus(), 100);
}

// ── Add spend sheet ───────────────────────────────────────────────────
function _showAddSpend(dateStr) {
  const d    = _D();
  const cats = (d.settings?.spendCategories || []);

  const overlay = el('div', 'mob-sheet-overlay');
  const sheet   = el('div', 'mob-sheet');

  let selCat = cats[0]?.id || 'food';
  let selSub = '';

  sheet.innerHTML = `
    <div class="mob-sheet-hdr">
      <span class="mob-sheet-title">Add spend</span>
      <button class="mob-sheet-close">✕</button>
    </div>
    <div class="mob-sheet-body">
      <input id="ms-sp-amt" type="number" inputmode="numeric" placeholder="Amount (¥)">
      <div class="mob-cat-grid" id="ms-sp-cats"></div>
      <div class="mob-sub-wrap" id="ms-sp-subs"></div>
      <input id="ms-sp-note" type="text" placeholder="Note (optional)" autocomplete="off">
      <button class="mob-sheet-save" id="ms-sp-save">Add</button>
    </div>
  `;
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  function renderSubs() {
    const wrap = sheet.querySelector('#ms-sp-subs');
    const cat  = cats.find(c => c.id === selCat);
    const subs = cat?.sub || [];
    wrap.innerHTML = '';
    if (!subs.length) { selSub = ''; return; }
    selSub = selSub && subs.includes(selSub) ? selSub : subs[0];
    subs.forEach(s => {
      const btn = el('button', 'mob-sub-btn' + (s === selSub ? ' active' : ''), s);
      btn.addEventListener('click', () => {
        selSub = s;
        wrap.querySelectorAll('.mob-sub-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      wrap.appendChild(btn);
    });
  }

  const catGrid = sheet.querySelector('#ms-sp-cats');
  cats.forEach(c => {
    const btn = el('button', 'mob-cat-btn' + (c.id === selCat ? ' active' : ''), c.name);
    btn.style.setProperty('--cat-color', c.color || `var(--cat-${c.id})`);
    btn.addEventListener('click', () => {
      selCat = c.id;
      catGrid.querySelectorAll('.mob-cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderSubs();
    });
    catGrid.appendChild(btn);
  });
  renderSubs();

  const close = () => overlay.remove();
  sheet.querySelector('.mob-sheet-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  sheet.querySelector('#ms-sp-save').addEventListener('click', () => {
    const amt = parseFloat(sheet.querySelector('#ms-sp-amt').value);
    if (!amt || isNaN(amt)) { sheet.querySelector('#ms-sp-amt').focus(); return; }
    const note  = sheet.querySelector('#ms-sp-note').value.trim();
    const entry = { id: _uid(), categoryId: selCat, subcategory: selSub || '', amount: amt, currency: 'JPY', note };
    const prev  = d.calendar?.spendEntries?.[dateStr] || [];
    const spendEntries = { ...(d.calendar?.spendEntries || {}), [dateStr]: [...prev, entry] };
    const cal = { ...(d.calendar || {}), spendEntries };
    d.calendar = cal;
    _mobileData = d;
    save({ calendar: cal });
    close();
    _render();
  });

  setTimeout(() => sheet.querySelector('#ms-sp-amt').focus(), 100);
}

// ── Day detail (events + spend for one date) ─────────────────────────
function _buildDayDetail(dateStr) {
  const d    = _D();
  const frag = document.createDocumentFragment();

  const [sy, sm, sd] = dateStr.split('-').map(Number);
  const lbl = el('div', 'day-date-label',
    new Date(sy, sm - 1, sd).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  );
  frag.appendChild(lbl);

  // Events
  const events = (d.calendar?.events || []).filter(e => e.date === dateStr);
  const evSec  = el('div', 'day-section');
  const evHdr  = el('div', 'day-sec-hdr');
  evHdr.appendChild(el('span', 'day-sec-title', 'Events'));
  const evAdd = el('button', 'day-sec-add', '+');
  evAdd.addEventListener('click', () => _showAddEvent(dateStr));
  evHdr.appendChild(evAdd);
  evSec.appendChild(evHdr);
  if (events.length) {
    const list = el('div', 'day-list');
    for (const ev of events) {
      const item = el('div', 'day-item');
      const dot  = el('span', 'day-dot');
      dot.style.background = `var(--cat-${ev.categoryId ?? ev.category ?? 'personal'})`;
      item.appendChild(dot);
      const info = el('div', 'day-item-info');
      info.appendChild(el('span', 'day-item-title', ev.title));
      if (ev.startTime) info.appendChild(el('span', 'day-item-meta', ev.startTime));
      if (ev.location) {
        const loc = document.createElement('a');
        loc.className = 'day-item-location';
        loc.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.location)}`;
        loc.target = '_blank';
        loc.rel = 'noopener noreferrer';
        loc.innerHTML = `<span class="material-symbols-outlined">location_on</span>${ev.location}`;
        info.appendChild(loc);
      }
      item.appendChild(info);
      list.appendChild(item);
    }
    evSec.appendChild(list);
  } else {
    evSec.appendChild(el('div', 'day-empty', 'No events'));
  }
  frag.appendChild(evSec);

  // Spend
  const spendEntries = d.calendar?.spendEntries?.[dateStr] || [];
  const total  = spendEntries.reduce((s, e) => s + (e.amount || 0), 0);
  const spSec  = el('div', 'day-section');
  const spHdr  = el('div', 'day-sec-hdr');
  spHdr.appendChild(el('span', 'day-sec-title', 'Spend'));
  const spRight = el('div', 'day-sec-right');
  if (total) spRight.appendChild(el('span', 'day-sec-total', '¥' + total.toLocaleString()));
  const spAdd = el('button', 'day-sec-add', '+');
  spAdd.addEventListener('click', () => _showAddSpend(dateStr));
  spRight.appendChild(spAdd);
  spHdr.appendChild(spRight);
  spSec.appendChild(spHdr);
  if (spendEntries.length) {
    const list = el('div', 'day-list');
    const spendCats = d.settings?.spendCategories || [];
    for (const entry of spendEntries) {
      const cat  = spendCats.find(c => c.id === entry.categoryId);
      const item = el('div', 'day-item');
      const dot  = el('span', 'day-dot');
      dot.style.background = cat?.color || `var(--cat-${entry.categoryId})`;
      item.appendChild(dot);
      const info = el('div', 'day-item-info');
      const label = (cat?.name || entry.categoryId) + (entry.subcategory ? ' · ' + entry.subcategory : '');
      info.appendChild(el('span', 'day-item-title', label));
      if (entry.note) info.appendChild(el('span', 'day-item-meta', entry.note));
      item.appendChild(info);
      item.appendChild(el('span', 'day-item-amt', '¥' + (entry.amount || 0).toLocaleString()));
      list.appendChild(item);
    }
    spSec.appendChild(list);
  } else {
    spSec.appendChild(el('div', 'day-empty', 'No spend'));
  }
  frag.appendChild(spSec);

  return frag;
}

// ── Week view ────────────────────────────────────────────────────────
function _buildWeekView() {
  const d     = _D();
  const today = _todayStr();
  const events = d.calendar?.events || [];
  const spend  = d.calendar?.spendEntries || {};

  const wrap = el('div', 'cal-week-wrap');

  // Find Monday of the selected week
  const [sy, sm, sd] = _selDate.split('-').map(Number);
  const sel = new Date(sy, sm - 1, sd);
  const dow = sel.getDay(); // 0=Sun
  const startOfWeek = new Date(sel);
  startOfWeek.setDate(sd - ((dow + 6) % 7)); // Monday

  for (let i = 0; i < 7; i++) {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    const ds = day.toLocaleDateString('sv-SE');
    const dayLabel = day.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });

    const row  = el('div', 'cal-week-row' + (ds === today ? ' today' : '') + (ds === _selDate ? ' selected' : ''));
    const hdr  = el('div', 'cal-week-day-hdr');
    hdr.appendChild(el('span', 'cal-week-day-label', dayLabel));

    const dayEvts   = events.filter(e => e.date === ds);
    const daySpend  = spend[ds] || [];
    const spTotal   = daySpend.reduce((s, e) => s + (e.amount || 0), 0);
    if (spTotal) hdr.appendChild(el('span', 'cal-week-spend', '¥' + spTotal.toLocaleString()));
    row.appendChild(hdr);

    if (dayEvts.length) {
      const chips = el('div', 'cal-week-chips');
      dayEvts.slice(0, 4).forEach(ev => {
        const chip = el('div', 'cal-week-chip');
        chip.style.background = `color-mix(in srgb, var(--cat-${ev.category ?? 'personal'}) 18%, transparent)`;
        chip.style.color = `var(--cat-${ev.category ?? 'personal'})`;
        chip.textContent = ev.title;
        chips.appendChild(chip);
      });
      if (dayEvts.length > 4) chips.appendChild(el('span', 'cal-week-more', `+${dayEvts.length - 4} more`));
      row.appendChild(chips);
    }

    row.addEventListener('click', () => { _selDate = ds; _calView = 'day'; _render(); });
    wrap.appendChild(row);
  }

  return wrap;
}

// ── Calendar tab ─────────────────────────────────────────────────────
function _buildDayTab() {
  const wrap = el('div', 'tab-content');

  // View toggle: Day | Week only
  const toggle = el('div', 'cal-view-toggle-mob');
  for (const v of ['Day', 'Week']) {
    const b = el('button', 'cal-vtog-btn' + (_calView === v.toLowerCase() ? ' active' : ''), v);
    b.addEventListener('click', () => { _calView = v.toLowerCase(); _render(); });
    toggle.appendChild(b);
  }
  wrap.appendChild(toggle);

  if (_calView === 'week') {
    wrap.appendChild(_buildWeekView());
  } else {
    wrap.appendChild(_buildMiniCal(false));
    wrap.appendChild(_buildDayDetail(_selDate));
  }

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
  const notes = (d.notes?.items || [])
    .filter(n => !n.archived)
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
    card.appendChild(el('div', 'note-title', note.title || note.text?.split('\n')[0] || 'Untitled'));
    if (isOpen) {
      card.appendChild(el('div', 'note-body', note.text || ''));
    } else if (note.text) {
      card.appendChild(el('div', 'note-preview',
        note.text.slice(0, 140) + (note.text.length > 140 ? '…' : '')
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
        window.location.reload();
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
  const title = el('span', 'brand-pill-name mob-title');
  title.textContent = 'Seratus';
  title.addEventListener('click', _onTitleTap);
  hdr.appendChild(title);
  const themeBtn = el('button', 'mob-theme-btn');
  themeBtn.innerHTML = `<span class="material-symbols-outlined">${_mobTheme === 'light' ? 'dark_mode' : 'light_mode'}</span>`;
  themeBtn.addEventListener('click', () => { _applyTheme(_mobTheme === 'dark' ? 'light' : 'dark'); _render(); });
  hdr.appendChild(themeBtn);
  app.appendChild(hdr);

  const main = el('div', 'mob-main');
  if (_tab === 'day')    main.appendChild(_buildDayTab());
  if (_tab === 'period') main.appendChild(_buildPeriodTab());
  if (_tab === 'notes')  main.appendChild(_buildNotesTab());
  app.appendChild(main);

  app.appendChild(_buildBottomNav());
}

load().then(data => { _mobileData = data; _render(); });
