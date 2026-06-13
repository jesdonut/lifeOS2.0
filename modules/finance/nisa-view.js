// nisa-view.js — NISA tracker section

const LIMITS = {
  annualTsumitate:  1_200_000,
  annualGrowth:     2_400_000,
  annualCombined:   3_600_000,
  lifetimeTotal:   18_000_000,
};

const YEAR = new Date().getFullYear().toString();

function uid()      { return 'nf_' + Math.random().toString(36).slice(2, 9); }
function fmtJPY(n)  { return '¥' + Math.round(n).toLocaleString(); }

// ── State ──────────────────────────────────────────────────────────
let _container         = null;
let _data              = null;
let _onSave            = null;
let _editValueFundId   = null;
let _editRatioFundId   = null;
let _addPurchaseFundId = null;
let _editPurchase      = null; // { fundId, purchaseId }
let _addFundOpen       = false;

// ── Data helpers ───────────────────────────────────────────────────
function nisaData() { return _data.nisa ?? {}; }
function funds() { return nisaData().funds ?? []; }

function saveFunds(newFunds) {
  const nisa = { ...nisaData(), funds: newFunds };
  _data = { ..._data, nisa };
  _onSave({ nisa });
}

function patchFund(id, patch) {
  saveFunds(funds().map(f => f.id === id ? { ...f, ...patch } : f));
}

// ── Public API ─────────────────────────────────────────────────────
export function mount(container, data, onSave) {
  _container = container;
  _data      = data;
  _onSave    = onSave;
  _render();
}

export function unmount() {
  if (_container) _container.innerHTML = '';
  _container         = null;
  _editValueFundId   = null;
  _editRatioFundId   = null;
  _addPurchaseFundId = null;
  _editPurchase      = null;
  _addFundOpen       = false;
}

export function update(newData) {
  _data = newData;
  if (_container) _render();
}

// ── Render ─────────────────────────────────────────────────────────
function _render() {
  if (!_container) return;
  _container.innerHTML = '';
  const root = div('nisa-section');

  const hdr = div('nisa-section-hdr');
  const title = document.createElement('span');
  title.className = 'nisa-section-title';
  title.textContent = 'NISA';
  const addFundBtn = btn('nisa-add-fund-btn', '', () => { _addFundOpen = !_addFundOpen; _render(); });
  addFundBtn.innerHTML = '<span class="material-symbols-outlined">add</span>Add fund';
  hdr.append(title, addFundBtn);
  root.appendChild(hdr);

  root.appendChild(_buildOverview(funds()));

  if (_addFundOpen) root.appendChild(_buildAddFundForm());

  funds().forEach(f => root.appendChild(_buildFundCard(f)));

  _container.appendChild(root);
}

// ── Overview ───────────────────────────────────────────────────────
function _buildOverview(fundList) {
  let totalValue = 0, totalFee = 0;
  let tsuYear = 0, growthYear = 0, lifetimeTotal = 0;

  fundList.forEach(f => {
    const val = f.currentValue ?? 0;
    totalValue += val;
    totalFee   += val * ((f.expenseRatio ?? 0) / 100);
    (f.purchases ?? []).forEach(p => {
      const amt = p.amount ?? 0;
      lifetimeTotal += amt;
      if ((p.date ?? '').startsWith(YEAR)) {
        if (p.bucket === 'tsumitate') tsuYear   += amt;
        if (p.bucket === 'growth')    growthYear += amt;
      }
    });
  });

  const combinedYear = tsuYear + growthYear;

  const card = div('nisa-overview');

  const statsGrid = div('nisa-overview-stats');
  statsGrid.append(
    _stat('Current Value',  fmtJPY(totalValue)),
    _stat('Total Invested', fmtJPY(lifetimeTotal)),
    _stat('Annual Fees',    fmtJPY(totalFee)),
  );
  card.appendChild(statsGrid);

  const limitsGrid = div('nisa-limits');
  limitsGrid.append(
    _limitStat('Tsumitate',  tsuYear,       LIMITS.annualTsumitate),
    _limitStat('Growth',     growthYear,    LIMITS.annualGrowth),
    _limitStat('Combined',   combinedYear,  LIMITS.annualCombined),
    _limitStat('Lifetime',   lifetimeTotal, LIMITS.lifetimeTotal),
  );
  card.appendChild(limitsGrid);

  return card;
}

