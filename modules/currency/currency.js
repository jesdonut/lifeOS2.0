// currency.js — Currency module (IDR/USD lots, P&L, rate management)

let _container = null;
let _data = null;
let _onSave = null;
let _listeners = []; // [{ el, type, fn }]

// ── Helpers ────────────────────────────────────────────────────────────────

function on(el, type, fn) {
  el.addEventListener(type, fn);
  _listeners.push({ el, type, fn });
}

function removeAllListeners() {
  for (const { el, type, fn } of _listeners) {
    el.removeEventListener(type, fn);
  }
  _listeners = [];
}

function getCurrency() {
  return _data?.currency ?? { lots: [], rates: {} };
}

function getRate(ccy) {
  return getCurrency().rates?.[ccy]?.rate ?? null;
}

function fmtJPY(n) {
  if (n == null || isNaN(n)) return '—';
  return '¥' + Math.round(n).toLocaleString();
}

function fmtIDR(n) {
  if (n == null || isNaN(n)) return '—';
  return 'Rp ' + Math.round(n).toLocaleString();
}

function fmtUSD(n) {
  if (n == null || isNaN(n)) return '—';
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtAmount(ccy, n) {
  if (ccy === 'IDR') return fmtIDR(n);
  if (ccy === 'USD') return fmtUSD(n);
  return n?.toLocaleString() ?? '—';
}

function fmtRate(ccy, rate) {
  if (rate == null) return '—';
  if (ccy === 'IDR') {
    // 1 IDR = rate JPY (small number like 0.0094)
    return rate.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 }) + ' ¥/IDR';
  }
  if (ccy === 'USD') {
    return '¥' + rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '/USD';
  }
  return String(rate);
}

function lotValueJPY(lot, rate) {
  if (rate == null) return null;
  return lot.amount * rate;
}

function lotBuyValueJPY(lot) {
  // buyRate = rate at time of purchase
  return lot.amount * lot.buyRate;
}

function lotPnl(lot, currentRate) {
  if (currentRate == null) return null;
  return lotValueJPY(lot, currentRate) - lotBuyValueJPY(lot);
}

function lotPnlPct(lot, currentRate) {
  if (currentRate == null) return null;
  const buy = lotBuyValueJPY(lot);
  if (!buy) return null;
  return ((currentRate - lot.buyRate) / lot.buyRate) * 100;
}

function save(updated) {
  _data = { ..._data, currency: updated };
  _onSave({ currency: updated });
}

// ── CSS injection ──────────────────────────────────────────────────────────

function injectCSS() {
  if (document.getElementById('currency-css')) return;
  const link = document.createElement('link');
  link.id = 'currency-css';
  link.rel = 'stylesheet';
  link.href = new URL('./currency.css', import.meta.url).href;
  document.head.appendChild(link);
}

function removeCSS() {
  document.getElementById('currency-css')?.remove();
}

// ── Render ─────────────────────────────────────────────────────────────────

function render() {
  _container.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'currency-root';

  root.appendChild(renderRates());
  root.appendChild(renderSummary());
  root.appendChild(renderLots());

  _container.appendChild(root);
}

// ── Rates section ──────────────────────────────────────────────────────────

function renderRates() {
  const wrap = document.createElement('div');
  wrap.innerHTML = '<div class="section-header"><span class="section-title">Exchange Rates</span></div>';

  const grid = document.createElement('div');
  grid.className = 'currency-rates';

  for (const ccy of ['IDR', 'USD']) {
    grid.appendChild(renderRateCard(ccy));
  }

  wrap.appendChild(grid);
  return wrap;
}

function renderRateCard(ccy) {
  const c = getCurrency();
  const rateInfo = c.rates?.[ccy] ?? null;
  const rate = rateInfo?.rate ?? null;
  const updatedAt = rateInfo?.updatedAt ?? null;

  const card = document.createElement('div');
  card.className = 'currency-rate-card';
  card.dataset.ccy = ccy;

  const header = document.createElement('div');
  header.className = 'currency-rate-header';

  const label = document.createElement('div');
  label.className = 'currency-rate-label';
  label.textContent = ccy;

  const updateBtn = document.createElement('button');
  updateBtn.className = 'btn btn-ghost';
  updateBtn.textContent = 'Update rate';
  on(updateBtn, 'click', () => toggleRateEdit(card, ccy));

  header.appendChild(label);
  header.appendChild(updateBtn);

  const valueEl = document.createElement('div');
  valueEl.className = 'currency-rate-value';
  valueEl.textContent = rate != null ? fmtRate(ccy, rate) : '—';

  const metaEl = document.createElement('div');
  metaEl.className = 'currency-rate-meta';
  metaEl.textContent = updatedAt ? 'Updated ' + updatedAt : 'No rate set — enter one to begin';

  card.appendChild(header);
  card.appendChild(valueEl);
  card.appendChild(metaEl);

  return card;
}

