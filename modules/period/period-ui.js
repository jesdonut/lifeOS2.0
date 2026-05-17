// period-ui.js — Period tracker UI module

import {
  getPeriodEntries,
  periodStats,
  currentWindow,
  futurePredictions,
  fertileWindow,
  ovulationDay,
  fd,
  mergeEntry,
} from './period-data.js';

// ── Module state ──────────────────────────────────────────────────────────────

let _container = null;
let _data      = null;
let _onSave    = null;
let _selectedDate = null;   // 'YYYY-MM-DD'
let _listeners = [];        // [{ el, type, fn }] for cleanup

const SYMPTOMS = [
  { key: 'cramps',    label: 'Cramps'     },
  { key: 'headache',  label: 'Headache'   },
  { key: 'fatigue',   label: 'Fatigue'    },
  { key: 'bloating',  label: 'Bloating'   },
  { key: 'mood',      label: 'Mood'       },
  { key: 'back_pain', label: 'Back pain'  },
];

const DISCHARGE_OPTIONS = [
  { value: '',          label: '—'          },
  { value: 'dry',       label: 'Dry'        },
  { value: 'sticky',    label: 'Sticky'     },
  { value: 'creamy',    label: 'Creamy'     },
  { value: 'watery',    label: 'Watery'     },
  { value: 'egg_white', label: 'Egg white'  },
];

// ── Exported API ──────────────────────────────────────────────────────────────

export function init(container, data, onSave) {
  _container = container;
  _data      = data;
  _onSave    = onSave;

  // Inject CSS
  if (!document.getElementById('period-css')) {
    const link = document.createElement('link');
    link.id   = 'period-css';
    link.rel  = 'stylesheet';
    link.href = new URL('./period.css', import.meta.url).href;
    document.head.appendChild(link);
  }

  render();
}

export function destroy() {
  for (const { el, type, fn } of _listeners) {
    el.removeEventListener(type, fn);
  }
  _listeners = [];
  _container = null;
  _data      = null;
  _onSave    = null;
  _selectedDate = null;

  const link = document.getElementById('period-css');
  if (link) link.remove();
}

export function onDataChange(newData) {
  _data = newData;
  render();
}

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
  if (!_container) return;
  _container.innerHTML = '';
  _listeners = [];

  const period  = _data?.period ?? {};
  const entries = getPeriodEntries(_data);
  const stats   = periodStats(entries);
  const window1 = currentWindow(entries, stats);
  const preds   = futurePredictions(entries, stats, 3);

  // Pre-compute day classification maps for the calendar
  const dayMap = buildDayMap(entries, period, preds, window1);

  // Root
  const root = el('div', 'period-root');

  // Stats bar
  root.appendChild(renderStatsBar(entries, stats, window1));

  // Body: calendar + optional day panel
  const body = el('div', _selectedDate ? 'period-body' : 'period-body no-panel');

  const calWrap = el('div', 'period-calendar-wrap');
  calWrap.appendChild(renderYearCalendar(dayMap));
  body.appendChild(calWrap);

  if (_selectedDate) {
    body.appendChild(renderDayPanel(period, entries));
  }

  root.appendChild(body);

  // Legend
  root.appendChild(renderLegend());

  _container.appendChild(root);
}

// ── Stats bar ─────────────────────────────────────────────────────────────────

function renderStatsBar(entries, stats, window1) {
  const bar = el('div', 'period-stats-bar');

  if (!stats || !window1) {
    const note = el('span');
    note.style.color = 'var(--text-muted)';
    note.style.fontSize = 'var(--text-sm)';
    note.textContent = entries.length < 2
      ? 'Log at least 2 periods to see predictions.'
      : 'Not enough data yet.';
    bar.appendChild(note);
    return bar;
  }

  // Arrival window
  const arrivalText = `arrives day ${stats.windowMin}–${stats.windowMax}`;
  bar.appendChild(statItem('Next period', arrivalText));

  bar.appendChild(sep());

  // Cycle average
  bar.appendChild(statItem('Avg cycle', `${stats.avg} days`));

  bar.appendChild(sep());

  // Count + since
  const firstYear = entries[0].start.slice(0, 4);
  const sinceText = `${stats.count} cycle${stats.count !== 1 ? 's' : ''} since ${firstYear}`;
  bar.appendChild(statItem('Tracked', sinceText));

  // Irregular badge
  if (stats.irregular) {
    const badge = el('span', 'period-irregular-badge');
    badge.textContent = 'irregular cycle';
    bar.appendChild(badge);
  }

  return bar;
}

function statItem(label, value) {
  const wrap = el('div', 'stat-item');
  const l = el('span', 'stat-label');
  l.textContent = label;
  const v = el('span', 'stat-value');
  v.textContent = value;
  wrap.appendChild(l);
  wrap.appendChild(v);
  return wrap;
}

