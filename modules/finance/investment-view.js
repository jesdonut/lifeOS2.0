// investment-view.js — investment tracker sub-view

import { COUNTRIES, PRODUCTS } from './investment-products.js';
import { calculate } from './investment-calc.js';
import * as NisaView from './nisa-view.js';

const SYM = { JPY: '¥', IDR: 'Rp ', GBP: '£', USD: '$', CNY: '¥' };
function sym(currency) { return SYM[currency] ?? (currency + ' '); }
function fmt(currency, amount) { return sym(currency) + Math.round(amount).toLocaleString(); }
function uid() { return 'inv_' + Math.random().toString(36).slice(2, 9); }

// ── Module state ───────────────────────────────────────────────────────
let _container     = null;
let _data          = null;
let _onSave        = null;
let _view          = 'list';  // 'list' | 'form'
let _editId        = null;
let _filterCountry = null;
let _expandedId    = null;
let _formData      = {};

// ── Data helpers ───────────────────────────────────────────────────────
function investments() { return _data.finance?.investments ?? []; }

function saveInvestments(list) {
  const finance = { ...(_data.finance ?? {}), investments: list };
  _data = { ..._data, finance };
  _onSave({ finance });
}

// ── Public API ─────────────────────────────────────────────────────────
export function mount(container, data, onSave) {
  _container = container;
  _data      = data;
  _onSave    = onSave;
  _render();
}

export function unmount() {
  NisaView.unmount();
  if (_container) _container.innerHTML = '';
  _container = null;
  _view = 'list';
  _editId = null;
  _filterCountry = null;
  _expandedId = null;
  _formData = {};
}

export function update(newData) {
  _data = newData;
  NisaView.update(newData);
  if (_container && _view === 'list') _render();
}

// ── Render ─────────────────────────────────────────────────────────────
function _render() {
  if (!_container) return;
  _container.innerHTML = '';
  _container.appendChild(_view === 'form' ? _buildForm() : _buildList());
}

// ── List view ──────────────────────────────────────────────────────────
function _buildList() {
  const root = div('inv-list-view');
  root.appendChild(_buildToolbar());

  const list     = investments();
  const filtered = _filterCountry ? list.filter(i => i.country === _filterCountry) : list;

  if (list.length) root.appendChild(_buildSummaryBar(list));

  const bonds  = filtered.filter(i => i.productType === 'governmentBond');
  const others = filtered.filter(i => i.productType !== 'governmentBond');

  const showNisa = !_filterCountry || _filterCountry === 'JP';

  if (!filtered.length && !showNisa) {
    const empty = div('inv-empty');
    empty.textContent = list.length
      ? 'No investments for this country.'
      : 'No investments yet. Add one to start tracking.';
    root.appendChild(empty);
  } else {
    if (bonds.length)  root.appendChild(_buildBondSection(bonds));
    if (others.length) {
      const cards = div('inv-cards');
      others.forEach(item => cards.appendChild(_buildCard(item)));
      root.appendChild(cards);
    }
  }

  if (showNisa) {
    const nisaWrap = div('nisa-wrap');
    root.appendChild(nisaWrap);
    NisaView.mount(nisaWrap, _data, _onSave);
  }

  return root;
}

function _buildToolbar() {
  const bar = div('inv-toolbar');

  const pills = div('inv-country-pills');

  const allPill = btn('inv-pill' + (!_filterCountry ? ' active' : ''), 'All', () => {
    _filterCountry = null; _render();
  });
  pills.appendChild(allPill);

  Object.entries(COUNTRIES).forEach(([code, { label }]) => {
    const p = btn('inv-pill' + (_filterCountry === code ? ' active' : ''), label, () => {
      _filterCountry = _filterCountry === code ? null : code;
      _render();
    });
    pills.appendChild(p);
  });

  const addBtn = btn('inv-add-btn', '', () => {
    _view = 'form';
    _editId = null;
    _formData = { country: _filterCountry ?? 'JP' };
    _render();
  });
  addBtn.innerHTML = '<span class="material-symbols-outlined">add</span>Add';

  bar.append(pills, addBtn);
  return bar;
}

