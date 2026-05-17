// calendar.js — Calendar module

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

const CATS = [
  { key: 'work',      label: 'Work' },
  { key: 'personal',  label: 'Personal' },
  { key: 'health',    label: 'Health' },
  { key: 'family',    label: 'Family' },
  { key: 'friends',   label: 'Friends' },
  { key: 'travel',    label: 'Travel' },
  { key: 'education', label: 'Education' },
  { key: 'project',   label: 'Project' },
  { key: 'partner',   label: 'Partner' },
];

let _container, _data, _onSave;
let _year = new Date().getFullYear();
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
  prevBtn.addEventListener('click', () => { _year--; render(); });

  const yearLabel = document.createElement('span');
  yearLabel.className = 'cal-year-label';
  yearLabel.textContent = _year;

  const nextBtn = document.createElement('button');
  nextBtn.className = 'cal-year-btn';
  nextBtn.textContent = '›';
  nextBtn.addEventListener('click', () => { _year++; render(); });

  const todayBtn = document.createElement('button');
  todayBtn.className = 'cal-today-btn';
  todayBtn.textContent = 'today';
  todayBtn.addEventListener('click', () => {
    _year = new Date().getFullYear();
    render();
    requestAnimationFrame(() => scrollToMonth(new Date().getMonth()));
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'cal-add-btn';
  addBtn.textContent = '+ add event';
  addBtn.addEventListener('click', () => openModal(todayStr()));

  header.append(prevBtn, yearLabel, nextBtn, todayBtn, addBtn);
  _container.appendChild(header);

  // Scroll area
  const scroll = document.createElement('div');
  scroll.className = 'cal-scroll';
  scroll.id = 'cal-scroll';
  _container.appendChild(scroll);

  buildMonths(scroll);

  // Scroll to current month if viewing current year
  if (_year === new Date().getFullYear()) {
    requestAnimationFrame(() => scrollToMonth(new Date().getMonth()));
  }
}

function renderGrid() {
  const scroll = _container.querySelector('#cal-scroll');
  if (!scroll) return;
  const top = scroll.scrollTop;
  buildMonths(scroll);
  scroll.scrollTop = top;
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
        const chip = document.createElement('div');
        chip.className = `cal-evt evt-${evt.category ?? 'personal'}`;
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
      dot.style.background = `var(--cat-${evt.category ?? 'personal'})`;

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
  CATS.forEach(c => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `cal-cat-chip evt-${c.key}${selectedCat === c.key ? ' selected' : ''}`;
    chip.dataset.cat = c.key;
    chip.textContent = c.label;
    chip.addEventListener('click', () => {
      selectedCat = c.key;
      catGrid.querySelectorAll('.cal-cat-chip').forEach(b =>
        b.classList.toggle('selected', b.dataset.cat === c.key)
      );
    });
    catGrid.appendChild(chip);
  });
  form.appendChild(catGrid);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'cal-modal-actions';

  if (editing) {
    const delBtn = document.createElement('button');
    delBtn.className = 'cal-del-btn';
    delBtn.textContent = 'Delete event';
    delBtn.addEventListener('click', () => {
      removeEvent(editing.id);
      openModal(date);
    });
    actions.appendChild(delBtn);
  }

  const saveBtn = document.createElement('button');
  saveBtn.className = 'cal-save-btn';
  saveBtn.textContent = editing ? 'Save' : 'Add';
  saveBtn.addEventListener('click', () => {
    const title = input.value.trim();
    if (!title) { input.focus(); return; }
    saveEvent({ id: editing?.id ?? uid(), date, title, category: selectedCat });
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
  if (idx >= 0) evts[idx] = evt;
  else evts.push(evt);
  _onSave({ calendar: { events: evts } });
}

function removeEvent(id) {
  _onSave({ calendar: { events: events().filter(e => e.id !== id) } });
}

function moveEvent(id, newDate) {
  const evts = events().map(e => e.id === id ? { ...e, date: newDate } : e);
  _onSave({ calendar: { events: evts } });
}