function sep() {
  return el('div', 'stat-sep');
}

// ── Day classification map ────────────────────────────────────────────────────

/*
 Returns a Map<'YYYY-MM-DD', classificationObj>
 classificationObj = {
   flowLevel: 'heavy'|'medium'|'light'|'spotting'|'unspecified'|null,
   isSpotting: bool,      // global spotting list
   predicted: 0|1|2|3,   // 0=none, 1=first pred, 2=second, 3=third
   fertile: bool,
   ovulation: bool,
 }
*/
function buildDayMap(entries, period, preds, window1) {
  const map = new Map();

  function get(dateStr) {
    if (!map.has(dateStr)) map.set(dateStr, { flowLevel: null, isSpotting: false, predicted: 0, fertile: false, ovulation: false });
    return map.get(dateStr);
  }

  // Flow days from entries
  for (const entry of entries) {
    const startD = parseDate(entry.start);
    const endD   = parseDate(entry.end);
    let cur = new Date(startD);
    while (cur <= endD) {
      const ds = fd(cur);
      const obj = get(ds);
      const flow = entry.flow?.[ds];
      obj.flowLevel = flow ?? 'unspecified';
      cur = addDays(cur, 1);
    }
  }

  // Global spotting list
  for (const ds of (period.spotting ?? [])) {
    const obj = get(ds);
    if (!obj.flowLevel) {           // don't overwrite actual flow
      obj.isSpotting = true;
    }
  }

  // Predictions (only future ones)
  const todayStr = todayDate();
  for (let pi = 0; pi < preds.length; pi++) {
    const pred = preds[pi];
    const predNum = pi + 1;         // 1, 2, 3
    let cur = new Date(pred.earliest);
    while (cur <= pred.latest) {
      const ds = fd(cur);
      if (ds >= todayStr) {         // only color future days
        const obj = get(ds);
        if (!obj.flowLevel && !obj.isSpotting) {
          // only paint the lowest prediction number (first pred wins)
          if (obj.predicted === 0) obj.predicted = predNum;
        }
      }
      cur = addDays(cur, 1);
    }
  }

  // Fertile window for first future prediction only
  if (preds.length > 0) {
    const fw = fertileWindow(preds[0]);
    const ov = ovulationDay(preds[0]);
    const ovStr = fd(ov);
    let cur = new Date(fw.start);
    while (cur <= fw.end) {
      const ds = fd(cur);
      if (ds >= todayStr) {
        const obj = get(ds);
        if (!obj.flowLevel && !obj.isSpotting && obj.predicted === 0) {
          obj.fertile = true;
        }
        if (ds === ovStr) obj.ovulation = true;
      }
      cur = addDays(cur, 1);
    }
  }

  return map;
}

// ── Year calendar ─────────────────────────────────────────────────────────────

