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
  { group: 'mood', label: 'Mood', items: [
    { key: 'calm',       label: 'Calm' },
    { key: 'happy',      label: 'Happy' },
    { key: 'irritable',  label: 'Irritable' },
    { key: 'low_energy', label: 'Low energy' },
    { key: 'anxious',    label: 'Anxious' },
    { key: 'foggy',      label: 'Foggy' },
    { key: 'sad',        label: 'Sad' },
  ]},
  { group: 'body', label: 'Body', items: [
    { key: 'tired',      label: 'Tired' },
    { key: 'cant_sleep', label: "Can't sleep" },
    { key: 'bloated',    label: 'Bloated' },
    { key: 'cravings',   label: 'Cravings' },
    { key: 'acne',       label: 'Acne' },
    { key: 'nausea',     label: 'Nausea' },
  ]},
];

const SYM_RIGHT = [
  { group: 'pain', label: 'Pain', items: [
    { key: 'cramps',         label: 'Cramps' },
    { key: 'headache',       label: 'Headache' },
    { key: 'back_pain',      label: 'Back pain' },
    { key: 'tender_breasts', label: 'Tender breasts' },
  ]},
];

const SYM_EMOJI = {
  calm:'😌', happy:'😊', irritable:'😤', low_energy:'😩',
  anxious:'😰', foggy:'🌫', sad:'😔',
  tired:'😴', cant_sleep:'💤', bloated:'🫧', cravings:'🍫', acne:'😬', nausea:'🤢',
  cramps:'😣', headache:'🤕', back_pain:'😖', tender_breasts:'😵',
};

const SYM_LABEL = {
  calm:'Calm', happy:'Happy', irritable:'Irritable', low_energy:'Low energy',
  anxious:'Anxious', foggy:'Foggy', sad:'Sad',
  tired:'Tired', cant_sleep:"Can't sleep", bloated:'Bloated',
  cravings:'Cravings', acne:'Acne', nausea:'Nausea',
  cramps:'Cramps', headache:'Headache', back_pain:'Back pain', tender_breasts:'Tender breasts',
};

// ── Module state ───────────────────────────────────────────────────
let _container   = null;
let _data        = null;
let _onSave      = null;
let _view        = 'overview';
let _entries     = [];
let _stats       = null;
let _detailMonth = null;

// ── Module contract ────────────────────────────────────────────────
export function init(container, data, onSave) {
  _container = container;
  _onSave    = onSave;
  _loadCss();
  _data    = data;
  _entries = getPeriodEntries(data);
  _stats   = periodStats(_entries);
  _render();
}

export function destroy() {
  _container   = null;
  _data        = null;
  _onSave      = null;
  _detailMonth = null;
}

export function onDataChange(newData) {
  _data    = newData;
  _entries = getPeriodEntries(newData);
  _stats   = periodStats(_entries);
}

