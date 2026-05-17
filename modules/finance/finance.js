/**
 * finance.js — Finance module
 * Tracks monthly income and expenses in JPY or IDR.
 */

const EXPENSE_CATEGORIES = [
  'Housing', 'Food', 'Transport', 'Health', 'Shopping', 'Entertainment', 'Other'
];

const CSS_ID = 'finance-css';
const CSS_PATH = new URL('./finance.css', import.meta.url).href;

// ── State ─────────────────────────────────────────────────────────────────────

let _container = null;
let _data      = null;   // full data object from store
let _onSave    = null;
let _month     = '';     // 'YYYY-MM'
let _listeners = [];     // [{ el, event, fn }]

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentMonthKey() {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthLabel(key) {
  const [y, m] = key.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

function offsetMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  const ny = d.getFullYear();
  const nm = String(d.getMonth() + 1).padStart(2, '0');
  return `${ny}-${nm}`;
}

function formatAmount(amount, currency) {
  const n = Number(amount);
  if (currency === 'IDR') {
    return 'Rp ' + n.toLocaleString('id-ID');
  }
  return '¥' + n.toLocaleString('ja-JP');
}

function getMonthData(month) {
  const finance = _data.finance || { months: {} };
  return finance.months?.[month] || { income: [], expenses: [] };
}

function saveMonthData(month, monthData) {
  const finance = _data.finance ? { ..._data.finance } : { months: {} };
  finance.months = { ...finance.months, [month]: monthData };
  _data = { ..._data, finance };
  _onSave({ finance });
}

function calcTotals(monthData) {
  const toJPY = (entry) => {
    // For summary we show raw amounts; multi-currency: display separately.
    // totals are computed per-currency and shown as-is (same-currency sums).
    return entry.amount;
  };

  // Group by currency
  const incByCur   = {};
  const expByCur   = {};

  for (const e of (monthData.income || [])) {
    incByCur[e.currency] = (incByCur[e.currency] || 0) + Number(e.amount);
  }
  for (const e of (monthData.expenses || [])) {
    expByCur[e.currency] = (expByCur[e.currency] || 0) + Number(e.amount);
  }

  return { incByCur, expByCur };
}

function formatMultiCurrency(byCur, fallbackSign = '') {
  const parts = [];
  for (const [cur, amt] of Object.entries(byCur)) {
    if (amt !== 0) parts.push(formatAmount(amt, cur));
  }
  if (parts.length === 0) return fallbackSign + '0';
  return parts.join(' + ');
}

function formatNetMultiCurrency(incByCur, expByCur) {
  // Net per currency
  const currencies = new Set([...Object.keys(incByCur), ...Object.keys(expByCur)]);
  const parts = [];
  for (const cur of currencies) {
    const net = (incByCur[cur] || 0) - (expByCur[cur] || 0);
    if (net !== 0) parts.push({ cur, net });
  }
  if (parts.length === 0) return { text: '¥0', positive: true };

  const texts   = parts.map(p => formatAmount(Math.abs(p.net), p.cur));
  const allPos  = parts.every(p => p.net >= 0);
  const allNeg  = parts.every(p => p.net < 0);
  const sign    = allNeg ? '−' : (parts.length === 1 && parts[0].net < 0 ? '−' : '');

  // Mixed-sign: show each with sign
  if (!allPos && !allNeg) {
    const mixed = parts.map(p => (p.net >= 0 ? '+' : '−') + formatAmount(Math.abs(p.net), p.cur));
    return { text: mixed.join(' / '), positive: false, mixed: true };
  }

  return {
    text: sign + texts.join(' + '),
    positive: allPos
  };
}

// ── Event listener management ─────────────────────────────────────────────────

function on(el, event, fn, opts) {
  el.addEventListener(event, fn, opts);
  _listeners.push({ el, event, fn, opts });
}

function removeAllListeners() {
  for (const { el, event, fn, opts } of _listeners) {
    el.removeEventListener(event, fn, opts);
  }
  _listeners = [];
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function render() {
  _container.innerHTML = '';

  const root = document.createElement('div');
  root.className = 'finance-root';

  root.appendChild(renderMonthNav());
  root.appendChild(renderSummary());
  root.appendChild(renderSection('income'));
  root.appendChild(renderSection('expenses'));

  _container.appendChild(root);
}

function renderMonthNav() {
  const nav = document.createElement('div');
  nav.className = 'finance-month-nav';

  const prev = document.createElement('button');
  prev.className = 'btn btn-ghost btn-icon';
  prev.title = 'Previous month';
  prev.textContent = '‹';

  const label = document.createElement('span');
  label.className = 'finance-month-label';
  label.textContent = monthLabel(_month);

  const next = document.createElement('button');
  next.className = 'btn btn-ghost btn-icon';
  next.title = 'Next month';
  next.textContent = '›';

  on(prev, 'click', () => { _month = offsetMonth(_month, -1); render(); });
  on(next, 'click', () => { _month = offsetMonth(_month, +1); render(); });

  nav.append(prev, label, next);
  return nav;
}

function renderSummary() {
  const md = getMonthData(_month);
  const { incByCur, expByCur } = calcTotals(md);

  const row = document.createElement('div');
  row.className = 'finance-summary';

  const incText = formatMultiCurrency(incByCur);
  const expText = formatMultiCurrency(expByCur);
  const net     = formatNetMultiCurrency(incByCur, expByCur);

  row.appendChild(summaryCard('Total Income',   incText, 'num-positive'));
  row.appendChild(summaryCard('Total Expenses', expText, 'num-negative'));
  row.appendChild(summaryCard('Net',            net.text,
    net.mixed ? 'num-muted' : (net.positive ? 'num-positive' : 'num-negative')));

  return row;
}

function summaryCard(label, amountText, cls) {
  const card = document.createElement('div');
  card.className = 'finance-summary-card';

  const lbl = document.createElement('div');
  lbl.className = 'finance-summary-label';
  lbl.textContent = label;

  const amt = document.createElement('div');
  amt.className = `finance-summary-amount ${cls}`;
  amt.textContent = amountText;

  card.append(lbl, amt);
  return card;
}

function renderSection(type) {
  const isIncome = type === 'income';
  const md = getMonthData(_month);
  const entries = (md[type] || []).slice();

  const section = document.createElement('div');
  section.className = 'finance-section';

  // Header
  const header = document.createElement('div');
  header.className = 'finance-section-header';

  const title = document.createElement('span');
  title.className = 'finance-section-title';
  title.textContent = isIncome ? 'Income' : 'Expenses';

  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-ghost';
  addBtn.textContent = isIncome ? '+ Add income' : '+ Add expense';

  header.append(title, addBtn);
  section.appendChild(header);

  // Table
  const tableWrap = document.createElement('div');
  tableWrap.style.overflowX = 'auto';

  const table = document.createElement('table');
  table.className = 'finance-table';

  // thead
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');

  if (isIncome) {
    hr.innerHTML = `
      <th>Source</th>
      <th class="col-amount">Amount</th>
      <th class="col-action"></th>`;
  } else {
    hr.innerHTML = `
      <th>Category</th>
      <th>Description</th>
      <th class="col-amount">Amount</th>
      <th class="col-action"></th>`;
  }

  thead.appendChild(hr);
  table.appendChild(thead);

  // tbody
  const tbody = document.createElement('tbody');

  if (entries.length === 0) {
    const emptyTr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = isIncome ? 3 : 4;
    td.className = 'finance-empty';
    td.textContent = isIncome ? 'No income recorded' : 'No expenses recorded';
    emptyTr.appendChild(td);
    tbody.appendChild(emptyTr);
  } else {
    for (const entry of entries) {
      tbody.appendChild(renderEntryRow(entry, type, isIncome));
    }
  }

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  section.appendChild(tableWrap);

  // Add-row form (hidden by default, shown on button click)
  const addRow = buildAddRow(type, isIncome, section);
  section.appendChild(addRow);

  on(addBtn, 'click', () => {
    addRow.style.display = addRow.style.display === 'none' ? 'flex' : 'none';
    if (addRow.style.display === 'flex') addRow.querySelector('.form-input').focus();
  });

  return section;
}

function renderEntryRow(entry, type, isIncome) {
  const tr = document.createElement('tr');
  tr.dataset.id = entry.id;

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'finance-delete-btn btn-icon';
  deleteBtn.title = 'Delete';
  deleteBtn.innerHTML = '✕';

  on(deleteBtn, 'click', () => {
    deleteEntry(type, entry.id);
  });

  const actionTd = document.createElement('td');
  actionTd.className = 'col-action';
  actionTd.appendChild(deleteBtn);

  const amtTd = document.createElement('td');
  amtTd.className = 'col-amount';
  amtTd.textContent = formatAmount(entry.amount, entry.currency);

  if (isIncome) {
    const srcTd = document.createElement('td');
    srcTd.textContent = entry.source || '—';
    tr.append(srcTd, amtTd, actionTd);
  } else {
    const catTd = document.createElement('td');
    catTd.innerHTML = `<span class="chip">${entry.category || 'Other'}</span>`;

    const descTd = document.createElement('td');
    descTd.textContent = entry.desc || '—';

    tr.append(catTd, descTd, amtTd, actionTd);
  }

  return tr;
}

function buildAddRow(type, isIncome, section) {
  const row = document.createElement('div');
  row.className = 'finance-add-row';
  row.style.display = 'none';

  if (isIncome) {
    const sourceInput = makeInput('text', 'Source (e.g. Salary)', 'source');
    const amountInput = makeInput('number', 'Amount', 'amount');
    amountInput.min = '0';
    const curSelect   = makeCurrencySelect();

    const actions = document.createElement('div');
    actions.className = 'add-row-actions';

    const saveBtn   = makeBtn('Save', 'btn btn-primary');
    const cancelBtn = makeBtn('Cancel', 'btn btn-ghost');

    on(saveBtn, 'click', () => {
      const source = sourceInput.value.trim();
      const amount = parseFloat(amountInput.value);
      const currency = curSelect.value;
      if (!source || isNaN(amount) || amount <= 0) return;

      addEntry('income', { id: 'inc_' + Date.now(), source, amount, currency });
      row.style.display = 'none';
      sourceInput.value = '';
      amountInput.value = '';
    });

    on(cancelBtn, 'click', () => { row.style.display = 'none'; });

    actions.append(saveBtn, cancelBtn);
    row.append(sourceInput, amountInput, curSelect, actions);

  } else {
    const catSelect  = makeCategorySelect();
    const descInput  = makeInput('text', 'Description', 'desc');
    const amountInput = makeInput('number', 'Amount', 'amount');
    amountInput.min = '0';
    const curSelect  = makeCurrencySelect();

    const actions = document.createElement('div');
    actions.className = 'add-row-actions';

    const saveBtn   = makeBtn('Save', 'btn btn-primary');
    const cancelBtn = makeBtn('Cancel', 'btn btn-ghost');

    on(saveBtn, 'click', () => {
      const category = catSelect.value;
      const desc     = descInput.value.trim();
      const amount   = parseFloat(amountInput.value);
      const currency = curSelect.value;
      if (isNaN(amount) || amount <= 0) return;

      addEntry('expenses', { id: 'exp_' + Date.now(), category, desc, amount, currency });
      row.style.display = 'none';
      descInput.value = '';
      amountInput.value = '';
      catSelect.selectedIndex = 0;
    });

    on(cancelBtn, 'click', () => { row.style.display = 'none'; });

    actions.append(saveBtn, cancelBtn);
    row.append(catSelect, descInput, amountInput, curSelect, actions);
  }

  return row;
}

// ── Input factory helpers ─────────────────────────────────────────────────────

function makeInput(type, placeholder, name) {
  const el = document.createElement('input');
  el.type = type;
  el.placeholder = placeholder;
  el.name = name;
  el.className = 'form-input';
  return el;
}

function makeCurrencySelect() {
  const sel = document.createElement('select');
  sel.className = 'form-input';
  sel.innerHTML = `<option value="JPY">JPY ¥</option><option value="IDR">IDR Rp</option>`;
  return sel;
}

function makeCategorySelect() {
  const sel = document.createElement('select');
  sel.className = 'form-input';
  sel.innerHTML = EXPENSE_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
  return sel;
}

function makeBtn(text, cls) {
  const btn = document.createElement('button');
  btn.className = cls;
  btn.textContent = text;
  return btn;
}

// ── Data mutations ────────────────────────────────────────────────────────────

function addEntry(type, entry) {
  const md = getMonthData(_month);
  const updated = {
    ...md,
    [type]: [...(md[type] || []), entry]
  };
  saveMonthData(_month, updated);
  render();
}

function deleteEntry(type, id) {
  const md = getMonthData(_month);
  const updated = {
    ...md,
    [type]: (md[type] || []).filter(e => e.id !== id)
  };
  saveMonthData(_month, updated);
  render();
}

// ── CSS injection ─────────────────────────────────────────────────────────────

function injectCSS() {
  if (document.getElementById(CSS_ID)) return;
  const link = document.createElement('link');
  link.id   = CSS_ID;
  link.rel  = 'stylesheet';
  link.href = CSS_PATH;
  document.head.appendChild(link);
}

function removeCSS() {
  document.getElementById(CSS_ID)?.remove();
}

// ── Module contract ───────────────────────────────────────────────────────────

export function init(container, data, onSave) {
  _container = container;
  _data      = data;
  _onSave    = onSave;
  _month     = currentMonthKey();

  injectCSS();
  render();
}

export function destroy() {
  removeAllListeners();
  removeCSS();
  if (_container) _container.innerHTML = '';
  _container = null;
  _data      = null;
  _onSave    = null;
}

export function onDataChange(newData) {
  _data = newData;
  render();
}
