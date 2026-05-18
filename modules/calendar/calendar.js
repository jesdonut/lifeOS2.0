// calendar.js — Calendar module

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

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

let _container, _data, _onSave;
let _year = new Date().getFullYear();
let _view = 'month'; // 'week' | 'month' | 'year'
let _weekStart = null; // Monday of displayed week; null until first week render
let _modal = null;

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
}

export function onDataChange(newData) {
  _data = newData;
  renderGrid();
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
    if (!_weekStart) _weekStart = getWeekMonday(new Date());
    yearLabel.className = 'cal-week-label';
    const wEnd = addDays(_weekStart, 6);
    const sameMonth = _weekStart.getMonth() === wEnd.getMonth();
    yearLabel.textContent = sameMonth
      ? `${MONTHS[_weekStart.getMonth()].slice(0, 3)} ${_weekStart.getDate()}–${wEnd.getDate()}`
      : `${MONTHS[_weekStart.getMonth()].slice(0, 3)} ${_weekStart.getDate()} – ${MONTHS[wEnd.getMonth()].slice(0, 3)} ${wEnd.getDate()}`;
    prevBtn.addEventListener('click', () => { _weekStart = addDays(_weekStart, -7); render(); });
    nextBtn.addEventListener('click', () => { _weekStart = addDays(_weekStart, 7); render(); });
    todayBtn.addEventListener('click', () => { _weekStart = getWeekMonday(new Date()); render(); });
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
    const stub = document.createElement('div');
    stub.style.cssText = 'padding:var(--s7) var(--s5);color:var(--text-3);font-size:var(--fs-sm);';
    stub.textContent = 'Year view coming soon.';
    scroll.appendChild(stub);
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
  }
}

function initSortable(scroll) {
  scroll.querySelectorAll('.cal-evt-list').forEach(list => {
    Sortable.create(list, {
      group:     'cal-events',
      animation: 120,
      onEnd(evt) {
        if (evt.from === evt.to) return;
        const id      = evt.item.dataset.id;
        const newDate = evt.to.dataset.date;
        moveEvent(id, newDate);
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
    DAYS.forEach(d => {
      const cell = document.createElement('div');
      cell.className = 'cal-dow';
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
    const startDow = (firstDay.getDay() + 6) % 7; // Monday = 0

    // Leading blanks
    for (let i = 0; i < startDow; i++) {
      const cell = document.createElement('div');
      cell.className = 'cal-cell other-month';
      cell.innerHTML = `<div class="cal-day-num">${prevDim - startDow + 1 + i}</div>`;
      grid.appendChild(cell);
    }

    // Days
    for (let d = 1; d <= dim; d++) {
      const key  = dateStr(_year, m, d);
      const evts = evtMap[key] ?? [];
      const cell = document.createElement('div');
      cell.className = 'cal-cell' + (key === todayKey ? ' today' : '');

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

    const col = document.createElement('div');
    col.className = 'cal-week-day' + (isToday ? ' today' : '');

    // Column header
    const hdr = document.createElement('div');
    hdr.className = 'cal-week-day-hdr';
    const dayName = document.createElement('div');
    dayName.className = 'cal-week-day-name';
    dayName.textContent = DAYS[i];
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

    // Spending summary
    const withSpend = dayEvts.filter(e => e.spend);
    if (withSpend.length > 0) {
      const spendSec = document.createElement('div');
      spendSec.className = 'cal-week-spend';

      const catTotals = {};
      withSpend.forEach(e => {
        const cat = e.category ?? 'personal';
        catTotals[cat] = (catTotals[cat] ?? 0) + Number(e.spend);
      });

      Object.entries(catTotals).forEach(([catId, total]) => {
        const row = document.createElement('div');
        row.className = 'cal-week-spend-row';
        const dot = document.createElement('span');
        dot.className = 'cal-week-spend-dot';
        dot.style.background = catColor(catId);
        const nameEl = document.createElement('span');
        nameEl.textContent = cats().find(c => c.id === catId)?.name ?? catId;
        const amtEl = document.createElement('span');
        amtEl.textContent = fmtSpend(total);
        row.append(dot, nameEl, amtEl);
        spendSec.appendChild(row);
      });

      const div = document.createElement('div');
      div.className = 'cal-week-spend-divider';
      spendSec.appendChild(div);

      const totalRow = document.createElement('div');
      totalRow.className = 'cal-week-spend-total';
      const total = withSpend.reduce((s, e) => s + Number(e.spend), 0);
      totalRow.innerHTML = `<span>Total</span><span>${fmtSpend(total)}</span>`;
      spendSec.appendChild(totalRow);

      body.appendChild(spendSec);
    }

    col.appendChild(body);
    grid.appendChild(col);
  }

  grid.querySelectorAll('.cal-evt-list').forEach(list => {
    Sortable.create(list, {
      group:     'cal-events',
      animation: 120,
      onEnd(evt) {
        if (evt.from === evt.to) return;
        moveEvent(evt.item.dataset.id, evt.to.dataset.date);
      },
    });
  });

  wrap.appendChild(grid);
  scroll.appendChild(wrap);
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

// ── Data ───────────────────────────────────────────────────────────

function saveEvent(evt) {
  const evts = [...events()];
  const idx  = evts.findIndex(e => e.id === evt.id);
  const now  = new Date().toISOString();
  if (idx >= 0) {
    evts[idx] = { ...evt, createdAt: evts[idx].createdAt ?? now, updatedAt: now };
  } else {
    evts.push({ ...evt, createdAt: now });
  }
  _onSave({ calendar: { events: evts } });
}

function removeEvent(id) {
  _onSave({ calendar: { events: events().filter(e => e.id !== id) } });
}

function moveEvent(id, newDate) {
  const evts = events().map(e => e.id === id ? { ...e, date: newDate } : e);
  _onSave({ calendar: { events: evts } });
}
