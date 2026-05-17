// nisa.js — NISA module (Tsumitate + Growth)

const TSUMITATE_LIMIT = 1_200_000;  // per year
const GROWTH_LIMIT    = 2_400_000;  // per year
const LIFETIME_LIMIT  = 18_000_000; // total

const WARN_THRESHOLD  = 0.9; // 90%

let _container = null;
let _data      = null;
let _onSave    = null;
let _year      = new Date().getFullYear();
let _listeners = [];

// ── Public API ──────────────────────────────────────────────

export function init(container, data, onSave) {
  _container = container;
  _data      = normalise(data);
  _onSave    = onSave;
  _year      = new Date().getFullYear();

  injectCSS();
  render();
}

export function destroy() {
  removeCSS();
  _listeners.forEach(([el, type, fn]) => el.removeEventListener(type, fn));
  _listeners = [];
  _container = null;
}

export function onDataChange(newData) {
  _data = normalise(newData);
  if (_container) render();
}

// ── Normalise ────────────────────────────────────────────────

function normalise(data) {
  const nisa = data?.nisa ?? {};
  return {
    ...data,
    nisa: {
      contributions: Array.isArray(nisa.contributions) ? nisa.contributions : [],
    },
  };
}

// ── CSS injection ────────────────────────────────────────────

function injectCSS() {
  if (document.getElementById('nisa-css')) return;
  const link = document.createElement('link');
  link.id   = 'nisa-css';
  link.rel  = 'stylesheet';
  link.href = './modules/nisa/nisa.css';
  document.head.appendChild(link);
}

function removeCSS() {
  const el = document.getElementById('nisa-css');
  if (el) el.remove();
}

// ── Computed helpers ─────────────────────────────────────────

function contribs() {
  return _data.nisa.contributions;
}

function forYear(year) {
  return contribs().filter(c => c.date?.startsWith(String(year)));
}

function sumByType(list, type) {
  return list.filter(c => c.type === type).reduce((s, c) => s + (c.amount || 0), 0);
}

function lifetimeUsed() {
  return contribs().reduce((s, c) => s + (c.amount || 0), 0);
}

// ── Render ───────────────────────────────────────────────────

function render() {
  _listeners.forEach(([el, type, fn]) => el.removeEventListener(type, fn));
  _listeners = [];

  const yearList   = forYear(_year);
  const tsumUsed   = sumByType(yearList, 'tsumitate');
  const growthUsed = sumByType(yearList, 'growth');
  const lifeUsed   = lifetimeUsed();

  _container.innerHTML = '';

  const root = el('div', 'nisa-root');
  root.appendChild(renderSummary(tsumUsed, growthUsed, lifeUsed));
  root.appendChild(renderYearNav());
  root.appendChild(renderTable(yearList));

  _container.appendChild(root);
}

// ── Summary cards ────────────────────────────────────────────

function renderSummary(tsumUsed, growthUsed, lifeUsed) {
  const grid = el('div', 'nisa-summary');
  grid.appendChild(summaryCard('Tsumitate 積立', tsumUsed, TSUMITATE_LIMIT));
  grid.appendChild(summaryCard('Growth 成長投資枠', growthUsed, GROWTH_LIMIT));
  grid.appendChild(summaryCard('Lifetime 生涯', lifeUsed, LIFETIME_LIMIT));
  return grid;
}

function summaryCard(label, used, limit) {
  const pct  = Math.min(used / limit, 1);
  const warn = pct >= WARN_THRESHOLD;
  const full = pct >= 1;

  const card = el('div', 'nisa-summary-card');

  const lbl = el('div', 'nisa-summary-label');
  lbl.textContent = label;

  const amt = el('div', 'nisa-summary-amount');
  amt.textContent = '¥' + used.toLocaleString();

  const sub = el('div', 'nisa-summary-sublabel' + (warn ? ' warn' : ''));
  sub.textContent = `of ¥${limit.toLocaleString()} (${Math.round(pct * 100)}%)`;

  const track = el('div', 'nisa-progress-track');
  const fill  = el('div', 'nisa-progress-fill' + (full ? ' full' : warn ? ' warn' : ''));
  fill.style.width = (pct * 100).toFixed(1) + '%';
  track.appendChild(fill);

  card.appendChild(lbl);
  card.appendChild(amt);
  card.appendChild(sub);
  card.appendChild(track);
  return card;
}

// ── Year nav ─────────────────────────────────────────────────

function renderYearNav() {
  const wrap = el('div', 'nisa-year-nav');

  const prev = btn('←', 'btn btn-ghost', () => { _year--; render(); });
  const lbl  = el('div', 'nisa-year-label');
  lbl.textContent = _year;
  const next = btn('→', 'btn btn-ghost', () => { _year++; render(); });

  wrap.appendChild(prev);
  wrap.appendChild(lbl);
  wrap.appendChild(next);
  return wrap;
}

// ── Contributions table ───────────────────────────────────────

