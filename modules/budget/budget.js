// modules/budget/budget.js — sub-view inside Finance

let _container, _data, _onSave;
let _year, _month;
let _editingCat  = null;
let _openProj    = {};   // { [projId]: true }
let _addingEntry = null; // { projId, type: 'expense'|'income' } | null
let _addingProj  = false;

function spendCats()  { return _data.settings?.spendCategories ?? []; }
function budgets()    { return _data.settings?.monthlyBudgets  ?? {}; }
function projects()   { return _data.projects?.list ?? []; }

function uid() { return Math.random().toString(36).slice(2, 9); }

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

function fmt(n) { return '¥' + Math.round(Math.abs(n)).toLocaleString(); }

function saveBudget(catId, amount) {
  const next = { ...budgets() };
  if (amount == null) delete next[catId];
  else next[catId] = amount;
  _onSave({ settings: { ..._data.settings, monthlyBudgets: next } });
}

function saveProjects(list) {
  _data = { ..._data, projects: { list } };
  _onSave({ projects: { list } });
}

// ── Sub-view contract ──────────────────────────────────────────────

export function mount(container, data, onSave, year, month) {
  _container   = container;
  _data        = data;
  _onSave      = onSave;
  _year        = year;
  _month       = month;
  _editingCat  = null;
  _addingEntry = null;
  _addingProj  = false;
  _loadCss();
  render();
}

export function unmount() {
  if (_container) _container.innerHTML = '';
  _container = null;
}

export function update(data) {
  _data = data;
  if (_container) render();
}

function _loadCss() {
  const href = new URL('./budget.css', import.meta.url).href;
  if (!document.querySelector(`link[href="${href}"]`)) {
    document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'stylesheet', href }));
  }
}

// ── Render ─────────────────────────────────────────────────────────

function render() {
  _container.innerHTML = '';

  const layout = document.createElement('div');
  layout.className = 'bud-layout';

  // Left: budget
  const left = document.createElement('div');
  left.className = 'bud-left';
  left.appendChild(renderBudget());

  // Right: projects
  const right = document.createElement('div');
  right.className = 'bud-right';
  right.appendChild(renderProjects());

  layout.append(left, right);
  _container.appendChild(layout);
}

// ── Budget (left) ──────────────────────────────────────────────────

function renderBudget() {
  const wrap = document.createElement('div');
  wrap.className = 'bud-wrap';

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
    if (budgeted.length > 0) wrap.appendChild(renderBudgetedSection(budgeted, bud));
    if (unbudgeted.length > 0) wrap.appendChild(renderUnbudgetedSection(unbudgeted));
  }

  return wrap;
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

  const totalRow = document.createElement('div');
  totalRow.className = 'bud-total-row';

  const totalLabel = document.createElement('span');
  totalLabel.className   = 'bud-total-label';
  totalLabel.textContent = 'Total';

  const totalAmt = document.createElement('span');
  totalAmt.className   = 'bud-total-amt';
  totalAmt.textContent = `${fmt(totalSpent)} / ${fmt(totalBudget)}`;

  const remaining = totalBudget - totalSpent;
  const totalRem  = document.createElement('span');
  totalRem.className   = 'bud-total-rem' + (remaining < 0 ? ' over' : '');
  totalRem.textContent = remaining < 0 ? `${fmt(remaining)} over` : `${fmt(remaining)} left`;

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
    if (_editingCat === cat.id) { wrap.appendChild(makeEditRow(cat, null)); return; }

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

