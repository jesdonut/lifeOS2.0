// arknights.js — Arknights tracker: Dashboard | Pulls | Operators | Collection

import { OP_LIST, PROF_LABEL } from './ak-operators-db.js';

function profLabel(p) { return PROF_LABEL[p] ?? p; }

// ── Banner config ──────────────────────────────────────────────────
const BANNERS = [
  { id: 'standard', label: 'Standard', hard: 300, note: 'Shared with Joint Op / Front' },
  { id: 'limited',  label: 'Limited',  hard: 300, note: '300 spark' },
  { id: 'collab',   label: 'Collab',   hard: 120, note: '120 guarantee' },
  { id: 'kernel',   label: 'Kernel',   hard: 200, note: '200 guarantee (blue)' },
];

const RARITIES = [6, 5, 4, 3];
const RARITY_CLASS = { 6: 'ak-r6', 5: 'ak-r5', 4: 'ak-r4', 3: 'ak-r3', 2: 'ak-r2', 1: 'ak-r1' };

const PROFESSIONS = ['CASTER','DEFENDER','GUARD','MEDIC','VANGUARD','SNIPER','SPECIALIST','SUPPORTER'];

// ── Module state ───────────────────────────────────────────────────
let _el, _state, _save;
let _view      = 'dashboard'; // dashboard | pulls | operators | collection
let _opFilter  = { q: '', rarity: 0, prof: '', source: '' };
let _ownFilter = { q: '', source: '' };

// How an operator is obtained, for the "source" filter + row label.
function opSource(op) {
  if (op.welfare || op.freeType) return 'welfare';
  if (op.limited) return 'limited';
  if (op.collab)  return 'collab';
  if (op.recruit) return 'recruit';
  return 'standard';
}
const SOURCE_LABEL = { standard: 'Standard', limited: 'Limited', collab: 'Collab', welfare: 'Welfare', recruit: 'Recruitment' };
const SOURCE_OPTS  = [{ v: '', l: 'All sources' }, ...Object.entries(SOURCE_LABEL).map(([v, l]) => ({ v, l }))];
let _colFilter = { q: '', rarity: 0, fav: false };

