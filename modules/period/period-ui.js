// modules/period/period-ui.js

import {
  getPeriodEntries, periodStats, currentWindow, futurePredictions,
  ovulationDay, fertileWindow, getPhase, avgPeriodDuration,
  mergeEntry, removeDay, addSpotting, removeSpotting,
  setSymptom, setBbt, fd,
} from './period-data.js';

// ── Local date utils ───────────────────────────────────────────────
const D    = s => new Date(s + 'T12:00:00');
const dStr = d => d.toLocaleDateString('en-CA');
const addD = (d, n) => new Date(d.getTime() + n * 86400000);
const diffD = (a, b) => Math.round((b - a) / 86400000);

// ── Constants ──────────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const WDAYS  = ['M','T','W','T','F','S','S'];

const FLOW_OPTS = [
  { key: 'none',     label: 'No flow' },
  { key: 'spotting', label: 'Spotting' },
  { key: 'light',    label: 'Light' },
  { key: 'medium',   label: 'Medium' },
  { key: 'heavy',    label: 'Heavy' },
];

const SYM_LEFT = [
  { group: 'general', label: 'General', items: [
    { key: 'appetite_change', label: 'Appetite change' },
    { key: 'mood_change',     label: 'Mood change' },
    { key: 'sleep_change',    label: 'Sleep change' },
    { key: 'fatigue',         label: 'Fatigue' },
    { key: 'memory_lapse',    label: 'Memory lapse' },
    { key: 'hot_flashes',     label: 'Hot flashes' },
    { key: 'night_sweats',    label: 'Night sweats' },
    { key: 'chills',          label: 'Chills' },
  ]},
  { group: 'skin', label: 'Skin & Hair', items: [
    { key: 'acne',      label: 'Acne' },
    { key: 'dry_skin',  label: 'Dry skin' },
    { key: 'hair_loss', label: 'Hair loss' },
    { key: 'itchy',     label: 'Itchy' },
  ]},
];

const SYM_RIGHT = [
  { group: 'pain', label: 'Pain', items: [
    { key: 'abdominal_cramp', label: 'Abdominal cramp' },
    { key: 'breast_pain',     label: 'Breast pain' },
    { key: 'headache',        label: 'Headache' },
    { key: 'lower_back_pain', label: 'Lower back pain' },
    { key: 'pelvic_pain',     label: 'Pelvic pain' },
  ]},
  { group: 'digestive', label: 'Digestive & Other', items: [
    { key: 'bloating',              label: 'Bloating' },
    { key: 'constipation',          label: 'Constipation' },
    { key: 'diarrhea',              label: 'Diarrhea' },
    { key: 'nausea',                label: 'Nausea' },
    { key: 'cravings',              label: 'Cravings' },
    { key: 'vaginal_dryness',       label: 'Vaginal dryness' },
    { key: 'bladder_incontinence',  label: 'Bladder incontinence' },
  ]},
];

const SYM_EMOJI = {
  appetite_change:'🍽️', mood_change:'🌊', sleep_change:'🌙',
  fatigue:'😩', memory_lapse:'🌫️', hot_flashes:'🔥', night_sweats:'💦', chills:'🥶',
  acne:'😬', dry_skin:'🏜️', hair_loss:'💇', itchy:'🤌',
  abdominal_cramp:'😣', breast_pain:'😵', headache:'🤕', lower_back_pain:'😖', pelvic_pain:'😓',
  bloating:'🫧', constipation:'😤', diarrhea:'💩', nausea:'🤢',
  cravings:'🍫', vaginal_dryness:'🌵', bladder_incontinence:'💧',
};

const SYM_LABEL = {
  appetite_change:'Appetite change', mood_change:'Mood change', sleep_change:'Sleep change',
  fatigue:'Fatigue', memory_lapse:'Memory lapse', hot_flashes:'Hot flashes',
  night_sweats:'Night sweats', chills:'Chills',
  acne:'Acne', dry_skin:'Dry skin', hair_loss:'Hair loss', itchy:'Itchy',
  abdominal_cramp:'Abdominal cramp', breast_pain:'Breast pain', headache:'Headache',
  lower_back_pain:'Lower back pain', pelvic_pain:'Pelvic pain',
  bloating:'Bloating', constipation:'Constipation', diarrhea:'Diarrhea', nausea:'Nausea',
  cravings:'Cravings', vaginal_dryness:'Vaginal dryness', bladder_incontinence:'Bladder incontinence',
};

const PHASE_DATA = {
  menstrual: {
    label: 'Menstrual',
    color: 'var(--flow-medium)',
    desc: 'Estrogen and progesterone are at their lowest. Your uterine lining is shedding.',
    signals: ['Cramps', 'Fatigue', 'Lower back pain', 'Mood dips', 'Reduced energy'],
    fertility: 'Not fertile', fertilityColor: 'var(--text-3)',
  },
  follicular: {
    label: 'Follicular',
    color: 'var(--green)',
    desc: 'Estrogen is rising as your body matures a follicle and rebuilds the uterine lining. Energy tends to improve through this phase.',
    signals: ['Increasing energy', 'Better mood', 'Clearer skin', 'Higher motivation'],
    fertility: 'Low fertility', fertilityColor: 'var(--text-3)',
  },
  ovulatory: {
    label: 'Ovulatory',
    color: 'var(--purple)',
    desc: 'Estrogen peaks and LH surges. An egg is released or about to be. This is your most fertile window.',
    signals: ['Peak energy', 'High confidence', 'Clear stretchy discharge', 'Higher libido'],
    fertility: 'High fertility', fertilityColor: 'var(--purple)',
  },
  luteal: {
    label: 'Luteal',
    color: 'var(--amber)',
    desc: 'Progesterone rises to support potential implantation, then drops if no pregnancy occurs.',
    signals: ['Bloating', 'Tender breasts', 'Mood shifts', 'Cravings', 'Fatigue'],
    fertility: 'Not fertile', fertilityColor: 'var(--text-3)',
  },
};

// ── Module state ───────────────────────────────────────────────────
let _container   = null;
let _data        = null;
let _onSave      = null;
let _view        = 'day';
let _navDate     = null;
let _entries     = [];
let _stats       = null;
let _tipEl       = null;
let _dayModal    = null;

// ── Module contract ────────────────────────────────────────────────
export function init(container, data, onSave) {
  _container = container;
  _onSave    = onSave;
  _loadCss();
  _container.style.cssText = 'padding:0;overflow:hidden;position:relative;display:flex;flex-direction:column;';

  // Migrate v1-imported entries that have `length` but no `end`
  const rawEntries = data.period?.entries ?? [];
  const needsMigration = rawEntries.some(e => !e.end);
  if (needsMigration) {
    const fixed = rawEntries.map(e => {
      if (e.end) return e;
      const len = e.length ?? 1;
      const d   = new Date(e.start + 'T12:00:00');
      d.setDate(d.getDate() + len - 1);
      const end = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const { length: _l, ...rest } = e;
      return { ...rest, end };
    });
    data = { ...data, period: { ...(data.period ?? {}), entries: fixed } };
    onSave({ period: data.period });
  }

  _data    = data;
  _navDate = _todayStr();
  _entries = getPeriodEntries(data);
  _stats   = periodStats(_entries);
  _render();
}

