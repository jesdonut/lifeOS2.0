// bank.js — Bank accounts module

export function init(container, data, onSave) {
  _container = container;
  _data = data.bank ?? { accounts: [] };
  _onSave = onSave;

  // Inject CSS
  if (!document.getElementById('bank-css')) {
    const link = document.createElement('link');
    link.id = 'bank-css';
    link.rel = 'stylesheet';
    link.href = './modules/bank/bank.css';
    document.head.appendChild(link);
  }

  _render();
  _attachListeners();
}

export function destroy() {
  _removeListeners();
  const link = document.getElementById('bank-css');
  if (link) link.remove();
  _container = null;
}

export function onDataChange(newData) {
  if (newData.bank) {
    _data = newData.bank;
    _render();
  }
}

// ─── Private state ────────────────────────────────────────────────────────────

let _container = null;
let _data = { accounts: [] };
let _onSave = null;
let _listeners = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _save() {
  _onSave({ bank: _data });
}

function _fmt(amount, currency) {
  if (currency === 'JPY') {
    return '¥' + Math.round(amount).toLocaleString();
  }
  if (currency === 'IDR') {
    return 'Rp' + Math.round(amount).toLocaleString();
  }
  // USD or other
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _currencyLabel(currency) {
  return currency;
}

function _typeLabel(type) {
  const labels = { checking: 'Checking', savings: 'Savings', foreign: 'Foreign' };
  return labels[type] ?? type;
}

function _totals() {
  const map = {};
  for (const acct of _data.accounts) {
    map[acct.currency] = (map[acct.currency] ?? 0) + (acct.balance ?? 0);
  }
  return map;
}

// ─── Render ───────────────────────────────────────────────────────────────────

function _render() {
  _removeListeners();
  _container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'bank-module';

  // Header
  const header = document.createElement('div');
  header.className = 'section-header';
  header.innerHTML = `
    <span class="section-title">Bank Accounts</span>
    <button class="btn btn-primary btn-sm" id="bank-add-btn">+ Add account</button>
  `;
  wrap.appendChild(header);

  // Totals
  const totals = _totals();
  const currencies = Object.keys(totals);
  if (currencies.length > 0) {
    const totalsEl = document.createElement('div');
    totalsEl.className = 'bank-totals';
    totalsEl.innerHTML = currencies.map(cur => `
      <div class="bank-total-item">
        <span class="bank-total-label">Total ${cur}</span>
        <span class="bank-total-amount">${_fmt(totals[cur], cur)}</span>
      </div>
    `).join('');
    wrap.appendChild(totalsEl);
  }

  // Account list
  if (_data.accounts.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No accounts yet. Add one to get started.';
    wrap.appendChild(empty);
  } else {
    const grid = document.createElement('div');
    grid.className = 'bank-grid';

    for (const acct of _data.accounts) {
      const card = _buildCard(acct);
      grid.appendChild(card);
    }

    wrap.appendChild(grid);
  }

  _container.appendChild(wrap);
  _attachListeners();
}

function _buildCard(acct) {
  const card = document.createElement('div');
  card.className = 'card bank-card';
  card.dataset.id = acct.id;

  card.innerHTML = `
    <div class="bank-card-top">
      <div class="bank-card-meta">
        <span class="bank-card-name">${_esc(acct.name)}</span>
        <span class="bank-card-bank">${_esc(acct.bank)}</span>
      </div>
      <div class="bank-card-badges">
        <span class="chip">${_esc(_typeLabel(acct.type))}</span>
        <span class="chip chip-accent">${_esc(_currencyLabel(acct.currency))}</span>
      </div>
    </div>
    <div class="bank-card-balance">${_fmt(acct.balance ?? 0, acct.currency)}</div>
    <div class="bank-card-actions">
      <button class="btn btn-ghost btn-sm bank-edit-btn" data-id="${acct.id}">Edit</button>
      <button class="btn btn-danger btn-sm bank-delete-btn" data-id="${acct.id}">Delete</button>
    </div>
  `;

  return card;
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Listeners ────────────────────────────────────────────────────────────────

function _on(el, event, handler) {
  el.addEventListener(event, handler);
  _listeners.push({ el, event, handler });
}

function _removeListeners() {
  for (const { el, event, handler } of _listeners) {
    el.removeEventListener(event, handler);
  }
  _listeners = [];
}

function _attachListeners() {
  const addBtn = document.getElementById('bank-add-btn');
  if (addBtn) {
    _on(addBtn, 'click', () => _openModal(null));
  }

  const editBtns = _container.querySelectorAll('.bank-edit-btn');
  for (const btn of editBtns) {
    _on(btn, 'click', (e) => {
      const id = e.currentTarget.dataset.id;
      const acct = _data.accounts.find(a => a.id === id);
      if (acct) _openModal(acct);
    });
  }

  const deleteBtns = _container.querySelectorAll('.bank-delete-btn');
  for (const btn of deleteBtns) {
    _on(btn, 'click', (e) => {
      const id = e.currentTarget.dataset.id;
      _confirmDelete(id);
    });
  }
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function _openModal(acct) {
  _closeModal();

  const isEdit = !!acct;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'bank-modal-overlay';

  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-title">${isEdit ? 'Edit Account' : 'Add Account'}</div>

      <div class="form-group">
        <label class="form-label" for="bank-f-name">Account name</label>
        <input class="form-input" id="bank-f-name" type="text" placeholder="e.g. Main Checking" value="${_esc(acct?.name ?? '')}" />
      </div>

      <div class="form-group">
        <label class="form-label" for="bank-f-bank">Bank</label>
        <input class="form-input" id="bank-f-bank" type="text" placeholder="e.g. SMBC, BCA" value="${_esc(acct?.bank ?? '')}" />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="bank-f-currency">Currency</label>
          <select class="form-input" id="bank-f-currency">
            <option value="JPY" ${(acct?.currency ?? 'JPY') === 'JPY' ? 'selected' : ''}>JPY</option>
            <option value="IDR" ${acct?.currency === 'IDR' ? 'selected' : ''}>IDR</option>
            <option value="USD" ${acct?.currency === 'USD' ? 'selected' : ''}>USD</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="bank-f-type">Type</label>
          <select class="form-input" id="bank-f-type">
            <option value="checking" ${(acct?.type ?? 'checking') === 'checking' ? 'selected' : ''}>Checking</option>
            <option value="savings" ${acct?.type === 'savings' ? 'selected' : ''}>Savings</option>
            <option value="foreign" ${acct?.type === 'foreign' ? 'selected' : ''}>Foreign</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="bank-f-balance">Balance</label>
        <input class="form-input" id="bank-f-balance" type="number" step="1" min="0" placeholder="0" value="${acct?.balance ?? ''}" />
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" id="bank-modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="bank-modal-save">${isEdit ? 'Save changes' : 'Add account'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const cancelBtn = overlay.querySelector('#bank-modal-cancel');
  const saveBtn = overlay.querySelector('#bank-modal-save');

  const cancelHandler = () => _closeModal();
  const saveHandler = () => _submitModal(isEdit ? acct.id : null);
  const overlayClickHandler = (e) => { if (e.target === overlay) _closeModal(); };
  const keyHandler = (e) => { if (e.key === 'Escape') _closeModal(); };

  _on(cancelBtn, 'click', cancelHandler);
  _on(saveBtn, 'click', saveHandler);
  _on(overlay, 'click', overlayClickHandler);
  _on(document, 'keydown', keyHandler);

  overlay.querySelector('#bank-f-name').focus();
}

function _closeModal() {
  const overlay = document.getElementById('bank-modal-overlay');
  if (overlay) {
    // Remove listeners for this overlay specifically by re-rendering
    // (overlay will be garbage collected)
    overlay.remove();
  }
  const confirmOverlay = document.getElementById('bank-confirm-overlay');
  if (confirmOverlay) confirmOverlay.remove();
}

function _submitModal(editId) {
  const name     = document.getElementById('bank-f-name')?.value.trim();
  const bank     = document.getElementById('bank-f-bank')?.value.trim();
  const currency = document.getElementById('bank-f-currency')?.value;
  const type     = document.getElementById('bank-f-type')?.value;
  const balance  = parseFloat(document.getElementById('bank-f-balance')?.value) || 0;

  if (!name) {
    document.getElementById('bank-f-name').focus();
    return;
  }
  if (!bank) {
    document.getElementById('bank-f-bank').focus();
    return;
  }

  if (editId) {
    const acct = _data.accounts.find(a => a.id === editId);
    if (acct) {
      acct.name = name;
      acct.bank = bank;
      acct.currency = currency;
      acct.type = type;
      acct.balance = balance;
    }
  } else {
    _data.accounts.push({
      id: 'acct_' + Date.now(),
      name,
      bank,
      currency,
      type,
      balance,
    });
  }

  _closeModal();
  _save();
  _render();
}

// ─── Delete confirmation ──────────────────────────────────────────────────────

function _confirmDelete(id) {
  _closeModal();

  const acct = _data.accounts.find(a => a.id === id);
  if (!acct) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'bank-confirm-overlay';

  overlay.innerHTML = `
    <div class="modal modal-sm" role="dialog" aria-modal="true">
      <div class="modal-title">Delete account?</div>
      <p class="bank-confirm-text">
        "${_esc(acct.name)}" (${_esc(acct.bank)}) will be permanently removed.
      </p>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="bank-confirm-cancel">Cancel</button>
        <button class="btn btn-danger" id="bank-confirm-ok">Delete</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const cancelHandler = () => { overlay.remove(); };
  const confirmHandler = () => {
    _data.accounts = _data.accounts.filter(a => a.id !== id);
    overlay.remove();
    _save();
    _render();
  };
  const overlayClickHandler = (e) => { if (e.target === overlay) overlay.remove(); };
  const keyHandler = (e) => { if (e.key === 'Escape') overlay.remove(); };

  _on(overlay.querySelector('#bank-confirm-cancel'), 'click', cancelHandler);
  _on(overlay.querySelector('#bank-confirm-ok'), 'click', confirmHandler);
  _on(overlay, 'click', overlayClickHandler);
  _on(document, 'keydown', keyHandler);
}