function s() { return _state; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ── Public API ─────────────────────────────────────────────────────
export function mountArknights(container, state, save) {
  _el    = container;
  _state = {
    orundum:   0,
    originium:  0,
    hhPermit:  0,
    tenPermit: 0,
    banner:    'standard',
    pity:      { standard: 0, limited: 0, collab: 0, kernel: 0 },
    pulls:     [],
    collection: {},
    ...state,
  };
  _save = patch => {
    _state = { ..._state, ...patch };
    save(patch);
    _render();
  };
  _render();
}

// ── Root render ────────────────────────────────────────────────────
function _render() {
  _el.innerHTML = '';

  const nav = _buildNav();
  _el.appendChild(nav);

  const body = document.createElement('div');
  body.className = 'ak-view-body';
  _el.appendChild(body);

  if (_view === 'dashboard')  _renderDashboard(body);
  if (_view === 'pulls')      _renderPulls(body);
  if (_view === 'operators')  _renderOperators(body);
  if (_view === 'collection') _renderCollection(body);
}

function _buildNav() {
  const nav = document.createElement('div');
  nav.className = 'ak-nav';
  const toggle = document.createElement('div');
  toggle.className = 'cal-view-toggle';
  [
    { id: 'dashboard',  label: 'Dashboard' },
    { id: 'pulls',      label: 'Pulls' },
    { id: 'operators',  label: 'Operators' },
    { id: 'collection', label: 'Collection' },
  ].forEach(({ id, label }) => {
    const btn = document.createElement('button');
    btn.className = 'cal-view-btn' + (_view === id ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => { if (_view !== id) { _view = id; _render(); } });
    toggle.appendChild(btn);
  });
  nav.appendChild(toggle);
  return nav;
}

// ── Dashboard ──────────────────────────────────────────────────────
function _renderDashboard(el) {
  // 1 originium = 180 orundum. We don't spend originium directly, just estimate pulls.
  const totalOrundum = s().orundum + (s().originium * 180);
  const orundumPulls = Math.floor(totalOrundum / 600);
  const pullsAvail   = orundumPulls + s().hhPermit + (s().tenPermit * 10);

  // Resources
  const resWrap = document.createElement('div');
  resWrap.className = 'ak-resources';

  const resources = [
    { key: 'orundum',   label: 'Orundum',     icon: '💎', suffix: '' },
    { key: 'originium', label: 'Originium',   icon: '🔷', suffix: '' },
    { key: 'hhPermit',  label: 'HH Permit',   icon: '🎫', suffix: '' },
    { key: 'tenPermit', label: '10x Permit',  icon: '🎫', suffix: '' },
  ];
  resources.forEach(r => resWrap.appendChild(_buildResCard(r)));

  const pullCard = document.createElement('div');
  pullCard.className = 'ak-res-card ak-res-pulls';
  pullCard.innerHTML = `
    <div class="ak-res-top"><span>🎲</span><span class="ak-res-lbl">Pulls available</span></div>
    <div class="ak-res-val">${pullsAvail.toLocaleString()}</div>
    <div class="ak-res-breakdown">
      ${orundumPulls} (${totalOrundum.toLocaleString()} orundum) + ${s().hhPermit} + ${s().tenPermit*10}
    </div>`;
  resWrap.appendChild(pullCard);
  el.appendChild(resWrap);

  // Pity — one section per banner
  const pitySection = document.createElement('div');
  pitySection.className = 'ak-pity-section';
  const pityHdr = document.createElement('div');
  pityHdr.className = 'ak-section-hdr';
  pityHdr.textContent = 'Pity';
  pitySection.appendChild(pityHdr);

  const pityGrid = document.createElement('div');
  pityGrid.className = 'ak-pity-grid';
  BANNERS.forEach(b => {
    const pity = s().pity[b.id] ?? 0;
    const pct  = Math.min(100, Math.round((pity / b.hard) * 100));
    const card = document.createElement('div');
    card.className = 'ak-pity-card';
    card.innerHTML = `
      <div class="ak-pity-card-top">
        <span class="ak-pity-banner-lbl">${b.label}</span>
        <span class="ak-pity-note">${b.note}</span>
      </div>
      <div class="ak-pity-nums">
        <span class="ak-pity-cur">${pity}</span>
        <span class="ak-pity-max">/ ${b.hard}</span>
      </div>
      <div class="ak-pity-bar">
        <div class="ak-pity-fill ${pct >= 75 ? 'ak-pity-fill--warn' : ''}" style="width:${pct}%"></div>
      </div>`;

    // Click to edit pity inline
    card.style.cursor = 'pointer';
    card.title = 'Click to edit pity';
    card.addEventListener('click', () => {
      const inp = document.createElement('input');
      inp.type = 'number'; inp.min = '0'; inp.max = b.hard.toString();
      inp.className = 'ak-pity-edit-inp'; inp.value = pity;
      card.innerHTML = '';
      const lbl = document.createElement('div'); lbl.className = 'ak-pity-banner-lbl'; lbl.textContent = b.label;
      const ok  = document.createElement('button'); ok.className = 'ak-res-ok'; ok.textContent = 'Set';
      const doSet = () => _save({ pity: { ...s().pity, [b.id]: parseInt(inp.value) || 0 } });
      ok.addEventListener('click', doSet);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') doSet(); if (e.key === 'Escape') _render(); });
      card.append(lbl, inp, ok);
      requestAnimationFrame(() => { inp.focus(); inp.select(); });
    });

    pityGrid.appendChild(card);
  });
  pitySection.appendChild(pityGrid);
  el.appendChild(pitySection);
}

function _buildResCard({ key, label, icon }) {
  const card = document.createElement('div');
  card.className = 'ak-res-card';

  const top = document.createElement('div'); top.className = 'ak-res-top';
  const ico = document.createElement('span'); ico.textContent = icon;
  const lbl = document.createElement('span'); lbl.className = 'ak-res-lbl'; lbl.textContent = label;
  top.append(ico, lbl);

  const valRow = document.createElement('div'); valRow.className = 'ak-res-val-row';
  const valEl  = document.createElement('span'); valEl.className = 'ak-res-val';
  valEl.textContent = s()[key].toLocaleString();
  const editBtn = document.createElement('button'); editBtn.className = 'ak-res-edit';
  editBtn.innerHTML = '<span class="material-symbols-outlined">edit</span>';

  editBtn.addEventListener('click', () => {
    valEl.style.display = 'none'; editBtn.style.display = 'none';
    const inp = document.createElement('input');
    inp.type = 'number'; inp.className = 'ak-res-inp'; inp.value = s()[key]; inp.min = '0';
    const ok = document.createElement('button'); ok.className = 'ak-res-ok'; ok.textContent = 'Save';
    const doSave = () => _save({ [key]: parseInt(inp.value) || 0 });
    ok.addEventListener('click', doSave);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') doSave(); if (e.key === 'Escape') _render(); });
    valRow.append(inp, ok);
    requestAnimationFrame(() => { inp.focus(); inp.select(); });
  });

  valRow.append(valEl, editBtn);
  card.append(top, valRow);
  return card;
}

// ── Pulls ──────────────────────────────────────────────────────────
function _renderPulls(el) {
  el.appendChild(_buildLogForm());
  el.appendChild(_buildHistory());
}

// Resolve a typed name to an operator (case-insensitive, trims). null if unknown.
function _findOp(name) {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  return OP_LIST.find(o => o.name.toLowerCase() === n)
    ?? OP_LIST.find(o => o.name.toLowerCase().startsWith(n))
    ?? null;
}

function _buildLogForm() {
  const wrap = document.createElement('div'); wrap.className = 'ak-log-form';

  const hdr = document.createElement('div'); hdr.className = 'ak-section-hdr'; hdr.textContent = 'Log pull';
  wrap.appendChild(hdr);

  // Banner
  const bannerRow = document.createElement('div'); bannerRow.className = 'ak-log-row';
  const bannerLbl = document.createElement('span'); bannerLbl.className = 'ak-log-lbl'; bannerLbl.textContent = 'Banner';
  const bannerToggle = document.createElement('div'); bannerToggle.className = 'ak-banner-toggle';
  BANNERS.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'ak-banner-btn' + (s().banner === b.id ? ' active' : '');
    btn.textContent = b.label;
    btn.addEventListener('click', () => { if (s().banner !== b.id) _save({ banner: b.id }); });
    bannerToggle.appendChild(btn);
  });
  bannerRow.append(bannerLbl, bannerToggle);
  wrap.appendChild(bannerRow);

  // Pulls — the universal unit (orundum, HH permit, or originium all become pulls).
  // Accepts a pull count directly, or paste an orundum amount and convert.
  const pullsRow = document.createElement('div'); pullsRow.className = 'ak-log-row';
  const pullsLbl = document.createElement('span'); pullsLbl.className = 'ak-log-lbl'; pullsLbl.textContent = 'Pulls';
  const pullsInp = document.createElement('input');
  pullsInp.type = 'number'; pullsInp.min = '0';
  pullsInp.className = 'ak-log-cnt'; pullsInp.placeholder = '1, 10…';
  const pullsHint = document.createElement('span'); pullsHint.className = 'ak-log-hint';
  const fromOrundumBtn = document.createElement('button');
  fromOrundumBtn.type = 'button'; fromOrundumBtn.className = 'ak-log-conv';
  fromOrundumBtn.textContent = '÷600 from orundum';
  fromOrundumBtn.title = 'Treat the number as orundum and convert to pulls';
  fromOrundumBtn.addEventListener('click', () => {
    const n = parseInt(pullsInp.value) || 0;
    if (n >= 600) { pullsInp.value = Math.round(n / 600); updHint(); }
  });
  const updHint = () => {
    const count = parseInt(pullsInp.value) || 0;
    pullsHint.textContent = count ? `≈ ${(count * 600).toLocaleString()} orundum` : '';
  };
  pullsInp.addEventListener('input', updHint); updHint();
  pullsRow.append(pullsLbl, pullsInp, fromOrundumBtn, pullsHint);
  wrap.appendChild(pullsRow);

  // Operators obtained — typed names become chips, rarity auto-resolved from the DB
  const got = []; // [{ name, rarity }]
  const opRow = document.createElement('div'); opRow.className = 'ak-log-row';
  const opLbl = document.createElement('span'); opLbl.className = 'ak-log-lbl'; opLbl.textContent = 'Got';
  const opInp = document.createElement('input');
  opInp.type = 'text'; opInp.className = 'ak-log-name'; opInp.placeholder = 'Type a name, Enter to add';
  const dlId = 'ak-op-dl';
  const dl = document.createElement('datalist'); dl.id = dlId;
  [...OP_LIST].sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name))
    .forEach(o => { const opt = document.createElement('option'); opt.value = o.name; dl.appendChild(opt); });
  opInp.setAttribute('list', dlId);
  opRow.append(opLbl, opInp, dl);
  wrap.appendChild(opRow);

  const chipsEl = document.createElement('div'); chipsEl.className = 'ak-got-chips';
  wrap.appendChild(chipsEl);
  const tallyEl = document.createElement('div'); tallyEl.className = 'ak-got-tally';
  wrap.appendChild(tallyEl);

  function renderGot() {
    chipsEl.innerHTML = '';
    got.forEach((g, i) => {
      const chip = document.createElement('span');
      chip.className = 'ak-got-chip ' + (RARITY_CLASS[g.rarity] ?? '');
      chip.innerHTML = `<span class="ak-got-star">${g.rarity ? g.rarity + '★' : '?'}</span>${g.name}`;
      const x = document.createElement('button'); x.className = 'ak-got-x'; x.textContent = '×';
      x.addEventListener('click', () => { got.splice(i, 1); renderGot(); });
      chip.appendChild(x);
      chipsEl.appendChild(chip);
    });
    const c6 = got.filter(g => g.rarity === 6).length;
    const c5 = got.filter(g => g.rarity === 5).length;
    tallyEl.textContent = got.length ? `6★ ${c6} · 5★ ${c5}` : '';
  }

  function addName(raw) {
    const name = raw.trim();
    if (!name) return;
    const op = _findOp(name);
    got.push({ name: op?.name ?? name, rarity: op?.rarity ?? null });
    renderGot();
  }
  opInp.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addName(opInp.value); opInp.value = ''; }
  });

  // Add button
  const addBtn = document.createElement('button'); addBtn.className = 'ak-log-add'; addBtn.textContent = '+ Log';
  addBtn.addEventListener('click', () => {
    if (opInp.value.trim()) { addName(opInp.value); opInp.value = ''; }
    const count = parseInt(pullsInp.value) || 0;
    if (!count && !got.length) { pullsInp.focus(); return; }
    const banner  = s().banner;
    const stars6  = got.filter(g => g.rarity === 6).length;
    const stars5  = got.filter(g => g.rarity === 5).length;
    const oldPity = s().pity[banner] ?? 0;
    // If a 6★ dropped this session, pity resets; otherwise it climbs by the pulls done.
    const newPity = stars6 > 0 ? 0 : oldPity + count;
    const pull = {
      id: uid(),
      date: new Date().toISOString().slice(0, 10),
      banner, count, spent: count * 600,
      operators: got.map(g => ({ name: g.name, rarity: g.rarity })),
      stars6, stars5,
    };
    _save({
      pulls: [pull, ...s().pulls],
      pity:  { ...s().pity, [banner]: newPity },
    });
  });
  wrap.appendChild(addBtn);
  return wrap;
}