// ── Render ─────────────────────────────────────────────────────────
function _render() {
  if (!_container) return;
  _container.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'pr-root';
  root.appendChild(_buildTop());
  const content = document.createElement('div');
  content.className = 'pr-content';
  if (_view === 'overview') _buildOverview(content);
  else                      _buildToday(content);
  root.appendChild(content);
  _container.appendChild(root);
  if (_detailMonth) {
    requestAnimationFrame(() => {
      const panel = _container.querySelector('.pr-detail');
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }
}

// ── Top bar ────────────────────────────────────────────────────────
function _buildTop() {
  const top = document.createElement('div');
  top.className = 'pr-top';

  const brand = document.createElement('div');
  brand.className = 'pr-brand';
  brand.innerHTML = `<span class="brand-pill-name pr-brand-name">Seratus</span><span class="pr-cycle-badge">CYCLE</span>`;

  const tabs = document.createElement('div');
  tabs.className = 'pr-tabs';
  [{ v: 'overview', label: 'Overview' }, { v: 'today', label: 'Today' }].forEach(({ v, label }) => {
    const btn = document.createElement('button');
    btn.className = 'pr-tab' + (_view === v ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => { if (_view !== v) { _view = v; _detailMonth = null; _render(); } });
    tabs.appendChild(btn);
  });

  const meta = document.createElement('div');
  meta.className = 'pr-meta';
  const today    = _todayStr();
  const cycleDay = _cycleDay(today);
  const cycleNum = _entries.length;
  meta.innerHTML = `
    <span>${_fmtDate(today)}</span>
    ${cycleDay ? `<span class="pr-dot">·</span><span>Day <strong>${cycleDay}</strong> of cycle</span>` : ''}
    ${cycleNum ? `<span class="pr-dot">·</span><span><strong>${cycleNum}</strong> ${cycleNum === 1 ? 'cycle' : 'cycles'} tracked</span>` : ''}
  `;
  top.append(brand, tabs, meta);
  return top;
}

// ── Overview ───────────────────────────────────────────────────────
function _buildOverview(el) {
  const hl = document.createElement('div');
  hl.className = 'pr-headline';
  const { main, italic } = _headlineText();
  const h1 = document.createElement('h1');
  h1.className = 'pr-h1';
  const s = document.createElement('span'); s.textContent = main; h1.appendChild(s);
  if (italic) { const em = document.createElement('em'); em.className = 'pr-em'; em.textContent = italic; h1.appendChild(em); }
  const sub = document.createElement('p'); sub.className = 'pr-hl-sub'; sub.textContent = _headlineSub();
  const pills = document.createElement('div'); pills.className = 'pr-status-pills';
  _statusPills().forEach(({ color, text }) => {
    const pill = document.createElement('div'); pill.className = 'pr-status-pill';
    pill.innerHTML = `<span class="pr-status-dot" style="background:${color}"></span><span>${text}</span>`;
    pills.appendChild(pill);
  });
  hl.append(h1, sub, pills);
  el.appendChild(hl);

  const hr = document.createElement('hr'); hr.className = 'pr-hr'; el.appendChild(hr);

  const ys = document.createElement('div'); ys.className = 'pr-year-section';
  const yh = document.createElement('div'); yh.className = 'pr-year-hdr';
  yh.innerHTML = `<span class="pr-year-title">Your year, month by month</span><span class="pr-year-hint">Tap any month to see what happened</span>`;
  ys.appendChild(yh);

  const grid = document.createElement('div'); grid.className = 'pr-year-grid';
  const today = _todayStr();
  const year  = parseInt(today.slice(0, 4));
  const cache = _buildDayCache();
  for (let m = 0; m < 12; m++) grid.appendChild(_buildMonthCard(year, m, today, cache));
  ys.appendChild(grid);
  el.appendChild(ys);

  if (_detailMonth) el.appendChild(_buildDetail(_detailMonth.year, _detailMonth.monthIdx, cache));
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
  return { periodDays, spottingSet, predictedSet, fertileSet, ovStr };
}

// ── Month card (mini) ──────────────────────────────────────────────
function _buildMonthCard(year, monthIdx, todayStr, cache) {
  const card = document.createElement('div');
  card.className = 'pr-month-card';
  const prefix = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
  if (todayStr.startsWith(prefix)) card.classList.add('current');
  if (_detailMonth?.year === year && _detailMonth?.monthIdx === monthIdx) card.classList.add('selected');

  const hdr = document.createElement('div'); hdr.className = 'pr-month-hdr';
  const name = document.createElement('span'); name.className = 'pr-month-name'; name.textContent = MONTHS[monthIdx];
  hdr.appendChild(name);
  const badge = _monthBadge(year, monthIdx, todayStr);
  if (badge) { const b = document.createElement('span'); b.className = `pr-month-badge ${badge.cls}`; b.textContent = badge.text; hdr.appendChild(b); }
  card.appendChild(hdr);

  _calGrid(card, year, monthIdx, todayStr, cache, false);

  const snippet = _monthSnippet(year, monthIdx, todayStr);
  if (snippet) { const p = document.createElement('p'); p.className = 'pr-month-snippet'; p.textContent = snippet; card.appendChild(p); }

  card.addEventListener('click', () => {
    _detailMonth = (_detailMonth?.year === year && _detailMonth?.monthIdx === monthIdx) ? null : { year, monthIdx };
    _render();
  });
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
        if (ds === todayStr)          inner.classList.add('today');
        if (cache.periodDays[ds])     inner.classList.add('period', `flow-${cache.periodDays[ds]}`);
        else if (cache.spottingSet.has(ds))  inner.classList.add('spotting');
        else if (cache.predictedSet.has(ds)) inner.classList.add('predicted');
        else if (cache.ovStr === ds)         inner.classList.add('ovulation');
        else if (cache.fertileSet.has(ds))   inner.classList.add('fertile');
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

// ── Month detail panel ─────────────────────────────────────────────
function _buildDetail(year, monthIdx, cache) {
  const panel = document.createElement('div');
  panel.className = 'pr-detail';

  const titleRow = document.createElement('div'); titleRow.className = 'pr-detail-title-row';
  const title = document.createElement('h2'); title.className = 'pr-detail-title'; title.textContent = `${MONTHS[monthIdx]} ${year}`;
  const close = document.createElement('button'); close.className = 'pr-detail-close'; close.innerHTML = '&times;';
  close.addEventListener('click', () => { _detailMonth = null; _render(); });
  titleRow.append(title, close);
  panel.appendChild(titleRow);

  const hr = document.createElement('hr'); hr.className = 'pr-hr'; panel.appendChild(hr);

  const body = document.createElement('div'); body.className = 'pr-detail-body';
  const left  = document.createElement('div'); left.className  = 'pr-detail-left';
  const right = document.createElement('div'); right.className = 'pr-detail-right';

  // Left: calendar label + bigger calendar + cycle stats
  const calLbl = document.createElement('div'); calLbl.className = 'pr-detail-label'; calLbl.textContent = 'Calendar';
  left.appendChild(calLbl);
  const calWrap = document.createElement('div'); calWrap.className = 'pr-detail-cal';
  _calGrid(calWrap, year, monthIdx, _todayStr(), cache, true);
  left.appendChild(calWrap);
  const statsBlock = _buildCycleBlock(year, monthIdx);
  if (statsBlock) left.appendChild(statsBlock);

  // Right: BBT + symptoms
  right.appendChild(_buildDetailBbt(year, monthIdx));
  right.appendChild(_buildDetailSymptoms(year, monthIdx));

  body.append(left, right);
  panel.appendChild(body);
  return panel;
}

function _buildCycleBlock(year, monthIdx) {
  const prefix = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
  const entry  = _entries.find(e => e.start.startsWith(prefix));
  if (!entry) return null;
  const block = document.createElement('div'); block.className = 'pr-cycle-block';
  const idx = _entries.indexOf(entry);
  if (idx < _entries.length - 1) {
    const days = diffD(D(entry.start), D(_entries[idx + 1].start));
    const lbl = document.createElement('div'); lbl.className = 'pr-cycle-label'; lbl.textContent = `${days} day cycle`;
    const sub = document.createElement('div'); sub.className = 'pr-cycle-sub';
    if (_stats) {
      const diff = days - _stats.avg;
      sub.textContent = Math.abs(diff) <= 2 ? 'Right on time.'
        : diff > 0 ? `${diff} days longer than usual.`
        : `${-diff} days shorter than usual.`;
    }
    block.append(lbl, sub);
  } else {
    const day = diffD(D(entry.start), D(_todayStr())) + 1;
    const lbl = document.createElement('div'); lbl.className = 'pr-cycle-label'; lbl.textContent = 'Cycle in progress';
    const sub = document.createElement('div'); sub.className = 'pr-cycle-sub'; sub.textContent = `Day ${day} today.`;
    block.append(lbl, sub);
  }
  return block;
}

// ── Detail: BBT chart ──────────────────────────────────────────────
function _buildDetailBbt(year, monthIdx) {
  const sec = document.createElement('div'); sec.className = 'pr-detail-section';
  const lbl = document.createElement('div'); lbl.className = 'pr-detail-label'; lbl.textContent = 'What your body did';
  sec.appendChild(lbl);

  const bbt = _data.period?.bbt ?? {};
  const daysInM = new Date(year, monthIdx + 1, 0).getDate();
  const points = [];
  for (let d = 1; d <= daysInM; d++) {
    const ds = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const val = bbt[ds];
    if (val != null) points.push({ day: d, temp: val });
  }

  if (!points.length) {
    const e = document.createElement('div'); e.className = 'pr-detail-empty'; e.textContent = 'No temperature data logged for this month.'; sec.appendChild(e); return sec;
  }

  const prefix = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
  const entry  = _entries.find(e => e.start.startsWith(prefix));
  let ovDayNum = null;
  if (entry) {
    const idx = _entries.indexOf(entry);
    const cycleLen = idx < _entries.length - 1 ? diffD(D(entry.start), D(_entries[idx + 1].start)) : (_stats?.avg ?? 28);
    const ovDate = addD(D(entry.start), cycleLen - 14);
    if (ovDate.getFullYear() === year && ovDate.getMonth() === monthIdx) ovDayNum = ovDate.getDate();
  }

  const pre  = points.filter(p => !ovDayNum || p.day < ovDayNum).map(p => p.temp);
  const post = points.filter(p =>  ovDayNum && p.day > ovDayNum).map(p => p.temp);
  const preAvg  = pre.length  ? pre.reduce((a, b) => a + b) / pre.length  : null;
  const postAvg = post.length ? post.reduce((a, b) => a + b) / post.length : null;

  const card = document.createElement('div'); card.className = 'pr-bbt-card';
  if (preAvg && postAvg && postAvg - preAvg > 0.1) {
    const hl = document.createElement('div'); hl.className = 'pr-bbt-card-hl';
    hl.innerHTML = `Your temperature <em class="pr-em">jumped on day ${ovDayNum}.</em>`;
    const sub = document.createElement('p'); sub.className = 'pr-bbt-card-sub';
    sub.textContent = 'That is when you ovulated. It stayed up for the rest of the cycle.';
    card.append(hl, sub);
  } else {
    const hl = document.createElement('div'); hl.className = 'pr-bbt-card-hl'; hl.textContent = 'Temperature this cycle.'; card.appendChild(hl);
  }

  card.appendChild(_bbtSvg(points, daysInM, ovDayNum, preAvg, postAvg));

  if (preAvg || postAvg) {
    const row = document.createElement('div'); row.className = 'pr-bbt-stats';
    const stat = (label, val, cls) => {
      const s = document.createElement('div'); s.className = 'pr-bbt-stat';
      s.innerHTML = `<div class="pr-bbt-stat-lbl">${label}</div><div class="pr-bbt-stat-val${cls ? ' ' + cls : ''}">${val}<span class="pr-bbt-stat-deg">°</span></div>`;
      return s;
    };
    if (preAvg)  row.appendChild(stat('Usually before', preAvg.toFixed(2)));
    if (postAvg) row.appendChild(stat('Usually after',  postAvg.toFixed(2), 'post'));
    if (preAvg && postAvg) {
      const jump = postAvg - preAvg;
      row.appendChild(stat('The jump', (jump >= 0 ? '+' : '') + jump.toFixed(2), 'jump'));
    }
    card.appendChild(row);
  }
  sec.appendChild(card);
  return sec;
}

function _bbtSvg(points, daysInMonth, ovDayNum, preAvg, postAvg) {
  const W = 420, H = 90;
  const allT = points.map(p => p.temp);
  const minT = Math.min(35.8, ...allT) - 0.05;
  const maxT = Math.max(37.2, ...allT) + 0.05;
  const xS = d => ((d - 1) / Math.max(daysInMonth - 1, 1)) * W;
  const yS = t => H - ((t - minT) / (maxT - minT)) * H;
  const NS = 'http://www.w3.org/2000/svg';

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H + 20}`);
  svg.setAttribute('width', '100%');
  svg.style.overflow = 'visible';

  const mkLine = (x1, y1, x2, y2, stroke, dash, opacity) => {
    const el = document.createElementNS(NS, 'line');
    el.setAttribute('x1', x1); el.setAttribute('y1', y1); el.setAttribute('x2', x2); el.setAttribute('y2', y2);
    el.style.stroke = stroke; el.style.strokeWidth = '1';
    if (dash)    el.style.strokeDasharray = dash;
    if (opacity) el.style.strokeOpacity = opacity;
    return el;
  };

  const mkPath = (pts, stroke) => {
    if (!pts.length) return null;
    const el = document.createElementNS(NS, 'path');
    el.setAttribute('d', pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xS(p.day).toFixed(1)},${yS(p.temp).toFixed(1)}`).join(' '));
    el.style.fill = 'none'; el.style.stroke = stroke;
    el.style.strokeWidth = '2'; el.style.strokeLinecap = 'round'; el.style.strokeLinejoin = 'round';
    return el;
  };

  if (preAvg)  svg.appendChild(mkLine(0, yS(preAvg),  W, yS(preAvg),  'var(--flow-medium)', '3,3'));
  if (postAvg) svg.appendChild(mkLine(0, yS(postAvg), W, yS(postAvg), 'var(--purple)',       '3,3'));
  if (ovDayNum) svg.appendChild(mkLine(xS(ovDayNum), 0, xS(ovDayNum), H, 'var(--purple)', null, '0.25'));

  const prePts  = ovDayNum ? points.filter(p => p.day <= ovDayNum) : points;
  const postPts = ovDayNum ? points.filter(p => p.day >= ovDayNum) : [];
  const prePath  = mkPath(prePts,  'var(--flow-medium)');
  const postPath = mkPath(postPts, 'var(--purple)');
  if (prePath)  svg.appendChild(prePath);
  if (postPath) svg.appendChild(postPath);

  const mkLbl = (x, y, text, color, anchor) => {
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', x); t.setAttribute('y', y);
    t.style.fontSize = '8px'; t.style.fill = color;
    if (anchor) t.setAttribute('text-anchor', anchor);
    t.textContent = text; return t;
  };
  if (preAvg)  svg.appendChild(mkLbl(3,  yS(preAvg)  - 3, 'Before ovulation', 'var(--flow-medium)'));
  if (postAvg) svg.appendChild(mkLbl(3,  yS(postAvg) - 3, 'After ovulation',  'var(--purple)'));
  svg.appendChild(mkLbl(0,       H + 14, 'Day 1',           'var(--text-3)'));
  svg.appendChild(mkLbl(W,       H + 14, `Day ${daysInMonth}`, 'var(--text-3)', 'end'));

  const last = points[points.length - 1];
  const dot  = document.createElementNS(NS, 'circle');
  dot.setAttribute('cx', xS(last.day)); dot.setAttribute('cy', yS(last.temp)); dot.setAttribute('r', '4');
  dot.style.fill = (ovDayNum && last.day >= ovDayNum) ? 'var(--purple)' : 'var(--flow-medium)';
  svg.appendChild(dot);
  return svg;
}

