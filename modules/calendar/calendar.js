// calendar.js — Calendar module

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAYS     = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DAYS_ALL = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']; // indexed by getDay()
const DOW_SINGLE = ['S','M','T','W','T','F','S'];             // single-letter, indexed by getDay()

const DEFAULT_CATS = [
  { id: 'work',      name: 'Work',      isCustom: false },
  { id: 'personal',  name: 'Personal',  isCustom: false },
  { id: 'health',    name: 'Health',    isCustom: false },
  { id: 'family',    name: 'Family',    isCustom: false },
  { id: 'friends',   name: 'Friends',   isCustom: false },
  { id: 'travel',    name: 'Travel',    isCustom: false },
  { id: 'education', name: 'Education', isCustom: false },
  { id: 'project',   name: 'Project',   isCustom: false },
  { id: 'partner',   name: 'Partner',   isCustom: false },
];

function cats() { return _data.settings?.categories ?? DEFAULT_CATS; }

function catColor(id) {
  const cat = cats().find(c => c.id === id);
  return cat?.isCustom && cat.color ? cat.color : `var(--cat-${id})`;
}

function catBg(id) {
  const cat = cats().find(c => c.id === id);
  if (cat?.isCustom && cat.color)
    return `color-mix(in srgb, ${cat.color} 18%, transparent)`;
  return '';  // let CSS class handle it
}

function spendCats() { return _data.settings?.spendCategories ?? []; }
function spendCatById(id) { return spendCats().find(c => c.id === id); }

let _container, _data, _onSave;
let _year = new Date().getFullYear();
let _view = 'week'; // 'week' | 'month' | 'year'
let _weekStart = null; // Monday of displayed week; null until first week render
let _modal = null;
let _spendModal = null;

// ── Helpers ────────────────────────────────────────────────────────

function uid() {
  return 'e_' + Math.random().toString(36).slice(2, 9);
}

function todayStr() {
  const tz = _data.settings?.timezone ?? 'Asia/Tokyo';
  return new Date().toLocaleDateString('sv', { timeZone: tz });
}

function events() {
  return _data.calendar?.events ?? [];
}

function dateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function dateStrFromDate(date) {
  return dateStr(date.getFullYear(), date.getMonth(), date.getDate());
}

