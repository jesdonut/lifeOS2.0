// modules/tasks/tasks.js

let _container, _data, _onSave;
let _adding = false;

export function init(container, data, onSave) {
  _container = container;
  _data      = data;
  _onSave    = onSave;
  _loadCss();
  render();
}

export function destroy() {
  _container.innerHTML = '';
  _adding = false;
}

export function onDataChange(newData) {
  _data = newData;
  render();
}

function _loadCss() {
  const href = new URL('./tasks.css', import.meta.url).href;
  if (!document.querySelector(`link[href="${href}"]`)) {
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function allTasks() {
  const raw = _data.tasks ?? {};
  const items = [];
  for (const [date, list] of Object.entries(raw)) {
    for (const t of (list ?? [])) items.push({ ...t, date });
  }
  return items;
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Mutations ──────────────────────────────────────────────────────

function addTask(text, date) {
  const raw = { ...(_data.tasks ?? {}) };
  const id  = 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  raw[date] = [...(raw[date] ?? []), { id, text, done: false }];
  _onSave({ tasks: raw });
}

function toggleDone(date, id) {
  const raw = { ...(_data.tasks ?? {}) };
  raw[date] = (raw[date] ?? []).map(t => t.id === id ? { ...t, done: !t.done } : t);
  _onSave({ tasks: raw });
}

function deleteTask(date, id) {
  const raw = { ...(_data.tasks ?? {}) };
  raw[date] = (raw[date] ?? []).filter(t => t.id !== id);
  if (!raw[date].length) delete raw[date];
  _onSave({ tasks: raw });
}

// ── Render ─────────────────────────────────────────────────────────

function render() {
  _container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'tsk-wrap';

  // Header
  const hdr = document.createElement('div');
  hdr.className = 'tsk-hdr';

  const title = document.createElement('span');
  title.className   = 'tsk-title';
  title.textContent = 'Tasks';

  const addBtn = document.createElement('button');
  addBtn.className   = 'tsk-add-btn';
  addBtn.textContent = '+ Add task';
  addBtn.addEventListener('click', () => { _adding = true; render(); });

  hdr.append(title, addBtn);
  wrap.appendChild(hdr);

  if (_adding) wrap.appendChild(renderAddForm());

  const td       = todayStr();
  const all      = allTasks();
  const overdue  = all.filter(t => !t.done && t.date <  td).sort((a, b) => a.date.localeCompare(b.date));
  const today    = all.filter(t => !t.done && t.date === td);
  const upcoming = all.filter(t => !t.done && t.date >  td).sort((a, b) => a.date.localeCompare(b.date));
  const done     = all.filter(t =>  t.done)                 .sort((a, b) => b.date.localeCompare(a.date));

  if (!all.length && !_adding) {
    const empty = document.createElement('p');
    empty.className   = 'tsk-empty';
    empty.textContent = 'No tasks yet.';
    wrap.appendChild(empty);
  } else {
    if (overdue.length)  wrap.appendChild(renderGroup('Overdue',  overdue,  'overdue'));
    if (today.length)    wrap.appendChild(renderGroup('Today',    today,    'today'));
    if (upcoming.length) wrap.appendChild(renderGroup('Upcoming', upcoming, 'upcoming'));
    if (done.length)     wrap.appendChild(renderGroup('Done',     done,     'done'));
  }

  _container.appendChild(wrap);
}

function renderAddForm() {
  const form = document.createElement('div');
  form.className = 'tsk-add-form';

  const textInput = document.createElement('input');
  textInput.className   = 'tsk-input';
  textInput.type        = 'text';
  textInput.placeholder = 'Task description';

  const dateInput = document.createElement('input');
  dateInput.className = 'tsk-date-input';
  dateInput.type      = 'date';
  dateInput.value     = todayStr();

  const saveBtn = document.createElement('button');
  saveBtn.className   = 'tsk-save-btn';
  saveBtn.textContent = 'Add';
  saveBtn.addEventListener('click', () => {
    const text = textInput.value.trim();
    if (text && dateInput.value) {
      addTask(text, dateInput.value);
      _adding = false;
    }
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.className   = 'tsk-cancel-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => { _adding = false; render(); });

  textInput.addEventListener('keydown', e => {
    if (e.key === 'Enter')  saveBtn.click();
    if (e.key === 'Escape') cancelBtn.click();
  });

  const actions = document.createElement('div');
  actions.className = 'tsk-form-actions';
  actions.append(saveBtn, cancelBtn);

  form.append(textInput, dateInput, actions);
  requestAnimationFrame(() => textInput.focus());
  return form;
}

function renderGroup(label, tasks, type) {
  const section = document.createElement('div');
  section.className = 'tsk-section';

  const groupLabel = document.createElement('div');
  groupLabel.className   = `tsk-group-label ${type}`;
  groupLabel.textContent = label;
  section.appendChild(groupLabel);

  tasks.forEach(t => section.appendChild(renderTaskRow(t, type)));
  return section;
}

function renderTaskRow(t, type) {
  const row = document.createElement('div');
  row.className = 'tsk-row' + (t.done ? ' done' : '');

  const checkbox = document.createElement('button');
  checkbox.className = 'tsk-check' + (t.done ? ' checked' : '');
  checkbox.addEventListener('click', () => toggleDone(t.date, t.id));

  const text = document.createElement('span');
  text.className   = 'tsk-text';
  text.textContent = t.text;

  const right = document.createElement('div');
  right.className = 'tsk-row-right';

  if (type !== 'today') {
    const dateEl = document.createElement('span');
    dateEl.className   = 'tsk-date' + (type === 'overdue' ? ' overdue' : '');
    dateEl.textContent = fmtDate(t.date);
    right.appendChild(dateEl);
  }

  const delBtn = document.createElement('button');
  delBtn.className   = 'tsk-del-btn';
  delBtn.textContent = '×';
  delBtn.addEventListener('click', () => deleteTask(t.date, t.id));
  right.appendChild(delBtn);

  row.append(checkbox, text, right);
  return row;
}
