// nisa-view.js — 新NISA contribution planner

const LIFETIME_CAP      = 18_000_000;
const TSUMITATE_CAP_YR  =  1_200_000;
const SEICHŌ_CAP_YR     =  2_400_000;
const COMBINED_CAP_YR   =  3_600_000;

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

let _container   = null;
let _data        = null;
let _onSave      = null;
let _addingSnap  = false;

// ── Data helpers ───────────────────────────────────────────────────────
function nisa() {
  return _data.finance?.nisa ?? {};
}

function defaults() {
  const now = new Date();
  return { startYear: now.getFullYear(), startMonth: now.getMonth(), birthYear: now.getFullYear() - 30, tsumitate: {}, seichō: {}, snapshots: [] };
}

function saveNisa(n) {
  const finance = { ...(_data.finance ?? {}), nisa: n };
  _data = { ..._data, finance };
  _onSave({ finance });
}

// ── Public API ─────────────────────────────────────────────────────────
export function mount(container, data, onSave) {
  _container = container;
  _data      = data;
  _onSave    = onSave;
  _addingSnap = false;
  _render();
}

export function unmount() {
  if (_container) _container.innerHTML = '';
  _container = null;
}

export function update(newData) {
  _data = newData;
  if (_container) _render();
}

// ── Calculation ────────────────────────────────────────────────────────
function calcPlan() {
  const n  = { ...defaults(), ...nisa() };
  const sy = n.startYear;
  const sm = n.startMonth;
  const by = n.birthYear;
  const tsumitate = n.tsumitate ?? {};
  const seichō    = n.seichō    ?? {};

  // Sorted tsumitate years for carry-forward lookup
  const tYears = Object.keys(tsumitate).map(Number).sort((a, b) => a - b);

  function getMonthly(y) {
    let v = 0;
    for (const ky of tYears) { if (ky <= y) v = tsumitate[ky]; else break; }
    return v || 0;
  }

  let cumulative = 0;
  let capYear = null, capAge = null;
  let totalTsumitate = 0, totalSeichō = 0;
  const rows = [];

  for (let y = sy; y <= sy + 60; y++) {
    const months   = y === sy ? (12 - sm) : 12;
    const tAmt     = Math.min(getMonthly(y) * months, TSUMITATE_CAP_YR);
    const sAmt     = Math.min(seichō[y] ?? 0, SEICHŌ_CAP_YR);
    const combined = Math.min(tAmt + sAmt, COMBINED_CAP_YR);
    const room     = LIFETIME_CAP - cumulative;
    const contrib  = Math.min(combined, room);

    // Split actual contribution proportionally if lifetime cap hit
    let tActual = tAmt, sActual = sAmt;
    if (contrib < combined && combined > 0) {
      tActual = Math.round(tAmt * contrib / combined);
      sActual = contrib - tActual;
    }

    cumulative     += contrib;
    totalTsumitate += tActual;
    totalSeichō    += sActual;

    rows.push({ year: y, age: y - by, tsumitate: tActual, seichō: sActual, cumulative, progress: cumulative / LIFETIME_CAP });

    if (cumulative >= LIFETIME_CAP && !capYear) { capYear = y; capAge = y - by; break; }
    if (contrib === 0 && y > sy + 1) break;
  }

  const thisYearRow   = rows.find(r => r.year === sy) ?? rows[0];
  const thisYearTotal = thisYearRow ? thisYearRow.tsumitate + thisYearRow.seichō : 0;
  const totalYears    = capYear ? capYear - sy + 1 : rows.length;
  const avgPerYear    = totalYears > 0 ? LIFETIME_CAP / totalYears : 0;

  return { rows, capYear, capAge, thisYearTotal, totalYears, avgPerYear, totalTsumitate, totalSeichō };
}

// ── Format helpers ─────────────────────────────────────────────────────
function man(yen) {
  const m = Math.round(yen / 10000);
  return `¥${m.toLocaleString()}万`;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls)  e.className   = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function div(cls, text) { return el('div', cls, text); }
function span(cls, text) { return el('span', cls, text); }
function btn(cls, text, onClick) {
  const b = el('button', cls, text);
  b.addEventListener('click', onClick);
  return b;
}

// ── Render ─────────────────────────────────────────────────────────────
function _render() {
  if (!_container) return;
  const scrollTop = _container.scrollTop;
  _container.innerHTML = '';

  const n    = { ...defaults(), ...nisa() };
  const plan = calcPlan();

  const root = div('nisa-root');
  root.appendChild(_buildTitle());
  root.appendChild(_buildSummaryBar(n, plan));
  root.appendChild(_buildContributions(n));
  root.appendChild(_buildBottom(n, plan));

  _container.appendChild(root);
  _container.scrollTop = scrollTop;
}

