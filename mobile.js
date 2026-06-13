// mobile.js — standalone mobile quick-entry app
// Stores delta in localStorage under 'lifeOS_mobile'
// Export as delta JSON, import on PC via Settings > Import mobile data

const MOBILE_KEY = 'lifeOS_mobile';
const TZ = 'Asia/Tokyo';

const SPEND_CATS = [
  { id: 'food',          name: 'Food',          sub: ['Breakfast', 'Lunch', 'Dinner', 'Others'] },
  { id: 'bills',         name: 'Bills',         sub: ['Rent', 'Gas', 'Water', 'Electricity', 'Internet', 'Mobile'] },
  { id: 'commute',       name: 'Commute',       sub: ['Work', 'Bus', 'Train', 'Airplane', 'Taxi', 'Ship'] },
  { id: 'entertainment', name: 'Entertainment', sub: ['Game', 'Movie', 'Clothes', 'Gadget'] },
  { id: 'beauty',        name: 'Beauty',        sub: ['Hair cut', 'Hair color', 'Nails', 'Eyebrow'] },
  { id: 'paperwork',     name: 'Paperwork',     sub: ['Visa', 'Government', 'Ward office'] },
  { id: 'medical',       name: 'Medical',       sub: ['Hospital', 'Clinic', 'Pharmacy'] },
  { id: 'necessities',   name: 'Necessities',   sub: ['Shampoo', 'Soap', 'Detergent'] },
];

const EVENT_CATS = [
  { id: 'personal',  name: 'Personal',  color: '#d69aa5' },
  { id: 'work',      name: 'Work',      color: '#b8c89a' },
  { id: 'health',    name: 'Health',    color: '#c79a9a' },
  { id: 'friends',   name: 'Friends',   color: '#7c9ccb' },
  { id: 'family',    name: 'Family',    color: '#86afc5' },
  { id: 'travel',    name: 'Travel',    color: '#d1b36a' },
  { id: 'education', name: 'Education', color: '#8fafa2' },
  { id: 'partner',   name: 'Partner',   color: '#b7a6b5' },
];

const SYMPTOMS = ['cramps', 'bloating', 'headache', 'mood swings', 'fatigue', 'back pain', 'nausea', 'tender'];

// ── State ──────────────────────────────────────────────────────────
let _data = _load();
let _viewDate = _todayStr();
let _tab = 'spend';
let _sheet = null; // null | 'spend' | 'event' | 'task'

// ── Persistence ────────────────────────────────────────────────────
function _load() {
  try {
    return JSON.parse(localStorage.getItem(MOBILE_KEY)) || _empty();
  } catch {
    return _empty();
  }
}

function _empty() {
  return {
    type: 'delta',
    version: 2,
    createdAt: new Date().toISOString(),
    calendar: { spendEntries: {}, events: [] },
    period: { entries: [], spotting: [], symptoms: {} },
    tasks: {},
  };
}

function _save() {
  localStorage.setItem(MOBILE_KEY, JSON.stringify(_data));
}

function _clearData() {
  if (!confirm('Clear all unsaved mobile entries? Make sure you exported first.')) return;
  _data = _empty();
  _save();
  render();
}

// ── Date helpers ───────────────────────────────────────────────────
function _todayStr() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: TZ });
}