function _stat(label, value) {
  const item = div('nisa-stat');
  const lbl  = div('nisa-stat-lbl'); lbl.textContent = label;
  const val  = div('nisa-stat-val'); val.textContent = value;
  item.append(lbl, val);
  return item;
}

function _limitStat(label, used, limit) {
  const pct  = Math.min(used / limit, 1);
  const item = div('nisa-stat nisa-stat-limit');
  const lbl  = div('nisa-stat-lbl'); lbl.textContent = label;

  const row      = div('nisa-limit-row');
  const usedEl   = div('nisa-stat-val');   usedEl.textContent = fmtJPY(used);
  const sep      = document.createElement('span'); sep.className = 'nisa-limit-sep'; sep.textContent = '/';
  const limitEl  = div('nisa-limit-cap');  limitEl.textContent = fmtJPY(limit);
  row.append(usedEl, sep, limitEl);

  const bar  = div('nisa-limit-bar');
  const fill = div('nisa-limit-fill' + (pct >= 1 ? ' full' : ''));
  fill.style.width = (pct * 100).toFixed(1) + '%';
  bar.appendChild(fill);

  item.append(lbl, row, bar);
  return item;
}

// ── Fund card ──────────────────────────────────────────────────────
function _buildFundCard(fund) {
  const card = div('nisa-fund-card');

  // Header
  const head = div('nisa-fund-head');
  const name = div('nisa-fund-name'); name.textContent = fund.name;

  const actions = div('nisa-fund-actions');

  const delBtn = btn('nisa-fund-action-btn nisa-fund-del', '', () => {
    const count = (fund.purchases ?? []).length;
    const msg   = count
      ? `Delete "${fund.name}"? This will also delete its ${count} purchase(s).`
      : `Delete "${fund.name}"?`;
    if (confirm(msg)) {
      if (_editValueFundId === fund.id)   _editValueFundId   = null;
      if (_editRatioFundId === fund.id)   _editRatioFundId   = null;
      if (_addPurchaseFundId === fund.id) _addPurchaseFundId = null;
      if (_editPurchase?.fundId === fund.id) _editPurchase   = null;
      saveFunds(funds().filter(f => f.id !== fund.id));
      _render();
    }
  });
  delBtn.innerHTML = '<span class="material-symbols-outlined">delete</span>';
  delBtn.title = 'Delete fund';

  actions.appendChild(delBtn);
  head.append(name, actions);
  card.appendChild(head);

  // Stats
  const stats = div('nisa-fund-stats');

  // Current value
  const valStat = div('nisa-fund-stat');
  const valLbl  = div('nisa-fund-stat-lbl'); valLbl.textContent = 'Current Value';
  valStat.appendChild(valLbl);
  if (_editValueFundId === fund.id) {
    const inp  = _inp('number', fund.currentValue ?? 0);
    const save = btn('nisa-inline-save', 'Save', () => {
      patchFund(fund.id, { currentValue: parseFloat(inp.value) || 0 });
      _editValueFundId = null; _render();
    });
    const cancel = btn('nisa-inline-cancel', 'Cancel', () => { _editValueFundId = null; _render(); });
    const row = div('nisa-inline-row'); row.append(inp, save, cancel);
    valStat.appendChild(row);
  } else {
    const valEl  = div('nisa-fund-stat-val'); valEl.textContent = fmtJPY(fund.currentValue ?? 0);
    const editBtn = btn('nisa-val-edit-btn', '', () => { _editValueFundId = fund.id; _render(); });
    editBtn.innerHTML = '<span class="material-symbols-outlined">edit</span>';
    editBtn.title = 'Update value';
    const row = div('nisa-inline-row'); row.append(valEl, editBtn);
    valStat.appendChild(row);
  }

  // Expense ratio
  const ratioStat = div('nisa-fund-stat');
  const ratioLbl  = div('nisa-fund-stat-lbl'); ratioLbl.textContent = 'Expense Ratio';
  ratioStat.appendChild(ratioLbl);
  if (_editRatioFundId === fund.id) {
    const inp    = _inp('number', fund.expenseRatio ?? 0); inp.step = '0.001';
    const save   = btn('nisa-inline-save', 'Save', () => {
      patchFund(fund.id, { expenseRatio: parseFloat(inp.value) || 0 });
      _editRatioFundId = null; _render();
    });
    const cancel = btn('nisa-inline-cancel', 'Cancel', () => { _editRatioFundId = null; _render(); });
    const row = div('nisa-inline-row'); row.append(inp, save, cancel);
    ratioStat.appendChild(row);
  } else {
    const ratioEl  = div('nisa-fund-stat-val'); ratioEl.textContent = (fund.expenseRatio ?? 0) + '%';
    const editBtn  = btn('nisa-val-edit-btn', '', () => { _editRatioFundId = fund.id; _render(); });
    editBtn.innerHTML = '<span class="material-symbols-outlined">edit</span>';
    editBtn.title = 'Edit expense ratio';
    const row = div('nisa-inline-row'); row.append(ratioEl, editBtn);
    ratioStat.appendChild(row);
  }

  // Total invested + gain/loss
  const totalInvested = (fund.purchases ?? []).reduce((s, p) => s + (p.amount ?? 0), 0);
  const gain          = (fund.currentValue ?? 0) - totalInvested;

  const invStat = div('nisa-fund-stat');
  const invLbl  = div('nisa-fund-stat-lbl'); invLbl.textContent = 'Total Invested';
  const invVal  = div('nisa-fund-stat-val'); invVal.textContent = fmtJPY(totalInvested);
  invStat.append(invLbl, invVal);

  const gainStat = div('nisa-fund-stat');
  const gainLbl  = div('nisa-fund-stat-lbl'); gainLbl.textContent = 'Gain / Loss';
  const gainVal  = div('nisa-fund-stat-val nisa-fund-gain ' + (gain >= 0 ? 'up' : 'down'));
  gainVal.textContent = (gain >= 0 ? '+' : '') + fmtJPY(gain);
  gainStat.append(gainLbl, gainVal);

  // Annual fee
  const annualFee = (fund.currentValue ?? 0) * ((fund.expenseRatio ?? 0) / 100);
  const feeStat   = div('nisa-fund-stat');
  const feeLbl    = div('nisa-fund-stat-lbl'); feeLbl.textContent = 'Annual Fee';
  const feeVal    = div('nisa-fund-stat-val'); feeVal.textContent = fmtJPY(annualFee);
  feeStat.append(feeLbl, feeVal);

  stats.append(valStat, invStat, gainStat, ratioStat, feeStat);
  card.appendChild(stats);

  // Purchases
  const section = div('nisa-purchases');

  const phdr    = div('nisa-purchases-hdr');
  const pLbl    = div('nisa-purchases-label'); pLbl.textContent = 'Purchases';
  const addPBtn = btn('nisa-add-purchase-btn', '', () => {
    _addPurchaseFundId = _addPurchaseFundId === fund.id ? null : fund.id;
    _editPurchase = null;
    _render();
  });
  addPBtn.innerHTML = '<span class="material-symbols-outlined">add</span>';
  addPBtn.title = 'Add purchase';
  phdr.append(pLbl, addPBtn);
  section.appendChild(phdr);

  if (_addPurchaseFundId === fund.id) {
    section.appendChild(_buildAddPurchaseForm(fund.id));
  }

  const purchases = fund.purchases ?? [];
  if (!purchases.length && _addPurchaseFundId !== fund.id) {
    const empty = div('nisa-purchases-empty'); empty.textContent = 'No purchases yet.';
    section.appendChild(empty);
  } else {
    purchases.forEach(p => {
      const isEditing = _editPurchase?.fundId === fund.id && _editPurchase?.purchaseId === p.id;
      section.appendChild(isEditing ? _buildEditPurchaseRow(fund.id, p) : _buildPurchaseRow(fund.id, p));
    });
  }

  card.appendChild(section);
  return card;
}