function _buildSummaryBar(list) {
  const totals = {};
  list.forEach(item => {
    const product = PRODUCTS[item.country]?.[item.productType];
    const result  = calculate(item, product);
    const cur     = item.currency || 'JPY';
    if (!totals[cur]) totals[cur] = { value: 0, invested: 0 };
    totals[cur].value    += result.estimatedValue;
    totals[cur].invested += result.totalInvested;
  });

  const bar = div('inv-summary-bar');
  const lbl = div('inv-sum-lbl'); lbl.textContent = 'Portfolio';
  const vals = div('inv-sum-vals');

  Object.entries(totals).forEach(([cur, { value, invested }]) => {
    const gain = value - invested;
    const chunk = div('inv-sum-cur');
    chunk.innerHTML = `
      <span class="inv-sum-cur-label">${cur}</span>
      <span class="inv-sum-cur-value">${fmt(cur, value)}</span>
      <span class="inv-sum-cur-gain ${gain >= 0 ? 'up' : 'down'}">${gain >= 0 ? '+' : ''}${fmt(cur, gain)}</span>
    `;
    vals.appendChild(chunk);
  });

  bar.append(lbl, vals);
  return bar;
}

// ── Bond section ───────────────────────────────────────────────────

const BOND_TAX = { IDR: 0.1 };

function _bondCalc(b) {
  const start  = new Date(b.startDate + 'T00:00:00');
  const end    = new Date(b.maturityDate + 'T00:00:00');
  const months = (end.getFullYear() - start.getFullYear()) * 12
               + (end.getMonth() - start.getMonth()) + 1;
  const tax        = BOND_TAX[b.currency] ?? 0;
  const grossYear  = b.principal * (b.couponRate / 100);
  const netYear    = Math.round(grossYear * (1 - tax));
  const netMonth   = Math.round(netYear / 12);
  const totalCoupon = Math.round(netMonth * months);
  return { months, netYear, netMonth, totalCoupon };
}

function _fmtIDR(v) {
  return 'Rp' + Math.round(v).toLocaleString();
}

const _MON = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
function _fmtMaturity(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return _MON[d.getMonth()] + ' ' + d.getFullYear();
}

function _buildBondSection(bonds) {
  const today   = new Date().toISOString().slice(0, 10);
  const active  = bonds.filter(b => (b.maturityDate ?? '') >= today)
                       .sort((a, b) => a.maturityDate.localeCompare(b.maturityDate));
  const matured = bonds.filter(b => (b.maturityDate ?? '') < today)
                       .sort((a, b) => b.maturityDate.localeCompare(a.maturityDate));

  const wrap = div('bond-section');

  const hdr    = div('bond-section-hdr');
  const hdrTitle = div('bond-section-hdr-title'); hdrTitle.textContent = 'Government Bonds';
  const addBtn = btn('nisa-add-fund-btn', '', () => {
    _view = 'form'; _editId = null;
    _formData = { country: 'ID', productType: 'governmentBond' };
    _render();
  });
  addBtn.innerHTML = '<span class="material-symbols-outlined">add</span>Add bond';
  hdr.append(hdrTitle, addBtn);
  wrap.appendChild(hdr);

  const cols = div('bond-cols');
  cols.appendChild(_buildBondCol('Active', active, false));
  cols.appendChild(_buildBondCol('Matured', matured, true));
  wrap.appendChild(cols);

  wrap.appendChild(_buildBondSummary(active, bonds));
  return wrap;
}

function _buildBondCol(label, bonds, isMatured) {
  const col = div('bond-col');

  const colHdr = div('bond-col-hdr');
  const countEl = document.createElement('span');
  countEl.className = 'bond-col-count';
  countEl.textContent = bonds.length;
  colHdr.textContent = label + ' ';
  colHdr.appendChild(countEl);
  col.appendChild(colHdr);

  const gridClass = isMatured ? 'bond-tbl-matured' : 'bond-tbl-active';
  const tblHdr = div('bond-tbl-hdr ' + gridClass);
  tblHdr.innerHTML = isMatured
    ? '<span>Series</span><span>Amount</span><span>Rate</span><span>Earned</span>'
    : '<span>Series</span><span>Amount</span><span>Rate</span><span>Net/Mo</span><span>Total</span><span>Matures</span>';
  col.appendChild(tblHdr);

  const list = div('bond-list');
  bonds.forEach(b => list.appendChild(_buildBondRow(b, isMatured, gridClass)));
  col.appendChild(list);

  return col;
}