function toggleRateEdit(card, ccy) {
  // Remove existing inline edit if present
  const existing = card.querySelector('.currency-rate-edit');
  if (existing) {
    existing.remove();
    return;
  }

  const c = getCurrency();
  const currentRate = c.rates?.[ccy]?.rate ?? '';

  const editRow = document.createElement('div');
  editRow.className = 'currency-rate-edit';

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'form-input';
  input.placeholder = ccy === 'IDR' ? '0.0094' : '154.20';
  input.step = ccy === 'IDR' ? '0.0001' : '0.01';
  input.min = '0';
  input.value = currentRate !== '' ? currentRate : '';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-primary';
  saveBtn.textContent = 'Save';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-ghost';
  cancelBtn.textContent = 'Cancel';

  on(cancelBtn, 'click', () => editRow.remove());

  on(saveBtn, 'click', () => {
    const val = parseFloat(input.value);
    if (isNaN(val) || val <= 0) {
      input.focus();
      return;
    }
    const today = new Date();
    const dateStr = today.getFullYear() + '-'
      + String(today.getMonth() + 1).padStart(2, '0') + '-'
      + String(today.getDate()).padStart(2, '0');

    const updated = {
      ...getCurrency(),
      rates: {
        ...getCurrency().rates,
        [ccy]: { rate: val, updatedAt: dateStr }
      }
    };
    save(updated);
    render();
  });

  on(input, 'keydown', (e) => {
    if (e.key === 'Enter') saveBtn.click();
    if (e.key === 'Escape') editRow.remove();
  });

  editRow.appendChild(input);
  editRow.appendChild(saveBtn);
  editRow.appendChild(cancelBtn);
  card.appendChild(editRow);

  input.focus();
}

// ── Summary section ────────────────────────────────────────────────────────

function renderSummary() {
  const c = getCurrency();
  const lots = c.lots ?? [];

  // Aggregate by currency
  let totalIDR = 0, totalUSD = 0;
  let totalBuyJPY = 0, totalCurrentJPY = 0;
  let hasMissingRate = false;

  for (const lot of lots) {
    const currentRate = getRate(lot.currency);
    if (lot.currency === 'IDR') totalIDR += lot.amount;
    if (lot.currency === 'USD') totalUSD += lot.amount;
    totalBuyJPY += lotBuyValueJPY(lot);
    if (currentRate != null) {
      totalCurrentJPY += lotValueJPY(lot, currentRate);
    } else {
      hasMissingRate = true;
    }
  }

  const totalPnl = hasMissingRate ? null : totalCurrentJPY - totalBuyJPY;

  const wrap = document.createElement('div');
  wrap.innerHTML = '<div class="section-header"><span class="section-title">Summary</span></div>';

  const grid = document.createElement('div');
  grid.className = 'currency-summary';

  // IDR held
  const idrCard = document.createElement('div');
  idrCard.className = 'currency-summary-card';
  const idrRate = getRate('IDR');
  const idrJPY = idrRate != null ? totalIDR * idrRate : null;
  idrCard.innerHTML = `
    <div class="currency-summary-label">IDR Held</div>
    <div class="currency-summary-amount">${fmtIDR(totalIDR)}</div>
    <div class="currency-summary-sub">${idrJPY != null ? fmtJPY(idrJPY) + ' at current rate' : 'No rate set'}</div>
  `;

  // USD held
  const usdCard = document.createElement('div');
  usdCard.className = 'currency-summary-card';
  const usdRate = getRate('USD');
  const usdJPY = usdRate != null ? totalUSD * usdRate : null;
  usdCard.innerHTML = `
    <div class="currency-summary-label">USD Held</div>
    <div class="currency-summary-amount">${fmtUSD(totalUSD)}</div>
    <div class="currency-summary-sub">${usdJPY != null ? fmtJPY(usdJPY) + ' at current rate' : 'No rate set'}</div>
  `;

  // Total P&L
  const pnlCard = document.createElement('div');
  pnlCard.className = 'currency-summary-card';
  let pnlClass = '';
  let pnlText = '—';
  if (totalPnl != null) {
    pnlClass = totalPnl >= 0 ? 'num-positive' : 'num-negative';
    pnlText = (totalPnl >= 0 ? '+' : '') + fmtJPY(totalPnl);
  }
  pnlCard.innerHTML = `
    <div class="currency-summary-label">Total P&amp;L (JPY)</div>
    <div class="currency-summary-amount ${pnlClass}">${pnlText}</div>
    <div class="currency-summary-sub">${hasMissingRate ? 'Some rates missing' : 'Across all lots'}</div>
  `;

  grid.appendChild(idrCard);
  grid.appendChild(usdCard);
  grid.appendChild(pnlCard);
  wrap.appendChild(grid);
  return wrap;
}