function renderYearCalendar(dayMap) {
  const year = new Date().getFullYear();

  const wrap = el('div');

  const yearLabel = el('div', 'period-year-label');
  yearLabel.textContent = String(year);
  wrap.appendChild(yearLabel);

  const grid = el('div', 'period-year-grid');

  for (let month = 0; month < 12; month++) {
    grid.appendChild(renderMonth(year, month, dayMap));
  }

  wrap.appendChild(grid);
  return wrap;
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW_LABELS  = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function renderMonth(year, month, dayMap) {
  const wrap = el('div', 'period-month');

  const nameEl = el('div', 'period-month-name');
  nameEl.textContent = MONTH_NAMES[month];
  wrap.appendChild(nameEl);

  // Weekday headers
  const hdr = el('div', 'period-weekday-headers');
  for (const d of DOW_LABELS) {
    const h = el('div', 'period-weekday-header');
    h.textContent = d;
    hdr.appendChild(h);
  }
  wrap.appendChild(hdr);

  const daysGrid = el('div', 'period-days-grid');

  // Leading blanks (0=Sun, 1=Mon, ...)
  const firstDow = new Date(year, month, 1).getDay();
  for (let i = 0; i < firstDow; i++) {
    daysGrid.appendChild(el('div', 'period-day is-empty'));
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr    = todayDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const info    = dayMap.get(dateStr) ?? { flowLevel: null, isSpotting: false, predicted: 0, fertile: false, ovulation: false };

    const cell = el('button', buildDayClass(info, dateStr, todayStr));
    cell.textContent = String(day);
    cell.setAttribute('data-date', dateStr);
    cell.setAttribute('aria-label', dateStr);

    if (info.ovulation) {
      const dot = el('span', 'ovulation-dot');
      cell.appendChild(dot);
    }

    on(cell, 'click', () => handleDayClick(dateStr));
    daysGrid.appendChild(cell);
  }

  wrap.appendChild(daysGrid);
  return wrap;
}

function buildDayClass(info, dateStr, todayStr) {
  const classes = ['period-day'];

  if (info.flowLevel) {
    classes.push('flow-' + info.flowLevel);
  } else if (info.isSpotting) {
    classes.push('spotting-day');
  } else if (info.fertile) {
    classes.push('fertile');
  } else if (info.predicted > 0) {
    classes.push('predicted-' + info.predicted);
  }

  if (dateStr === todayStr) classes.push('is-today');
  if (dateStr === _selectedDate) classes.push('is-selected');

  return classes.join(' ');
}

// ── Day panel ─────────────────────────────────────────────────────────────────

function renderDayPanel(period, entries) {
  const ds = _selectedDate;
  const panel = el('div', 'period-day-panel');

  // Header row: date + close
  const closeRow = el('div', 'period-panel-close');
  const closeBtn = el('button', 'period-panel-close-btn');
  closeBtn.textContent = '✕ close';
  on(closeBtn, 'click', () => {
    _selectedDate = null;
    render();
  });
  closeRow.appendChild(closeBtn);

  const dateEl = el('div', 'period-day-panel-date');
  dateEl.textContent = formatDisplayDate(ds);

  panel.appendChild(dateEl);
  panel.appendChild(closeRow);

  // ── Flow ──
  const existingFlow = findFlowForDate(entries, ds);
  panel.appendChild(renderFlowSection(ds, existingFlow, entries, period));

  // ── BBT ──
  const bbt = period.bbt?.[ds] ?? '';
  panel.appendChild(renderBbtSection(ds, bbt, period));

  // ── Discharge ──
  const discharge = period.discharge?.[ds] ?? '';
  panel.appendChild(renderDischargeSection(ds, discharge, period));

  // ── Symptoms ──
  const sympObj = period.symptoms?.[ds] ?? {};
  panel.appendChild(renderSymptomsSection(ds, sympObj, period));

  // ── Notes ──
  const entryForDate = findEntryForDate(entries, ds);
  const notes = entryForDate?.notes ?? '';
  panel.appendChild(renderNotesSection(ds, notes, entries, period));

  return panel;
}

// Flow section
function renderFlowSection(ds, existingFlow, entries, period) {
  const sec = section('Flow');
  const btns = el('div', 'period-flow-btns');

  const levels = [
    { value: 'heavy',    label: 'Heavy'    },
    { value: 'medium',   label: 'Medium'   },
    { value: 'light',    label: 'Light'    },
    { value: 'spotting', label: 'Spotting' },
  ];

  for (const lv of levels) {
    const btn = el('button', 'period-flow-btn' + (existingFlow === lv.value ? ` active-${lv.value}` : ''));
    btn.textContent = lv.label;
    on(btn, 'click', () => {
      const updated = mergeEntry(entries, ds, 'flow', lv.value);
      _onSave({ period: { ...period, entries: updated } });
    });
    btns.appendChild(btn);
  }

  sec.appendChild(btns);
  return sec;
}

// BBT section
function renderBbtSection(ds, bbt, period) {
  const sec = section('BBT');
  const row = el('div', 'period-bbt-row');

  const input = el('input', 'period-bbt-input');
  input.type        = 'number';
  input.step        = '0.01';
  input.min         = '35';
  input.max         = '42';
  input.placeholder = '36.5';
  input.value       = bbt !== '' ? String(bbt) : '';

  on(input, 'blur', () => {
    const v = parseFloat(input.value);
    if (!isNaN(v) && v >= 35 && v <= 42) {
      _onSave({ period: { ...period, bbt: { ...(period.bbt ?? {}), [ds]: v } } });
    } else if (input.value === '') {
      // Remove entry if cleared
      const updated = { ...(period.bbt ?? {}) };
      delete updated[ds];
      _onSave({ period: { ...period, bbt: updated } });
    }
  });

  const unit = el('span', 'period-bbt-unit');
  unit.textContent = '°C';

  row.appendChild(input);
  row.appendChild(unit);
  sec.appendChild(row);
  return sec;
}

// Discharge section
function renderDischargeSection(ds, discharge, period) {
  const sec = section('Discharge');

  const sel = el('select', 'period-discharge-select');
  for (const opt of DISCHARGE_OPTIONS) {
    const o = document.createElement('option');
    o.value       = opt.value;
    o.textContent = opt.label;
    if (opt.value === discharge) o.selected = true;
    sel.appendChild(o);
  }

  on(sel, 'change', () => {
    const v = sel.value;
    if (v === '') {
      const updated = { ...(period.discharge ?? {}) };
      delete updated[ds];
      _onSave({ period: { ...period, discharge: updated } });
    } else {
      _onSave({ period: { ...period, discharge: { ...(period.discharge ?? {}), [ds]: v } } });
    }
  });

  sec.appendChild(sel);
  return sec;
}

// Symptoms section
function renderSymptomsSection(ds, sympObj, period) {
  const sec = section('Symptoms');
  const grid = el('div', 'period-symptom-grid');

  for (const sym of SYMPTOMS) {
    const item = el('label', 'period-symptom-item');

    const checkbox = document.createElement('input');
    checkbox.type    = 'checkbox';
    checkbox.checked = !!sympObj[sym.key];

    on(checkbox, 'change', () => {
      const current = { ...(period.symptoms?.[ds] ?? {}) };
      if (checkbox.checked) {
        current[sym.key] = true;
      } else {
        delete current[sym.key];
      }
      const updatedSymptoms = { ...(period.symptoms ?? {}), [ds]: current };
      if (Object.keys(current).length === 0) delete updatedSymptoms[ds];
      _onSave({ period: { ...period, symptoms: updatedSymptoms } });
    });

    const lbl = el('span', 'period-symptom-label');
    lbl.textContent = sym.label;

    item.appendChild(checkbox);
    item.appendChild(lbl);
    grid.appendChild(item);
  }

  sec.appendChild(grid);
  return sec;
}

// Notes section
function renderNotesSection(ds, notes, entries, period) {
  const sec = section('Notes');

  const textarea = el('textarea', 'period-notes-textarea');
  textarea.placeholder = 'Any notes for this day…';
  textarea.value       = notes;

  let saveTimer = null;
  on(textarea, 'input', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const updated = mergeEntry(entries, ds, 'notes', textarea.value);
      _onSave({ period: { ...period, entries: updated } });
    }, 600);
  });

  on(textarea, 'blur', () => {
    clearTimeout(saveTimer);
    const updated = mergeEntry(entries, ds, 'notes', textarea.value);
    _onSave({ period: { ...period, entries: updated } });
  });

  sec.appendChild(textarea);
  return sec;
}