// ── Detail: symptoms ───────────────────────────────────────────────
function _buildDetailSymptoms(year, monthIdx) {
  const sec = document.createElement('div'); sec.className = 'pr-detail-section';
  const lbl = document.createElement('div'); lbl.className = 'pr-detail-label'; lbl.textContent = 'How you felt';
  sec.appendChild(lbl);

  const prefix = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
  const counts = {};
  for (const [ds, sym] of Object.entries(_data.period?.symptoms ?? {})) {
    if (!ds.startsWith(prefix)) continue;
    for (const [k, v] of Object.entries(sym ?? {})) { if (v) counts[k] = (counts[k] ?? 0) + 1; }
  }
  for (const entry of _entries) {
    for (const [ds, sym] of Object.entries(entry.symptoms ?? {})) {
      if (!ds.startsWith(prefix)) continue;
      for (const [k, v] of Object.entries(sym ?? {})) { if (v) counts[k] = (counts[k] ?? 0) + 1; }
    }
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) {
    const e = document.createElement('div'); e.className = 'pr-detail-empty'; e.textContent = 'No symptoms logged for this month.'; sec.appendChild(e); return sec;
  }

  const list = document.createElement('div'); list.className = 'pr-sym-list';
  for (const [key, count] of sorted) {
    const row = document.createElement('div'); row.className = 'pr-sym-row';
    const emoji = document.createElement('div'); emoji.className = 'pr-sym-emoji'; emoji.textContent = SYM_EMOJI[key] ?? '·';
    const text  = document.createElement('div'); text.className  = 'pr-sym-text';
    text.innerHTML = `<span class="pr-sym-name">${SYM_LABEL[key] ?? key}</span> on ${count} ${count === 1 ? 'day' : 'days'}`;
    const cnt = document.createElement('div'); cnt.className = 'pr-sym-count'; cnt.textContent = `${count}×`;
    row.append(emoji, text, cnt); list.appendChild(row);
  }
  sec.appendChild(list);
  return sec;
}