function renderTable(yearList) {
  const section = el('div', 'nisa-section');

  // header
  const header = el('div', 'nisa-section-header');
  const title  = el('div', 'nisa-section-title');
  title.textContent = `Contributions — ${_year}`;
  const addBtn = btn('+ Add', 'btn btn-primary', () => openModal());
  header.appendChild(title);
  header.appendChild(addBtn);
  section.appendChild(header);

  // table
  const table = el('table', 'nisa-table');

  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Date</th>
      <th>Type</th>
      <th>Fund</th>
      <th>Notes</th>
      <th class="col-amount">Amount</th>
      <th class="col-action"></th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  const sorted = [...yearList].sort((a, b) => (b.date > a.date ? 1 : -1));

  if (sorted.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.className = 'nisa-empty';
    td.textContent = 'No contributions recorded for this year.';
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    sorted.forEach(c => tbody.appendChild(renderRow(c)));
  }

  table.appendChild(tbody);
  section.appendChild(table);
  return section;
}

function renderRow(c) {
  const tr = document.createElement('tr');

  td(tr, c.date ?? '—');
  td(tr, typeChip(c.type));
  td(tr, c.fund || '—');
  td(tr, c.notes || '—');

  const amtTd = document.createElement('td');
  amtTd.className = 'col-amount';
  amtTd.textContent = '¥' + (c.amount || 0).toLocaleString();
  tr.appendChild(amtTd);

  const actTd = document.createElement('td');
  actTd.className = 'col-action';
  const delBtn = btn('✕', 'nisa-delete-btn', () => deleteContrib(c.id));
  delBtn.title = 'Delete';
  actTd.appendChild(delBtn);
  tr.appendChild(actTd);

  return tr;
}

function typeChip(type) {
  const span = document.createElement('span');
  if (type === 'tsumitate') {
    span.className   = 'nisa-chip-tsumitate';
    span.textContent = '積立';
  } else {
    span.className   = 'nisa-chip-growth';
    span.textContent = '成長';
  }
  return span;
}

// ── Modal ─────────────────────────────────────────────────────

function openModal() {
  const today = isoToday();

  const overlay = el('div', 'nisa-modal-overlay');

  const modal = el('div', 'nisa-modal');

  const title = el('div', 'nisa-modal-title');
  title.textContent = 'Add Contribution';
  modal.appendChild(title);

  // date
  const dateInput = input('date', today);
  modal.appendChild(formGroup('Date', dateInput));

  // type
  const typeSelect = document.createElement('select');
  typeSelect.className = 'nisa-form-input';
  [['tsumitate', '積立 Tsumitate'], ['growth', '成長 Growth']].forEach(([val, label]) => {
    const opt   = document.createElement('option');
    opt.value   = val;
    opt.textContent = label;
    typeSelect.appendChild(opt);
  });
  modal.appendChild(formGroup('Type', typeSelect));

  // amount
  const amountInput = input('number', '');
  amountInput.min         = '1';
  amountInput.step        = '1';
  amountInput.placeholder = '0';
  modal.appendChild(formGroup('Amount (¥)', amountInput));

  // fund
  const fundInput = input('text', '');
  fundInput.placeholder = 'e.g. eMAXIS Slim';
  modal.appendChild(formGroup('Fund', fundInput));

  // notes
  const notesInput = input('text', '');
  notesInput.placeholder = 'Optional';
  modal.appendChild(formGroup('Notes', notesInput));

  // footer
  const footer = el('div', 'nisa-modal-footer');

  const cancelBtn = btn('Cancel', 'btn btn-ghost', () => overlay.remove());
  const saveBtn   = btn('Save', 'btn btn-primary', () => {
    const amount = parseInt(amountInput.value, 10);
    if (!dateInput.value || isNaN(amount) || amount <= 0) return;

    const contrib = {
      id:     'nisa_' + Date.now(),
      date:   dateInput.value,
      type:   typeSelect.value,
      amount,
      fund:   fundInput.value.trim(),
      notes:  notesInput.value.trim(),
    };

    const updated = [...contribs(), contrib];
    save(updated);
    overlay.remove();
  });

  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);
  modal.appendChild(footer);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // close on backdrop click
  on(overlay, 'click', e => { if (e.target === overlay) overlay.remove(); });

  amountInput.focus();
}

// ── Mutations ────────────────────────────────────────────────

function deleteContrib(id) {
  const updated = contribs().filter(c => c.id !== id);
  save(updated);
}

function save(contributions) {
  _data = { ..._data, nisa: { contributions } };
  _onSave({ nisa: { contributions } });
  render();
}

// ── DOM helpers ──────────────────────────────────────────────

function el(tag, cls) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  return node;
}

function btn(text, cls, handler) {
  const b = document.createElement('button');
  b.className   = cls;
  b.textContent = text;
  on(b, 'click', handler);
  return b;
}

function on(element, type, fn) {
  element.addEventListener(type, fn);
  _listeners.push([element, type, fn]);
}

function td(tr, content) {
  const cell = document.createElement('td');
  if (content instanceof Node) {
    cell.appendChild(content);
  } else {
    cell.textContent = content;
  }
  tr.appendChild(cell);
}

function input(type, value) {
  const el = document.createElement('input');
  el.type      = type;
  el.value     = value;
  el.className = 'nisa-form-input';
  return el;
}

function formGroup(labelText, inputEl) {
  const group = el('div', 'nisa-form-group');
  const lbl   = el('label', 'nisa-form-label');
  lbl.textContent = labelText;
  group.appendChild(lbl);
  group.appendChild(inputEl);
  return group;
}

function isoToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