// ── Title ──────────────────────────────────────────────────────────────
function _buildTitle() {
  const hdr = div('nisa-title-bar');
  const title = span('nisa-title-jp', '新NISA');
  const sub   = span('nisa-title-en', 'CONTRIBUTION TRACKER');
  hdr.append(title, sub);
  return hdr;
}

// ── Summary bar ────────────────────────────────────────────────────────
function _buildSummaryBar(n, plan) {
  const bar = div('nisa-summary-bar');

  // Lifetime block
  const lifetime = div('nisa-sum-lifetime');
  const topLbl   = div('nisa-sum-toplbl', 'LIFETIME PLAN');
  const amounts  = div('nisa-sum-amounts');
  const current  = span('nisa-sum-current', man(plan.rows[plan.rows.length - 1]?.cumulative ?? 0));
  const sep      = span('nisa-sum-sep', ' / ');
  const capLbl   = span('nisa-sum-caplbl', man(LIFETIME_CAP));
  amounts.append(current, sep, capLbl);

  const progressBar = div('nisa-progress-bar');
  const tPct = (plan.totalTsumitate / LIFETIME_CAP * 100).toFixed(2);
  const sPct = (plan.totalSeichō    / LIFETIME_CAP * 100).toFixed(2);
  const tSeg = div('nisa-prog-t'); tSeg.style.width = tPct + '%';
  const sSeg = div('nisa-prog-s'); sSeg.style.width = sPct + '%';
  progressBar.append(tSeg, sSeg);

  const breakdown = div('nisa-sum-breakdown');
  const bd1 = span('nisa-bd-t', `・つみたて ${man(plan.totalTsumitate)}`);
  const bd2 = span('nisa-bd-s', `・成長 ${man(plan.totalSeichō)}`);
  breakdown.append(bd1, bd2);

  lifetime.append(topLbl, amounts, progressBar, breakdown);
  bar.appendChild(lifetime);

  // Stats
  const stats = [
    { lbl: 'CAP YEAR',        big: plan.capYear ?? '—', sub: plan.capAge ? `age ${plan.capAge}` : '' },
    { lbl: `${n.startYear} TOTAL`, big: man(plan.thisYearTotal) },
    { lbl: 'AVG / YEAR',      big: man(plan.avgPerYear), sub: `over ${plan.totalYears} years` },
  ];

  stats.forEach(({ lbl, big, sub: subText }) => {
    const stat = div('nisa-sum-stat');
    stat.append(div('nisa-sum-statlbl', lbl), div('nisa-sum-statbig', big));
    if (subText) stat.appendChild(div('nisa-sum-statsub', subText));
    bar.appendChild(stat);
  });

  return bar;
}

// ── Contribution sections ──────────────────────────────────────────────
function _buildContributions(n) {
  const wrap = div('nisa-contributions');
  wrap.appendChild(_buildTsumitate(n));
  wrap.appendChild(_buildSeichō(n));
  return wrap;
}

function _buildTsumitate(n) {
  const box = div('nisa-contrib-box nisa-contrib-t');

  const hdr = div('nisa-contrib-hdr');
  hdr.append(
    span('nisa-contrib-title', 'つみたて'),
    span('nisa-contrib-en', ' — MONTHLY/YEAR'),
    span('nisa-contrib-cap', 'cap ¥1.2M/year')
  );
  box.appendChild(hdr);

  const tsumitate = n.tsumitate ?? {};
  const sy = n.startYear;
  const sm = n.startMonth;
  const sortedYears = Object.keys(tsumitate).map(Number).sort((a, b) => a - b);

  sortedYears.forEach(y => {
    const monthly = tsumitate[y] ?? 0;
    const months  = y === sy ? (12 - sm) : 12;
    const annual  = Math.min(monthly * months, TSUMITATE_CAP_YR);

    const row = div('nisa-contrib-row');
    const yearLbl = span('nisa-contrib-year', String(y));

    const inp = el('input', 'nisa-contrib-inp');
    inp.type = 'number'; inp.min = '0'; inp.step = '1000'; inp.value = monthly;
    inp.addEventListener('change', () => {
      saveNisa({ ...n, tsumitate: { ...tsumitate, [y]: parseInt(inp.value) || 0 } });
      _render();
    });

    const annualLbl = span('nisa-contrib-annual', man(annual));
    const rmBtn = btn('nisa-contrib-rm', '×', () => {
      const updated = { ...tsumitate };
      delete updated[y];
      saveNisa({ ...n, tsumitate: updated });
      _render();
    });

    row.append(yearLbl, inp, annualLbl, rmBtn);
    box.appendChild(row);
  });

  const addBtn = btn('nisa-add-year', '+ add year', () => {
    const lastY = sortedYears[sortedYears.length - 1] ?? sy - 1;
    const newY  = lastY + 1;
    if (!tsumitate[newY]) {
      saveNisa({ ...n, tsumitate: { ...tsumitate, [newY]: tsumitate[lastY] ?? 0 } });
      _render();
    }
  });
  box.appendChild(addBtn);
  return box;
}

