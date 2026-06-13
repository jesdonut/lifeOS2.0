// modules/budget/budget.js

let _container, _data, _onSave;
let _year, _month;
let _editingCat = null;

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

function spendCats() { return _data.settings?.spendCategories ?? []; }
function budgets()   { return _data.settings?.monthlyBudgets  ?? {}; }

function catSpent(catId) {
  const prefix  = `${_year}-${String(_month + 1).padStart(2, '0')}`;
  const entries = _data.calendar?.spendEntries ?? {};
  let total = 0;
  for (const [date, list] of Object.entries(entries)) {
    if (!date.startsWith(prefix)) continue;
    for (const e of (list ?? [])) {
      if (e.categoryId === catId) total += e.amount ?? 0;
    }
  }
  return Math.round(total);
}

function fmt(n) {
  return '¥' + Math.round(Math.abs(n)).toLocaleString();
}

function saveBudget(catId, amount) {
  const next = { ...budgets() };
  if (amount == null) delete next[catId];
  else next[catId] = amount;
  _onSave({ settings: { ..._data.settings, monthlyBudgets: next } });
}

// ── Module contract ────────────────────────────────────────────────

export function init(container, data, onSave) {
  _container = container;
  _data      = data;
  _onSave    = onSave;
  const now  = new Date();
  _year      = now.getFullYear();
  _month     = now.getMonth();
  _loadCss();
  render();
}

export function destroy() {
  _container.innerHTML = '';
  _editingCat = null;
}

export function onDataChange(newData) {
  _data = newData;
  render();
}