function _dateLabel(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function _shiftDate(s, n) {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function _uid() {
  return 'mob_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── Export ─────────────────────────────────────────────────────────
function _export() {
  const out = { ..._data, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `lifeos-delta-${_todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Count helper ───────────────────────────────────────────────────
function _entryCount() {
  const spendDates = Object.keys(_data.calendar.spendEntries).length;
  const events     = _data.calendar.events.length;
  const period     = _data.period.entries.length + _data.period.spotting.length;
  const tasks      = Object.values(_data.tasks).flat().length;
  return spendDates + events + period + tasks;
}

// ── Render ─────────────────────────────────────────────────────────
function render() {
  const app = document.getElementById('mob-app');
  app.innerHTML = '';
  app.appendChild(_header());
  app.appendChild(_datebar());
  app.appendChild(_tabs());
  app.appendChild(_content());
  if (_sheet) app.appendChild(_buildSheet());
}

function _header() {
  const el = document.createElement('div');
  el.className = 'mob-header';

  const count = _entryCount();
  el.innerHTML = `
    <span class="mob-title">LifeOS</span>
    <div class="mob-header-actions">
      ${count > 0 ? `<button class="mob-clear-btn" id="clearBtn">Clear</button>` : ''}
      <button class="mob-export-btn" id="exportBtn">Export${count > 0 ? ` (${count})` : ''}</button>
    </div>
  `;
  el.querySelector('#exportBtn').addEventListener('click', _export);
  el.querySelector('#clearBtn')?.addEventListener('click', _clearData);
  return el;
}

function _datebar() {
  const el = document.createElement('div');
  el.className = 'mob-datebar';
  const isToday = _viewDate === _todayStr();
  el.innerHTML = `
    <button class="mob-nav-btn" id="prevDay">&#8249;</button>
    <span class="mob-date-label">
      ${_dateLabel(_viewDate)}
      ${isToday ? '<span class="mob-today-badge">Today</span>' : ''}
    </span>
    <button class="mob-nav-btn" id="nextDay">&#8250;</button>
  `;
  el.querySelector('#prevDay').addEventListener('click', () => { _viewDate = _shiftDate(_viewDate, -1); render(); });
  el.querySelector('#nextDay').addEventListener('click', () => { _viewDate = _shiftDate(_viewDate, 1);  render(); });
  return el;
}

function _tabs() {
  const el = document.createElement('div');
  el.className = 'mob-tabs';
  for (const { id, label } of [
    { id: 'spend',  label: 'Spend'  },
    { id: 'period', label: 'Period' },
    { id: 'events', label: 'Events' },
    { id: 'tasks',  label: 'Tasks'  },
  ]) {
    const btn = document.createElement('button');
    btn.className = 'mob-tab' + (_tab === id ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => { _tab = id; render(); });
    el.appendChild(btn);
  }
  return el;
}

function _content() {
  const el = document.createElement('div');
  el.className = 'mob-content';
  if      (_tab === 'spend')  el.appendChild(_spendTab());
  else if (_tab === 'period') el.appendChild(_periodTab());
  else if (_tab === 'events') el.appendChild(_eventsTab());
  else if (_tab === 'tasks')  el.appendChild(_tasksTab());
  return el;
}

// ── Spend tab ──────────────────────────────────────────────────────
function _spendTab() {
  const el      = document.createElement('div');
  const entries = _data.calendar.spendEntries[_viewDate] || [];
  const total   = entries.reduce((s, e) => s + e.amount, 0);

  const hdr = document.createElement('div');
  hdr.className = 'mob-section-hdr';
  hdr.innerHTML = `<span class="mob-section-total">${total > 0 ? '¥' + total.toLocaleString() : ''}</span>`;
  const addBtn = document.createElement('button');
  addBtn.className = 'mob-add-btn';
  addBtn.textContent = '+ Add';
  addBtn.addEventListener('click', () => { _sheet = 'spend'; render(); });
  hdr.appendChild(addBtn);
  el.appendChild(hdr);

  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'mob-empty';
    empty.textContent = 'No entries yet';
    el.appendChild(empty);
    return el;
  }

  const list = document.createElement('div');
  list.className = 'mob-list';
  for (const entry of entries) {
    const cat  = SPEND_CATS.find(c => c.id === entry.categoryId);
    const item = document.createElement('div');
    item.className = 'mob-entry';
    item.innerHTML = `
      <span class="mob-dot" style="background:var(--cat-${entry.categoryId})"></span>
      <span class="mob-entry-cat">${cat?.name ?? entry.categoryId}</span>
      ${entry.subcategory ? `<span class="mob-entry-sub">${entry.subcategory}</span>` : ''}
      ${entry.note ? `<span class="mob-entry-note">${entry.note}</span>` : ''}
      <span class="mob-entry-amt">¥${entry.amount.toLocaleString()}</span>
      <button class="mob-del-btn" data-id="${entry.id}">×</button>
    `;
    item.querySelector('.mob-del-btn').addEventListener('click', e => {
      const id = e.target.dataset.id;
      _data.calendar.spendEntries[_viewDate] =
        (_data.calendar.spendEntries[_viewDate] || []).filter(x => x.id !== id);
      if (!_data.calendar.spendEntries[_viewDate].length)
        delete _data.calendar.spendEntries[_viewDate];
      _save(); render();
    });
    list.appendChild(item);
  }
  el.appendChild(list);
  return el;
}

// ── Period tab ─────────────────────────────────────────────────────
function _periodTab() {
  const el         = document.createElement('div');
  const isSpotting = _data.period.spotting.includes(_viewDate);
  const entry      = _data.period.entries.find(e => e.start <= _viewDate && _viewDate <= e.end);
  const symptoms   = _data.period.symptoms[_viewDate] || {};
  const flow       = isSpotting ? 'spotting' : (entry?.flow ?? 'none');

  // Flow
  const flowSec = document.createElement('div');
  flowSec.className = 'mob-period-section';
  flowSec.innerHTML = '<div class="mob-period-label">Flow</div>';
  const flowBtns = document.createElement('div');
  flowBtns.className = 'mob-flow-btns';
  for (const f of ['none', 'light', 'medium', 'heavy', 'spotting']) {
    const btn = document.createElement('button');
    btn.className = 'mob-flow-btn' + (f === 'spotting' ? ' spotting' : '') + (flow === f ? ' active' : '');
    btn.textContent = f.charAt(0).toUpperCase() + f.slice(1);
    btn.addEventListener('click', () => _setFlow(f));
    flowBtns.appendChild(btn);
  }
  flowSec.appendChild(flowBtns);
  el.appendChild(flowSec);

  // Symptoms
  const sympSec = document.createElement('div');
  sympSec.className = 'mob-period-section';
  sympSec.innerHTML = '<div class="mob-period-label">Symptoms</div>';
  const sympGrid = document.createElement('div');
  sympGrid.className = 'mob-symp-grid';
  for (const s of SYMPTOMS) {
    const btn = document.createElement('button');
    btn.className = 'mob-symp-btn' + (symptoms[s] ? ' active' : '');
    btn.textContent = s;
    btn.addEventListener('click', () => _toggleSymptom(s));
    sympGrid.appendChild(btn);
  }
  sympSec.appendChild(sympGrid);
  el.appendChild(sympSec);

  return el;
}

function _setFlow(flow) {
  _data.period.spotting = _data.period.spotting.filter(d => d !== _viewDate);
  _data.period.entries  = _data.period.entries.filter(
    e => !(e.start <= _viewDate && _viewDate <= e.end)
  );
  if (flow === 'spotting') {
    _data.period.spotting.push(_viewDate);
  } else if (flow !== 'none') {
    _data.period.entries.push({ id: _uid(), start: _viewDate, end: _viewDate, flow });
  }
  _save(); render();
}

function _toggleSymptom(symptom) {
  const s = _data.period.symptoms;
  if (!s[_viewDate]) s[_viewDate] = {};
  if (s[_viewDate][symptom]) {
    delete s[_viewDate][symptom];
    if (!Object.keys(s[_viewDate]).length) delete s[_viewDate];
  } else {
    s[_viewDate][symptom] = true;
  }
  _save(); render();
}

// ── Events tab ─────────────────────────────────────────────────────
function _eventsTab() {
  const el     = document.createElement('div');
  const events = _data.calendar.events.filter(e => e.date === _viewDate);

  const hdr = document.createElement('div');
  hdr.className = 'mob-section-hdr';
  hdr.innerHTML = '<span></span>';
  const addBtn = document.createElement('button');
  addBtn.className = 'mob-add-btn';
  addBtn.textContent = '+ Add';
  addBtn.addEventListener('click', () => { _sheet = 'event'; render(); });
  hdr.appendChild(addBtn);
  el.appendChild(hdr);

  if (!events.length) {
    const empty = document.createElement('div');
    empty.className = 'mob-empty';
    empty.textContent = 'No events';
    el.appendChild(empty);
    return el;
  }

  const list = document.createElement('div');
  list.className = 'mob-list';
  for (const ev of events) {
    const cat  = EVENT_CATS.find(c => c.id === ev.category);
    const item = document.createElement('div');
    item.className = 'mob-entry';
    item.innerHTML = `
      <span class="mob-dot" style="background:var(--cat-ev-${ev.category}, var(--text-3))"></span>
      <span class="mob-entry-cat">${ev.title}</span>
      <span class="mob-entry-sub">${cat?.name ?? ev.category}</span>
      <button class="mob-del-btn" data-id="${ev.id}">×</button>
    `;
    item.querySelector('.mob-del-btn').addEventListener('click', e => {
      _data.calendar.events = _data.calendar.events.filter(x => x.id !== e.target.dataset.id);
      _save(); render();
    });
    list.appendChild(item);
  }
  el.appendChild(list);
  return el;
}

// ── Tasks tab ──────────────────────────────────────────────────────
function _tasksTab() {
  const el    = document.createElement('div');
  const tasks = _data.tasks[_viewDate] || [];

  const hdr = document.createElement('div');
  hdr.className = 'mob-section-hdr';
  hdr.innerHTML = '<span></span>';
  const addBtn = document.createElement('button');
  addBtn.className = 'mob-add-btn';
  addBtn.textContent = '+ Add';
  addBtn.addEventListener('click', () => { _sheet = 'task'; render(); });
  hdr.appendChild(addBtn);
  el.appendChild(hdr);

  if (!tasks.length) {
    const empty = document.createElement('div');
    empty.className = 'mob-empty';
    empty.textContent = 'No tasks';
    el.appendChild(empty);
    return el;
  }

  const list = document.createElement('div');
  list.className = 'mob-list';
  for (const task of tasks) {
    const item = document.createElement('div');
    item.className = 'mob-entry task' + (task.done ? ' done' : '');
    item.innerHTML = `
      <button class="mob-check-btn${task.done ? ' checked' : ''}" data-id="${task.id}">
        ${task.done ? '✓' : ''}
      </button>
      <span class="mob-task-text">${task.text}</span>
      <button class="mob-del-btn" data-id="${task.id}">×</button>
    `;
    item.querySelector('.mob-check-btn').addEventListener('click', e => {
      const t = (_data.tasks[_viewDate] || []).find(x => x.id === e.currentTarget.dataset.id);
      if (t) { t.done = !t.done; _save(); render(); }
    });
    item.querySelector('.mob-del-btn').addEventListener('click', e => {
      _data.tasks[_viewDate] = (_data.tasks[_viewDate] || []).filter(x => x.id !== e.target.dataset.id);
      _save(); render();
    });
    list.appendChild(item);
  }
  el.appendChild(list);
  return el;
}

// ── Bottom sheet ───────────────────────────────────────────────────
function _buildSheet() {
  const overlay = document.createElement('div');
  overlay.className = 'mob-overlay';
  overlay.addEventListener('click', e => {
    if (e.target === overlay) { _sheet = null; render(); }
  });
  const sheet = document.createElement('div');
  sheet.className = 'mob-sheet';
  if      (_sheet === 'spend') sheet.appendChild(_spendSheet());
  else if (_sheet === 'event') sheet.appendChild(_eventSheet());
  else if (_sheet === 'task')  sheet.appendChild(_taskSheet());
  overlay.appendChild(sheet);
  return overlay;
}

function _sheetHeader(title) {
  const hdr = document.createElement('div');
  hdr.className = 'mob-sheet-hdr';
  hdr.innerHTML = `<span class="mob-sheet-title">${title}</span>`;
  const close = document.createElement('button');
  close.className = 'mob-sheet-close';
  close.textContent = '×';
  close.addEventListener('click', () => { _sheet = null; render(); });
  hdr.appendChild(close);
  return hdr;
}

function _spendSheet() {
  const el = document.createElement('div');
  el.appendChild(_sheetHeader('Add spend'));

  const catGrid = document.createElement('div');
  catGrid.className = 'mob-cat-grid';

  const fields = document.createElement('div');
  fields.className = 'mob-sheet-fields';
  fields.style.display = 'none';

  const subSel   = Object.assign(document.createElement('select'),   { className: 'mob-input' });
  const amtInput = Object.assign(document.createElement('input'),    { className: 'mob-input', type: 'number', placeholder: 'Amount (¥)', inputMode: 'numeric' });
  const noteInput = Object.assign(document.createElement('input'),   { className: 'mob-input', type: 'text',   placeholder: 'Note (optional)' });
  const saveBtn  = Object.assign(document.createElement('button'),   { className: 'mob-save-btn', textContent: 'Save' });

  fields.appendChild(subSel);
  fields.appendChild(amtInput);
  fields.appendChild(noteInput);
  fields.appendChild(saveBtn);

  let selectedCat = null;

  for (const cat of SPEND_CATS) {
    const btn = document.createElement('button');
    btn.className = 'mob-cat-btn';
    btn.innerHTML = `<span class="mob-dot" style="background:var(--cat-${cat.id})"></span>${cat.name}`;
    btn.addEventListener('click', () => {
      selectedCat = cat;
      catGrid.querySelectorAll('.mob-cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      subSel.innerHTML = '<option value="">No subcategory</option>' +
        cat.sub.map(s => `<option value="${s}">${s}</option>`).join('');
      fields.style.display = '';
      setTimeout(() => amtInput.focus(), 50);
    });
    catGrid.appendChild(btn);
  }

  saveBtn.addEventListener('click', () => {
    if (!selectedCat) return;
    const amt = parseInt(amtInput.value, 10);
    if (!amt) return;
    const entry = {
      id:          _uid(),
      categoryId:  selectedCat.id,
      subcategory: subSel.value || null,
      note:        noteInput.value.trim() || null,
      amount:      amt,
      currency:    'JPY',
    };
    if (!_data.calendar.spendEntries[_viewDate])
      _data.calendar.spendEntries[_viewDate] = [];
    _data.calendar.spendEntries[_viewDate].push(entry);
    _save(); _sheet = null; render();
  });

  amtInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveBtn.click(); });

  el.appendChild(catGrid);
  el.appendChild(fields);
  return el;
}

function _eventSheet() {
  const el = document.createElement('div');
  el.appendChild(_sheetHeader('Add event'));

  const fields = document.createElement('div');
  fields.className = 'mob-sheet-fields';

  const titleInput = Object.assign(document.createElement('input'), {
    className: 'mob-input', type: 'text', placeholder: 'Title',
  });
  const catSel = Object.assign(document.createElement('select'), { className: 'mob-input' });
  catSel.innerHTML = EVENT_CATS.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  const saveBtn = Object.assign(document.createElement('button'), {
    className: 'mob-save-btn', textContent: 'Save',
  });

  saveBtn.addEventListener('click', () => {
    const title = titleInput.value.trim();
    if (!title) return;
    const cat = EVENT_CATS.find(c => c.id === catSel.value);
    _data.calendar.events.push({
      id: _uid(), title, category: catSel.value, color: cat?.color ?? null, date: _viewDate,
    });
    _save(); _sheet = null; render();
  });
  titleInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveBtn.click(); });

  fields.appendChild(titleInput);
  fields.appendChild(catSel);
  fields.appendChild(saveBtn);
  el.appendChild(fields);
  setTimeout(() => titleInput.focus(), 50);
  return el;
}

function _taskSheet() {
  const el = document.createElement('div');
  el.appendChild(_sheetHeader('Add task'));

  const fields = document.createElement('div');
  fields.className = 'mob-sheet-fields';

  const textInput = Object.assign(document.createElement('input'), {
    className: 'mob-input', type: 'text', placeholder: 'Task',
  });
  const saveBtn = Object.assign(document.createElement('button'), {
    className: 'mob-save-btn', textContent: 'Save',
  });

  saveBtn.addEventListener('click', () => {
    const text = textInput.value.trim();
    if (!text) return;
    if (!_data.tasks[_viewDate]) _data.tasks[_viewDate] = [];
    _data.tasks[_viewDate].push({ id: _uid(), text, done: false });
    _save(); _sheet = null; render();
  });
  textInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveBtn.click(); });

  fields.appendChild(textInput);
  fields.appendChild(saveBtn);
  el.appendChild(fields);
  setTimeout(() => textInput.focus(), 50);
  return el;
}

// ── Init ───────────────────────────────────────────────────────────
render();