function _buildSeichō(n) {
  const box = div('nisa-contrib-box nisa-contrib-s');

  const hdr = div('nisa-contrib-hdr');
  hdr.append(
    span('nisa-contrib-title', '成長'),
    span('nisa-contrib-en', ' — LUMP SUM/YEAR'),
    span('nisa-contrib-cap', 'cap ¥2.4M/year')
  );
  box.appendChild(hdr);

  const seichō = n.seichō ?? {};
  const sy = n.startYear;
  const sortedYears = Object.keys(seichō).map(Number).sort((a, b) => a - b);

  sortedYears.forEach(y => {
    const lumpSum = seichō[y] ?? 0;

    const row = div('nisa-contrib-row');
    const yearLbl = span('nisa-contrib-year', String(y));

    const inp = el('input', 'nisa-contrib-inp');
    inp.type = 'number'; inp.min = '0'; inp.step = '10000'; inp.value = lumpSum;
    inp.addEventListener('change', () => {
      saveNisa({ ...n, seichō: { ...seichō, [y]: parseInt(inp.value) || 0 } });
      _render();
    });

    const rmBtn = btn('nisa-contrib-rm', '×', () => {
      const updated = { ...seichō };
      delete updated[y];
      saveNisa({ ...n, seichō: updated });
      _render();
    });

    row.append(yearLbl, inp, rmBtn);
    box.appendChild(row);
  });

  const addBtn = btn('nisa-add-year', '+ add year', () => {
    const lastY = sortedYears[sortedYears.length - 1] ?? sy - 1;
    const newY  = lastY + 1;
    if (!seichō[newY]) {
      saveNisa({ ...n, seichō: { ...seichō, [newY]: seichō[lastY] ?? 0 } });
      _render();
    }
  });
  box.appendChild(addBtn);
  return box;
}

// ── Bottom: settings + snapshots ───────────────────────────────────────
function _buildBottom(n, plan) {
  const wrap = div('nisa-bottom');
  wrap.appendChild(_buildSettings(n, plan));
  wrap.appendChild(_buildSnapshots(n, plan));
  return wrap;
}

function _buildSettings(n, plan) {
  const box = div('nisa-settings');

  function settingGroup(labelText, inputEl) {
    const g = div('nisa-setting-group');
    g.append(div('nisa-setting-lbl', labelText), inputEl);
    return g;
  }

  // Start year
  const syInp = el('input', 'nisa-setting-inp');
  syInp.type = 'number'; syInp.value = n.startYear;
  syInp.addEventListener('change', () => { saveNisa({ ...n, startYear: parseInt(syInp.value) || n.startYear }); _render(); });
  box.appendChild(settingGroup('start year', syInp));

  // Start month
  const smSel = el('select', 'nisa-setting-sel');
  MONTHS.forEach((m, i) => {
    const opt = el('option', '', m);
    opt.value = i;
    if (i === n.startMonth) opt.selected = true;
    smSel.appendChild(opt);
  });
  smSel.addEventListener('change', () => { saveNisa({ ...n, startMonth: parseInt(smSel.value) }); _render(); });
  box.appendChild(settingGroup('start month', smSel));

  // Birth year
  const byInp = el('input', 'nisa-setting-inp');
  byInp.type = 'number'; byInp.value = n.birthYear;
  byInp.addEventListener('change', () => { saveNisa({ ...n, birthYear: parseInt(byInp.value) || n.birthYear }); _render(); });
  box.appendChild(settingGroup('birth year', byInp));

  // This year monthly (display only)
  const thisMonthly = n.tsumitate?.[n.startYear] ?? 0;
  const tyVal = div('nisa-setting-val', `¥${thisMonthly.toLocaleString()}`);
  box.appendChild(settingGroup('this year monthly', tyVal));

  return box;
}