function _buildBondRow(b, isMatured, gridClass) {
  const calc = _bondCalc(b);
  const row  = div('bond-row ' + gridClass);

  const seriesEl = document.createElement('span'); seriesEl.className = 'bc-series'; seriesEl.textContent = b.displayName;
  const amtEl    = document.createElement('span'); amtEl.textContent    = _fmtIDR(b.principal);
  const rateEl   = document.createElement('span'); rateEl.className = 'bc-rate'; rateEl.textContent = b.couponRate.toFixed(2) + '%';
  const totalEl  = document.createElement('span'); totalEl.textContent  = _fmtIDR(calc.totalCoupon);

  if (isMatured) {
    row.append(seriesEl, amtEl, rateEl, totalEl);
  } else {
    const moEl  = document.createElement('span'); moEl.textContent  = _fmtIDR(calc.netMonth);
    const matEl = document.createElement('span'); matEl.className = 'bc-matures';
    matEl.textContent = _fmtMaturity(b.maturityDate);
    row.append(seriesEl, amtEl, rateEl, moEl, totalEl, matEl);
  }

  return row;
}

function _buildBondSummary(active, all) {
  const tax        = 0.1;
  const invested   = active.reduce((s, b) => s + b.principal, 0);
  const annualNet  = Math.round(active.reduce((s, b) => s + b.principal * (b.couponRate / 100) * (1 - tax), 0));
  const monthlyNet = Math.round(annualNet / 12);
  const totalCoupon = all.reduce((s, b) => s + _bondCalc(b).totalCoupon, 0);

  const bar = div('bond-summary');
  [
    ['Active invested',    fmt('IDR', invested)],
    ['Annual net',         fmt('IDR', annualNet)],
    ['Monthly net',        fmt('IDR', monthlyNet)],
    ['Total coupon (all)', fmt('IDR', totalCoupon)],
  ].forEach(([label, value]) => {
    const item = div('bond-sum-item');
    const lbl  = div('bond-sum-lbl'); lbl.textContent = label;
    const val  = div('bond-sum-val'); val.textContent = value;
    item.append(lbl, val);
    bar.appendChild(item);
  });
  return bar;
}

// ── Investment card ─────────────────────────────────────────────────