// ── Lots table ─────────────────────────────────────────────────────────────

function renderLots() {
  const c = getCurrency();
  const lots = (c.lots ?? []).slice().sort((a, b) => (b.buyDate ?? '').localeCompare(a.buyDate ?? ''));

  const section = document.createElement('div');
  section.className = 'currency-lots-section';

  const header = document.createElement('div');
  header.className = 'currency-lots-header';

  const title = document.createElement('span');
  title.className = 'currency-lots-title';
  title.textContent = 'Lots';

  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-primary';
  addBtn.textContent = '+ Add lot';
  on(addBtn, 'click', () => openAddModal());

  header.appendChild(title);
  header.appendChild(addBtn);
  section.appendChild(header);

  if (lots.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'currency-empty';
    empty.textContent = 'No lots yet. Add one to start tracking.';
    section.appendChild(empty);
    return section;
  }

  const tableWrap = document.createElement('div');
  tableWrap.style.overflowX = 'auto';

  const table = document.createElement('table');
  table.className = 'currency-table';

  table.innerHTML = `
    <thead>
      <tr>
        <th class="col-date">Date</th>
        <th>Currency</th>
        <th class="col-num">Amount</th>
        <th class="col-num">Buy Rate</th>
        <th class="col-num">Buy Value (JPY)</th>
        <th class="col-num">Current Value (JPY)</th>
        <th class="col-num">P&amp;L</th>
        <th class="col-num">P&amp;L %</th>
        <th>Notes</th>
        <th class="col-action"></th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement('tbody');

  for (const lot of lots) {
    const currentRate = getRate(lot.currency);
    const currentVal = lotValueJPY(lot, currentRate);
    const buyVal = lotBuyValueJPY(lot);
    const pnl = lotPnl(lot, currentRate);
    const pnlPct = lotPnlPct(lot, currentRate);

    let pnlClass = '';
    let pnlText = '—';
    let pnlPctText = '—';

    if (pnl != null) {
      pnlClass = pnl >= 0 ? 'num-positive' : 'num-negative';
      pnlText = (pnl >= 0 ? '+' : '') + fmtJPY(pnl);
      pnlPctText = (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(2) + '%';
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-date">${lot.buyDate ?? '—'}</td>
      <td><span class="chip chip-accent">${lot.currency}</span></td>
      <td class="col-num">${fmtAmount(lot.currency, lot.amount)}</td>
      <td class="col-num">${fmtRate(lot.currency, lot.buyRate)}</td>
      <td class="col-num">${fmtJPY(buyVal)}</td>
      <td class="col-num">${currentRate != null ? fmtJPY(currentVal) : '<span class="num-muted">No rate</span>'}</td>
      <td class="col-num ${pnlClass}">${pnlText}</td>
      <td class="col-num ${pnlClass}">${pnlPctText}</td>
      <td class="col-notes" title="${escapeAttr(lot.notes ?? '')}">${escapeHTML(lot.notes ?? '')}</td>
      <td class="col-action">
        <button class="btn btn-icon currency-delete-btn" title="Delete lot" data-id="${lot.id}">✕</button>
      </td>
    `;

    const deleteBtn = tr.querySelector('.currency-delete-btn');
    on(deleteBtn, 'click', () => deleteLot(lot.id));

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  section.appendChild(tableWrap);
  return section;
}

// ── Add lot modal ──────────────────────────────────────────────────────────

function openAddModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  const title = document.createElement('div');
  title.className = 'modal-title';
  title.textContent = 'Add Lot';

  const form = document.createElement('div');
  form.className = 'currency-modal-form';

  // Currency + Date row
  const row1 = document.createElement('div');
  row1.className = 'form-row';

  const ccyGroup = document.createElement('div');
  ccyGroup.className = 'form-group';
  ccyGroup.innerHTML = '<label class="form-label">Currency</label>';
  const ccySel = document.createElement('select');
  ccySel.className = 'form-input';
  ccySel.innerHTML = '<option value="IDR">IDR</option><option value="USD">USD</option>';
  ccyGroup.appendChild(ccySel);

  const dateGroup = document.createElement('div');
  dateGroup.className = 'form-group';
  dateGroup.innerHTML = '<label class="form-label">Buy Date</label>';
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.className = 'form-input';
  const today = new Date();
  dateInput.value = today.getFullYear() + '-'
    + String(today.getMonth() + 1).padStart(2, '0') + '-'
    + String(today.getDate()).padStart(2, '0');
  dateGroup.appendChild(dateInput);

  row1.appendChild(ccyGroup);
  row1.appendChild(dateGroup);

  // Amount + Buy Rate row
  const row2 = document.createElement('div');
  row2.className = 'form-row';

  const amtGroup = document.createElement('div');
  amtGroup.className = 'form-group';
  amtGroup.innerHTML = '<label class="form-label">Amount</label>';
  const amtInput = document.createElement('input');
  amtInput.type = 'number';
  amtInput.className = 'form-input';
  amtInput.placeholder = '1000000';
  amtInput.min = '0';
  amtInput.step = 'any';
  amtGroup.appendChild(amtInput);

  const rateGroup = document.createElement('div');
  rateGroup.className = 'form-group';
  const rateLabel = document.createElement('label');
  rateLabel.className = 'form-label';
  rateLabel.textContent = 'Buy Rate (¥ per unit)';
  rateGroup.appendChild(rateLabel);
  const rateInput = document.createElement('input');
  rateInput.type = 'number';
  rateInput.className = 'form-input';
  rateInput.placeholder = '0.0094';
  rateInput.step = 'any';
  rateInput.min = '0';

  // Pre-fill rate from current stored rate
  function prefillRate() {
    const r = getRate(ccySel.value);
    if (r != null) rateInput.placeholder = String(r);
    else rateInput.placeholder = ccySel.value === 'IDR' ? '0.0094' : '154.20';
  }
  prefillRate();
  on(ccySel, 'change', prefillRate);

  rateGroup.appendChild(rateInput);

  row2.appendChild(amtGroup);
  row2.appendChild(rateGroup);

  // Notes
  const notesGroup = document.createElement('div');
  notesGroup.className = 'form-group';
  notesGroup.innerHTML = '<label class="form-label">Notes (optional)</label>';
  const notesInput = document.createElement('input');
  notesInput.type = 'text';
  notesInput.className = 'form-input';
  notesInput.placeholder = 'e.g. BCA bank, bonus funds';
  notesGroup.appendChild(notesInput);

  // Error msg
  const errEl = document.createElement('div');
  errEl.style.color = 'var(--negative)';
  errEl.style.fontSize = 'var(--text-sm)';
  errEl.style.display = 'none';

  form.appendChild(row1);
  form.appendChild(row2);
  form.appendChild(notesGroup);
  form.appendChild(errEl);

  // Footer
  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-ghost';
  cancelBtn.textContent = 'Cancel';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-primary';
  saveBtn.textContent = 'Add Lot';

  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);

  function closeModal() {
    overlay.remove();
  }

  on(cancelBtn, 'click', closeModal);
  on(overlay, 'click', (e) => { if (e.target === overlay) closeModal(); });
  on(document, 'keydown', handleEsc);

  function handleEsc(e) {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', handleEsc);
    }
  }

  on(saveBtn, 'click', () => {
    const ccy = ccySel.value;
    const amount = parseFloat(amtInput.value);
    const buyRate = parseFloat(rateInput.value);
    const buyDate = dateInput.value;

    errEl.style.display = 'none';

    if (isNaN(amount) || amount <= 0) {
      errEl.textContent = 'Enter a valid amount.';
      errEl.style.display = '';
      amtInput.focus();
      return;
    }
    if (isNaN(buyRate) || buyRate <= 0) {
      errEl.textContent = 'Enter a valid buy rate.';
      errEl.style.display = '';
      rateInput.focus();
      return;
    }
    if (!buyDate) {
      errEl.textContent = 'Select a buy date.';
      errEl.style.display = '';
      dateInput.focus();
      return;
    }

    const newLot = {
      id: 'lot_' + Date.now(),
      currency: ccy,
      amount,
      buyRate,
      buyDate,
      notes: notesInput.value.trim()
    };

    const c = getCurrency();
    const updated = { ...c, lots: [...(c.lots ?? []), newLot] };
    save(updated);
    closeModal();
    render();
  });

  modal.appendChild(title);
  modal.appendChild(form);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  amtInput.focus();
}

// ── Delete lot ─────────────────────────────────────────────────────────────

function deleteLot(id) {
  const c = getCurrency();
  const updated = { ...c, lots: (c.lots ?? []).filter(l => l.id !== id) };
  save(updated);
  render();
}

// ── Escape helpers ─────────────────────────────────────────────────────────

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

// ── Module contract ────────────────────────────────────────────────────────

export function init(container, data, onSave) {
  _container = container;
  _data = data;
  _onSave = onSave;
  injectCSS();
  render();
}

export function destroy() {
  removeAllListeners();
  removeCSS();
  if (_container) _container.innerHTML = '';
  _container = null;
  _data = null;
  _onSave = null;
}

export function onDataChange(newData) {
  _data = newData;
  render();
}