// ── Today view ─────────────────────────────────────────────────────
function _buildToday(el) {
  const today = _todayStr();
  const hdr = document.createElement('div'); hdr.className = 'pr-today-hdr';
  hdr.innerHTML = `<h2 class="pr-today-title">Today</h2><span class="pr-today-hint">Quick log, tap what feels right</span>`;
  el.appendChild(hdr);

  const card = document.createElement('div'); card.className = 'pr-log-card';
  const top  = document.createElement('div'); top.className  = 'pr-log-card-top';
  top.innerHTML = `<h3 class="pr-log-card-title">How are you today?</h3><span class="pr-autosave">Saves as you tap</span>`;
  card.appendChild(top);

  const grid  = document.createElement('div'); grid.className  = 'pr-log-grid';
  const left  = document.createElement('div'); left.className  = 'pr-log-col';
  const right = document.createElement('div'); right.className = 'pr-log-col';
  const counts = _countSymptoms();

  left.appendChild(_buildFlowChips(today));
  SYM_LEFT.forEach(g => left.appendChild(_buildSymGroup(g, today, counts)));
  right.appendChild(_buildBbtInput(today));
  SYM_RIGHT.forEach(g => right.appendChild(_buildSymGroup(g, today, counts)));

  grid.append(left, right); card.appendChild(grid); el.appendChild(card);
  el.appendChild(_buildInsights());
}