function _buildCard(item) {
  const product    = PRODUCTS[item.country]?.[item.productType];
  const result     = calculate(item, product);
  const country    = COUNTRIES[item.country];
  const isExpanded = _expandedId === item.id;
  const cur        = item.currency;

  const card = div('inv-card');

  // Head: info + values
  const head = div('inv-card-head');

  const info = div('inv-card-info');
  const name = div('inv-card-name');
  name.textContent = item.displayName || product?.label || item.productType;

  const meta = div('inv-card-meta');
  const tags = [];
  if (country) tags.push(country.label);
  if (product) tags.push(product.label);
  if (product?.taxTreatment && product.taxTreatment !== 'taxable') tags.push(product.taxTreatment);
  if (item.startDate) {
    const d = new Date(item.startDate);
    tags.push('from ' + d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short' }));
  }
  meta.textContent = tags.join(' · ');
  info.append(name, meta);

  const vals = div('inv-card-vals');
  const valEl = div('inv-card-value');
  valEl.textContent = fmt(cur, result.estimatedValue);
  if (result.isEstimate) {
    const badge = span('inv-badge-est'); badge.textContent = 'est.';
    valEl.appendChild(badge);
  }

  const gainEl = div('inv-card-gain ' + (result.estimatedGain >= 0 ? 'up' : 'down'));
  gainEl.textContent = (result.estimatedGain >= 0 ? '+' : '') + fmt(cur, Math.abs(result.estimatedGain));
  vals.append(valEl, gainEl);
  head.append(info, vals);
  card.appendChild(head);

  // Actions
  const actions = div('inv-card-actions');

  const explBtn = btn('inv-action-link', isExpanded ? 'Hide calculation' : 'How this is calculated', () => {
    _expandedId = isExpanded ? null : item.id;
    _render();
  });

  const editBtn = btn('inv-action-btn', '', () => {
    _view = 'form'; _editId = item.id; _formData = { ...item }; _render();
  });
  editBtn.innerHTML = '<span class="material-symbols-outlined">edit</span>';
  editBtn.title = 'Edit';

  const delBtn = btn('inv-action-btn inv-action-del', '', () => {
    const label = item.displayName || product?.label || 'this investment';
    if (confirm('Delete "' + label + '"?')) {
      saveInvestments(investments().filter(i => i.id !== item.id));
      if (_expandedId === item.id) _expandedId = null;
      _render();
    }
  });
  delBtn.innerHTML = '<span class="material-symbols-outlined">delete</span>';
  delBtn.title = 'Delete';

  actions.append(explBtn, editBtn, delBtn);
  card.appendChild(actions);

  // Expandable explanation
  if (isExpanded) {
    const explain = div('inv-card-explain');
    const hdr = div('inv-explain-hdr');
    hdr.textContent = 'How this is calculated';
    explain.appendChild(hdr);
    result.explanationLines.forEach(line => {
      const p = div('inv-explain-line'); p.textContent = line;
      explain.appendChild(p);
    });
    if (result.isEstimate) {
      const note = div('inv-explain-note');
      note.textContent = 'This is an estimate. Enter a current value above to override it.';
      explain.appendChild(note);
    }
    card.appendChild(explain);
  }

  return card;
}

// ── Form ───────────────────────────────────────────────────────────────
function _buildForm() {
  const root = div('inv-form-view');

  const hdr = div('inv-form-hdr');
  const backBtn = btn('inv-form-back', '', () => { _view = 'list'; _editId = null; _render(); });
  backBtn.innerHTML = '<span class="material-symbols-outlined">arrow_back</span>';
  const title = document.createElement('h2');
  title.className = 'inv-form-title';
  title.textContent = _editId ? 'Edit investment' : 'Add investment';
  hdr.append(backBtn, title);
  root.appendChild(hdr);

  const form = div('inv-form');

  // Country selector
  const countryGroup = _buildSelect('Country', 'country',
    Object.entries(COUNTRIES).map(([k, v]) => ({ value: k, label: v.label })),
    _formData.country ?? 'JP',
    v => { _formData.country = v; _formData.productType = null; _render(); });
  form.appendChild(countryGroup);

  // Product type selector
  const country = _formData.country ?? 'JP';
  const countryProds = PRODUCTS[country] ?? {};
  const prodOptions = Object.entries(countryProds).map(([k, v]) => ({ value: k, label: v.label }));
  const currentProd = _formData.productType ?? prodOptions[0]?.value ?? null;
  if (currentProd && !_formData.productType) _formData.productType = currentProd;

  const prodGroup = _buildSelect('Product type', 'productType', prodOptions, currentProd ?? '', v => {
    _formData.productType = v; _render();
  });
  form.appendChild(prodGroup);

  // Dynamic fields
  const product = countryProds[currentProd];
  if (product) {
    const defaultCurrency = COUNTRIES[country]?.currency ?? 'JPY';

    const nameGroup = _buildTextInput('Display name',
      _formData.displayName ?? '', v => { _formData.displayName = v; });
    form.appendChild(nameGroup);

    product.fields.forEach(fieldDef => {
      if (fieldDef.key === 'notes') return;
      let group = null;
      if (fieldDef.type === 'number')  group = _buildNumberInput(fieldDef.label, _formData[fieldDef.key] ?? '', defaultCurrency, v => { _formData[fieldDef.key] = v; });
      if (fieldDef.type === 'percent') group = _buildPercentInput(fieldDef.label, _formData[fieldDef.key] ?? '', v => { _formData[fieldDef.key] = v; });
      if (fieldDef.type === 'date')    group = _buildDateInput(fieldDef.label, _formData[fieldDef.key] ?? '', v => { _formData[fieldDef.key] = v; });
      if (group) form.appendChild(group);
    });

    if (product.fields.some(f => f.key === 'notes')) {
      form.appendChild(_buildTextInput('Notes', _formData.notes ?? '', v => { _formData.notes = v; }));
    }
  }

  const submitBtn = btn('inv-form-submit', _editId ? 'Save changes' : 'Add investment', _submitForm);
  form.appendChild(submitBtn);

  root.appendChild(form);
  return root;
}

function _submitForm() {
  const country     = _formData.country ?? 'JP';
  const productType = _formData.productType ?? Object.keys(PRODUCTS[country] ?? {})[0];
  const product     = PRODUCTS[country]?.[productType];
  if (!product) return;

  const rawManual = _formData.currentMarketValue;
  const manualValue = (rawManual !== '' && rawManual != null) ? parseFloat(rawManual) : null;

  const item = {
    id:                 _editId ?? uid(),
    country,
    productType,
    displayName:        (_formData.displayName || '').trim() || product.label,
    currency:           COUNTRIES[country]?.currency ?? 'JPY',
    principal:          parseFloat(_formData.principal)          || 0,
    contributionAmount: parseFloat(_formData.contributionAmount) || 0,
    startDate:          _formData.startDate    || null,
    maturityDate:       _formData.maturityDate || null,
    interestRate:       parseFloat(_formData.interestRate)       || 0,
    couponRate:         parseFloat(_formData.couponRate)         || 0,
    currentMarketValue: isNaN(manualValue) ? null : manualValue,
    taxTreatment:       product.taxTreatment,
    notes:              _formData.notes || '',
    lastUpdated:        new Date().toISOString().slice(0, 10),
  };

  const list = investments();
  saveInvestments(_editId ? list.map(i => i.id === _editId ? item : i) : [...list, item]);
  _view = 'list'; _editId = null; _formData = {};
  _render();
}

// ── Field builders ─────────────────────────────────────────────────────
function _buildSelect(label, key, options, value, onChange) {
  const group = div('inv-field-group');
  const lbl = document.createElement('label');
  lbl.className = 'inv-field-label'; lbl.textContent = label;
  const sel = document.createElement('select');
  sel.className = 'inv-field-select';
  options.forEach(({ value: v, label: l }) => {
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = l;
    if (v === value) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', () => onChange(sel.value));
  group.append(lbl, sel);
  return group;
}

function _buildTextInput(label, value, onChange) {
  const group = div('inv-field-group');
  const lbl = document.createElement('label');
  lbl.className = 'inv-field-label'; lbl.textContent = label;
  const inp = document.createElement('input');
  inp.type = 'text'; inp.className = 'inv-field-input'; inp.value = value;
  inp.addEventListener('input', () => onChange(inp.value));
  group.append(lbl, inp);
  return group;
}

function _buildNumberInput(label, value, currency, onChange) {
  const group = div('inv-field-group');
  const lbl = document.createElement('label');
  lbl.className = 'inv-field-label'; lbl.textContent = label;
  const wrap = div('inv-field-num-wrap');
  const prefix = span('inv-field-prefix'); prefix.textContent = sym(currency);
  const inp = document.createElement('input');
  inp.type = 'number'; inp.min = '0'; inp.className = 'inv-field-input inv-field-num';
  inp.value = value; inp.placeholder = '0';
  inp.addEventListener('input', () => onChange(inp.value));
  wrap.append(prefix, inp);
  group.append(lbl, wrap);
  return group;
}

function _buildPercentInput(label, value, onChange) {
  const group = div('inv-field-group');
  const lbl = document.createElement('label');
  lbl.className = 'inv-field-label'; lbl.textContent = label;
  const wrap = div('inv-field-num-wrap');
  const inp = document.createElement('input');
  inp.type = 'number'; inp.min = '0'; inp.step = '0.1'; inp.className = 'inv-field-input inv-field-num';
  inp.value = value; inp.placeholder = '0.0';
  inp.addEventListener('input', () => onChange(inp.value));
  const suffix = span('inv-field-suffix'); suffix.textContent = '%';
  wrap.append(inp, suffix);
  group.append(lbl, wrap);
  return group;
}

function _buildDateInput(label, value, onChange) {
  const group = div('inv-field-group');
  const lbl = document.createElement('label');
  lbl.className = 'inv-field-label'; lbl.textContent = label;
  const inp = document.createElement('input');
  inp.type = 'date'; inp.className = 'inv-field-input'; inp.value = value ?? '';
  inp.addEventListener('change', () => onChange(inp.value || null));
  group.append(lbl, inp);
  return group;
}

// ── Tiny helpers ───────────────────────────────────────────────────────
function div(className) {
  const el = document.createElement('div'); el.className = className; return el;
}
function span(className) {
  const el = document.createElement('span'); el.className = className; return el;
}
function btn(className, text, onClick) {
  const el = document.createElement('button');
  el.className = className; el.textContent = text;
  el.addEventListener('click', onClick); return el;
}