function _buildSnapshots(n, plan) {
  const box = div('nisa-snapshots');
  box.appendChild(div('nisa-snap-hdr', 'YEAR SNAPSHOTS'));

  const sy = n.startYear;
  const pinned   = new Set([sy, plan.capYear].filter(Boolean));
  const userSnaps = (n.snapshots ?? []).filter(y => y > sy && y !== plan.capYear);
  const allYears  = [...pinned, ...userSnaps].filter((y, i, a) => a.indexOf(y) === i).sort((a, b) => a - b);

  const table  = el('table', 'nisa-snap-table');
  const thead  = document.createElement('thead');
  thead.innerHTML = '<tr><th>year</th><th>age</th><th>つみたて</th><th>成長</th><th>cumulative</th><th>progress</th><th></th></tr>';
  const tbody  = document.createElement('tbody');

  allYears.forEach(y => {
    const row = plan.rows.find(r => r.year === y);
    if (!row) return;
    const pct = (Math.min(row.progress, 1) * 100).toFixed(1);
    const tr  = document.createElement('tr');
    tr.className = 'nisa-snap-row' + (y === plan.capYear ? ' nisa-snap-cap' : '');

    const tCell = div('nisa-snap-t-val', row.tsumitate > 0 ? man(row.tsumitate) : '—');
    if (row.tsumitate > 0) tCell.style.color = 'var(--flow-medium)';
    const sCell = div('nisa-snap-s-val', row.seichō > 0 ? man(row.seichō) : '—');
    if (row.seichō > 0) sCell.style.color = 'var(--blue)';

    const progCell = div('nisa-snap-prog-wrap');
    const progBar  = div('nisa-snap-bar');
    const tFill    = div('nisa-snap-fill-t');
    const sFill    = div('nisa-snap-fill-s');
    const total    = row.tsumitate + row.seichō;
    tFill.style.width = total > 0 ? ((row.tsumitate / LIFETIME_CAP) * 100).toFixed(2) + '%' : '0';
    sFill.style.width = total > 0 ? ((row.seichō    / LIFETIME_CAP) * 100).toFixed(2) + '%' : '0';
    progBar.append(tFill, sFill);
    // Overall filled background
    const overallBar = div('nisa-snap-bar');
    const overallFill = div('nisa-snap-fill-overall'); overallFill.style.width = pct + '%';
    overallBar.appendChild(overallFill);
    progCell.appendChild(overallBar);

    const td = (cls, child) => {
      const t = document.createElement('td');
      t.className = cls;
      if (typeof child === 'string') t.textContent = child;
      else if (child) t.appendChild(child);
      return t;
    };

    tr.append(
      td('nisa-snap-td nisa-snap-year', String(y)),
      td('nisa-snap-td nisa-snap-age', String(row.age)),
      td('nisa-snap-td', tCell),
      td('nisa-snap-td', sCell),
      td('nisa-snap-td nisa-snap-cum', man(row.cumulative)),
      td('nisa-snap-td nisa-snap-prog', progCell),
      td('nisa-snap-td nisa-snap-rm-td', ''),
    );

    if (!pinned.has(y)) {
      const rmBtn = btn('nisa-snap-rm-btn', '×', () => {
        saveNisa({ ...n, snapshots: (n.snapshots ?? []).filter(s => s !== y) });
        _render();
      });
      tr.querySelector('.nisa-snap-rm-td').appendChild(rmBtn);
    }

    tbody.appendChild(tr);
  });

  // Add snapshot row
  const addRow = document.createElement('tr');
  const addTd  = document.createElement('td');
  addTd.colSpan = 7; addTd.className = 'nisa-snap-add-td';

  if (_addingSnap) {
    const inp = el('input', 'nisa-snap-year-inp');
    inp.type = 'number'; inp.placeholder = 'year'; inp.min = sy + 1;
    const ok  = btn('nisa-snap-ok', 'Add', () => {
      const y = parseInt(inp.value);
      if (y && y > sy && !allYears.includes(y)) {
        saveNisa({ ...n, snapshots: [...(n.snapshots ?? []), y].sort((a, b) => a - b) });
      }
      _addingSnap = false; _render();
    });
    const cancel = btn('nisa-snap-cancel', 'Cancel', () => { _addingSnap = false; _render(); });
    addTd.append(inp, ok, cancel);
  } else {
    const addBtn = btn('nisa-add-year nisa-add-snap', '+ add snapshot year', () => {
      _addingSnap = true; _render();
    });
    addTd.appendChild(addBtn);
  }

  addRow.appendChild(addTd);
  tbody.appendChild(addRow);

  table.append(thead, tbody);
  box.appendChild(table);

  box.appendChild(div('nisa-footer-note', 'Lifetime cap ¥18M · つみたて ¥1.2M/year · 成長 ¥2.4M/year · up to ¥3.6M/year combined'));
  return box;
}