function _buildHistory() {
  const wrap = document.createElement('div'); wrap.className = 'ak-history';

  const hdr = document.createElement('div'); hdr.className = 'ak-section-hdr';
  hdr.textContent = `Pull log (${s().pulls.length})`;
  wrap.appendChild(hdr);

  if (!s().pulls.length) {
    const e = document.createElement('div'); e.className = 'ak-history-empty'; e.textContent = 'No pulls logged yet';
    wrap.appendChild(e); return wrap;
  }

  const list = document.createElement('div'); list.className = 'ak-history-list';
  s().pulls.slice(0, 100).forEach(p => {
    const row = document.createElement('div'); row.className = 'ak-history-row';
    const bCfg = BANNERS.find(b => b.id === p.banner);

    const dateEl   = document.createElement('span'); dateEl.className   = 'ak-h-date';   dateEl.textContent   = p.date ?? '';
    const bannerEl = document.createElement('span'); bannerEl.className = 'ak-h-banner'; bannerEl.textContent = bCfg?.label ?? p.banner;
    const cntEl    = document.createElement('span'); cntEl.className    = 'ak-h-cnt';    cntEl.textContent    = (p.count || 0) + 'x';

    // Operators got — new model is an array; fall back to the old single-operator shape.
    const ops = p.operators ?? (p.operator ? [{ name: p.operator, rarity: p.rarity ?? null }] : []);
    const gotEl = document.createElement('span'); gotEl.className = 'ak-h-got';
    ops.forEach(o => {
      const tag = document.createElement('span');
      tag.className = 'ak-rarity-tag ' + (RARITY_CLASS[o.rarity] ?? '');
      tag.textContent = (o.rarity ? o.rarity + '★ ' : '') + o.name;
      gotEl.appendChild(tag);
    });

    const rm = document.createElement('button'); rm.className = 'ak-h-rm'; rm.innerHTML = '&times;';
    rm.addEventListener('click', () => _save({ pulls: s().pulls.filter(x => x.id !== p.id) }));

    row.append(dateEl, bannerEl, cntEl, gotEl, rm);
    list.appendChild(row);
  });
  wrap.appendChild(list);
  return wrap;
}