function makeCatRow(cat, target, spent) {
  if (_editingCat === cat.id) return makeEditRow(cat, target);

  const row = document.createElement('div');
  row.className = 'bud-cat-row';

  const pct      = target > 0 ? Math.min(spent / target, 1) : 0;
  const rem      = target - spent;
  const over     = rem < 0;
  const barColor = pct >= 1 ? 'var(--red)' : pct >= 0.8 ? 'var(--amber)' : (cat.color ?? `var(--cat-${cat.id})`);

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

// ── Projects (right) ───────────────────────────────────────────────

function renderProjects() {
  const wrap = document.createElement('div');
  wrap.className = 'proj-wrap';

  const hdr = document.createElement('div');
  hdr.className = 'proj-hdr';
  const title = document.createElement('span');
  title.className   = 'proj-title';
  title.textContent = 'Projects';
  const newBtn = document.createElement('button');
  newBtn.className   = 'proj-new-btn';
  newBtn.textContent = '+ New';
  newBtn.addEventListener('click', () => { _addingProj = true; render(); });
  hdr.append(title, newBtn);
  wrap.appendChild(hdr);

  if (_addingProj) wrap.appendChild(renderNewProjForm());

  const list = projects();
  if (!list.length && !_addingProj) {
    const empty = document.createElement('div');
    empty.className   = 'proj-empty';
    empty.textContent = 'No projects yet. Track expenses and income for conventions, booth, merch, etc.';
    wrap.appendChild(empty);
    return wrap;
  }

  list.forEach(proj => wrap.appendChild(renderProjCard(proj)));
  return wrap;
}

function renderNewProjForm() {
  const card = document.createElement('div');
  card.className = 'proj-card proj-new-form';

  const inp = document.createElement('input');
  inp.className   = 'proj-name-inp';
  inp.type        = 'text';
  inp.placeholder = 'Project name (e.g. Comiket 2025)';
  inp.autocomplete = 'off';

  const colorPick = document.createElement('input');
  colorPick.type      = 'color';
  colorPick.className = 'proj-color-pick';
  colorPick.value     = '#c9a0b4';

  const actions = document.createElement('div');
  actions.className = 'proj-form-actions';

  const saveBtn = document.createElement('button');
  saveBtn.className   = 'proj-save-btn';
  saveBtn.textContent = 'Add project';
  saveBtn.addEventListener('click', () => {
    const name = inp.value.trim();
    if (!name) { inp.focus(); return; }
    const list = [...projects(), { id: uid(), name, color: colorPick.value, entries: [] }];
    saveProjects(list);
    _addingProj = false;
    render();
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.className   = 'proj-cancel-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => { _addingProj = false; render(); });

  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter')  saveBtn.click();
    if (e.key === 'Escape') cancelBtn.click();
  });

  actions.append(saveBtn, cancelBtn);
  card.append(colorPick, inp, actions);
  requestAnimationFrame(() => inp.focus());
  return card;
}

function renderProjCard(proj) {
  const isOpen = !!_openProj[proj.id];
  const entries = proj.entries ?? [];
  const totalIncome  = entries.filter(e => e.type === 'income').reduce((s, e) => s + (e.amount ?? 0), 0);
  const totalExpense = entries.filter(e => e.type === 'expense').reduce((s, e) => s + (e.amount ?? 0), 0);
  const net = totalIncome - totalExpense;

  const card = document.createElement('div');
  card.className = 'proj-card' + (isOpen ? ' open' : '');

  // Card header
  const head = document.createElement('div');
  head.className = 'proj-card-head';

  const dot = document.createElement('span');
  dot.className = 'proj-dot';
  dot.style.background = proj.color ?? 'var(--accent)';

  const nameEl = document.createElement('span');
  nameEl.className   = 'proj-card-name';
  nameEl.textContent = proj.name;

  const netEl = document.createElement('span');
  netEl.className   = 'proj-card-net' + (net >= 0 ? ' pos' : ' neg');
  netEl.textContent = `${net >= 0 ? '+' : '−'}${fmt(net)}`;

  const chev = document.createElement('span');
  chev.className  = 'proj-chev material-symbols-outlined';
  chev.textContent = 'chevron_right';

  head.append(dot, nameEl, netEl, chev);
  head.addEventListener('click', () => {
    _openProj[proj.id] = !isOpen;
    _addingEntry = null;
    render();
  });
  card.appendChild(head);

  if (!isOpen) return card;

  // Entry list
  const body = document.createElement('div');
  body.className = 'proj-body';

  if (entries.length) {
    const sorted = [...entries].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
    sorted.forEach(entry => {
      const row = document.createElement('div');
      row.className = 'proj-entry-row';

      const dateEl = document.createElement('span');
      dateEl.className   = 'proj-entry-date';
      dateEl.textContent = entry.date ? fmtDate(entry.date) : '—';

      const labelEl = document.createElement('span');
      labelEl.className   = 'proj-entry-label';
      labelEl.textContent = entry.label || '—';

      const amtEl = document.createElement('span');
      amtEl.className   = 'proj-entry-amt ' + entry.type;
      amtEl.textContent = `${entry.type === 'income' ? '+' : '−'}${fmt(entry.amount ?? 0)}`;

      const delBtn = document.createElement('button');
      delBtn.className   = 'proj-entry-del';
      delBtn.textContent = '×';
      delBtn.addEventListener('click', e => {
        e.stopPropagation();
        const list = projects().map(p => p.id !== proj.id ? p : {
          ...p, entries: p.entries.filter(en => en.id !== entry.id)
        });
        saveProjects(list);
        render();
      });

      row.append(dateEl, labelEl, amtEl, delBtn);
      body.appendChild(row);
    });

    // Subtotals
    const totals = document.createElement('div');
    totals.className = 'proj-totals';
    totals.innerHTML = `
      <span class="proj-total-item"><span class="proj-total-lbl">Income</span><span class="proj-entry-amt income">+${fmt(totalIncome)}</span></span>
      <span class="proj-total-item"><span class="proj-total-lbl">Expenses</span><span class="proj-entry-amt expense">−${fmt(totalExpense)}</span></span>
      <span class="proj-total-item proj-total-net"><span class="proj-total-lbl">Net</span><span class="proj-entry-amt ${net >= 0 ? 'income' : 'expense'}">${net >= 0 ? '+' : '−'}${fmt(net)}</span></span>
    `;
    body.appendChild(totals);
  }

  // Add entry form or buttons
  if (_addingEntry?.projId === proj.id) {
    body.appendChild(renderAddEntryForm(proj, _addingEntry.type));
  } else {
    const btns = document.createElement('div');
    btns.className = 'proj-add-btns';

    const expBtn = document.createElement('button');
    expBtn.className   = 'proj-add-exp-btn';
    expBtn.textContent = '− Add expense';
    expBtn.addEventListener('click', e => { e.stopPropagation(); _addingEntry = { projId: proj.id, type: 'expense' }; render(); });

    const incBtn = document.createElement('button');
    incBtn.className   = 'proj-add-inc-btn';
    incBtn.textContent = '+ Add income';
    incBtn.addEventListener('click', e => { e.stopPropagation(); _addingEntry = { projId: proj.id, type: 'income' }; render(); });

    const delProjBtn = document.createElement('button');
    delProjBtn.className   = 'proj-del-btn';
    delProjBtn.textContent = 'Delete project';
    delProjBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (!confirm(`Delete "${proj.name}"?`)) return;
      saveProjects(projects().filter(p => p.id !== proj.id));
      delete _openProj[proj.id];
      render();
    });

    btns.append(expBtn, incBtn, delProjBtn);
    body.appendChild(btns);
  }

  card.appendChild(body);
  return card;
}

