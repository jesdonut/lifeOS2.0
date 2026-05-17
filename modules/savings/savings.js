// savings.js — Accounts, Bonds, Deposits module

// ── State ──────────────────────────────────────────────────────────────────

let _container = null;
let _data = null;
let _onSave = null;
let _activeTab = 'accounts';
let _listeners = [];     // [{ el, type, fn }] for cleanup

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

function getSavings() {
  return _data.savings ?? { accounts: [], bonds: [], deposits: [] };
}

function save(savings) {
  _data = { ..._data, savings };
  _onSave({ savings });
}

function fmtCurrency(amount, currency) {
  if (currency === 'IDR') {
    return 'Rp ' + Number(amount).toLocaleString();
  }
  return '¥' + Number(amount).toLocaleString();
}

function fmtPct(rate) {
  return (Number(rate) * 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }) + '%';
}

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${y}/${m}/${d}`;
}

function daysUntil(isoDate) {
  if (!isoDate) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(isoDate);
  const tgt = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((tgt - today) / 86400000);
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') node.className = v;
    else if (k === 'textContent') node.textContent = v;
    else if (k === 'innerHTML') node.innerHTML = v;
    else node.setAttribute(k, v);
  }
  for (const child of children) {
    if (child == null) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

// ── Modal helpers ──────────────────────────────────────────────────────────

function showModal(title, bodyHTML, onConfirm) {
  const overlay = el('div', { className: 'modal-overlay' });

  const modal = el('div', { className: 'modal' });

  const titleEl = el('h2', { className: 'modal-title', textContent: title });

  const body = el('div', { className: 'modal-body' });
  body.innerHTML = bodyHTML;

  const footer = el('div', { className: 'modal-footer' });
  const cancelBtn = el('button', { className: 'btn btn-ghost', textContent: 'Cancel' });
  const saveBtn = el('button', { className: 'btn btn-primary', textContent: 'Save' });

  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);
  modal.appendChild(titleEl);
  modal.appendChild(body);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function close() {
    document.body.removeChild(overlay);
  }

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  saveBtn.addEventListener('click', () => {
    const result = onConfirm(body);
    if (result !== false) close();
  });

  // Focus first input
  const firstInput = body.querySelector('input, select, textarea');
  if (firstInput) setTimeout(() => firstInput.focus(), 50);

  return { overlay, body, close };
}

function confirmDialog(message, onConfirm) {
  const overlay = el('div', { className: 'modal-overlay' });
  const modal = el('div', { className: 'modal' });
  const msg = el('p', { textContent: message, style: 'line-height:1.6' });
  const footer = el('div', { className: 'modal-footer' });
  const cancelBtn = el('button', { className: 'btn btn-ghost', textContent: 'Cancel' });
  const delBtn = el('button', { className: 'btn btn-danger', textContent: 'Delete' });

  footer.appendChild(cancelBtn);
  footer.appendChild(delBtn);
  modal.appendChild(msg);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function close() { document.body.removeChild(overlay); }
  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  delBtn.addEventListener('click', () => { close(); onConfirm(); });
}

// ── Form field builders ────────────────────────────────────────────────────

function inputField(name, label, type = 'text', value = '', placeholder = '') {
  return `
    <div class="form-group">
      <label class="form-label" for="sf-${name}">${label}</label>
      <input class="form-input" id="sf-${name}" name="${name}" type="${type}"
             value="${escAttr(String(value))}" placeholder="${escAttr(placeholder)}" />
    </div>`;
}

function selectField(name, label, options, selected = '') {
  const opts = options.map(([v, t]) =>
    `<option value="${escAttr(v)}"${v === selected ? ' selected' : ''}>${t}</option>`
  ).join('');
  return `
    <div class="form-group">
      <label class="form-label" for="sf-${name}">${label}</label>
      <select class="form-input" id="sf-${name}" name="${name}">${opts}</select>
    </div>`;
}

function textareaField(name, label, value = '') {
  return `
    <div class="form-group">
      <label class="form-label" for="sf-${name}">${label}</label>
      <textarea class="form-input" id="sf-${name}" name="${name}"
                rows="2" style="resize:vertical">${escAttr(value)}</textarea>
    </div>`;
}

function escAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function getField(body, name) {
  return body.querySelector(`[name="${name}"]`)?.value?.trim() ?? '';
}

// ── Tab switching ──────────────────────────────────────────────────────────

function switchTab(tabName) {
  _activeTab = tabName;

  const tabs = _container.querySelectorAll('.savings-tab');
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));

  const panes = _container.querySelectorAll('.savings-pane');
  panes.forEach(p => p.classList.toggle('active', p.dataset.pane === tabName));
}

// ── ACCOUNTS ──────────────────────────────────────────────────────────────

function renderAccounts(pane) {
  const savings = getSavings();
  const accounts = savings.accounts ?? [];

  pane.innerHTML = '';

  const header = el('div', { className: 'section-header' });
  const titleEl = el('h2', { className: 'section-title', textContent: 'Accounts' });
  const addBtn = el('button', { className: 'btn btn-primary', textContent: '+ Add account' });

  header.appendChild(titleEl);
  header.appendChild(addBtn);
  pane.appendChild(header);

  on(addBtn, 'click', () => openAccountModal());

  if (accounts.length === 0) {
    pane.appendChild(el('div', { className: 'empty-state', textContent: 'No accounts yet.' }));
    return;
  }

  const grid = el('div', { className: 'accounts-grid' });

  for (const acct of accounts) {
    const card = el('div', { className: 'account-card' });

    const cardHeader = el('div', { className: 'account-card-header' });
    const nameWrap = el('div');
    nameWrap.appendChild(el('div', { className: 'account-name', textContent: acct.name }));
    nameWrap.appendChild(el('div', { className: 'account-bank', textContent: acct.bank }));

    const actions = el('div', { className: 'account-actions' });
    const editBtn = el('button', { className: 'btn btn-icon', title: 'Edit', textContent: '✏' });
    const delBtn = el('button', { className: 'btn btn-icon', title: 'Delete', textContent: '✕' });
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    cardHeader.appendChild(nameWrap);
    cardHeader.appendChild(actions);
    card.appendChild(cardHeader);

    const balance = el('div', {
      className: 'account-balance',
      textContent: fmtCurrency(acct.balance, acct.currency),
    });
    card.appendChild(balance);

    const meta = el('div', { className: 'account-meta' });
    const currencyChip = el('span', {
      className: 'chip chip-accent',
      textContent: acct.currency,
    });
    const rate = el('span', {
      className: 'account-rate',
      textContent: fmtPct(acct.interestRate ?? 0) + ' p.a.',
    });
    meta.appendChild(currencyChip);
    meta.appendChild(rate);
    card.appendChild(meta);

    if (acct.notes) {
      card.appendChild(el('div', { className: 'account-notes', textContent: acct.notes }));
    }

    on(editBtn, 'click', () => openAccountModal(acct));
    on(delBtn, 'click', () => {
      confirmDialog(`Delete "${acct.name}"? This cannot be undone.`, () => {
        const s = getSavings();
        const updated = { ...s, accounts: s.accounts.filter(a => a.id !== acct.id) };
        save(updated);
        renderAccounts(pane);
      });
    });

    grid.appendChild(card);
  }

  pane.appendChild(grid);
}

function openAccountModal(existing = null) {
  const title = existing ? 'Edit Account' : 'Add Account';
  const a = existing ?? {};

  const bodyHTML = `
    <div style="display:flex;flex-direction:column;gap:var(--space-3)">
      ${inputField('name', 'Name', 'text', a.name ?? '', 'e.g. Sony Bank')}
      ${inputField('bank', 'Bank', 'text', a.bank ?? '', 'e.g. Sony Bank')}
      ${selectField('currency', 'Currency', [['JPY', 'JPY — Japanese Yen'], ['IDR', 'IDR — Indonesian Rupiah']], a.currency ?? 'JPY')}
      ${inputField('balance', 'Balance', 'number', a.balance ?? '', '0')}
      ${inputField('interestRate', 'Interest Rate (e.g. 0.002 = 0.2%)', 'number', a.interestRate ?? '', '0.001')}
      ${textareaField('notes', 'Notes (optional)', a.notes ?? '')}
    </div>`;

  showModal(title, bodyHTML, (body) => {
    const name = getField(body, 'name');
    if (!name) { alert('Name is required.'); return false; }
    const balance = parseFloat(getField(body, 'balance')) || 0;
    const interestRate = parseFloat(getField(body, 'interestRate')) || 0;

    const record = {
      id: existing?.id ?? 'acct_' + Date.now(),
      name,
      bank: getField(body, 'bank'),
      currency: getField(body, 'currency') || 'JPY',
      balance,
      interestRate,
      notes: getField(body, 'notes'),
    };

    const s = getSavings();
    let accounts;
    if (existing) {
      accounts = s.accounts.map(a => a.id === record.id ? record : a);
    } else {
      accounts = [...(s.accounts ?? []), record];
    }

    save({ ...s, accounts });
    renderAccounts(_container.querySelector('[data-pane="accounts"]'));
  });
}

// ── BONDS ─────────────────────────────────────────────────────────────────

const BOND_SERIES = [
  'ORI-026', 'ORI-025', 'ORI-024', 'ORI-023',
  'SR-022', 'SR-021', 'SR-020', 'SR-019',
  'SBR-014', 'SBR-013', 'SBR-012',
  'ST-013', 'ST-012', 'ST-011',
  'PBS', 'Other',
];

function renderBonds(pane) {
  const savings = getSavings();
  const bonds = savings.bonds ?? [];

  pane.innerHTML = '';

  const header = el('div', { className: 'section-header' });
  header.appendChild(el('h2', { className: 'section-title', textContent: 'Government Bonds' }));
  const addBtn = el('button', { className: 'btn btn-primary', textContent: '+ Add bond' });
  header.appendChild(addBtn);
  pane.appendChild(header);

  on(addBtn, 'click', () => openBondModal());

  if (bonds.length === 0) {
    pane.appendChild(el('div', { className: 'empty-state', textContent: 'No bonds yet.' }));
    return;
  }

  const wrap = el('div', { className: 'savings-table-wrap' });
  const table = el('table', { className: 'data-table' });

  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Series</th>
      <th>Name</th>
      <th style="text-align:right">Amount (Rp)</th>
      <th style="text-align:right">Coupon</th>
      <th>Issue</th>
      <th>Maturity</th>
      <th>Status</th>
      <th></th>
    </tr>`;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const bond of bonds) {
    const tr = document.createElement('tr');
    if (bond.matured) tr.className = 'savings-row-matured';

    const statusChip = bond.matured
      ? `<span class="chip chip-accent">Matured</span>`
      : `<span class="chip chip-positive">Active</span>`;

    let actions = '';
    if (!bond.matured) {
      actions += `<button class="btn btn-ghost js-mature" data-id="${bond.id}" style="font-size:var(--text-sm)">Mark matured</button> `;
      actions += `<button class="btn btn-icon js-bond-delete" data-id="${bond.id}" title="Delete">✕</button>`;
    }

    tr.innerHTML = `
      <td><span class="chip">${escAttr(bond.series)}</span></td>
      <td>${escAttr(bond.name)}</td>
      <td style="text-align:right">Rp ${Number(bond.amount).toLocaleString()}</td>
      <td style="text-align:right">${fmtPct(bond.couponRate)}</td>
      <td>${fmtDate(bond.issueDate)}</td>
      <td>${fmtDate(bond.maturityDate)}</td>
      <td>${statusChip}</td>
      <td style="white-space:nowrap">${actions}</td>`;

    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  pane.appendChild(wrap);

  // Wire up table-level delegation
  on(tbody, 'click', (e) => {
    const matureBtn = e.target.closest('.js-mature');
    if (matureBtn) {
      const id = matureBtn.dataset.id;
      markBondMatured(id);
      return;
    }
    const delBtn = e.target.closest('.js-bond-delete');
    if (delBtn) {
      const id = delBtn.dataset.id;
      const bond = (getSavings().bonds ?? []).find(b => b.id === id);
      if (!bond) return;
      confirmDialog(`Delete "${bond.name}"? This cannot be undone.`, () => {
        const s = getSavings();
        save({ ...s, bonds: s.bonds.filter(b => b.id !== id) });
        renderBonds(pane);
      });
    }
  });
}