// ── Operators ──────────────────────────────────────────────────────
function _renderOperators(el) {
  const grid = document.createElement('div'); grid.className = 'ak-ops-grid';

  // Left: Add column
  const addCol = document.createElement('div'); addCol.className = 'ak-ops-col';

  const addHdr = document.createElement('div'); addHdr.className = 'ak-ops-col-hdr';
  addHdr.textContent = 'Add';
  addCol.appendChild(addHdr);

  const filterBar = document.createElement('div'); filterBar.className = 'ak-filter-bar';

  const qInp = document.createElement('input');
  qInp.type = 'text'; qInp.className = 'ak-filter-q'; qInp.placeholder = 'Search…';
  qInp.value = _opFilter.q;
  qInp.addEventListener('input', () => { _opFilter.q = qInp.value; _renderOpList(addList); });

  const rarSel = document.createElement('select'); rarSel.className = 'ak-filter-sel';
  [{ v: 0, l: 'All rarities' }, ...RARITIES.map(r => ({ v: r, l: r + '★' }))].forEach(({ v, l }) => {
    const opt = document.createElement('option'); opt.value = v; opt.textContent = l;
    if (Number(v) === _opFilter.rarity) opt.selected = true;
    rarSel.appendChild(opt);
  });
  rarSel.addEventListener('change', () => { _opFilter.rarity = parseInt(rarSel.value); _renderOpList(addList); });

  const profSel = document.createElement('select'); profSel.className = 'ak-filter-sel';
  [{ v: '', l: 'All classes' }, ...PROFESSIONS.map(p => ({ v: p, l: profLabel(p) }))].forEach(({ v, l }) => {
    const opt = document.createElement('option'); opt.value = v; opt.textContent = l;
    if (v === _opFilter.prof) opt.selected = true;
    profSel.appendChild(opt);
  });
  profSel.addEventListener('change', () => { _opFilter.prof = profSel.value; _renderOpList(addList); });

  const srcSel = document.createElement('select'); srcSel.className = 'ak-filter-sel';
  SOURCE_OPTS.forEach(({ v, l }) => {
    const opt = document.createElement('option'); opt.value = v; opt.textContent = l;
    if (v === _opFilter.source) opt.selected = true;
    srcSel.appendChild(opt);
  });
  srcSel.addEventListener('change', () => { _opFilter.source = srcSel.value; _renderOpList(addList); });

  filterBar.append(qInp, rarSel, profSel, srcSel);
  addCol.appendChild(filterBar);

  const addList = document.createElement('div'); addList.className = 'ak-op-list';
  addCol.appendChild(addList);

  // Right: Owned column
  const ownedCol = document.createElement('div'); ownedCol.className = 'ak-ops-col';

  const ownedHdr = document.createElement('div'); ownedHdr.className = 'ak-ops-col-hdr';
  ownedHdr.textContent = 'Owned';
  ownedCol.appendChild(ownedHdr);

  const ownedFilterBar = document.createElement('div'); ownedFilterBar.className = 'ak-filter-bar';
  const ownedQ = document.createElement('input');
  ownedQ.type = 'text'; ownedQ.className = 'ak-filter-q'; ownedQ.placeholder = 'Search…';
  ownedQ.value = _ownFilter.q;
  ownedQ.addEventListener('input', () => { _ownFilter.q = ownedQ.value; _renderOwnedList(ownedList); });

  const ownedSrc = document.createElement('select'); ownedSrc.className = 'ak-filter-sel';
  SOURCE_OPTS.forEach(({ v, l }) => {
    const opt = document.createElement('option'); opt.value = v; opt.textContent = l;
    if (v === _ownFilter.source) opt.selected = true;
    ownedSrc.appendChild(opt);
  });
  ownedSrc.addEventListener('change', () => { _ownFilter.source = ownedSrc.value; _renderOwnedList(ownedList); });

  ownedFilterBar.append(ownedQ, ownedSrc);
  ownedCol.appendChild(ownedFilterBar);

  const ownedList = document.createElement('div'); ownedList.className = 'ak-op-list';
  ownedCol.appendChild(ownedList);

  grid.append(addCol, ownedCol);
  el.appendChild(grid);

  _renderOpList(addList);
  _renderOwnedList(ownedList);
}