function _buildFlowChips(today) {
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
      _data = { ..._data, period }; _entries = getPeriodEntries(_data); _stats = periodStats(_entries); _render();
    });
    chips.appendChild(chip);
  });
  sec.appendChild(chips); return sec;
}

function _buildSymGroup(group, today, counts) {
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
      _data = { ..._data, period }; _entries = getPeriodEntries(_data); _render();
    });
    chips.appendChild(chip);
  });
  sec.appendChild(chips); return sec;
}

function _buildBbtInput(today) {
  const sec = _makeSec('Temperature when you woke up');
  const cur = _data.period?.bbt?.[today] ?? null;
  let val   = cur ?? 36.50;

  const wrap = document.createElement('div'); wrap.className = 'pr-bbt-wrap';
  const minB = document.createElement('button'); minB.className = 'pr-bbt-btn'; minB.textContent = '−';
  const disp = document.createElement('div');   disp.className = 'pr-bbt-disp';
  const plus = document.createElement('button'); plus.className = 'pr-bbt-btn'; plus.textContent = '+';
  wrap.append(minB, disp, plus);
  const note = document.createElement('p'); note.className = 'pr-bbt-note';

  const refresh = () => {
    disp.innerHTML = `<span class="pr-bbt-val">${val.toFixed(2)}</span><span class="pr-bbt-unit">°C</span>`;
    note.textContent = _bbtNote(val);
  };
  const save = () => {
    const period = { ...(_data.period ?? {}) };
    period.bbt = setBbt(period.bbt, today, val);
    _onSave({ period }); _data = { ..._data, period }; _entries = getPeriodEntries(_data); refresh();
  };
  minB.addEventListener('click', () => { val = Math.max(35.0, Math.round((val - 0.05) * 100) / 100); save(); });
  plus.addEventListener('click', () => { val = Math.min(40.0, Math.round((val + 0.05) * 100) / 100); save(); });

  refresh();
  if (cur === null) note.textContent = 'Log every morning before getting up for the most accurate results.';
  sec.append(wrap, note);

  if (cur !== null) {
    const clr = document.createElement('button'); clr.className = 'pr-bbt-clr'; clr.textContent = 'Clear today';
    clr.addEventListener('click', () => {
      const period = { ...(_data.period ?? {}) };
      period.bbt = setBbt(period.bbt, today, null);
      _onSave({ period }); _data = { ..._data, period }; _render();
    });
    sec.appendChild(clr);
  }
  return sec;
}