export function destroy() {
  if (_container) _container.style.cssText = '';
  if (_tipEl)    { _tipEl.remove();    _tipEl    = null; }
  if (_dayModal) { _dayModal.remove(); _dayModal = null; }
  _container = null;
  _data      = null;
  _onSave    = null;
  _navDate   = null;
}

export function onDataChange(newData) {
  _data    = newData;
  _entries = getPeriodEntries(newData);
  _stats   = periodStats(_entries);
}

// ── Render ─────────────────────────────────────────────────────────
function _render() {
  if (!_container) return;
  _hideTip();
  _container.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'pr-root';
  root.appendChild(_buildTop());
  const content = document.createElement('div');
  content.className = _view === 'cycles' ? 'pr-content pr-content--cycles' : 'pr-content';
  if      (_view === 'day')    _buildDayView(content);
  else if (_view === 'week')   _buildWeekView(content);
  else if (_view === 'month')  _buildMonthView(content);
  else if (_view === 'cycles') _buildCycles(content);
  else                         _buildOverview(content);
  root.appendChild(content);
  _container.appendChild(root);
}

// ── Top bar ────────────────────────────────────────────────────────
function _buildTop() {
  const top = document.createElement('div');
  top.className = 'pr-top';

  const today = _todayStr();

  if (_view === 'cycles') {
    const lbl = document.createElement('span');
    lbl.className = 'cal-year-label';
    const cycleDay = _cycleDay(today);
    lbl.textContent = _fmtDate(today) + (cycleDay ? ` · Day ${cycleDay}` : '');
    top.appendChild(lbl);
  } else {
    const prevBtn = document.createElement('button'); prevBtn.className = 'cal-year-btn'; prevBtn.textContent = '‹';
    const lbl     = document.createElement('span');   lbl.className = 'cal-year-label';
    const nextBtn = document.createElement('button'); nextBtn.className = 'cal-year-btn'; nextBtn.textContent = '›';
    const todBtn  = document.createElement('button'); todBtn.className  = 'cal-today-btn'; todBtn.textContent = 'today';

    if (_view === 'day') {
      lbl.textContent = new Date(_navDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      prevBtn.addEventListener('click', () => { _navDate = dStr(addD(D(_navDate), -1)); _render(); });
      nextBtn.addEventListener('click', () => { _navDate = dStr(addD(D(_navDate),  1)); _render(); });
      const onToday = _navDate === today;
      todBtn.disabled = onToday; todBtn.style.opacity = onToday ? '0.35' : '1';
      todBtn.addEventListener('click', () => { _navDate = today; _render(); });
    } else { // year
      const y         = parseInt(_navDate.slice(0, 4));
      const curYear   = parseInt(today.slice(0, 4));
      const birthYear = _data?.settings?.birthYear ?? null;
      const minYear   = birthYear ? Math.max(birthYear, curYear - 50) : curYear - 10;
      lbl.textContent  = String(y);
      prevBtn.disabled = y <= minYear;
      nextBtn.disabled = y >= curYear + 1;
      prevBtn.addEventListener('click', () => { _navDate = _shiftYear(_navDate, -1); _render(); });
      nextBtn.addEventListener('click', () => { _navDate = _shiftYear(_navDate,  1); _render(); });
      const onYear = y === curYear;
      todBtn.disabled = onYear; todBtn.style.opacity = onYear ? '0.35' : '1';
      todBtn.addEventListener('click', () => { _navDate = today; _render(); });
    }
    top.append(prevBtn, lbl, nextBtn, todBtn);
  }

  // View toggle — always on the right, matching Calendar layout
  const tabs = document.createElement('div');
  tabs.className = 'cal-view-toggle';
  [
    { v: 'day',    label: 'Day' },
    { v: 'year',   label: 'Year' },
    { v: 'cycles', label: 'Cycles' },
  ].forEach(({ v, label }) => {
    const btn = document.createElement('button');
    btn.className = 'cal-view-btn' + (_view === v ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => { if (_view !== v) { _view = v; _render(); } });
    tabs.appendChild(btn);
  });
  top.appendChild(tabs);

  return top;
}

// ── Date nav helpers ───────────────────────────────────────────────
function _weekBounds(date) {
  const d   = D(date);
  const dow = (d.getDay() + 6) % 7; // 0=Mon
  return { mon: dStr(addD(d, -dow)), sun: dStr(addD(d, 6 - dow)) };
}

function _shiftMonth(date, n) {
  const [y, m, day] = date.split('-').map(Number);
  let ny = y, nm = m + n;
  while (nm > 12) { nm -= 12; ny++; }
  while (nm < 1)  { nm += 12; ny--; }
  const max = new Date(ny, nm, 0).getDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(day, max)).padStart(2, '0')}`;
}

function _shiftYear(date, n) {
  const [y, m, day] = date.split('-').map(Number);
  const ny  = y + n;
  const max = new Date(ny, m, 0).getDate();
  return `${ny}-${String(m).padStart(2, '0')}-${String(Math.min(day, max)).padStart(2, '0')}`;
}

// ── Day view ───────────────────────────────────────────────────────
function _buildDayView(el) {
  const today  = _todayStr();
  const ds     = _navDate;
  const counts = _countSymptoms();

  const wrap = document.createElement('div');
  wrap.className = 'pr-day-view';

  // Phase/status info if viewing today
  if (ds === today) {
    const phasePanel = _buildPhasePanel();
    if (phasePanel) wrap.appendChild(phasePanel);
  }

  const grid = document.createElement('div'); grid.className = 'pr-log-grid';
  const left  = document.createElement('div'); left.className  = 'pr-log-col';
  const right = document.createElement('div'); right.className = 'pr-log-col';

  left.appendChild(_buildFlowChips(ds));
  SYM_LEFT.forEach(g  => left.appendChild(_buildSymGroup(g, ds, counts)));
  right.appendChild(_buildBbtInput(ds));
  SYM_RIGHT.forEach(g => right.appendChild(_buildSymGroup(g, ds, counts)));

  grid.append(left, right);
  wrap.appendChild(grid);
  el.appendChild(wrap);
}

// ── Week view ──────────────────────────────────────────────────────
function _buildWeekView(el) {
  const today = _todayStr();
  const cache = _buildDayCache();
  const { mon } = _weekBounds(_navDate);

  const strip = document.createElement('div');
  strip.className = 'pr-week-strip';

  for (let i = 0; i < 7; i++) {
    const ds  = dStr(addD(D(mon), i));
    const d   = D(ds);
    const col = document.createElement('div');
    col.className = 'pr-week-col' + (ds === _navDate ? ' selected' : '') + (ds === today ? ' today' : '');

    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum  = d.getDate();

    const nameEl = document.createElement('div'); nameEl.className = 'pr-wk-name'; nameEl.textContent = dayName;
    const numEl  = document.createElement('div'); numEl  .className = 'pr-wk-num';  numEl.textContent  = dayNum;

    const indicator = document.createElement('div'); indicator.className = 'pr-wk-ind';
    if (cache.periodDays[ds])            indicator.classList.add('period', `flow-${cache.periodDays[ds]}`);
    else if (cache.spottingSet.has(ds))  indicator.classList.add('spotting');
    else if (cache.predictedSet.has(ds)) indicator.classList.add('predicted');
    else if (cache.fertileSet.has(ds))   indicator.classList.add('fertile');

    if (cache.symptomDays[ds]?.length) {
      const dot = document.createElement('span'); dot.className = 'pr-wk-symdot';
      col.appendChild(dot);
    }

    col.append(nameEl, numEl, indicator);
    col.addEventListener('click', () => { _navDate = ds; _view = 'day'; _render(); });
    strip.appendChild(col);
  }

  el.appendChild(strip);
}

// ── Month view ─────────────────────────────────────────────────────
function _buildMonthView(el) {
  const today   = _todayStr();
  const [y, m]  = _navDate.split('-').map(Number);
  const cache   = _buildDayCache();

  const phasePanel = _buildPhasePanel();
  if (phasePanel) el.appendChild(phasePanel);

  const card = document.createElement('div');
  card.className = 'pr-month-single';
  _calGrid(card, y, m - 1, today, cache, true);
  el.appendChild(card);
}

// ── Year view (was Overview) ───────────────────────────────────────
function _buildOverview(el) {
  const phasePanel = _buildPhasePanel();
  if (phasePanel) {
    el.appendChild(phasePanel);
  } else {
    const hl = document.createElement('div');
    hl.className = 'pr-headline';
    const { main, italic } = _headlineText();
    const h1 = document.createElement('h1');
    h1.className = 'pr-h1';
    const s = document.createElement('span'); s.textContent = main; h1.appendChild(s);
    if (italic) { const em = document.createElement('em'); em.className = 'pr-em'; em.textContent = italic; h1.appendChild(em); }
    const sub = document.createElement('p'); sub.className = 'pr-hl-sub'; sub.textContent = _headlineSub();
    const textGroup = document.createElement('div'); textGroup.className = 'pr-hl-text';
    textGroup.append(h1, sub);
    const pills = document.createElement('div'); pills.className = 'pr-status-pills';
    _statusPills().forEach(({ color, text }) => {
      const pill = document.createElement('div'); pill.className = 'pr-status-pill';
      pill.innerHTML = `<span class="pr-status-dot" style="background:${color}"></span><span>${text}</span>`;
      pills.appendChild(pill);
    });
    hl.append(textGroup, pills);
    el.appendChild(hl);
  }

  const ys = document.createElement('div'); ys.className = 'pr-year-section';

  const today   = _todayStr();
  const year    = parseInt(_navDate.slice(0, 4));

  const grid = document.createElement('div'); grid.className = 'pr-year-grid';
  const cache = _buildDayCache();
  for (let m = 0; m < 12; m++) grid.appendChild(_buildMonthCard(year, m, today, cache));
  ys.appendChild(grid);
  el.appendChild(ys);
}

// ── Day cache ──────────────────────────────────────────────────────
function _buildDayCache() {
  const periodDays = {};
  for (const e of _entries) {
    let d = D(e.start), end = D(e.end);
    while (d <= end) { const ds = dStr(d); periodDays[ds] = e.flow?.[ds] ?? 'medium'; d = addD(d, 1); }
  }
  const spottingSet  = new Set(_data.period?.spotting ?? []);
  const win          = _stats ? currentWindow(_entries, _stats) : null;
  const preds        = _stats ? futurePredictions(_entries, _stats, 5) : [];
  const predictedSet = new Set();
  for (const p of [win, ...preds].filter(Boolean)) {
    let d = D(fd(p.earliest)), end = D(fd(p.latest));
    while (d <= end) { const ds = dStr(d); if (!periodDays[ds] && !spottingSet.has(ds)) predictedSet.add(ds); d = addD(d, 1); }
  }
  const fertileSet = new Set();
  let ovStr = null;
  if (win) {
    const fw = fertileWindow(win);
    let d = D(fd(fw.start)), end = D(fd(fw.end));
    while (d <= end) { fertileSet.add(dStr(d)); d = addD(d, 1); }
    ovStr = fd(ovulationDay(win));
  }
  const symptomDays = {};
  for (const [ds, sym] of Object.entries(_data.period?.symptoms ?? {})) {
    const keys = Object.keys(sym).filter(k => sym[k]);
    if (keys.length) symptomDays[ds] = keys;
  }
  for (const e of _entries) {
    for (const [ds, sym] of Object.entries(e.symptoms ?? {})) {
      const keys = Object.keys(sym).filter(k => sym[k]);
      if (keys.length) symptomDays[ds] = [...new Set([...(symptomDays[ds] ?? []), ...keys])];
    }
  }
  const travelDays = new Set(
    (_data.calendar?.events ?? [])
      .filter(e => e.category === 'travel')
      .map(e => e.date)
  );
  return { periodDays, spottingSet, predictedSet, fertileSet, ovStr, symptomDays, travelDays };
}

// ── Month card (mini) ──────────────────────────────────────────────
function _buildMonthCard(year, monthIdx, todayStr, cache) {
  const card = document.createElement('div');
  card.className = 'pr-month-card';
  const prefix = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
  if (todayStr.startsWith(prefix)) card.classList.add('current');

  const hdr = document.createElement('div'); hdr.className = 'pr-month-hdr';
  const name = document.createElement('span'); name.className = 'pr-month-name'; name.textContent = MONTHS[monthIdx];
  hdr.appendChild(name);
  const badge = _monthBadge(year, monthIdx, todayStr);
  if (badge) { const b = document.createElement('span'); b.className = `pr-month-badge ${badge.cls}`; b.textContent = badge.text; hdr.appendChild(b); }
  card.appendChild(hdr);

  _calGrid(card, year, monthIdx, todayStr, cache, false);

  const snippet = _monthSnippet(year, monthIdx, todayStr);
  if (snippet) { const p = document.createElement('p'); p.className = 'pr-month-snippet'; p.textContent = snippet; card.appendChild(p); }

  return card;
}

function _calGrid(parent, year, monthIdx, todayStr, cache, large) {
  const dowRow = document.createElement('div'); dowRow.className = 'pr-cal-row pr-cal-dow';
  WDAYS.forEach(d => { const c = document.createElement('div'); c.className = 'pr-cal-cell'; c.textContent = d; dowRow.appendChild(c); });
  parent.appendChild(dowRow);

  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  let offset = new Date(year, monthIdx, 1).getDay() - 1;
  if (offset < 0) offset = 6;
  const cells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  for (let r = 0; r < Math.ceil(cells.length / 7); r++) {
    const row = document.createElement('div'); row.className = 'pr-cal-row';
    for (let c = 0; c < 7; c++) {
      const day = cells[r * 7 + c];
      const cell = document.createElement('div'); cell.className = 'pr-cal-cell';
      if (day != null) {
        const ds    = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const inner = document.createElement('div');
        inner.className = 'pr-day' + (large ? ' pr-day-lg' : '');
        inner.textContent = day;
        if (ds === todayStr)                 inner.classList.add('today');
        if (cache.periodDays[ds])            inner.classList.add('period', `flow-${cache.periodDays[ds]}`);
        else if (cache.spottingSet.has(ds))  inner.classList.add('spotting');
        else if (cache.predictedSet.has(ds)) inner.classList.add('predicted');
        else if (cache.ovStr === ds)         inner.classList.add('ovulation');
        else if (cache.fertileSet.has(ds))   inner.classList.add('fertile');
        if (cache.travelDays.has(ds))         inner.classList.add('travel');
        if (cache.symptomDays[ds]?.length) {
          inner.classList.add('has-symptoms');
          const sd = document.createElement('i'); sd.className = 'pr-sym-dot'; inner.appendChild(sd);
        }

        const tip = _buildDayTip(ds, cache);
        if (tip) {
          inner.addEventListener('mouseenter', e => _showTip(e, tip));
          inner.addEventListener('mouseleave', _hideTip);
        }

        inner.addEventListener('click', e => {
          e.stopPropagation();
          _openDayModal(ds);
        });
        cell.appendChild(inner);
      }
      row.appendChild(cell);
    }
    parent.appendChild(row);
  }
}

function _monthBadge(year, monthIdx, todayStr) {
  const prefix = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
  if (todayStr.startsWith(prefix)) return { text: 'Now', cls: 'now' };
  if (prefix > todayStr.slice(0, 7)) {
    if (!_stats || !_entries.length) return null;
    const win = currentWindow(_entries, _stats);
    const preds = futurePredictions(_entries, _stats, 5);
    const has = [win, ...preds].filter(Boolean).some(p => {
      const s = fd(p.earliest).slice(0, 7), e = fd(p.latest).slice(0, 7);
      return s <= prefix && prefix <= e;
    });
    return has ? { text: 'Coming up', cls: 'coming-up' } : null;
  }
  const entry = _entries.find(e => e.start.startsWith(prefix));
  if (!entry) return null;
  const idx = _entries.indexOf(entry);
  if (idx < _entries.length - 1) {
    const days = diffD(D(entry.start), D(_entries[idx + 1].start));
    return { text: `${days} days`, cls: 'cycle-len' };
  }
  return null;
}

function _monthSnippet(year, monthIdx, todayStr) {
  const prefix = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
  if (prefix <= todayStr.slice(0, 7) || !_stats || !_entries.length) return null;
  const win = currentWindow(_entries, _stats);
  const preds = futurePredictions(_entries, _stats, 5);
  for (const p of [win, ...preds].filter(Boolean)) {
    if (fd(p.center).startsWith(prefix)) {
      const day = parseInt(fd(p.center).slice(8));
      const ord = day <= 7 ? 'early' : day <= 20 ? 'mid' : 'late';
      return `Probably around ${ord}-${MONTHS[monthIdx].toLowerCase()}.`;
    }
  }
  return null;
}

// ── Cycles tab (Gantt) ─────────────────────────────────────────────
function _cycleMedian(lengths) {
  if (!lengths.length) return null;
  const s = [...lengths].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? Math.round((s[m - 1] + s[m]) / 2) : s[m];
}

// ── SVG donut chart ────────────────────────────────────────────────
function _donutChart(segments, cx, cy, r, thickness, centerLabel) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (!total) return null;

  const ns  = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${cx * 2} ${cy * 2}`);
  svg.setAttribute('class', 'pr-donut');

  let angle = -Math.PI / 2; // start at top
  const innerR = r - thickness;

  segments.forEach(({ value, color }) => {
    if (!value) return;
    const sweep = (value / total) * 2 * Math.PI;
    const endAngle = angle + sweep;
    const largeArc = sweep > Math.PI ? 1 : 0;

    const ox1 = cx + r * Math.cos(angle),  oy1 = cy + r * Math.sin(angle);
    const ox2 = cx + r * Math.cos(endAngle), oy2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(endAngle), iy1 = cy + innerR * Math.sin(endAngle);
    const ix2 = cx + innerR * Math.cos(angle), iy2 = cy + innerR * Math.sin(angle);

    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', `M ${ox1} ${oy1} A ${r} ${r} 0 ${largeArc} 1 ${ox2} ${oy2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2} Z`);
    path.setAttribute('fill', color);
    svg.appendChild(path);

    angle = endAngle;
  });

  if (centerLabel) {
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', cx); text.setAttribute('y', cy);
    text.setAttribute('text-anchor', 'middle'); text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('class', 'pr-donut-label');
    text.textContent = centerLabel;
    svg.appendChild(text);
  }

  return svg;
}