function markBondMatured(id) {
  const s = getSavings();
  const bond = (s.bonds ?? []).find(b => b.id === id);
  if (!bond || bond.matured) return;

  // Confirm before irreversible action
  const overlay = el('div', { className: 'modal-overlay' });
  const modal = el('div', { className: 'modal' });
  const msg = el('p', {
    textContent: `Mark "${bond.name}" as matured? This cannot be undone.`,
    style: 'line-height:1.6',
  });
  const footer = el('div', { className: 'modal-footer' });
  const cancelBtn = el('button', { className: 'btn btn-ghost', textContent: 'Cancel' });
  const confirmBtn = el('button', { className: 'btn btn-primary', textContent: 'Mark matured' });

  footer.appendChild(cancelBtn);
  footer.appendChild(confirmBtn);
  modal.appendChild(msg);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function close() { document.body.removeChild(overlay); }
  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  confirmBtn.addEventListener('click', () => {
    close();
    const updated = {
      ...s,
      bonds: s.bonds.map(b => b.id === id ? { ...b, matured: true } : b),
    };
    save(updated);
    renderBonds(_container.querySelector('[data-pane="bonds"]'));
  });
}

function openBondModal(existing = null) {
  const title = existing ? 'Edit Bond' : 'Add Bond';
  const b = existing ?? {};

  const seriesOptions = BOND_SERIES.map(s => [s, s]);

  const bodyHTML = `
    <div style="display:flex;flex-direction:column;gap:var(--space-3)">
      ${selectField('series', 'Series', seriesOptions, b.series ?? 'ORI-026')}
      ${inputField('name', 'Name / Label', 'text', b.name ?? '', 'e.g. ORI-026 Tranche 1')}
      ${inputField('amount', 'Amount (Rp)', 'number', b.amount ?? '', '1000000')}
      ${inputField('couponRate', 'Coupon Rate (e.g. 0.065 = 6.5%)', 'number', b.couponRate ?? '', '0.065')}
      ${inputField('issueDate', 'Issue Date', 'date', b.issueDate ?? '')}
      ${inputField('maturityDate', 'Maturity Date', 'date', b.maturityDate ?? '')}
      ${textareaField('notes', 'Notes (optional)', b.notes ?? '')}
    </div>`;

  showModal(title, bodyHTML, (body) => {
    const name = getField(body, 'name');
    if (!name) { alert('Name is required.'); return false; }
    const amount = parseFloat(getField(body, 'amount')) || 0;
    const couponRate = parseFloat(getField(body, 'couponRate')) || 0;

    const record = {
      id: existing?.id ?? 'bond_' + Date.now(),
      name,
      series: getField(body, 'series') || 'ORI-026',
      amount,
      couponRate,
      issueDate: getField(body, 'issueDate'),
      maturityDate: getField(body, 'maturityDate'),
      // matured is one-way: preserve existing true, default false
      matured: existing?.matured === true ? true : false,
      notes: getField(body, 'notes'),
    };

    const s = getSavings();
    let bonds;
    if (existing) {
      bonds = s.bonds.map(b => b.id === record.id ? record : b);
    } else {
      bonds = [...(s.bonds ?? []), record];
    }

    save({ ...s, bonds });
    renderBonds(_container.querySelector('[data-pane="bonds"]'));
  });
}