function getWeekMonday(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function currencySymbol() {
  const cur = (_data.settings?.currencies ?? [])[0] ?? 'JPY';
  return cur === 'IDR' ? 'Rp' : cur === 'JPY' ? '¥' : cur;
}

function fmtSpend(amount) {
  return `${currencySymbol()} ${Number(amount).toLocaleString()}`;
}

function weekStartDay() {
  const ws = _data?.settings?.weekStart;
  return (typeof ws === 'number' && ws >= 0 && ws <= 6) ? ws : 1;
}

function getWeekStart(date) {
  const ws = weekStartDay();
  const d  = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (d.getDay() - ws + 7) % 7;
  d.setDate(d.getDate() - offset);
  return d;
}

function orderedDays() {
  const ws = weekStartDay();
  return Array.from({ length: 7 }, (_, i) => DAYS_ALL[(ws + i) % 7]);
}

// ── Module contract ────────────────────────────────────────────────

export function init(container, data, onSave) {
  _container = container;
  _data = data;
  _onSave = onSave;

  const cssHref = new URL('./calendar.css', import.meta.url).href;
  if (!document.querySelector(`link[href="${cssHref}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssHref;
    document.head.appendChild(link);
  }

  _container.style.cssText =
    'padding:0;overflow:hidden;position:relative;display:flex;flex-direction:column;';

  render();
}

export function destroy() {
  _container.style.cssText = '';
  _container.innerHTML = '';
  _modal = null;
  _spendModal = null;
}

export function onDataChange(newData) {
  const prevWS = _data?.settings?.weekStart;
  _data = newData;
  if (newData.settings?.weekStart !== prevWS) {
    _weekStart = null; // force recalculate for new week start
    render();
  } else {
    renderGrid();
  }
}

// ── Rendering ──────────────────────────────────────────────────────

function render() {
  _modal = null;
  _container.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.className = 'cal-header';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'cal-year-btn';
  prevBtn.textContent = '‹';

  const yearLabel = document.createElement('span');

  const nextBtn = document.createElement('button');
  nextBtn.className = 'cal-year-btn';
  nextBtn.textContent = '›';

  const todayBtn = document.createElement('button');
  todayBtn.className = 'cal-today-btn';
  todayBtn.textContent = 'today';

  if (_view === 'week') {
    if (!_weekStart) _weekStart = getWeekStart(new Date());
    yearLabel.className = 'cal-week-label';
    const wEnd = addDays(_weekStart, 6);
    const sameMonth = _weekStart.getMonth() === wEnd.getMonth();
    yearLabel.textContent = sameMonth
      ? `${MONTHS[_weekStart.getMonth()].slice(0, 3)} ${_weekStart.getDate()}–${wEnd.getDate()}`
      : `${MONTHS[_weekStart.getMonth()].slice(0, 3)} ${_weekStart.getDate()} – ${MONTHS[wEnd.getMonth()].slice(0, 3)} ${wEnd.getDate()}`;
    prevBtn.addEventListener('click', () => { _weekStart = addDays(_weekStart, -7); render(); });
    nextBtn.addEventListener('click', () => { _weekStart = addDays(_weekStart, 7); render(); });
    todayBtn.addEventListener('click', () => { _weekStart = getWeekStart(new Date()); render(); });
  } else {
    yearLabel.className = 'cal-year-label';
    yearLabel.textContent = _year;
    prevBtn.addEventListener('click', () => { _year--; render(); });
    nextBtn.addEventListener('click', () => { _year++; render(); });
    todayBtn.addEventListener('click', () => {
      _year = new Date().getFullYear();
      render();
      if (_view === 'month') requestAnimationFrame(() => scrollToMonth(new Date().getMonth()));
    });
  }

  // View toggle
  const viewToggle = document.createElement('div');
  viewToggle.className = 'cal-view-toggle';
  ['week', 'month', 'year'].forEach(v => {
    const btn = document.createElement('button');
    btn.className = 'cal-view-btn' + (_view === v ? ' active' : '');
    btn.textContent = v.charAt(0).toUpperCase() + v.slice(1);
    btn.addEventListener('click', () => { _view = v; render(); });
    viewToggle.appendChild(btn);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'cal-add-btn';
  addBtn.textContent = '+ add event';
  addBtn.addEventListener('click', () => {
    if (_view === 'week' && _weekStart) {
      const tk = todayStr();
      const wEnd = addDays(_weekStart, 6);
      const inWeek = tk >= dateStrFromDate(_weekStart) && tk <= dateStrFromDate(wEnd);
      openModal(inWeek ? tk : dateStrFromDate(_weekStart));
    } else {
      openModal(todayStr());
    }
  });

  header.append(prevBtn, yearLabel, nextBtn, todayBtn, viewToggle, addBtn);
  _container.appendChild(header);

  // Scroll area
  const scroll = document.createElement('div');
  scroll.className = 'cal-scroll';
  scroll.id = 'cal-scroll';
  _container.appendChild(scroll);

  if (_view === 'month') {
    buildMonths(scroll);
    if (_year === new Date().getFullYear()) {
      requestAnimationFrame(() => scrollToMonth(new Date().getMonth()));
    }
  } else if (_view === 'week') {
    buildWeek(scroll);
  } else {
    buildYear(scroll);
  }
}

function renderGrid() {
  const scroll = _container.querySelector('#cal-scroll');
  if (!scroll) return;
  if (_view === 'week') {
    buildWeek(scroll);
  } else if (_view === 'month') {
    const top = scroll.scrollTop;
    buildMonths(scroll);
    scroll.scrollTop = top;
  } else {
    buildYear(scroll);
  }
}

function initSortable(scroll) {
  scroll.querySelectorAll('.cal-evt-list').forEach(list => {
    Sortable.create(list, {
      group:     'cal-events',
      animation: 120,
      onEnd(evt) {
        if (evt.from === evt.to) {
          renderGrid(); // snap back — no within-day reordering
        } else {
          moveEvent(evt.item.dataset.id, evt.to.dataset.date);
        }
      },
    });
  });
}

function buildMonths(scroll) {
  scroll.innerHTML = '';

  const todayKey = todayStr();
  const evtMap = {};
  events().forEach(e => {
    if (!evtMap[e.date]) evtMap[e.date] = [];
    evtMap[e.date].push(e);
  });

  for (let m = 0; m < 12; m++) {
    const section = document.createElement('section');
    section.className = 'cal-month';
    section.dataset.month = m;

    // Month title
    const title = document.createElement('div');
    title.className = 'cal-month-title';
    title.textContent = MONTHS[m];
    section.appendChild(title);

    // Day-of-week header
    const dowRow = document.createElement('div');
    dowRow.className = 'cal-grid cal-dow-row';
    orderedDays().forEach(d => {
      const dow = DAYS_ALL.indexOf(d);
      const cell = document.createElement('div');
      cell.className = 'cal-dow' + (dow === 0 || dow === 6 ? ' weekend' : '');
      cell.textContent = d;
      dowRow.appendChild(cell);
    });
    section.appendChild(dowRow);

    // Day grid
    const grid = document.createElement('div');
    grid.className = 'cal-grid';

    const firstDay = new Date(_year, m, 1);
    const dim      = new Date(_year, m + 1, 0).getDate();
    const prevDim  = new Date(_year, m, 0).getDate();
    const startDow = (firstDay.getDay() - weekStartDay() + 7) % 7;

    // Leading blanks
    for (let i = 0; i < startDow; i++) {
      const cell = document.createElement('div');
      cell.className = 'cal-cell other-month';
      cell.innerHTML = `<div class="cal-day-num">${prevDim - startDow + 1 + i}</div>`;
      grid.appendChild(cell);
    }

    // Days
    for (let d = 1; d <= dim; d++) {
      const key     = dateStr(_year, m, d);
      const evts    = evtMap[key] ?? [];
      const dow     = new Date(_year, m, d).getDay();
      const cell    = document.createElement('div');
      cell.className = 'cal-cell'
        + (key === todayKey ? ' today' : '')
        + (dow === 0 || dow === 6 ? ' weekend' : '');

      const num = document.createElement('div');
      num.className = 'cal-day-num';
      num.textContent = d;
      cell.appendChild(num);

      // Sortable event list — drag events between days
      const evtList = document.createElement('div');
      evtList.className = 'cal-evt-list';
      evtList.dataset.date = key;

      evts.forEach(evt => {
        const catId = evt.category ?? 'personal';
        const bg    = catBg(catId);
        const chip  = document.createElement('div');
        chip.className = `cal-evt${bg ? '' : ` evt-${catId}`}`;
        if (bg) { chip.style.background = bg; chip.style.color = catColor(catId); }
        chip.dataset.id = evt.id;
        chip.textContent = evt.title;
        chip.addEventListener('click', e => {
          e.stopPropagation();
          openModal(key, evt.id);
        });
        evtList.appendChild(chip);
      });

      cell.appendChild(evtList);
      cell.addEventListener('click', () => openModal(key));
      grid.appendChild(cell);
    }

    // Trailing blanks
    const filled = startDow + dim;
    const tail   = filled % 7 === 0 ? 0 : 7 - (filled % 7);
    for (let i = 1; i <= tail; i++) {
      const cell = document.createElement('div');
      cell.className = 'cal-cell other-month';
      cell.innerHTML = `<div class="cal-day-num">${i}</div>`;
      grid.appendChild(cell);
    }

    section.appendChild(grid);
    scroll.appendChild(section);
  }

  initSortable(scroll);
}

function scrollToMonth(month) {
  const scroll = _container.querySelector('#cal-scroll');
  const section = scroll?.querySelector(`[data-month="${month}"]`);
  if (section) section.scrollIntoView({ behavior: 'instant' });
}

function buildWeek(scroll) {
  scroll.innerHTML = '';
  if (!_weekStart) _weekStart = getWeekMonday(new Date());

  const todayKey = todayStr();
  const evtMap = {};
  events().forEach(e => {
    if (!e.date) return;
    if (!evtMap[e.date]) evtMap[e.date] = [];
    evtMap[e.date].push(e);
  });

  const wrap = document.createElement('div');
  wrap.className = 'cal-week-wrap';

  const grid = document.createElement('div');
  grid.className = 'cal-week-grid';

  for (let i = 0; i < 7; i++) {
    const day   = addDays(_weekStart, i);
    const key   = dateStrFromDate(day);
    const dayEvts = evtMap[key] ?? [];
    const isToday = key === todayKey;

    const dow = day.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const col = document.createElement('div');
    col.className = 'cal-week-day' + (isToday ? ' today' : '') + (isWeekend ? ' weekend' : '');

    // Column header
    const hdr = document.createElement('div');
    hdr.className = 'cal-week-day-hdr';
    const dayName = document.createElement('div');
    dayName.className = 'cal-week-day-name';
    dayName.textContent = DAYS_ALL[day.getDay()];
    const dayNum = document.createElement('div');
    dayNum.className = 'cal-week-day-num';
    dayNum.textContent = day.getDate();
    hdr.append(dayName, dayNum);
    col.appendChild(hdr);

    // Column body
    const body = document.createElement('div');
    body.className = 'cal-week-day-body';
    body.addEventListener('click', () => openModal(key));

    const evtList = document.createElement('div');
    evtList.className = 'cal-evt-list';
    evtList.dataset.date = key;

    dayEvts.forEach(evt => {
      const catId = evt.category ?? 'personal';
      const bg    = catBg(catId);
      const chip  = document.createElement('div');
      chip.className = `cal-evt cal-week-evt${bg ? '' : ` evt-${catId}`}`;
      if (bg) { chip.style.background = bg; chip.style.color = catColor(catId); }
      chip.dataset.id = evt.id;
      chip.textContent = evt.title;
      if (evt.spend) {
        const amt = document.createElement('span');
        amt.className = 'cal-evt-spend';
        amt.textContent = fmtSpend(evt.spend);
        chip.appendChild(amt);
      }
      chip.addEventListener('click', e => { e.stopPropagation(); openModal(key, evt.id); });
      evtList.appendChild(chip);
    });

    body.appendChild(evtList);

    // Spend entries section
    const daySpend = (calData().spendEntries ?? {})[key] ?? [];
    const spendSec = document.createElement('div');
    spendSec.className = 'cal-spend-section';

    const spendHdr = document.createElement('div');
    spendHdr.className = 'cal-spend-hdr';
    const spendLabel = document.createElement('span');
    spendLabel.className = 'cal-spend-label';
    spendLabel.textContent = 'Spend';
    const addSpendBtn = document.createElement('button');
    addSpendBtn.className = 'cal-spend-add-btn';
    addSpendBtn.textContent = '+';
    addSpendBtn.addEventListener('click', e => { e.stopPropagation(); openSpendModal(key); });
    spendHdr.append(spendLabel, addSpendBtn);
    spendSec.appendChild(spendHdr);

    if (daySpend.length > 0) {
      const catTotals = {};
      daySpend.forEach(e => {
        catTotals[e.categoryId] = (catTotals[e.categoryId] ?? 0) + Number(e.amount);
      });
      Object.entries(catTotals).forEach(([catId, total]) => {
        const cat = spendCatById(catId);
        const row = document.createElement('div');
        row.className = 'cal-week-spend-row';
        const dot = document.createElement('span');
        dot.className = 'cal-week-spend-dot';
        dot.style.background = cat?.color ?? 'var(--text-3)';
        const nameEl = document.createElement('span');
        nameEl.textContent = cat?.name ?? catId;
        const amtEl = document.createElement('span');
        amtEl.textContent = fmtSpend(total);
        row.append(dot, nameEl, amtEl);
        row.addEventListener('click', e => { e.stopPropagation(); openSpendModal(key, null, catId); });
        spendSec.appendChild(row);
      });

      const divEl = document.createElement('div');
      divEl.className = 'cal-week-spend-divider';
      spendSec.appendChild(divEl);

      const totalRow = document.createElement('div');
      totalRow.className = 'cal-week-spend-total';
      const total = daySpend.reduce((s, e) => s + Number(e.amount), 0);
      totalRow.innerHTML = `<span>Total</span><span>${fmtSpend(total)}</span>`;
      spendSec.appendChild(totalRow);
    }

    body.appendChild(spendSec);

    col.appendChild(body);
    grid.appendChild(col);
  }

  wrap.appendChild(grid);
  scroll.appendChild(wrap);
  initSortable(scroll);
}

function buildYear(scroll) {
  scroll.innerHTML = '';

  const todayKey = todayStr();
  const evtMap   = {};
  events().forEach(e => {
    if (!e.date) return;
    if (!evtMap[e.date]) evtMap[e.date] = [];
    evtMap[e.date].push(e);
  });

  const grid = document.createElement('div');
  grid.className = 'cal-year-grid';

  for (let m = 0; m < 12; m++) {
    const card = document.createElement('div');
    card.className = 'cal-year-month';

    const title = document.createElement('div');
    title.className = 'cal-year-month-title';
    title.textContent = MONTHS[m];
    card.appendChild(title);

    const dowRow = document.createElement('div');
    dowRow.className = 'cal-year-dow-row';
    const ws = weekStartDay();
    for (let i = 0; i < 7; i++) {
      const dayIdx = (ws + i) % 7;
      const s = document.createElement('span');
      s.textContent = DOW_SINGLE[dayIdx];
      if (dayIdx === 0 || dayIdx === 6) s.classList.add('weekend');
      dowRow.appendChild(s);
    }
    card.appendChild(dowRow);

    const dayGrid = document.createElement('div');
    dayGrid.className = 'cal-year-day-grid';

    const dim      = new Date(_year, m + 1, 0).getDate();
    const startDow = (new Date(_year, m, 1).getDay() - ws + 7) % 7;

    for (let i = 0; i < startDow; i++) {
      const blank = document.createElement('div');
      blank.className = 'cal-year-cell blank';
      dayGrid.appendChild(blank);
    }

    for (let d = 1; d <= dim; d++) {

      const key       = dateStr(_year, m, d);
      const dayEvts   = evtMap[key] ?? [];
      const isToday   = key === todayKey;
      const dayOfWeek = new Date(_year, m, d).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const cell = document.createElement('div');
      cell.className = 'cal-year-cell'
        + (isToday   ? ' today'   : '')
        + (isWeekend ? ' weekend' : '');

      const num = document.createElement('span');
      num.className = 'cal-year-cell-num';
      num.textContent = d;
      cell.appendChild(num);

      if (dayEvts.length > 0) {
        const dot = document.createElement('span');
        dot.className = 'cal-year-evt-dot';
        dot.style.background = catColor(dayEvts[0].category ?? 'personal');
        cell.appendChild(dot);
      }

      cell.addEventListener('click', e => {
        e.stopPropagation();
        _view = 'month';
        render();
        requestAnimationFrame(() => scrollToMonth(m));
      });
      dayGrid.appendChild(cell);
    }

    // Pad to always 42 cells (6 rows) so all cards are the same height
    const filled = startDow + dim;
    for (let i = filled; i < 42; i++) {
      const blank = document.createElement('div');
      blank.className = 'cal-year-cell blank';
      dayGrid.appendChild(blank);
    }

    card.appendChild(dayGrid);

    // Events preview
    const monthPrefix = `${_year}-${String(m + 1).padStart(2, '0')}`;
    const monthEvts   = events()
      .filter(e => e.date?.startsWith(monthPrefix))
      .sort((a, b) => (a.date > b.date ? 1 : -1));

    const evtSec  = document.createElement('div');
    evtSec.className = 'cal-year-events';

    monthEvts.slice(0, 3).forEach(evt => {
      const row = document.createElement('div');
      row.className = 'cal-year-evt-row';
      const dot = document.createElement('span');
      dot.className = 'cal-year-evt-row-dot';
      dot.style.background = catColor(evt.category ?? 'personal');
      const lbl = document.createElement('span');
      lbl.className = 'cal-year-evt-row-title';
      lbl.textContent = evt.title;
      row.append(dot, lbl);
      evtSec.appendChild(row);
    });

    const extra = monthEvts.length - 3;
    if (extra > 0) {
      const more = document.createElement('div');
      more.className = 'cal-year-evt-more';
      more.textContent = `+${extra} more`;
      evtSec.appendChild(more);
    }

    card.appendChild(evtSec);
    card.addEventListener('click', () => {
      _view = 'month';
      render();
      requestAnimationFrame(() => scrollToMonth(m));
    });
    grid.appendChild(card);
  }

  scroll.appendChild(grid);
}

// ── Modal ──────────────────────────────────────────────────────────

function openModal(date, editId = null) {
  closeModal();

  const dayEvts  = events().filter(e => e.date === date);
  const editing  = editId ? dayEvts.find(e => e.id === editId) : null;

  // Format date display without timezone ambiguity
  const [y, mo, d] = date.split('-').map(Number);
  const dayLabel = new Date(y, mo - 1, d).toLocaleDateString('en', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  _modal = document.createElement('div');
  _modal.className = 'cal-modal';

  const card = document.createElement('div');
  card.className = 'cal-modal-card';

  // Header
  const hdr = document.createElement('div');
  hdr.className = 'cal-modal-hdr';
  const dateSpan = document.createElement('span');
  dateSpan.className = 'cal-modal-date';
  dateSpan.textContent = dayLabel;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'cal-modal-close';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', closeModal);
  hdr.append(dateSpan, closeBtn);
  card.appendChild(hdr);

  // Event list
  if (dayEvts.length > 0) {
    const list = document.createElement('div');
    list.className = 'cal-modal-list';

    dayEvts.forEach(evt => {
      const row = document.createElement('div');
      row.className = 'cal-modal-row';

      const dot = document.createElement('span');
      dot.className = 'cal-modal-dot';
      dot.style.background = catColor(evt.category ?? 'personal');

      const title = document.createElement('span');
      title.className = 'cal-modal-evt-title';
      title.textContent = evt.title;

      const cat = document.createElement('span');
      cat.className = 'cal-modal-cat';
      cat.textContent = evt.category ?? '';

      const editBtn = document.createElement('button');
      editBtn.className = 'cal-modal-edit-btn';
      editBtn.textContent = 'edit';
      editBtn.addEventListener('click', () => openModal(date, evt.id));

      const delBtn = document.createElement('button');
      delBtn.className = 'cal-modal-del-row';
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', () => {
        removeEvent(evt.id);
        openModal(date);
      });

      row.append(dot, title, cat, editBtn, delBtn);
      list.appendChild(row);
    });

    card.appendChild(list);
  }

  // Form
  const form = document.createElement('div');
  form.className = 'cal-modal-form';

  const input = document.createElement('input');
  input.className = 'cal-modal-input';
  input.type = 'text';
  input.placeholder = editing ? 'Event title' : 'New event title';
  input.value = editing?.title ?? '';
  input.autocomplete = 'off';
  form.appendChild(input);

  // Category chips
  let selectedCat = editing?.category ?? 'personal';
  const catGrid = document.createElement('div');
  catGrid.className = 'cal-cat-grid';
  cats().forEach(c => {
    const bg   = catBg(c.id);
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `cal-cat-chip${bg ? '' : ` evt-${c.id}`}${selectedCat === c.id ? ' selected' : ''}`;
    chip.dataset.cat = c.id;
    chip.textContent = c.name;
    if (bg) {
      chip.style.background = bg;
      chip.style.color = catColor(c.id);
      if (selectedCat === c.id) chip.style.borderColor = catColor(c.id);
    }
    chip.addEventListener('click', () => {
      selectedCat = c.id;
      catGrid.querySelectorAll('.cal-cat-chip').forEach(b => {
        const isSelected = b.dataset.cat === c.id;
        b.classList.toggle('selected', isSelected);
        const bcat = cats().find(x => x.id === b.dataset.cat);
        if (bcat?.isCustom && bcat.color) {
          b.style.borderColor = isSelected ? bcat.color : '';
        }
      });
    });
    catGrid.appendChild(chip);
  });
  form.appendChild(catGrid);

  // Spend
  const spendRow = document.createElement('div');
  spendRow.className = 'cal-modal-spend-row';
  const spendLbl = document.createElement('div');
  spendLbl.className = 'cal-form-label';
  spendLbl.textContent = 'Amount spent';
  const spendWrap = document.createElement('div');
  spendWrap.className = 'cal-modal-spend-wrap';
  const spendSym = document.createElement('span');
  spendSym.className = 'cal-modal-spend-sym';
  spendSym.textContent = currencySymbol();
  const spendInput = document.createElement('input');
  spendInput.className = 'cal-modal-spend-input';
  spendInput.type = 'number';
  spendInput.min = '0';
  spendInput.step = '1';
  spendInput.placeholder = '0';
  spendInput.value = editing?.spend ?? '';
  spendInput.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); saveBtn.click(); }
    if (e.key === 'Escape') closeModal();
  });
  spendWrap.append(spendSym, spendInput);
  spendRow.append(spendLbl, spendWrap);
  form.appendChild(spendRow);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'cal-modal-actions';

  if (editing) {
    const parkBtn = document.createElement('button');
    parkBtn.className = 'cal-park-btn';
    parkBtn.textContent = 'Park for later';
    parkBtn.title = 'Move to unscheduled — find it in the Notes sidebar';
    parkBtn.addEventListener('click', () => {
      saveEvent({ ...editing, date: null });
      closeModal();
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'cal-del-btn';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => {
      removeEvent(editing.id);
      openModal(date);
    });

    actions.append(parkBtn, delBtn);
  }

  const saveBtn = document.createElement('button');
  saveBtn.className = 'cal-save-btn';
  saveBtn.textContent = editing ? 'Save' : 'Add';
  saveBtn.addEventListener('click', () => {
    const title = input.value.trim();
    if (!title) { input.focus(); return; }
    const spend = parseFloat(spendInput.value) || undefined;
    saveEvent({ id: editing?.id ?? uid(), date, title, category: selectedCat, ...(spend !== undefined ? { spend } : {}) });
    openModal(date);
  });
  actions.appendChild(saveBtn);
  form.appendChild(actions);

  card.appendChild(form);
  _modal.appendChild(card);
  _container.appendChild(_modal);

  // Close on backdrop click
  _modal.addEventListener('click', e => { if (e.target === _modal) closeModal(); });

  // Keyboard
  input.focus();
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); saveBtn.click(); }
    if (e.key === 'Escape') closeModal();
  });
}

function closeModal() {
  _modal?.remove();
  _modal = null;
}

// ── Spend entry modal ───────────────────────────────────────────────

function openSpendModal(dateStr, entryId, preselectCatId) {
  _spendModal?.remove();

  const daySpend = (calData().spendEntries ?? {})[dateStr] ?? [];
  const editing  = entryId ? daySpend.find(e => e.id === entryId) : null;

  _spendModal = document.createElement('div');
  _spendModal.className = 'cal-modal';

  const card = document.createElement('div');
  card.className = 'cal-modal-card';

  // Header
  const hdr = document.createElement('div');
  hdr.className = 'cal-modal-hdr';
  const title = document.createElement('div');
  title.className = 'cal-modal-title';
  title.textContent = editing ? 'Edit spend' : 'Add spend';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'cal-modal-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', closeSpendModal);
  hdr.append(title, closeBtn);
  card.appendChild(hdr);

  const form = document.createElement('div');
  form.className = 'cal-modal-form';

  // Category picker
  const catLbl = document.createElement('div');
  catLbl.className = 'cal-form-label';
  catLbl.textContent = 'Category';
  form.appendChild(catLbl);

  const catGrid = document.createElement('div');
  catGrid.className = 'cal-spend-cat-grid';

  let selectedCat = editing?.categoryId ?? preselectCatId ?? null;
  let selectedSub = editing?.subcategory ?? null;

  const subRow = document.createElement('div');
  subRow.className = 'cal-spend-sub-row';

  function renderSubcategories() {
    subRow.innerHTML = '';
    const cat = spendCatById(selectedCat);
    if (!cat || !cat.sub?.length) return;
    const subLbl = document.createElement('div');
    subLbl.className = 'cal-form-label';
    subLbl.style.marginTop = 'var(--s3)';
    subLbl.textContent = 'Subcategory';
    subRow.appendChild(subLbl);
    const subGrid = document.createElement('div');
    subGrid.className = 'cal-spend-cat-grid';
    cat.sub.forEach(s => {
      const chip = document.createElement('button');
      chip.className = 'cal-spend-sub-chip' + (selectedSub === s ? ' active' : '');
      chip.textContent = s;
      chip.style.setProperty('--chip-color', cat.color);
      chip.addEventListener('click', () => {
        selectedSub = selectedSub === s ? null : s;
        subGrid.querySelectorAll('.cal-spend-sub-chip').forEach(b => b.classList.remove('active'));
        if (selectedSub === s) chip.classList.add('active');
      });
      subGrid.appendChild(chip);
    });
    subRow.appendChild(subGrid);
  }

  spendCats().forEach(cat => {
    const chip = document.createElement('button');
    chip.className = 'cal-spend-cat-chip' + (selectedCat === cat.id ? ' active' : '');
    chip.style.setProperty('--chip-color', cat.color);
    const dot = document.createElement('span');
    dot.className = 'cal-spend-chip-dot';
    dot.style.background = cat.color;
    chip.append(dot, cat.name);
    chip.addEventListener('click', () => {
      selectedCat = cat.id;
      selectedSub = null;
      catGrid.querySelectorAll('.cal-spend-cat-chip').forEach(b => b.classList.remove('active'));
      chip.classList.add('active');
      renderSubcategories();
    });
    catGrid.appendChild(chip);
  });

  form.appendChild(catGrid);
  form.appendChild(subRow);
  renderSubcategories();

  // Amount input
  const amtLbl = document.createElement('div');
  amtLbl.className = 'cal-form-label';
  amtLbl.style.marginTop = 'var(--s3)';
  amtLbl.textContent = 'Amount';
  const amtWrap = document.createElement('div');
  amtWrap.className = 'cal-modal-spend-wrap';
  const amtSym = document.createElement('span');
  amtSym.className = 'cal-modal-spend-sym';
  amtSym.textContent = currencySymbol();
  const amtInput = document.createElement('input');
  amtInput.className = 'cal-modal-spend-input';
  amtInput.type = 'number';
  amtInput.min = '0';
  amtInput.step = '1';
  amtInput.placeholder = '0';
  amtInput.value = editing?.amount ?? '';
  amtWrap.append(amtSym, amtInput);
  form.append(amtLbl, amtWrap);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'cal-modal-actions';

  if (editing) {
    const delBtn = document.createElement('button');
    delBtn.className = 'cal-del-btn';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => {
      removeSpendEntry(dateStr, editing.id);
      closeSpendModal();
      render();
    });
    actions.appendChild(delBtn);
  }

  const saveBtn = document.createElement('button');
  saveBtn.className = 'cal-save-btn';
  saveBtn.textContent = editing ? 'Save' : 'Add';
  saveBtn.addEventListener('click', () => {
    if (!selectedCat) { catGrid.querySelector('.cal-spend-cat-chip')?.focus(); return; }
    const amount = parseFloat(amtInput.value);
    if (!amount || amount <= 0) { amtInput.focus(); return; }
    saveSpendEntry(dateStr, {
      id:         editing?.id ?? spendUid(),
      categoryId: selectedCat,
      subcategory: selectedSub ?? null,
      amount,
    });
    closeSpendModal();
    render();
  });
  amtInput.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); saveBtn.click(); }
    if (e.key === 'Escape') closeSpendModal();
  });
  actions.appendChild(saveBtn);
  form.appendChild(actions);
  card.appendChild(form);

  _spendModal.appendChild(card);
  _container.appendChild(_spendModal);

  _spendModal.addEventListener('click', e => { if (e.target === _spendModal) closeSpendModal(); });

  requestAnimationFrame(() => amtInput.focus());
}

function closeSpendModal() {
  _spendModal?.remove();
  _spendModal = null;
}

// ── Data ───────────────────────────────────────────────────────────

function calData() { return _data.calendar ?? {}; }

function saveEvent(evt) {
  const evts = [...events()];
  const idx  = evts.findIndex(e => e.id === evt.id);
  const now  = new Date().toISOString();
  if (idx >= 0) {
    evts[idx] = { ...evt, createdAt: evts[idx].createdAt ?? now, updatedAt: now };
  } else {
    evts.push({ ...evt, createdAt: now });
  }
  _onSave({ calendar: { ...calData(), events: evts } });
}

function removeEvent(id) {
  _onSave({ calendar: { ...calData(), events: events().filter(e => e.id !== id) } });
}

function moveEvent(id, newDate) {
  const moved  = events().find(e => e.id === id);
  const others = events().filter(e => e.id !== id);
  _onSave({ calendar: { ...calData(), events: [...others, { ...moved, date: newDate }] } });
}

function saveSpendEntry(dateStr, entry) {
  const all = { ...(calData().spendEntries ?? {}) };
  const day = [...(all[dateStr] ?? [])];
  const idx = day.findIndex(e => e.id === entry.id);
  if (idx >= 0) day[idx] = entry; else day.push(entry);
  _onSave({ calendar: { ...calData(), spendEntries: { ...all, [dateStr]: day } } });
}

function removeSpendEntry(dateStr, id) {
  const all = { ...(calData().spendEntries ?? {}) };
  const day = (all[dateStr] ?? []).filter(e => e.id !== id);
  _onSave({ calendar: { ...calData(), spendEntries: { ...all, [dateStr]: day } } });
}

function spendUid() { return 'sp_' + Math.random().toString(36).slice(2, 9); }