function _buildInsights() {
  const sec = document.createElement('div'); sec.className = 'pr-insights';
  const hdr = document.createElement('div'); hdr.className = 'pr-insights-hdr';
  hdr.innerHTML = `<h3 class="pr-insights-title">What we've learned about you</h3><span class="pr-insights-sub">From ${_entries.length} ${_entries.length === 1 ? 'cycle' : 'cycles'} so far</span>`;
  sec.appendChild(hdr);

  if (_entries.length < 2 || !_stats) {
    const e = document.createElement('p'); e.className = 'pr-insights-empty'; e.textContent = 'Insights appear after two cycles are tracked.'; sec.appendChild(e); return sec;
  }

  const grid = document.createElement('div'); grid.className = 'pr-insights-grid';
  grid.appendChild(_insightCard(
    'Cycle length',
    `Your cycles are <em>usually about ${_stats.avg} days${_stats.irregular ? ', though they vary' : ''}</em>.`,
    `${_entries.length} cycles tracked. Shortest was ${_stats.min}, longest was ${_stats.max}. ${_stats.irregular ? 'Your cycle varies quite a bit, so we widen the prediction window.' : 'We use your recent ones more when guessing the next one.'}`
  ));
  const avgDur = avgPeriodDuration(_entries);
  if (avgDur) grid.appendChild(_insightCard(
    'Period length',
    `Your period usually lasts <em>about ${avgDur} days.</em>`,
    'Across all tracked cycles. Some variation between cycles is completely normal.'
  ));
  const highDays = _bbtHighDays();
  if (highDays) grid.appendChild(_insightCard(
    'Temperature',
    `Your temperature has stayed high for <em>${highDays} ${highDays === 1 ? 'day' : 'days'}.</em>`,
    highDays >= 14 ? 'Consistent with ovulation. If your period is late and temperature stays high past day 18, it might be worth taking a test.' : 'A sustained rise usually means ovulation happened. Keep logging every morning.'
  ));
  sec.appendChild(grid); return sec;
}