function _loadCss() {
  const href = new URL('./budget.css', import.meta.url).href;
  if (!document.querySelector(`link[href="${href}"]`)) {
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
}

// ── Render ─────────────────────────────────────────────────────────

function render() {
  _container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'bud-wrap';

  wrap.appendChild(renderHeader());

  const cats       = spendCats();
  const bud        = budgets();
  const budgeted   = cats.filter(c => bud[c.id] != null);
  const unbudgeted = cats.filter(c => bud[c.id] == null);

  if (budgeted.length === 0 && unbudgeted.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'bud-empty';
    empty.textContent = 'No spend categories set up yet. Add them in Settings.';
    wrap.appendChild(empty);
  } else {
    if (budgeted.length > 0) {
      wrap.appendChild(renderBudgetedSection(budgeted, bud));
    }
    if (unbudgeted.length > 0) {
      wrap.appendChild(renderUnbudgetedSection(unbudgeted));
    }
  }

  _container.appendChild(wrap);
}

function renderHeader() {
  const hdr = document.createElement('div');
  hdr.className = 'bud-hdr';

  const prev = document.createElement('button');
  prev.className  = 'bud-nav-btn';
  prev.textContent = '‹';
  prev.addEventListener('click', () => {
    _month--;
    if (_month < 0) { _month = 11; _year--; }
    render();
  });

  const label = document.createElement('span');
  label.className   = 'bud-month-label';
  label.textContent = `${MONTHS[_month]} ${_year}`;

  const next = document.createElement('button');
  next.className  = 'bud-nav-btn';
  next.textContent = '›';
  next.addEventListener('click', () => {
    _month++;
    if (_month > 11) { _month = 0; _year++; }
    render();
  });

  hdr.append(prev, label, next);
  return hdr;
}

function renderBudgetedSection(cats, bud) {
  const section = document.createElement('div');
  section.className = 'bud-section';

  let totalBudget = 0;
  let totalSpent  = 0;

  cats.forEach(cat => {
    const target = bud[cat.id];
    const spent  = catSpent(cat.id);
    totalBudget += target;
    totalSpent  += spent;
    section.appendChild(makeCatRow(cat, target, spent));
  });

  // Totals row
  const totalRow   = document.createElement('div');
  totalRow.className = 'bud-total-row';

  const totalLabel = document.createElement('span');
  totalLabel.className   = 'bud-total-label';
  totalLabel.textContent = 'Total';

  const totalAmt = document.createElement('span');
  totalAmt.className   = 'bud-total-amt';
  totalAmt.textContent = `${fmt(totalSpent)} / ${fmt(totalBudget)}`;

  const remaining = totalBudget - totalSpent;
  const totalRem  = document.createElement('span');
  totalRem.className = 'bud-total-rem' + (remaining < 0 ? ' over' : '');
  totalRem.textContent = remaining < 0
    ? `${fmt(remaining)} over`
    : `${fmt(remaining)} left`;

  totalRow.append(totalLabel, totalAmt, totalRem);
  section.appendChild(totalRow);

  return section;
}

function renderUnbudgetedSection(cats) {
  const wrap = document.createElement('div');
  wrap.className = 'bud-unbud-wrap';

  const label = document.createElement('div');
  label.className   = 'bud-unbud-label';
  label.textContent = 'No budget set';
  wrap.appendChild(label);

  cats.forEach(cat => {
    if (_editingCat === cat.id) {
      wrap.appendChild(makeEditRow(cat, null));
      return;
    }

    const row = document.createElement('div');
    row.className = 'bud-unbud-row';

    const dot = document.createElement('span');
    dot.className = 'bud-dot';
    dot.style.background = cat.color ?? `var(--cat-${cat.id})`;

    const name = document.createElement('span');
    name.className   = 'bud-unbud-name';
    name.textContent = cat.name;

    const spent = catSpent(cat.id);
    const spentEl = document.createElement('span');
    spentEl.className   = 'bud-unbud-spent';
    spentEl.textContent = spent > 0 ? fmt(spent) : '';

    const setBtn = document.createElement('button');
    setBtn.className   = 'bud-set-btn';
    setBtn.textContent = '+ set budget';
    setBtn.addEventListener('click', () => { _editingCat = cat.id; render(); });

    row.append(dot, name, spentEl, setBtn);
    wrap.appendChild(row);
  });

  return wrap;
}

// ── Row builders ───────────────────────────────────────────────────

function makeCatRow(cat, target, spent) {
  if (_editingCat === cat.id) return makeEditRow(cat, target);

  const row = document.createElement('div');
  row.className = 'bud-cat-row';

  const pct  = target > 0 ? Math.min(spent / target, 1) : 0;
  const rem  = target - spent;
  const over = rem < 0;
  const barColor = pct >= 1 ? 'var(--red)' : pct >= 0.8 ? 'var(--amber)' : (cat.color ?? `var(--cat-${cat.id})`);

  // Top line
  const top = document.createElement('div');
  top.className = 'bud-cat-top';

  const dot = document.createElement('span');
  dot.className = 'bud-dot';
  dot.style.background = cat.color ?? `var(--cat-${cat.id})`;

  const name = document.createElement('span');
  name.className   = 'bud-cat-name';
  name.textContent = cat.name;

  const amts = document.createElement('span');
  amts.className   = 'bud-cat-amts';
  amts.textContent = `${fmt(spent)} / ${fmt(target)}`;

  const remEl = document.createElement('span');
  remEl.className   = 'bud-cat-rem' + (over ? ' over' : '');
  remEl.textContent = over ? `${fmt(rem)} over` : `${fmt(rem)} left`;

  const editBtn = document.createElement('button');
  editBtn.className   = 'bud-edit-btn';
  editBtn.textContent = 'edit';
  editBtn.addEventListener('click', () => { _editingCat = cat.id; render(); });

  top.append(dot, name, amts, remEl, editBtn);

  // Progress bar
  const barWrap = document.createElement('div');
  barWrap.className = 'bud-bar-wrap';

  const fill = document.createElement('div');
  fill.className        = 'bud-bar-fill';
  fill.style.width      = `${pct * 100}%`;
  fill.style.background = barColor;

  barWrap.appendChild(fill);
  row.append(top, barWrap);
  return row;
}

function makeEditRow(cat, currentTarget) {
  const row = document.createElement('div');
  row.className = 'bud-cat-row editing';

  const top = document.createElement('div');
  top.className = 'bud-edit-top';

  const dot = document.createElement('span');
  dot.className = 'bud-dot';
  dot.style.background = cat.color ?? `var(--cat-${cat.id})`;

  const name = document.createElement('span');
  name.className   = 'bud-cat-name';
  name.textContent = cat.name;

  top.append(dot, name);

  const controls = document.createElement('div');
  controls.className = 'bud-edit-controls';

  const input = document.createElement('input');
  input.className   = 'bud-input';
  input.type        = 'number';
  input.min         = '0';
  input.placeholder = '0';
  if (currentTarget != null) input.value = currentTarget;

  const freq = document.createElement('select');
  freq.className = 'bud-freq-sel';
  [['monthly', 'Monthly (¥)'], ['daily', 'Daily (¥)'], ['yearly', 'Yearly (¥)']].forEach(([val, lbl]) => {
    const opt = document.createElement('option');
    opt.value = val; opt.textContent = lbl;
    freq.appendChild(opt);
  });

  const toMonthly = () => {
    const val = parseFloat(input.value);
    if (isNaN(val) || val < 0) return null;
    if (freq.value === 'daily')  return Math.round(val * 30);
    if (freq.value === 'yearly') return Math.round(val / 12);
    return Math.round(val);
  };

  const saveBtn = document.createElement('button');
  saveBtn.className   = 'bud-save-btn';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => {
    const val = toMonthly();
    if (val != null) saveBudget(cat.id, val);
    _editingCat = null;
    render();
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.className   = 'bud-cancel-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => { _editingCat = null; render(); });

  const actions = document.createElement('div');
  actions.className = 'bud-edit-actions';
  actions.append(saveBtn, cancelBtn);

  if (currentTarget != null) {
    const removeBtn = document.createElement('button');
    removeBtn.className   = 'bud-remove-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => { saveBudget(cat.id, null); _editingCat = null; render(); });
    actions.appendChild(removeBtn);
  }

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  saveBtn.click();
    if (e.key === 'Escape') cancelBtn.click();
  });

  controls.append(input, freq, actions);
  row.append(top, controls);
  requestAnimationFrame(() => input.focus());
  return row;
}