// ── DEPOSITS ───────────────────────────────────────────────────────────────

function renderDeposits(pane) {
  const savings = getSavings();
  const deposits = savings.deposits ?? [];

  pane.innerHTML = '';

  const header = el('div', { className: 'section-header' });
  header.appendChild(el('h2', { className: 'section-title', textContent: 'Time Deposits' }));
  const addBtn = el('button', { className: 'btn btn-primary', textContent: '+ Add deposit' });
  header.appendChild(addBtn);
  pane.appendChild(header);

  on(addBtn, 'click', () => openDepositModal());

  if (deposits.length === 0) {
    pane.appendChild(el('div', { className: 'empty-state', textContent: 'No deposits yet.' }));
    return;
  }

  const wrap = el('div', { className: 'savings-table-wrap' });
  const table = el('table', { className: 'data-table' });

  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Name</th>
      <th>Bank</th>
      <th>Currency</th>
      <th style="text-align:right">Amount</th>
      <th style="text-align:right">Rate</th>
      <th>Start</th>
      <th>Maturity</th>
      <th>Status</th>
      <th></th>
    </tr>`;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const dep of deposits) {
    const tr = document.createElement('tr');
    if (dep.matured) tr.className = 'savings-row-matured';

    const statusChip = dep.matured
      ? `<span class="chip chip-accent">Matured</span>`
      : `<span class="chip chip-positive">Active</span>`;

    let daysCell = '';
    if (!dep.matured && dep.maturityDate) {
      const d = daysUntil(dep.maturityDate);
      if (d !== null) {
        const cls = d <= 30 ? 'days-badge soon' : 'days-badge';
        if (d < 0) {
          daysCell = `<span class="${cls}">(${Math.abs(d)}d overdue)</span>`;
        } else if (d === 0) {
          daysCell = `<span class="days-badge soon">(today)</span>`;
        } else {
          daysCell = `<span class="${cls}">(${d}d)</span>`;
        }
      }
    }

    let actions = '';
    if (!dep.matured) {
      actions += `<button class="btn btn-ghost js-dep-mature" data-id="${dep.id}" style="font-size:var(--text-sm)">Mark matured</button> `;
      actions += `<button class="btn btn-icon js-dep-delete" data-id="${dep.id}" title="Delete">✕</button>`;
    }

    tr.innerHTML = `
      <td>${escAttr(dep.name)}</td>
      <td>${escAttr(dep.bank)}</td>
      <td><span class="chip chip-accent">${escAttr(dep.currency)}</span></td>
      <td style="text-align:right">${fmtCurrency(dep.amount, dep.currency)}</td>
      <td style="text-align:right">${fmtPct(dep.interestRate)}</td>
      <td>${fmtDate(dep.startDate)}</td>
      <td>${fmtDate(dep.maturityDate)} ${daysCell}</td>
      <td>${statusChip}</td>
      <td style="white-space:nowrap">${actions}</td>`;

    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  pane.appendChild(wrap);

  on(tbody, 'click', (e) => {
    const matureBtn = e.target.closest('.js-dep-mature');
    if (matureBtn) {
      markDepositMatured(matureBtn.dataset.id);
      return;
    }
    const delBtn = e.target.closest('.js-dep-delete');
    if (delBtn) {
      const id = delBtn.dataset.id;
      const dep = (getSavings().deposits ?? []).find(d => d.id === id);
      if (!dep) return;
      confirmDialog(`Delete "${dep.name}"? This cannot be undone.`, () => {
        const s = getSavings();
        save({ ...s, deposits: s.deposits.filter(d => d.id !== id) });
        renderDeposits(pane);
      });
    }
  });
}

function markDepositMatured(id) {
  const s = getSavings();
  const dep = (s.deposits ?? []).find(d => d.id === id);
  if (!dep || dep.matured) return;

  const overlay = el('div', { className: 'modal-overlay' });
  const modal = el('div', { className: 'modal' });
  const msg = el('p', {
    textContent: `Mark "${dep.name}" as matured? This cannot be undone.`,
    style: 'line-height:1.6',
  });
  const footer = el('div', { className: 'modal-footer' });
  const cancelBtn = el('button', { className: 'btn btn-ghost', textContent: 'Cancel' });
  const confirmBtn = el('button', { className: 'btn btn-primary', textContent: 'Mark matured' });

  footer.appendChild(cancelBtn);
  footer.appendChild(confirmBtn);
  modal.appendChild(msg);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function close() { document.body.removeChild(overlay); }
  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  confirmBtn.addEventListener('click', () => {
    close();
    const updated = {
      ...s,
      deposits: s.deposits.map(d => d.id === id ? { ...d, matured: true } : d),
    };
    save(updated);
    renderDeposits(_container.querySelector('[data-pane="deposits"]'));
  });
}

function openDepositModal(existing = null) {
  const title = existing ? 'Edit Deposit' : 'Add Deposit';
  const d = existing ?? {};

  const bodyHTML = `
    <div style="display:flex;flex-direction:column;gap:var(--space-3)">
      ${inputField('name', 'Name / Label', 'text', d.name ?? '', 'e.g. BCA 6-month deposit')}
      ${inputField('bank', 'Bank', 'text', d.bank ?? '', 'e.g. BCA')}
      ${selectField('currency', 'Currency', [['JPY', 'JPY — Japanese Yen'], ['IDR', 'IDR — Indonesian Rupiah']], d.currency ?? 'IDR')}
      ${inputField('amount', 'Amount', 'number', d.amount ?? '', '10000000')}
      ${inputField('interestRate', 'Interest Rate (e.g. 0.045 = 4.5%)', 'number', d.interestRate ?? '', '0.045')}
      ${inputField('startDate', 'Start Date', 'date', d.startDate ?? '')}
      ${inputField('maturityDate', 'Maturity Date', 'date', d.maturityDate ?? '')}
      ${textareaField('notes', 'Notes (optional)', d.notes ?? '')}
    </div>`;

  showModal(title, bodyHTML, (body) => {
    const name = getField(body, 'name');
    if (!name) { alert('Name is required.'); return false; }
    const amount = parseFloat(getField(body, 'amount')) || 0;
    const interestRate = parseFloat(getField(body, 'interestRate')) || 0;

    const record = {
      id: existing?.id ?? 'dep_' + Date.now(),
      name,
      bank: getField(body, 'bank'),
      currency: getField(body, 'currency') || 'IDR',
      amount,
      interestRate,
      startDate: getField(body, 'startDate'),
      maturityDate: getField(body, 'maturityDate'),
      // matured is one-way: never allow reverting to false
      matured: existing?.matured === true ? true : false,
      notes: getField(body, 'notes'),
    };

    const s = getSavings();
    let deposits;
    if (existing) {
      deposits = s.deposits.map(dep => dep.id === record.id ? record : dep);
    } else {
      deposits = [...(s.deposits ?? []), record];
    }

    save({ ...s, deposits });
    renderDeposits(_container.querySelector('[data-pane="deposits"]'));
  });
}

// ── Shell render ───────────────────────────────────────────────────────────

function renderShell() {
  _container.innerHTML = '';
  _container.className = 'savings-panel';

  // Tab bar
  const tabBar = el('div', { className: 'savings-tabs' });
  const tabs = [
    { key: 'accounts', label: 'Accounts' },
    { key: 'bonds', label: 'Bonds' },
    { key: 'deposits', label: 'Deposits' },
  ];

  for (const { key, label } of tabs) {
    const btn = el('button', {
      className: 'savings-tab' + (key === _activeTab ? ' active' : ''),
      textContent: label,
    });
    btn.dataset.tab = key;
    on(btn, 'click', () => switchTab(key));
    tabBar.appendChild(btn);
  }

  _container.appendChild(tabBar);

  // Panes
  for (const { key } of tabs) {
    const pane = el('div', { className: 'savings-pane' + (key === _activeTab ? ' active' : '') });
    pane.dataset.pane = key;
    _container.appendChild(pane);
  }

  // Render each pane's content
  renderAccounts(_container.querySelector('[data-pane="accounts"]'));
  renderBonds(_container.querySelector('[data-pane="bonds"]'));
  renderDeposits(_container.querySelector('[data-pane="deposits"]'));
}

// ── Module contract ────────────────────────────────────────────────────────

export function init(container, data, onSave) {
  _container = container;
  _data = data;
  _onSave = onSave;
  _activeTab = 'accounts';
  _listeners = [];

  // Inject CSS
  if (!document.getElementById('savings-css')) {
    const link = document.createElement('link');
    link.id = 'savings-css';
    link.rel = 'stylesheet';
    link.href = 'modules/savings/savings.css';
    document.head.appendChild(link);
  }

  renderShell();
}

export function destroy() {
  removeAllListeners();

  const link = document.getElementById('savings-css');
  if (link) link.remove();

  if (_container) _container.innerHTML = '';

  _container = null;
  _data = null;
  _onSave = null;
}

export function onDataChange(newData) {
  if (!_container) return;
  _data = newData;

  // Re-render the currently visible pane only to avoid unnecessary redraws
  const accountsPane = _container.querySelector('[data-pane="accounts"]');
  const bondsPane = _container.querySelector('[data-pane="bonds"]');
  const depositsPane = _container.querySelector('[data-pane="deposits"]');

  if (accountsPane) renderAccounts(accountsPane);
  if (bondsPane) renderBonds(bondsPane);
  if (depositsPane) renderDeposits(depositsPane);
}