function _insightCard(eyebrow, headline, body) {
  const card = document.createElement('div'); card.className = 'pr-insight-card';
  card.innerHTML = `<div class="pr-insight-eyebrow">${eyebrow}</div><div class="pr-insight-hl">${headline}</div><p class="pr-insight-body">${body}</p>`;
  return card;
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
  if (!_entries.length) return 'Tap Today to start logging your period.';
  const entry = _entries.find(e => D(today) >= D(e.start) && D(today) <= D(e.end));
  if (entry) return entry.flow?.[today] ? `Logged as ${entry.flow[today]} flow today. Head to Today to update your symptoms.` : 'Tap Today to update your flow and symptoms.';
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
  if (_stats) pills.push({ color: _stats.irregular ? 'var(--amber)' : 'var(--green)', text: `Cycle is <strong>${_stats.irregular ? 'irregular' : 'on track'}</strong>` });
  return pills;
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

function _bbtHighDays() {
  const bbt = _data.period?.bbt ?? {};
  let d = D(_todayStr()), count = 0;
  while (count < 60) { const ds = dStr(d); const val = bbt[ds]; if (val == null || val < 36.7) break; count++; d = addD(d, -1); }
  return count > 0 ? count : null;
}

function _loadCss() {
  const href = new URL('../../style/period.css', import.meta.url).href;
  if (!document.querySelector(`link[href="${href}"]`))
    document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'stylesheet', href }));
}