function _buildCycles(el) {
  const today  = _todayStr();
  const avgDur = avgPeriodDuration(_entries);

  if (!_entries.length) {
    const empty = document.createElement('p'); empty.className = 'pr-cyc-empty';
    empty.textContent = 'No cycles tracked yet. Go to Day view and tap a day to start.';
    el.appendChild(empty);
    return;
  }

  const completedLengths = [];
  for (let i = 0; i < _entries.length - 1; i++)
    completedLengths.push(diffD(D(_entries[i].start), D(_entries[i + 1].start)));

  const avg      = _stats?.avg ?? null;
  const median   = _cycleMedian(completedLengths);
  const longest  = completedLengths.length ? Math.max(...completedLengths) : null;
  const shortest = completedLengths.length ? Math.min(...completedLengths) : null;

  const flowCounts = { spotting: 0, light: 0, medium: 0, heavy: 0 };
  for (const entry of _entries)
    for (const level of Object.values(entry.flow ?? {}))
      if (flowCounts[level] !== undefined) flowCounts[level]++;

  const showAllList = el.dataset.showAllList === '1';

  // ── Two-column layout ─────────────────────────────────────────────
  const layout = document.createElement('div');
  layout.className = 'pr-cyc-layout';

  // ── LEFT column ───────────────────────────────────────────────────
  const left = document.createElement('div');
  left.className = 'pr-cyc-left';

  // Donut
  const donutWrap = document.createElement('div');
  donutWrap.className = 'pr-cyc-donut-wrap';
  const donut = _donutChart([
    { value: flowCounts.heavy,    color: 'var(--flow-heavy)'  },
    { value: flowCounts.medium,   color: 'var(--flow-medium)' },
    { value: flowCounts.light,    color: 'var(--flow-light)'  },
    { value: flowCounts.spotting, color: 'var(--purple)'      },
  ], 60, 60, 52, 20, avgDur ? `${avgDur}d` : '');

  if (donut) {
    donutWrap.appendChild(donut);
    const legend = document.createElement('div');
    legend.className = 'pr-donut-legend';
    [
      { label: 'Heavy',    color: 'var(--flow-heavy)',  count: flowCounts.heavy    },
      { label: 'Medium',   color: 'var(--flow-medium)', count: flowCounts.medium   },
      { label: 'Light',    color: 'var(--flow-light)',  count: flowCounts.light    },
      { label: 'Spotting', color: 'var(--purple)',      count: flowCounts.spotting },
    ].filter(s => s.count > 0).forEach(({ label, color, count }) => {
      const row = document.createElement('div'); row.className = 'pr-donut-leg-row';
      row.innerHTML = `<span class="pr-donut-dot" style="background:${color}"></span><span class="pr-donut-leg-lbl">${label}</span><span class="pr-donut-leg-cnt">${count}d</span>`;
      legend.appendChild(row);
    });
    donutWrap.appendChild(legend);
  } else {
    donutWrap.appendChild(Object.assign(document.createElement('p'), { className: 'pr-cyc-empty', textContent: 'No flow logged yet.' }));
  }
  left.appendChild(donutWrap);

  // Stats 2×3 grid
  const statsGrid = document.createElement('div');
  statsGrid.className = 'pr-cyc-stats-grid';
  [
    { label: 'Avg cycle',     value: avg      ? `${avg}d`      : '—' },
    { label: 'Median',        value: median   ? `${median}d`   : '—' },
    { label: 'Longest',       value: longest  ? `${longest}d`  : '—' },
    { label: 'Shortest',      value: shortest ? `${shortest}d` : '—' },
    { label: 'Avg period',    value: avgDur   ? `${avgDur}d`   : '—' },
    { label: 'Total logged',  value: `${_entries.length}`           },
  ].forEach(({ label, value }) => {
    const cell = document.createElement('div'); cell.className = 'pr-cyc-stat-cell';
    cell.innerHTML = `<div class="pr-cyc-cell-lbl">${label}</div><div class="pr-cyc-cell-val">${value}</div>`;
    statsGrid.appendChild(cell);
  });
  left.appendChild(statsGrid);

  // Current cycle card
  const cur = _entries[_entries.length - 1];
  if (cur) {
    const elapsed  = diffD(D(cur.start), D(today)) + 1;
    const curFlow  = {};
    Object.values(cur.flow ?? {}).forEach(f => { curFlow[f] = (curFlow[f] ?? 0) + 1; });
    const flowStr  = ['heavy','medium','light','spotting'].filter(k => curFlow[k]).map(k => `${curFlow[k]}d ${k}`).join(' · ');
    const startFmt = new Date(cur.start + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endFmt   = cur.end ? new Date(cur.end + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'now';
    const card     = document.createElement('div'); card.className = 'pr-cyc-cur-card';
    card.innerHTML = `
      <div class="pr-cyc-cur-title">Cycle ${_entries.length} <span class="pr-cyc-cur-badge">current</span></div>
      <div class="pr-cyc-cur-dates">${startFmt} – ${endFmt} · ${elapsed}d</div>
      ${flowStr ? `<div class="pr-cyc-cur-flow">${flowStr}</div>` : ''}
    `;
    left.appendChild(card);
  }

  layout.appendChild(left);

  // ── RIGHT column ──────────────────────────────────────────────────
  const right = document.createElement('div');
  right.className = 'pr-cyc-right';

  // Bar chart — last 8 completed, longest as 100%
  if (completedLengths.length) {
    const maxLen  = longest;
    const refDays = [21, 28, 35].filter(d => d < maxLen);
    const pct     = d => `${(d / maxLen * 100).toFixed(2)}%`;

    const chart = document.createElement('div');
    chart.className = 'pr-cyc-barchart';

    // Axis header
    const axisRow = document.createElement('div'); axisRow.className = 'pr-cyc-bar-axis';
    const axisZone = document.createElement('div'); axisZone.className = 'pr-cyc-bar-zone';
    refDays.forEach(d => {
      const t = document.createElement('span'); t.className = 'pr-cyc-axis-tick';
      t.style.left = pct(d); t.textContent = `${d}d`;
      axisZone.appendChild(t);
    });
    axisRow.appendChild(document.createElement('div')); // spacer for lbl col
    axisRow.appendChild(axisZone);
    axisRow.appendChild(document.createElement('div')); // spacer for num col
    chart.appendChild(axisRow);

    const last8    = completedLengths.slice(-8);
    const startIdx = Math.max(0, completedLengths.length - 8);
    last8.forEach((len, i) => {
      const row   = document.createElement('div'); row.className = 'pr-cyc-bar-row';
      const lbl   = document.createElement('div'); lbl.className = 'pr-cyc-bar-lbl'; lbl.textContent = `#${startIdx + i + 1}`;
      const zone  = document.createElement('div'); zone.className = 'pr-cyc-bar-zone';
      refDays.forEach(d => {
        const line = document.createElement('div'); line.className = 'pr-cyc-bar-refline'; line.style.left = pct(d);
        zone.appendChild(line);
      });
      const fill = document.createElement('div'); fill.className = 'pr-cyc-bar-fill'; fill.style.width = pct(len);
      zone.appendChild(fill);
      const num = document.createElement('div'); num.className = 'pr-cyc-bar-num'; num.textContent = `${len}d`;
      row.append(lbl, zone, num);
      chart.appendChild(row);
    });
    right.appendChild(chart);
  }

  // Cycle list — compact rows, last 5 default
  const allReversed = [..._entries].reverse();
  const visible     = showAllList ? allReversed : allReversed.slice(0, 5);
  const list        = document.createElement('div');
  list.className    = 'pr-cyc-list';

  visible.forEach((entry, i) => {
    const globalIdx = _entries.length - 1 - i;
    const nextEntry = _entries[globalIdx + 1];
    const cycleLen  = nextEntry ? diffD(D(entry.start), D(nextEntry.start)) : null;
    const periodLen = entry.end ? diffD(D(entry.start), D(entry.end)) + 1 : null;
    const isCurrent = i === 0 && !nextEntry;

    const startDate = new Date(entry.start + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endDate   = entry.end ? new Date(entry.end + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;

    const item    = document.createElement('div'); item.className = 'pr-cyc-item';
    const header  = document.createElement('div'); header.className = 'pr-cyc-item-hdr';
    const numSpan = document.createElement('span'); numSpan.className = 'pr-cyc-item-num';
    numSpan.innerHTML = `Cycle ${globalIdx + 1}${isCurrent ? ' <span class="pr-cyc-cur-badge">current</span>' : ''}`;
    const dateSpan = document.createElement('span'); dateSpan.className = 'pr-cyc-item-date';
    dateSpan.textContent = startDate + (endDate ? ` – ${endDate}` : '');
    const perSpan  = document.createElement('span'); perSpan.className = 'pr-cyc-item-period';
    perSpan.textContent = periodLen ? `${periodLen}d period` : '';
    const lenSpan  = document.createElement('span'); lenSpan.className = 'pr-cyc-item-len';
    lenSpan.textContent = cycleLen ? `${cycleLen}d` : isCurrent ? '…' : '—';
    const chev = document.createElement('span'); chev.className = 'pr-cyc-item-chevron'; chev.textContent = '›';
    header.append(numSpan, dateSpan, perSpan, lenSpan, chev);

    const body = document.createElement('div'); body.className = 'pr-cyc-item-body'; body.hidden = true;
    const rows = [];
    const flowLevels = Object.values(entry.flow ?? {});
    if (flowLevels.length) {
      const counts = {};
      flowLevels.forEach(f => { counts[f] = (counts[f] ?? 0) + 1; });
      rows.push('Flow: ' + ['heavy','medium','light','spotting'].filter(k => counts[k]).map(k => `${counts[k]}d ${k}`).join(' · '));
    }
    const allSymps = [...new Set(Object.values(entry.symptoms ?? {}).flat())];
    if (allSymps.length) rows.push(`Symptoms: ${allSymps.slice(0, 6).map(k => SYM_LABEL[k] ?? k).join(', ')}`);
    if (!rows.length) rows.push('No details logged.');
    body.innerHTML = rows.map(r => `<div class="pr-cyc-detail">${r}</div>`).join('');

    header.addEventListener('click', () => {
      const open = !body.hidden;
      body.hidden = open;
      item.classList.toggle('expanded', !open);
      chev.textContent = open ? '›' : '⌄';
    });
    item.append(header, body);
    list.appendChild(item);
  });

  if (_entries.length > 5) {
    const toggle = document.createElement('button');
    toggle.className = 'pr-cyc-see-all';
    toggle.textContent = showAllList ? 'Show less' : `See all ${_entries.length} cycles`;
    toggle.addEventListener('click', () => {
      el.dataset.showAllList = showAllList ? '0' : '1';
      el.innerHTML = ''; _buildCycles(el);
    });
    list.appendChild(toggle);
  }

  right.appendChild(list);
  layout.appendChild(right);
  el.appendChild(layout);
}

// ── Day log modal ──────────────────────────────────────────────────
function _openDayModal(ds) {
  if (_dayModal) { _dayModal.remove(); _dayModal = null; }

  const d         = new Date(ds + 'T00:00:00');
  const dateLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const overlay = document.createElement('div');
  overlay.className = 'pr-day-modal-overlay';
  overlay.addEventListener('click', () => { overlay.remove(); _dayModal = null; _render(); });

  const modal = document.createElement('div');
  modal.className = 'pr-day-modal';
  modal.addEventListener('click', e => e.stopPropagation());

  const hdr = document.createElement('div'); hdr.className = 'pr-day-modal-hdr';
  const dateEl = document.createElement('span'); dateEl.className = 'pr-day-modal-date'; dateEl.textContent = dateLabel;
  const closeBtn = document.createElement('button'); closeBtn.className = 'pr-detail-close'; closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', () => { overlay.remove(); _dayModal = null; _render(); });
  hdr.append(dateEl, closeBtn);

  const body = document.createElement('div'); body.className = 'pr-day-modal-body';

  function refresh() {
    body.innerHTML = '';
    const counts = _countSymptoms();
    const left  = document.createElement('div'); left.className  = 'pr-log-col';
    const right = document.createElement('div'); right.className = 'pr-log-col';
    left.appendChild(_buildFlowChips(ds, refresh));
    SYM_LEFT.forEach(g => left.appendChild(_buildSymGroup(g, ds, counts, refresh)));
    right.appendChild(_buildBbtInput(ds, refresh));
    SYM_RIGHT.forEach(g => right.appendChild(_buildSymGroup(g, ds, counts, refresh)));
    const grid = document.createElement('div'); grid.className = 'pr-log-grid';
    grid.append(left, right);
    body.appendChild(grid);
  }

  refresh();
  modal.append(hdr, body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  _dayModal = overlay;
}


function _buildFlowChips(today, afterSave = null) {
  const sec = _makeSec('Flow');
  const chips = document.createElement('div'); chips.className = 'pr-chips';
  const entry      = _entries.find(e => D(today) >= D(e.start) && D(today) <= D(e.end));
  const curFlow    = entry?.flow?.[today];
  const isSpotting = (_data.period?.spotting ?? []).includes(today);

  FLOW_OPTS.forEach(({ key, label }) => {
    const chip = document.createElement('button'); chip.className = 'pr-chip'; chip.textContent = label;
    const active = (key === 'spotting' && isSpotting)
      || (key !== 'none' && key !== 'spotting' && curFlow === key)
      || (key === 'none' && !curFlow && !isSpotting);
    if (active) chip.classList.add('active');
    chip.addEventListener('click', () => {
      const period = { ...(_data.period ?? {}) };
      if (key === 'none') {
        period.entries  = removeDay(_entries, today);
        period.spotting = removeSpotting(period.spotting, today);
      } else if (key === 'spotting') {
        period.entries  = removeDay(_entries, today);
        period.spotting = isSpotting ? removeSpotting(period.spotting, today) : addSpotting(period.spotting, today);
      } else {
        period.spotting = removeSpotting(period.spotting, today);
        period.entries  = mergeEntry(_entries, today, 'flow', key);
      }
      _onSave({ period });
      _data = { ..._data, period }; _entries = getPeriodEntries(_data); _stats = periodStats(_entries);
      if (afterSave) afterSave(); else _render();
    });
    chips.appendChild(chip);
  });
  sec.appendChild(chips); return sec;
}

function _buildSymGroup(group, today, counts, afterSave = null) {
  const sec = _makeSec(group.label);
  const chips = document.createElement('div'); chips.className = 'pr-chips';
  const todaySym = _data.period?.symptoms?.[today] ?? {};
  group.items.forEach(({ key, label }) => {
    const chip = document.createElement('button');
    chip.className = 'pr-chip' + (todaySym[key] ? ' active' : '');
    const cnt = counts[key] ?? 0;
    chip.innerHTML = `${label}${cnt > 0 ? `<span class="pr-chip-cnt">&times;${cnt}</span>` : ''}`;
    chip.addEventListener('click', () => {
      const period = { ...(_data.period ?? {}) };
      period.symptoms = setSymptom(period.symptoms, today, key, !!(period.symptoms?.[today]?.[key]) ? null : true);
      _onSave({ period });
      _data = { ..._data, period }; _entries = getPeriodEntries(_data);
      if (afterSave) afterSave(); else _render();
    });
    chips.appendChild(chip);
  });
  sec.appendChild(chips); return sec;
}

function _buildBbtInput(today, afterSave = null) {
  const sec = _makeSec('Temperature when you woke up');
  const cur = _data.period?.bbt?.[today] ?? null;

  if (cur === null) {
    const chips = document.createElement('div'); chips.className = 'pr-chips';
    const noChip  = document.createElement('button'); noChip.className  = 'pr-chip active'; noChip.textContent = 'No temperature';
    const yesChip = document.createElement('button'); yesChip.className = 'pr-chip';        yesChip.textContent = 'Log temperature';
    yesChip.addEventListener('click', () => { chips.remove(); _buildBbtStepper(sec, today, 36.50, afterSave); });
    chips.append(noChip, yesChip);
    sec.appendChild(chips);
    return sec;
  }

  _buildBbtStepper(sec, today, cur, afterSave);
  return sec;
}

function _buildBbtStepper(sec, today, initialVal, afterSave) {
  let val = initialVal;

  const wrap = document.createElement('div'); wrap.className = 'pr-bbt-wrap';
  const minB = document.createElement('button'); minB.className = 'pr-bbt-btn'; minB.textContent = '−';
  const disp = document.createElement('div');   disp.className = 'pr-bbt-disp';
  const plus = document.createElement('button'); plus.className = 'pr-bbt-btn'; plus.textContent = '+';
  wrap.append(minB, disp, plus);
  const note = document.createElement('p'); note.className = 'pr-bbt-note';

  const redraw = () => {
    disp.innerHTML = `<span class="pr-bbt-val">${val.toFixed(2)}</span><span class="pr-bbt-unit">°C</span>`;
    note.textContent = _bbtNote(val);
  };
  const save = () => {
    const period = { ...(_data.period ?? {}) };
    period.bbt = setBbt(period.bbt, today, val);
    _onSave({ period }); _data = { ..._data, period }; _entries = getPeriodEntries(_data); redraw();
  };
  minB.addEventListener('click', () => { val = Math.max(35.0, Math.round((val - 0.05) * 100) / 100); save(); });
  plus.addEventListener('click', () => { val = Math.min(40.0, Math.round((val + 0.05) * 100) / 100); save(); });
  redraw();
  sec.append(wrap, note);

  const clr = document.createElement('button'); clr.className = 'pr-bbt-clr'; clr.textContent = 'Clear';
  clr.addEventListener('click', () => {
    const period = { ...(_data.period ?? {}) };
    period.bbt = setBbt(period.bbt, today, null);
    _onSave({ period }); _data = { ..._data, period }; _entries = getPeriodEntries(_data);
    if (afterSave) afterSave(); else _render();
  });
  sec.appendChild(clr);
}


// ── Day tooltip ────────────────────────────────────────────────────
function _buildDayTip(ds, cache) {
  const parts = [];
  if (cache.periodDays[ds]) {
    const flow = cache.periodDays[ds];
    parts.push(flow === 'unspecified' ? 'Period' : flow === 'none' ? 'No flow' : `${flow.charAt(0).toUpperCase() + flow.slice(1)} flow`);
  } else if (cache.spottingSet.has(ds)) {
    parts.push('Spotting');
  } else if (cache.ovStr === ds) {
    parts.push('Ovulation day');
  } else if (cache.predictedSet.has(ds)) {
    parts.push('Predicted period');
  } else if (cache.fertileSet.has(ds)) {
    parts.push('Fertile window');
  }
  if (cache.travelDays.has(ds)) parts.push('Travel');
  const syms = cache.symptomDays?.[ds];
  if (syms?.length) {
    const labels = syms.map(k => SYM_LABEL[k] ?? k.replace(/_/g, ' '));
    parts.push((parts.length ? '' : 'Symptoms: ') + labels.join(', '));
  }
  return parts.join('\n');
}

function _showTip(e, text) {
  if (!_tipEl) {
    _tipEl = document.createElement('div');
    _tipEl.className = 'pr-tip';
    document.body.appendChild(_tipEl);
  }
  _tipEl.innerHTML = text.split('\n').map((l, i) => i === 0 ? `<strong>${l}</strong>` : l).join('<br>');
  _tipEl.style.display = 'block';
  const rect = e.currentTarget.getBoundingClientRect();
  _tipEl.style.left      = `${rect.left + rect.width / 2}px`;
  _tipEl.style.top       = `${rect.top - 8}px`;
  _tipEl.style.transform = 'translate(-50%, -100%)';
}

function _hideTip() {
  if (_tipEl) _tipEl.style.display = 'none';
}

// ── Helpers ────────────────────────────────────────────────────────
function _makeSec(label) {
  const sec = document.createElement('div'); sec.className = 'pr-log-sec';
  const lbl = document.createElement('div'); lbl.className = 'pr-log-lbl'; lbl.textContent = label;
  sec.appendChild(lbl); return sec;
}

function _todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: _data?.settings?.timezone ?? 'Asia/Tokyo' });
}

function _cycleDay(todayStr) {
  if (!_entries.length) return null;
  const diff = diffD(D(_entries[_entries.length - 1].start), D(todayStr));
  return diff >= 0 ? diff + 1 : null;
}

function _fmtDate(ds) {
  return new Date(ds + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' });
}

function _headlineText() {
  const today = _todayStr();
  if (!_entries.length) return { main: 'Start tracking your cycle.', italic: null };
  const entry = _entries.find(e => D(today) >= D(e.start) && D(today) <= D(e.end));
  if (entry) { const dayN = diffD(D(entry.start), D(today)) + 1; return { main: `Day ${dayN} of your period.`, italic: null }; }
  if (!_stats) return { main: 'Keep tracking', italic: ' to see predictions.' };
  const win = currentWindow(_entries, _stats);
  if (win) {
    const t = D(today), ear = D(fd(win.earliest)), lat = D(fd(win.latest)), ctr = D(fd(win.center));
    const dUntilCtr = diffD(t, ctr), dUntilEar = diffD(t, ear);
    if (t >= ear && t <= lat) return dUntilCtr <= 1 ? { main: 'Your period is coming ', italic: 'in about a day.' } : { main: 'Your period is coming ', italic: `in about ${dUntilCtr} days.` };
    if (dUntilEar > 0 && dUntilEar <= 5) return { main: 'Your period is ', italic: 'coming soon.' };
  }
  const phase = getPhase(_entries, _stats, today);
  const phaseMap = { follicular: 'follicular phase.', ovulatory: 'ovulation window.', luteal: 'luteal phase.' };
  const cycleDay = _cycleDay(today);
  if (phaseMap[phase] && cycleDay) return { main: `Day ${cycleDay}, `, italic: phaseMap[phase] };
  if (cycleDay) return { main: `Day ${cycleDay} of your cycle.`, italic: null };
  return { main: 'Welcome back.', italic: null };
}

function _headlineSub() {
  const today = _todayStr();
  if (!_entries.length) return 'Tap any day to start logging your period.';
  const entry = _entries.find(e => D(today) >= D(e.start) && D(today) <= D(e.end));
  if (entry) return entry.flow?.[today] ? `Logged as ${entry.flow[today]} flow today. Tap any day to update.` : 'Tap any day to log your flow and symptoms.';
  const win = _stats ? currentWindow(_entries, _stats) : null;
  if (win) {
    const efmt = D(fd(win.earliest)).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const lfmt = D(fd(win.latest)).toLocaleDateString('en-US',   { month: 'long', day: 'numeric' });
    return `Expected somewhere between ${efmt} and ${lfmt}.`;
  }
  return 'Track two cycles to unlock predictions.';
}

function _statusPills() {
  const pills = [], today = _todayStr();
  const win = _stats ? currentWindow(_entries, _stats) : null;
  if (win) {
    const days = diffD(D(today), D(fd(win.center)));
    if (days >= 0) pills.push({ color: 'var(--flow-medium)', text: days <= 1 ? '<strong>1 day</strong> until period' : `<strong>${days} days</strong> until period` });
    const dAgo = diffD(ovulationDay(win), D(today));
    if (dAgo > 0 && dAgo < 20) pills.push({ color: 'var(--purple)', text: `Ovulated <strong>${dAgo} days ago</strong>` });
  }
  if (_stats && !_stats.notEnoughData) pills.push({ color: _stats.irregular ? 'var(--amber)' : 'var(--green)', text: `Cycle is <strong>${_stats.irregular ? 'variable' : 'on track'}</strong>` });
  return pills;
}

function _buildPhasePanel() {
  const today = _todayStr();
  const phase = getPhase(_entries, _stats, today);
  if (!phase || !_stats) return null;
  const info = PHASE_DATA[phase];
  if (!info) return null;

  const panel = document.createElement('div'); panel.className = 'pr-phase-panel';

  // Left: badge, description, signals, disclaimer
  const left = document.createElement('div'); left.className = 'pr-phase-left';

  const nameRow = document.createElement('div'); nameRow.className = 'pr-phase-name-row';
  const badge = document.createElement('span'); badge.className = 'pr-phase-badge';
  badge.textContent = info.label;
  badge.style.color       = info.color;
  badge.style.background  = `color-mix(in srgb, ${info.color} 12%, transparent)`;
  badge.style.borderColor = `color-mix(in srgb, ${info.color} 25%, transparent)`;
  const phaseDay = _phaseDay(phase, today);
  const cycDay   = _cycleDay(today);
  const dayParts = [];
  if (phaseDay) dayParts.push(`Day ${phaseDay} of phase`);
  if (cycDay)   dayParts.push(`Cycle day ${cycDay}`);
  const dayLbl = document.createElement('span'); dayLbl.className = 'pr-phase-cycle-day';
  dayLbl.textContent = dayParts.join(' · ');
  nameRow.append(badge, dayLbl);

  const desc = document.createElement('p'); desc.className = 'pr-phase-desc';
  desc.textContent = info.desc;

  const sigWrap = document.createElement('div'); sigWrap.className = 'pr-phase-signals';
  info.signals.forEach(s => {
    const chip = document.createElement('span'); chip.className = 'pr-phase-signal';
    chip.textContent = s; sigWrap.appendChild(chip);
  });

  const note = document.createElement('p'); note.className = 'pr-phase-note';
  note.textContent = 'Estimated from your cycle history. Not medical advice.';

  const { main, italic } = _headlineText();
  const h1 = document.createElement('h1'); h1.className = 'pr-h1';
  const mainSpan = document.createElement('span'); mainSpan.textContent = main; h1.appendChild(mainSpan);
  if (italic) { const em = document.createElement('em'); em.className = 'pr-em'; em.textContent = italic; h1.appendChild(em); }
  const sub = document.createElement('p'); sub.className = 'pr-hl-sub'; sub.textContent = _headlineSub();

  left.append(nameRow, h1, sub, desc, sigWrap, note);

  // Right: fertility + 2 contextual stats
  const right = document.createElement('div'); right.className = 'pr-phase-right';
  right.appendChild(_phaseStat(info.fertility, 'Fertility', info.fertilityColor));

  const win = currentWindow(_entries, _stats);
  if (win) {
    const todayD = D(today);
    const ovD    = D(fd(ovulationDay(win)));
    const perD   = D(fd(win.center));

    if (phase === 'menstrual') {
      const avgDur = avgPeriodDuration(_entries);
      if (avgDur) right.appendChild(_phaseStat(`~${avgDur}d`, 'Avg period length', 'var(--text-2)'));
      const dToOv = diffD(todayD, ovD);
      if (dToOv > 0) right.appendChild(_phaseStat(`~${dToOv}d`, 'Until ovulation', 'var(--purple)'));
    } else if (phase === 'follicular') {
      const dToOv = diffD(todayD, ovD);
      if (dToOv > 0) right.appendChild(_phaseStat(`~${dToOv}d`, 'Until ovulation', 'var(--purple)'));
      right.appendChild(_phaseStat(`${_stats.med}d`, 'Typical cycle', 'var(--text-2)'));
    } else if (phase === 'ovulatory') {
      const ovFmt = new Date(fd(ovD) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      right.appendChild(_phaseStat(ovFmt, 'Est. ovulation', 'var(--purple)'));
      const dToPer = diffD(todayD, perD);
      if (dToPer >= 0) right.appendChild(_phaseStat(`~${dToPer}d`, 'Until next period', 'var(--flow-medium)'));
    } else if (phase === 'luteal') {
      const dToPer = diffD(todayD, perD);
      if (dToPer >= 0) right.appendChild(_phaseStat(`~${dToPer}d`, 'Until next period', 'var(--flow-medium)'));
      right.appendChild(_phaseStat(`${_stats.med}d`, 'Typical cycle', 'var(--text-2)'));
    }
  }

  panel.append(left, right);
  return panel;
}

function _phaseStat(value, label, color) {
  const stat = document.createElement('div'); stat.className = 'pr-phase-stat';
  const val  = document.createElement('div'); val.className  = 'pr-phase-stat-val';
  val.textContent = value;
  if (color) val.style.color = color;
  const lbl  = document.createElement('div'); lbl.className  = 'pr-phase-stat-lbl';
  lbl.textContent = label;
  stat.append(val, lbl);
  return stat;
}

function _phaseDay(phase, todayStr) {
  const today = D(todayStr);
  if (phase === 'menstrual') {
    const entry = _entries.find(e => today >= D(e.start) && today <= D(e.end));
    return entry ? diffD(D(entry.start), today) + 1 : null;
  }
  if (phase === 'follicular' && _entries.length) {
    const days = diffD(D(_entries[_entries.length - 1].end), today);
    return days > 0 ? days : null;
  }
  if (!_stats) return null;
  const win = currentWindow(_entries, _stats);
  if (!win) return null;
  const ov = D(fd(ovulationDay(win)));
  if (phase === 'ovulatory') {
    const days = diffD(addD(ov, -4), today) + 1;
    return days > 0 ? days : null;
  }
  if (phase === 'luteal') {
    const days = diffD(addD(ov, 2), today) + 1;
    return days > 0 ? days : null;
  }
  return null;
}

function _countSymptoms() {
  const counts = {};
  for (const daySym of Object.values(_data.period?.symptoms ?? {}))
    for (const [k, v] of Object.entries(daySym ?? {})) if (v) counts[k] = (counts[k] ?? 0) + 1;
  for (const e of _entries)
    for (const daySym of Object.values(e.symptoms ?? {}))
      for (const [k, v] of Object.entries(daySym ?? {})) if (v) counts[k] = (counts[k] ?? 0) + 1;
  return counts;
}

function _bbtNote(temp) {
  const phase = getPhase(_entries, _stats, _todayStr());
  if (temp >= 36.7) return "That's a bit higher than usual, you probably ovulated already.";
  if (temp < 36.4)  return 'Temperature is on the lower side, could be just before ovulation.';
  if (phase === 'luteal') return 'Temperatures tend to stay elevated in the luteal phase.';
  return 'Log every morning before getting up for the most accurate results.';
}


function _loadCss() {
  const href = new URL('../../style/period.css', import.meta.url).href;
  if (!document.querySelector(`link[href="${href}"]`))
    document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'stylesheet', href }));
}