function renderAddEntryForm(proj, type) {
  const form = document.createElement('div');
  form.className = 'proj-entry-form';

  const labelInp = document.createElement('input');
  labelInp.className   = 'proj-entry-inp';
  labelInp.type        = 'text';
  labelInp.placeholder = type === 'income' ? 'e.g. Keychain sales day 1' : 'e.g. Booth fee, materials…';
  labelInp.autocomplete = 'off';

  const amtInp = document.createElement('input');
  amtInp.className   = 'proj-entry-inp proj-entry-amt-inp';
  amtInp.type        = 'number';
  amtInp.min         = '0';
  amtInp.placeholder = '¥0';

  const dateInp = document.createElement('input');
  dateInp.className = 'proj-entry-inp proj-entry-date-inp';
  dateInp.type      = 'date';
  dateInp.value     = new Date().toISOString().slice(0, 10);

  const actions = document.createElement('div');
  actions.className = 'proj-form-actions';

  const saveBtn = document.createElement('button');
  saveBtn.className   = 'proj-save-btn';
  saveBtn.textContent = type === 'income' ? 'Add income' : 'Add expense';
  saveBtn.addEventListener('click', () => {
    const amount = parseFloat(amtInp.value);
    if (isNaN(amount) || amount <= 0) { amtInp.focus(); return; }
    const entry = { id: uid(), type, label: labelInp.value.trim() || null, amount, date: dateInp.value || null };
    const list = projects().map(p => p.id !== proj.id ? p : { ...p, entries: [...(p.entries ?? []), entry] });
    saveProjects(list);
    _addingEntry = null;
    render();
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.className   = 'proj-cancel-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => { _addingEntry = null; render(); });

  amtInp.addEventListener('keydown', e => {
    if (e.key === 'Enter')  saveBtn.click();
    if (e.key === 'Escape') cancelBtn.click();
  });

  actions.append(saveBtn, cancelBtn);
  form.append(labelInp, amtInp, dateInp, actions);
  requestAnimationFrame(() => labelInp.focus());
  return form;
}

function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}
