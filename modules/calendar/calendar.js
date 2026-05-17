const CSS_ID = 'cal-css';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];
const COLORS = ['work', 'personal', 'health', 'finance'];

let _container = null;
let _onSave    = null;
let _events    = [];
let _year      = 0;
let _month     = 0;
let _selected  = null;
let _editingId = null;

const _listeners = [];

function on(el, type, fn) {
  el.addEventListener(type, fn);
  _listeners.push({ el, type, fn });
}

function today() {
  const d = new Date();
  return fmt(d.getFullYear(), d.getMonth(), d.getDate());
}

function fmt(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function fmtDisplay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function eventsForDate(dateStr) {
  return _events.filter(e => e.date === dateStr)
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
}

function save() {
  _onSave({ calendar: { events: _events } });
}

export function init(container, data, onSave) {
  _container = container;
  _onSave    = onSave;
  _events    = (data?.calendar?.events) ? [...data.calendar.events] : [];

  if (!document.getElementById(CSS_ID)) {
    const link = document.createElement('link');
    link.id   = CSS_ID;
    link.rel  = 'stylesheet';
    link.href = 'modules/calendar/calendar.css';
    document.head.appendChild(link);
  }

  const now = new Date();
  _year  = now.getFullYear();
  _month = now.getMonth();

  const todayStr = today();
  _selected = todayStr;

  render();
}

export function destroy() {
  _listeners.forEach(({ el, type, fn }) => el.removeEventListener(type, fn));
  _listeners.length = 0;

  const link = document.getElementById(CSS_ID);
  if (link) link.remove();

  _container = null;
  _onSave    = null;
  _events    = [];
  _selected  = null;
  _editingId = null;
}

export function onDataChange(newData) {
  if (newData?.calendar?.events) {
    _events = [...newData.calendar.events];
    renderGrid();
    renderSide();
  }
}

function render() {
  _container.innerHTML = '';

  const root = document.createElement('div');
  root.className = 'cal-root';

  const main = document.createElement('div');
  main.className = 'cal-main';

  const nav = buildNav();
  const grid = document.createElement('div');
  grid.className = 'cal-grid';
  grid.id = 'cal-grid';

  main.appendChild(nav);
  main.appendChild(grid);

  const side = document.createElement('div');
  side.className = 'cal-side';
  side.id = 'cal-side';

  root.appendChild(main);
  root.appendChild(side);
  _container.appendChild(root);

  renderGrid();
  renderSide();
}

function buildNav() {
  const nav = document.createElement('div');
  nav.className = 'cal-nav';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'btn btn-ghost btn-icon';
  prevBtn.textContent = '‹';
  prevBtn.title = 'Previous month';

  const label = document.createElement('span');
  label.className = 'cal-month-label';
  label.id = 'cal-month-label';

  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn btn-ghost btn-icon';
  nextBtn.textContent = '›';
  nextBtn.title = 'Next month';

  const todayBtn = document.createElement('button');
  todayBtn.className = 'btn btn-ghost';
  todayBtn.textContent = 'Today';

  nav.appendChild(prevBtn);
  nav.appendChild(label);
  nav.appendChild(nextBtn);
  nav.appendChild(todayBtn);

  on(prevBtn, 'click', () => { stepMonth(-1); });
  on(nextBtn, 'click', () => { stepMonth(1); });
  on(todayBtn, 'click', () => {
    const now = new Date();
    _year  = now.getFullYear();
    _month = now.getMonth();
    _selected = today();
    renderGrid();
    renderSide();
  });

  return nav;
}

function stepMonth(delta) {
  _month += delta;
  if (_month > 11) { _month = 0; _year++; }
  if (_month < 0)  { _month = 11; _year--; }
  renderGrid();
  renderSide();
}

function renderGrid() {
  const grid = document.getElementById('cal-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const label = document.getElementById('cal-month-label');
  if (label) label.textContent = `${MONTHS[_month]} ${_year}`;

  const weekdays = document.createElement('div');
  weekdays.className = 'cal-weekdays';
  DAYS.forEach(d => {
    const cell = document.createElement('div');
    cell.className = 'cal-weekday';
    cell.textContent = d;
    weekdays.appendChild(cell);
  });
  grid.appendChild(weekdays);

  const weeks = document.createElement('div');
  weeks.className = 'cal-weeks';

  const firstDay = new Date(_year, _month, 1).getDay();
  const daysInMonth = new Date(_year, _month + 1, 0).getDate();
  const daysInPrev  = new Date(_year, _month, 0).getDate();
  const todayStr = today();

  let day = 1;
  let nextDay = 1;
  let started = false;

  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  let col = 0;
  let week = null;

  for (let i = 0; i < totalCells; i++) {
    if (col === 0) {
      week = document.createElement('div');
      week.className = 'cal-week';
    }

    const cell = document.createElement('div');
    cell.className = 'cal-day';

    let dateStr;
    if (i < firstDay) {
      const d = daysInPrev - firstDay + i + 1;
      dateStr = fmt(_month === 0 ? _year - 1 : _year, _month === 0 ? 11 : _month - 1, d);
      cell.classList.add('cal-day--faded');
      cell.querySelector?.('.cal-day-num');
      const num = document.createElement('div');
      num.className = 'cal-day-num';
      num.textContent = d;
      cell.appendChild(num);
    } else if (day <= daysInMonth) {
      dateStr = fmt(_year, _month, day);
      const num = document.createElement('div');
      num.className = 'cal-day-num';
      num.textContent = day;
      if (dateStr === todayStr) cell.classList.add('cal-day--today');
      if (dateStr === _selected) cell.classList.add('cal-day--selected');
      cell.appendChild(num);

      const evs = eventsForDate(dateStr);
      if (evs.length > 0) {
        const evList = document.createElement('div');
        evList.className = 'cal-day-events';
        const max = 3;
        evs.slice(0, max).forEach(ev => {
          const chip = document.createElement('div');
          chip.className = 'cal-event-chip';
          chip.dataset.color = ev.color;
          chip.textContent = ev.title;
          evList.appendChild(chip);
        });
        if (evs.length > max) {
          const more = document.createElement('div');
          more.className = 'cal-overflow';
          more.textContent = `+${evs.length - max} more`;
          evList.appendChild(more);
        }
        cell.appendChild(evList);
      }

      day++;
    } else {
      dateStr = fmt(_month === 11 ? _year + 1 : _year, _month === 11 ? 0 : _month + 1, nextDay);
      cell.classList.add('cal-day--faded');
      const num = document.createElement('div');
      num.className = 'cal-day-num';
      num.textContent = nextDay;
      cell.appendChild(num);
      nextDay++;
    }

    cell.dataset.date = dateStr;

    on(cell, 'click', () => {
      _selected = dateStr;
      renderGrid();
      renderSide();
    });

    week.appendChild(cell);
    col++;

    if (col === 7) {
      weeks.appendChild(week);
      col = 0;
    }
  }

  grid.appendChild(weeks);
}

function renderSide() {
  const side = document.getElementById('cal-side');
  if (!side) return;
  side.innerHTML = '';

  if (!_selected) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Select a day to see events.';
    side.appendChild(empty);
    return;
  }

  const header = document.createElement('div');
  header.className = 'cal-side-header section-header';

  const label = document.createElement('div');
  label.className = 'cal-selected-label section-title';
  label.textContent = fmtDisplay(_selected);

  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-primary';
  addBtn.textContent = '+ Event';

  header.appendChild(label);
  header.appendChild(addBtn);
  side.appendChild(header);

  let formVisible = false;
  let formEl = null;

  on(addBtn, 'click', () => {
    if (formVisible) {
      formEl?.remove();
      formVisible = false;
      return;
    }
    formEl = buildAddForm(_selected, () => {
      formEl?.remove();
      formVisible = false;
    });
    side.insertBefore(formEl, list);
    formVisible = true;
  });

  const evs = eventsForDate(_selected);
  const list = document.createElement('div');
  list.className = 'cal-event-list';

  if (evs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No events.';
    list.appendChild(empty);
  } else {
    evs.forEach(ev => {
      list.appendChild(buildEventItem(ev));
    });
  }

  side.appendChild(list);
}

function buildEventItem(ev) {
  const item = document.createElement('div');
  item.className = 'cal-event-item';
  item.dataset.id = ev.id;

  const dot = document.createElement('div');
  dot.className = 'cal-event-dot';
  dot.dataset.color = ev.color;

  const body = document.createElement('div');
  body.className = 'cal-event-body';

  const title = document.createElement('div');
  title.className = 'cal-event-title';
  title.textContent = ev.title;

  body.appendChild(title);

  if (ev.time) {
    const meta = document.createElement('div');
    meta.className = 'cal-event-meta';
    meta.textContent = fmtTime(ev.time);
    body.appendChild(meta);
  }

  if (ev.notes?.trim()) {
    const notes = document.createElement('div');
    notes.className = 'cal-event-notes';
    notes.textContent = ev.notes.trim();
    body.appendChild(notes);
  }

  const actions = document.createElement('div');
  actions.className = 'cal-event-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-icon';
  editBtn.title = 'Edit';
  editBtn.innerHTML = '✎';

  const delBtn = document.createElement('button');
  delBtn.className = 'btn btn-icon';
  delBtn.title = 'Delete';
  delBtn.innerHTML = '✕';
  delBtn.style.color = 'var(--negative)';

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  item.appendChild(dot);
  item.appendChild(body);
  item.appendChild(actions);

  on(editBtn, 'click', (e) => {
    e.stopPropagation();
    openEditModal(ev);
  });

  on(delBtn, 'click', (e) => {
    e.stopPropagation();
    deleteEvent(ev.id);
  });

  return item;
}

function buildAddForm(dateStr, onClose) {
  const form = document.createElement('div');
  form.className = 'cal-add-form';

  let chosenColor = 'personal';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'form-group';
  const titleLabel = document.createElement('label');
  titleLabel.className = 'form-label';
  titleLabel.textContent = 'Title';
  const titleInput = document.createElement('input');
  titleInput.className = 'form-input';
  titleInput.type = 'text';
  titleInput.placeholder = 'Event title';
  titleGroup.appendChild(titleLabel);
  titleGroup.appendChild(titleInput);

  const row = document.createElement('div');
  row.className = 'form-row';

  const timeGroup = document.createElement('div');
  timeGroup.className = 'form-group';
  timeGroup.style.flex = '1';
  const timeLabel = document.createElement('label');
  timeLabel.className = 'form-label';
  timeLabel.textContent = 'Time (optional)';
  const timeInput = document.createElement('input');
  timeInput.className = 'form-input';
  timeInput.type = 'time';
  timeGroup.appendChild(timeLabel);
  timeGroup.appendChild(timeInput);

  const colorGroup = document.createElement('div');
  colorGroup.className = 'form-group';
  const colorLabel = document.createElement('label');
  colorLabel.className = 'form-label';
  colorLabel.textContent = 'Color';
  const colorPicker = document.createElement('div');
  colorPicker.className = 'cal-color-picker';

  const colorOpts = {};
  COLORS.forEach(c => {
    const opt = document.createElement('button');
    opt.className = 'cal-color-opt' + (c === chosenColor ? ' cal-color-opt--active' : '');
    opt.dataset.color = c;
    opt.title = c;
    colorPicker.appendChild(opt);
    colorOpts[c] = opt;

    on(opt, 'click', () => {
      chosenColor = c;
      Object.values(colorOpts).forEach(o => o.classList.remove('cal-color-opt--active'));
      opt.classList.add('cal-color-opt--active');
    });
  });

  colorGroup.appendChild(colorLabel);
  colorGroup.appendChild(colorPicker);

  row.appendChild(timeGroup);
  row.appendChild(colorGroup);

  const notesGroup = document.createElement('div');
  notesGroup.className = 'form-group';
  const notesLabel = document.createElement('label');
  notesLabel.className = 'form-label';
  notesLabel.textContent = 'Notes (optional)';
  const notesInput = document.createElement('textarea');
  notesInput.className = 'form-input';
  notesInput.rows = 2;
  notesInput.style.resize = 'vertical';
  notesGroup.appendChild(notesLabel);
  notesGroup.appendChild(notesInput);

  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-ghost';
  cancelBtn.textContent = 'Cancel';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-primary';
  saveBtn.textContent = 'Add';

  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);

  form.appendChild(titleGroup);
  form.appendChild(row);
  form.appendChild(notesGroup);
  form.appendChild(footer);

  titleInput.focus();

  on(cancelBtn, 'click', onClose);

  on(saveBtn, 'click', () => {
    const title = titleInput.value.trim();
    if (!title) { titleInput.focus(); return; }

    const ev = {
      id:    'ev_' + Date.now(),
      title,
      date:  dateStr,
      time:  timeInput.value || null,
      color: chosenColor,
      notes: notesInput.value.trim(),
    };

    _events.push(ev);
    save();
    onClose();
    renderGrid();
    renderSide();
  });

  on(titleInput, 'keydown', (e) => {
    if (e.key === 'Enter') saveBtn.click();
    if (e.key === 'Escape') onClose();
  });

  return form;
}