// ── Purchase rows ──────────────────────────────────────────────────
function _buildPurchaseRow(fundId, p) {
  const row  = div('nisa-purchase-row');
  const info = div('nisa-purchase-info');

  const dateEl   = div('nisa-purchase-date');   dateEl.textContent = p.date ?? '';
  const amtEl    = div('nisa-purchase-amount'); amtEl.textContent = fmtJPY(p.amount ?? 0);
  const bucketEl = div('nisa-purchase-bucket ' + (p.bucket === 'tsumitate' ? 'bk-tsu' : 'bk-growth'));
  bucketEl.textContent = p.bucket === 'tsumitate' ? 'Tsumitate' : 'Growth';
  info.append(dateEl, amtEl, bucketEl);

  const acts   = div('nisa-purchase-actions');
  const editBtn = btn('nisa-purchase-action', '', () => {
    _editPurchase = { fundId, purchaseId: p.id };
    _addPurchaseFundId = null;
    _render();
  });
  editBtn.innerHTML = '<span class="material-symbols-outlined">edit</span>';

  const delBtn = btn('nisa-purchase-action nisa-purchase-del', '', () => {
    if (confirm('Delete this purchase?')) {
      const fund = funds().find(f => f.id === fundId);
      patchFund(fundId, { purchases: fund.purchases.filter(x => x.id !== p.id) });
      if (_editPurchase?.purchaseId === p.id) _editPurchase = null;
      _render();
    }
  });
  delBtn.innerHTML = '<span class="material-symbols-outlined">delete</span>';

  acts.append(editBtn, delBtn);
  row.append(info, acts);
  return row;
}