function _renderOpList(list) {
  list.innerHTML = '';
  const col  = s().collection ?? {};
  const q    = _opFilter.q.toLowerCase();
  const rFil = _opFilter.rarity;
  const pFil = _opFilter.prof;

  const sFil = _opFilter.source;
  const filtered = OP_LIST.filter(op => {
    if (col[op.id]?.owned) return false;
    if (rFil && op.rarity !== rFil) return false;
    if (pFil && op.profession !== pFil) return false;
    if (sFil && opSource(op) !== sFil) return false;
    if (q && !op.name.toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name));

  filtered.forEach(op => {
    const row = document.createElement('div'); row.className = 'ak-op-row';

    const avatarEl = document.createElement('div');
    avatarEl.className = 'ak-op-avatar-ph ' + RARITY_CLASS[op.rarity];
    avatarEl.textContent = op.name[0];

    const info   = document.createElement('div'); info.className = 'ak-op-info';
    const nameEl = document.createElement('span'); nameEl.className = 'ak-op-name'; nameEl.textContent = op.name;
    const src    = opSource(op);
    const sub    = document.createElement('span'); sub.className = 'ak-op-sub';
    sub.textContent = profLabel(op.profession) + (src !== 'standard' ? ' · ' + SOURCE_LABEL[src] : '');
    info.append(nameEl, sub);

    const rar = document.createElement('span'); rar.className = 'ak-rarity-tag ' + RARITY_CLASS[op.rarity]; rar.textContent = op.rarity + '★';

    const addBtn = document.createElement('button'); addBtn.className = 'ak-own-btn';
    addBtn.textContent = 'Add';
    addBtn.addEventListener('click', e => {
      e.stopPropagation();
      const newCol = { ...(s().collection ?? {}), [op.id]: { owned: true, potential: 1, elite: 0, level: 1, favorite: false } };
      _save({ collection: newCol });
    });

    row.append(avatarEl, info, rar, addBtn);
    list.appendChild(row);
  });

  if (!filtered.length) {
    const e = document.createElement('div'); e.className = 'ak-history-empty';
    e.textContent = (!q && !rFil && !pFil) ? 'All operators owned' : 'No operators match';
    list.appendChild(e);
  }
}

function _renderOwnedList(list) {
  list.innerHTML = '';
  const col = s().collection ?? {};

  const q    = _ownFilter.q.toLowerCase();
  const sFil = _ownFilter.source;
  const owned = Object.entries(col)
    .filter(([, c]) => c.owned)
    .map(([id, data]) => ({ op: OP_LIST.find(o => o.id === id), data }))
    .filter(({ op }) => op)
    .filter(({ op }) => !q || op.name.toLowerCase().includes(q))
    .filter(({ op }) => !sFil || opSource(op) === sFil)
    .sort((a, b) => b.op.rarity - a.op.rarity || a.op.name.localeCompare(b.op.name));

  owned.forEach(({ op, data }) => {
    const row = document.createElement('div'); row.className = 'ak-op-row ak-op-owned';

    const avatarEl = document.createElement('div');
    avatarEl.className = 'ak-op-avatar-ph ' + RARITY_CLASS[op.rarity];
    avatarEl.textContent = op.name[0];

    const info   = document.createElement('div'); info.className = 'ak-op-info';
    const nameEl = document.createElement('span'); nameEl.className = 'ak-op-name'; nameEl.textContent = op.name;
    const oSrc   = opSource(op);
    const sub    = document.createElement('span'); sub.className = 'ak-op-sub';
    sub.textContent = profLabel(op.profession) + (oSrc !== 'standard' ? ' · ' + SOURCE_LABEL[oSrc] : '');
    info.append(nameEl, sub);

    const potBtns = document.createElement('div'); potBtns.className = 'ak-pot-btns';
    for (let p = 1; p <= 6; p++) {
      const btn = document.createElement('button');
      btn.className = 'ak-pot-btn' + (data.potential === p ? ' active' : '');
      btn.textContent = p;
      btn.addEventListener('click', () => {
        const newCol = { ...(s().collection ?? {}), [op.id]: { ...data, potential: p } };
        _save({ collection: newCol });
      });
      potBtns.appendChild(btn);
    }

    const rmBtn = document.createElement('button'); rmBtn.className = 'ak-own-btn';
    rmBtn.textContent = '×';
    rmBtn.addEventListener('click', e => {
      e.stopPropagation();
      const newCol = { ...(s().collection ?? {}) };
      delete newCol[op.id];
      _save({ collection: newCol });
    });

    row.append(avatarEl, info, potBtns, rmBtn);
    list.appendChild(row);
  });

  if (!owned.length) {
    const e = document.createElement('div'); e.className = 'ak-history-empty'; e.textContent = 'No operators owned yet';
    list.appendChild(e);
  }
}

// ── Collection ─────────────────────────────────────────────────────
function _renderCollection(el) {
  const col = s().collection ?? {};
  const owned = Object.entries(col).filter(([, c]) => c.owned);

  // Filters
  const filterBar = document.createElement('div'); filterBar.className = 'ak-filter-bar';
  const qInp = document.createElement('input');
  qInp.type = 'text'; qInp.className = 'ak-filter-q'; qInp.placeholder = 'Search…';
  qInp.value = _colFilter.q;
  qInp.addEventListener('input', () => { _colFilter.q = qInp.value; renderList(); });

  const rarSel = document.createElement('select'); rarSel.className = 'ak-filter-sel';
  [{ v: 0, l: 'All rarities' }, ...RARITIES.map(r => ({ v: r, l: r + '★' }))].forEach(({ v, l }) => {
    const opt = document.createElement('option'); opt.value = v; opt.textContent = l;
    if (Number(v) === _colFilter.rarity) opt.selected = true;
    rarSel.appendChild(opt);
  });
  rarSel.addEventListener('change', () => { _colFilter.rarity = parseInt(rarSel.value); renderList(); });

  const favBtn = document.createElement('button'); favBtn.className = 'ak-fav-toggle' + (_colFilter.fav ? ' active' : '');
  favBtn.innerHTML = '<span class="material-symbols-outlined">favorite</span>';
  favBtn.addEventListener('click', () => { _colFilter.fav = !_colFilter.fav; favBtn.classList.toggle('active', _colFilter.fav); renderList(); });

  filterBar.append(qInp, rarSel, favBtn);
  el.appendChild(filterBar);

  const countEl = document.createElement('div'); countEl.className = 'ak-col-count';
  countEl.textContent = `${owned.length} operators`;
  el.appendChild(countEl);

  const list = document.createElement('div'); list.className = 'ak-col-grid';
  el.appendChild(list);

  function renderList() {
    list.innerHTML = '';
    const q    = _colFilter.q.toLowerCase();
    const rFil = _colFilter.rarity;

    const filtered = owned.filter(([id, c]) => {
      const op = OP_LIST.find(o => o.id === id);
      if (_colFilter.fav && !c.favorite) return false;
      if (rFil && op?.rarity !== rFil) return false;
      if (q && !op?.name?.toLowerCase().includes(q) && !id.includes(q)) return false;
      return true;
    }).sort(([idA, cA], [idB, cB]) => {
      const ra = OP_LIST.find(o => o.id === idA)?.rarity ?? 0;
      const rb = OP_LIST.find(o => o.id === idB)?.rarity ?? 0;
      if (rb !== ra) return rb - ra;
      return (cB.favorite ? 1 : 0) - (cA.favorite ? 1 : 0);
    });

    filtered.forEach(([id, c]) => {
      const op  = OP_LIST.find(o => o.id === id);
      const card = document.createElement('div'); card.className = 'ak-col-card';

      const avatar = document.createElement('div');
      avatar.className = 'ak-col-avatar-ph ' + (op ? RARITY_CLASS[op.rarity] : '');
      avatar.textContent = (op?.name ?? id)[0];

      if (op?.rarity) {
        const rarBadge = document.createElement('span');
        rarBadge.className = 'ak-col-rar-badge ' + RARITY_CLASS[op.rarity];
        rarBadge.textContent = op.rarity + '★';
        card.appendChild(rarBadge);
      }

      const favBtn2 = document.createElement('button'); favBtn2.className = 'ak-col-fav' + (c.favorite ? ' on' : '');
      favBtn2.innerHTML = '<span class="material-symbols-outlined">favorite</span>';
      favBtn2.addEventListener('click', e => {
        e.stopPropagation();
        const nc = { ...(s().collection ?? {}), [id]: { ...c, favorite: !c.favorite } };
        _save({ collection: nc });
      });

      const nameEl = document.createElement('div'); nameEl.className = 'ak-col-name'; nameEl.textContent = op?.name ?? id;

      // Elite / level / potential
      const statsRow = document.createElement('div'); statsRow.className = 'ak-col-stats';

      const maxElite = op?.rarity >= 4 ? 2 : op?.rarity === 3 ? 1 : 0;
      const eliteSel = document.createElement('select'); eliteSel.className = 'ak-col-sel';
      for (let i = 0; i <= maxElite; i++) {
        const o = document.createElement('option'); o.value = i; o.textContent = 'E' + i;
        if (i === (c.elite ?? 0)) o.selected = true;
        eliteSel.appendChild(o);
      }
      eliteSel.addEventListener('change', () => {
        const nc = { ...(s().collection ?? {}), [id]: { ...c, elite: parseInt(eliteSel.value) } };
        _save({ collection: nc });
      });

      const potSel = document.createElement('select'); potSel.className = 'ak-col-sel';
      for (let i = 1; i <= 6; i++) {
        const o = document.createElement('option'); o.value = i; o.textContent = 'P' + i;
        if (i === (c.potential ?? 1)) o.selected = true;
        potSel.appendChild(o);
      }
      potSel.addEventListener('change', () => {
        const nc = { ...(s().collection ?? {}), [id]: { ...c, potential: parseInt(potSel.value) } };
        _save({ collection: nc });
      });

      const rmBtn = document.createElement('button'); rmBtn.className = 'ak-col-rm';
      rmBtn.innerHTML = '<span class="material-symbols-outlined">delete</span>';
      rmBtn.addEventListener('click', e => {
        e.stopPropagation();
        const nc = { ...(s().collection ?? {}) };
        delete nc[id];
        _save({ collection: nc });
      });

      statsRow.append(eliteSel, potSel, rmBtn);
      card.append(avatar, favBtn2, nameEl, statsRow);
      list.appendChild(card);
    });

    if (!filtered.length) {
      const e = document.createElement('div'); e.className = 'ak-history-empty';
      e.textContent = owned.length ? 'No operators match filters' : 'No operators in collection yet — add from Operators tab';
      list.appendChild(e);
    }
  }

  renderList();
}