function openEditModal(ev) {
  let chosenColor = ev.color;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const titleEl = document.createElement('div');
  titleEl.className = 'modal-title';
  titleEl.textContent = 'Edit Event';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'form-group';
  const titleLabel = document.createElement('label');
  titleLabel.className = 'form-label';
  titleLabel.textContent = 'Title';
  const titleInput = document.createElement('input');
  titleInput.className = 'form-input';
  titleInput.type = 'text';
  titleInput.value = ev.title;
  titleGroup.appendChild(titleLabel);
  titleGroup.appendChild(titleInput);

  const row = document.createElement('div');
  row.className = 'form-row';

  const dateGroup = document.createElement('div');
  dateGroup.className = 'form-group';
  dateGroup.style.flex = '1';
  const dateLabel = document.createElement('label');
  dateLabel.className = 'form-label';
  dateLabel.textContent = 'Date';
  const dateInput = document.createElement('input');
  dateInput.className = 'form-input';
  dateInput.type = 'date';
  dateInput.value = ev.date;
  dateGroup.appendChild(dateLabel);
  dateGroup.appendChild(dateInput);

  const timeGroup = document.createElement('div');
  timeGroup.className = 'form-group';
  timeGroup.style.flex = '1';
  const timeLabel = document.createElement('label');
  timeLabel.className = 'form-label';
  timeLabel.textContent = 'Time';
  const timeInput = document.createElement('input');
  timeInput.className = 'form-input';
  timeInput.type = 'time';
  timeInput.value = ev.time || '';
  timeGroup.appendChild(timeLabel);
  timeGroup.appendChild(timeInput);

  row.appendChild(dateGroup);
  row.appendChild(timeGroup);

  const colorGroup = document.createElement('div');
  colorGroup.className = 'form-group';
  const colorLabel = document.createElement('label');
  colorLabel.className = 'form-label';
  colorLabel.textContent = 'Color';
  const colorPicker = document.createElement('div');
  colorPicker.className = 'cal-modal-color-picker cal-color-picker';

  const colorOpts = {};
  COLORS.forEach(c => {
    const opt = document.createElement('button');
    opt.className = 'cal-color-opt' + (c === chosenColor ? ' cal-color-opt--active' : '');
    opt.dataset.color = c;
    opt.title = c;
    colorPicker.appendChild(opt);
    colorOpts[c] = opt;

    on(opt, 'click', () => {
      chosenColor = c;
      Object.values(colorOpts).forEach(o => o.classList.remove('cal-color-opt--active'));
      opt.classList.add('cal-color-opt--active');
    });
  });

  colorGroup.appendChild(colorLabel);
  colorGroup.appendChild(colorPicker);

  const notesGroup = document.createElement('div');
  notesGroup.className = 'form-group';
  const notesLabel = document.createElement('label');
  notesLabel.className = 'form-label';
  notesLabel.textContent = 'Notes';
  const notesInput = document.createElement('textarea');
  notesInput.className = 'form-input';
  notesInput.rows = 3;
  notesInput.style.resize = 'vertical';
  notesInput.value = ev.notes || '';
  notesGroup.appendChild(notesLabel);
  notesGroup.appendChild(notesInput);

  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-danger';
  deleteBtn.style.marginRight = 'auto';
  deleteBtn.textContent = 'Delete';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-ghost';
  cancelBtn.textContent = 'Cancel';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-primary';
  saveBtn.textContent = 'Save';

  footer.appendChild(deleteBtn);
  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);

  modal.appendChild(titleEl);
  modal.appendChild(titleGroup);
  modal.appendChild(row);
  modal.appendChild(colorGroup);
  modal.appendChild(notesGroup);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  titleInput.focus();

  const close = () => overlay.remove();

  on(overlay, 'click', (e) => { if (e.target === overlay) close(); });
  on(cancelBtn, 'click', close);

  on(deleteBtn, 'click', () => {
    deleteEvent(ev.id);
    close();
  });

  on(saveBtn, 'click', () => {
    const title = titleInput.value.trim();
    if (!title) { titleInput.focus(); return; }

    const idx = _events.findIndex(e => e.id === ev.id);
    if (idx !== -1) {
      _events[idx] = {
        ...ev,
        title,
        date:  dateInput.value,
        time:  timeInput.value || null,
        color: chosenColor,
        notes: notesInput.value.trim(),
      };
      if (dateInput.value !== ev.date) {
        _selected = dateInput.value;
        const d = new Date(dateInput.value + 'T00:00:00');
        _year  = d.getFullYear();
        _month = d.getMonth();
      }
      save();
      renderGrid();
      renderSide();
    }
    close();
  });

  on(titleInput, 'keydown', (e) => { if (e.key === 'Escape') close(); });
}

function deleteEvent(id) {
  _events = _events.filter(e => e.id !== id);
  save();
  renderGrid();
  renderSide();
}

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}