// ── Legend ────────────────────────────────────────────────────────────────────

function renderLegend() {
  const legend = el('div', 'period-legend');

  const items = [
    { cls: 'heavy',     label: 'Heavy'     },
    { cls: 'medium',    label: 'Medium'    },
    { cls: 'light',     label: 'Light'     },
    { cls: 'spotting',  label: 'Spotting'  },
    { cls: 'predicted', label: 'Predicted' },
    { cls: 'fertile',   label: 'Fertile'   },
  ];

  for (const item of items) {
    const wrap = el('div', 'period-legend-item');
    const dot  = el('div', `period-legend-dot ${item.cls}`);
    const lbl  = el('span');
    lbl.textContent = item.label;
    wrap.appendChild(dot);
    wrap.appendChild(lbl);
    legend.appendChild(wrap);
  }

  return legend;
}

// ── Event handling ────────────────────────────────────────────────────────────

function handleDayClick(dateStr) {
  if (_selectedDate === dateStr) {
    _selectedDate = null;
  } else {
    _selectedDate = dateStr;
  }
  render();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Create element with class string */
function el(tag, cls) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  return node;
}

/** Register listener and track for cleanup */
function on(el, type, fn) {
  el.addEventListener(type, fn);
  _listeners.push({ el, type, fn });
}

/** Build a labeled panel section */
function section(labelText) {
  const sec = el('div', 'period-panel-section');
  const lbl = el('div', 'period-panel-section-label');
  lbl.textContent = labelText;
  sec.appendChild(lbl);
  return sec;
}

/** Parse 'YYYY-MM-DD' to local midnight Date */
function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Add n days to a Date, returning new Date */
function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Today as 'YYYY-MM-DD' in local time */
function todayDate() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

/** Human-readable date from 'YYYY-MM-DD' */
function formatDisplayDate(ds) {
  const d = parseDate(ds);
  return d.toLocaleDateString('en-GB', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

/** Find flow level for a specific date across all entries */
function findFlowForDate(entries, dateStr) {
  for (const entry of entries) {
    if (entry.flow?.[dateStr]) return entry.flow[dateStr];
    // Also check if date is within entry range but has no specific flow key
    const startD = parseDate(entry.start);
    const endD   = parseDate(entry.end);
    const d      = parseDate(dateStr);
    if (d >= startD && d <= endD) return entry.flow?.[dateStr] ?? null;
  }
  return null;
}

/** Find the entry that contains or is adjacent to a date */
function findEntryForDate(entries, dateStr) {
  const d = parseDate(dateStr);
  for (const entry of entries) {
    const s = parseDate(entry.start);
    const e = parseDate(entry.end);
    if (d >= s && d <= e) return entry;
  }
  return null;
}
