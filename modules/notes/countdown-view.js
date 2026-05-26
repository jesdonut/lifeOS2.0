// countdown-view.js — countdowns section, mounted inside notes panel

let _container = null;
let _data = null;
let _onSave = null;
let _adding = false;
let _editId = null;
let _form = {};

function uid() { return 'cd_' + Math.random().toString(36).slice(2, 9); }
function cds() { return _data.notes?.countdowns ?? []; }

function persist(list) {
  const notes = { ...(_data.notes ?? {}), countdowns: list };
  _data = { ..._data, notes };
  _onSave({ notes });
}

// ── Public ─────────────────────────────────────────────────────────
export function mount(container, data, onSave) {
  _container = container;
  _data = data;
  _onSave = onSave;
  _render();
}

export function update(data) {
  _data = data;
  if (_container) _render();
}

export function unmount() {
  _container = null;
  _adding = false;
  _editId = null;
  _form = {};
}

// ── Render ─────────────────────────────────────────────────────────
function _render() {
  _container.innerHTML = '';

  const hdr = document.createElement('div');
  hdr.className = 'notes-section-hdr';
  const lbl = document.createElement('span');
  lbl.className = 'notes-section-label';
  lbl.textContent = 'Countdowns';
  const addBtn = document.createElement('button');
  addBtn.className = 'notes-add-btn';
  addBtn.textContent = '+';
  addBtn.addEventListener('click', () => {
    _adding = !_adding;
    _editId = null;
    _form = {};
    _render();
  });
  hdr.append(lbl, addBtn);
  _container.appendChild(hdr);

  if (_adding || _editId) _container.appendChild(_buildForm());

  const list = cds();
  if (!list.length && !_adding) {
    const empty = document.createElement('p');
    empty.className = 'cd-empty';
    empty.textContent = 'No countdowns yet.';
    _container.appendChild(empty);
    return;
  }

  list.forEach(cd => _container.appendChild(_buildCard(cd)));
}

function _buildCard(cd) {
  if (_editId === cd.id) return document.createDocumentFragment();

  const { days, label } = _compute(cd);

  const card = document.createElement('div');
  card.className = 'cd-item';

  const count = document.createElement('div');
  count.className = 'cd-count';
  count.textContent = days;

  const info = document.createElement('div');
  info.className = 'cd-info';

  const name = document.createElement('div');
  name.className = 'cd-label';
  name.textContent = cd.label;

  const sub = document.createElement('div');
  sub.className = 'cd-sub';
  const d = new Date(cd.date + 'T00:00:00');
  const fmtd = d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
  sub.textContent = label + ' · ' + fmtd;

  info.append(name, sub);

  const actions = document.createElement('div');
  actions.className = 'cd-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'cd-action-btn';
  editBtn.textContent = 'edit';
  editBtn.addEventListener('click', () => {
    _editId = cd.id;
    _adding = false;
    _form = { ...cd };
    _render();
  });

  const delBtn = document.createElement('button');
  delBtn.className = 'cd-action-btn cd-del-btn';
  delBtn.textContent = '✕';
  delBtn.addEventListener('click', () => persist(cds().filter(c => c.id !== cd.id)));

  actions.append(editBtn, delBtn);
  card.append(count, info, actions);
  return card;
}

function _buildForm() {
  const form = document.createElement('div');
  form.className = 'cd-form';

  const labelInp = document.createElement('input');
  labelInp.type = 'text';
  labelInp.className = 'cd-form-input';
  labelInp.placeholder = 'Label';
  labelInp.value = _form.label ?? '';
  labelInp.addEventListener('input', () => { _form.label = labelInp.value; });

  const dateInp = document.createElement('input');
  dateInp.type = 'date';
  dateInp.className = 'cd-form-input';
  dateInp.value = _form.date ?? '';
  dateInp.addEventListener('change', () => { _form.date = dateInp.value; });

  // Mode toggle
  const modeRow = document.createElement('div');
  modeRow.className = 'cd-form-row';
  const modeLabel = document.createElement('span');
  modeLabel.className = 'cd-form-row-label';
  modeLabel.textContent = 'Mode';
  const modeToggle = document.createElement('div');
  modeToggle.className = 'cd-toggle';
  ['since', 'until'].forEach(m => {
    const b = document.createElement('button');
    b.className = 'cd-toggle-btn' + ((_form.mode ?? 'since') === m ? ' active' : '');
    b.textContent = m;
    b.addEventListener('click', () => { _form.mode = m; _render(); });
    modeToggle.appendChild(b);
  });
  modeRow.append(modeLabel, modeToggle);

  // Yearly toggle
  const yearlyRow = document.createElement('div');
  yearlyRow.className = 'cd-form-row';
  const yearlyLabel = document.createElement('span');
  yearlyLabel.className = 'cd-form-row-label';
  yearlyLabel.textContent = 'Repeat yearly';
  const yearlyCheck = document.createElement('input');
  yearlyCheck.type = 'checkbox';
  yearlyCheck.className = 'cd-form-check';
  yearlyCheck.checked = _form.yearly ?? false;
  yearlyCheck.addEventListener('change', () => { _form.yearly = yearlyCheck.checked; });
  yearlyRow.append(yearlyLabel, yearlyCheck);

  // Buttons
  const btnRow = document.createElement('div');
  btnRow.className = 'cd-form-btns';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'cd-form-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    _adding = false; _editId = null; _form = {}; _render();
  });
  const saveBtn = document.createElement('button');
  saveBtn.className = 'cd-form-save';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => {
    if (!_form.label?.trim() || !_form.date) return;
    const item = {
      id:     _editId ?? uid(),
      label:  _form.label.trim(),
      date:   _form.date,
      mode:   _form.mode ?? 'since',
      yearly: _form.yearly ?? false,
    };
    const list = _editId
      ? cds().map(c => c.id === _editId ? item : c)
      : [...cds(), item];
    _adding = false; _editId = null; _form = {};
    persist(list);
  });
  btnRow.append(cancelBtn, saveBtn);

  form.append(labelInp, dateInp, modeRow, yearlyRow, btnRow);
  requestAnimationFrame(() => labelInp.focus());
  return form;
}

// ── Calculation ────────────────────────────────────────────────────
function _compute(cd) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ref = new Date(cd.date + 'T00:00:00');

  if (cd.mode === 'since') {
    const days = Math.round((today - ref) / 86400000);
    return { days: Math.max(0, days), label: 'days since' };
  }

  // mode === 'until'
  let target = ref;
  if (cd.yearly) {
    const thisYear = new Date(today.getFullYear(), ref.getMonth(), ref.getDate());
    target = thisYear < today
      ? new Date(today.getFullYear() + 1, ref.getMonth(), ref.getDate())
      : thisYear;
  }

  const days = Math.round((target - today) / 86400000);
  if (days === 0) return { days: 0,             label: 'today'     };
  if (days < 0)  return { days: Math.abs(days), label: 'days ago'  };
  return            { days,                  label: 'days to go' };
}