function _buildEditPurchaseRow(fundId, p) {
  const row   = div('nisa-purchase-edit-row');
  const dateI = _inp('date', p.date ?? '');
  const amtI  = _inp('number', p.amount ?? ''); amtI.placeholder = 'Amount';
  const sel   = _bucketSelect(p.bucket);

  const save = btn('nisa-inline-save', 'Save', () => {
    const fund = funds().find(f => f.id === fundId);
    patchFund(fundId, {
      purchases: fund.purchases.map(x => x.id !== p.id ? x :
        { ...x, date: dateI.value, amount: parseFloat(amtI.value) || 0, bucket: sel.value }
      )
    });
    _editPurchase = null; _render();
  });
  const cancel = btn('nisa-inline-cancel', 'Cancel', () => { _editPurchase = null; _render(); });

  row.append(dateI, amtI, sel, save, cancel);
  return row;
}

function _buildAddPurchaseForm(fundId) {
  const form  = div('nisa-purchase-edit-row');
  const dateI = _inp('date', new Date().toISOString().slice(0, 10));
  const amtI  = _inp('number', ''); amtI.placeholder = 'Amount';
  const sel   = _bucketSelect('tsumitate');

  const save = btn('nisa-inline-save', 'Add', () => {
    const amt = parseFloat(amtI.value);
    if (!amt) return;
    const fund = funds().find(f => f.id === fundId);
    patchFund(fundId, {
      purchases: [...(fund.purchases ?? []), { id: uid(), date: dateI.value, amount: amt, bucket: sel.value }]
    });
    _addPurchaseFundId = null; _render();
  });
  const cancel = btn('nisa-inline-cancel', 'Cancel', () => { _addPurchaseFundId = null; _render(); });

  form.append(dateI, amtI, sel, save, cancel);
  return form;
}

// ── Add fund form ──────────────────────────────────────────────────
function _buildAddFundForm() {
  const form     = div('nisa-add-fund-form');
  const nameI    = _inp('text', '');   nameI.placeholder  = 'Fund name';
  const ratioI   = _inp('number', ''); ratioI.placeholder = 'Expense ratio (%)'; ratioI.step = '0.001';

  const save = btn('nisa-inline-save', 'Add', () => {
    if (!nameI.value.trim()) return;
    saveFunds([...funds(), {
      id:           uid(),
      name:         nameI.value.trim(),
      expenseRatio: parseFloat(ratioI.value) || 0,
      currentValue: 0,
      purchases:    [],
    }]);
    _addFundOpen = false; _render();
  });
  const cancel = btn('nisa-inline-cancel', 'Cancel', () => { _addFundOpen = false; _render(); });

  form.append(nameI, ratioI, save, cancel);
  return form;
}

// ── Tiny helpers ───────────────────────────────────────────────────
function _bucketSelect(selected) {
  const sel = document.createElement('select'); sel.className = 'nisa-sel';
  ['tsumitate', 'growth'].forEach(v => {
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = v === 'tsumitate' ? 'Tsumitate' : 'Growth';
    if (v === selected) opt.selected = true;
    sel.appendChild(opt);
  });
  return sel;
}

function _inp(type, value) {
  const el = document.createElement('input');
  el.type = type; el.value = value; el.className = 'nisa-inp';
  return el;
}

function div(className) {
  const el = document.createElement('div'); el.className = className; return el;
}

function btn(className, text, onClick) {
  const el = document.createElement('button');
  el.className = className; el.textContent = text;
  el.addEventListener('click', onClick); return el;
}
