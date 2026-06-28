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
const RARITY_CLASS = { 6: 'ak-r6', 5: 'ak-r5', 4: 'ak-r4', 3: 'ak-r3' };

const PROFESSIONS = ['CASTER','DEFENDER','GUARD','MEDIC','VANGUARD','SNIPER','SPECIALIST','SUPPORTER'];

// ── Module state ───────────────────────────────────────────────────
let _el, _state, _save;
let _view      = 'dashboard'; // dashboard | pulls | operators | collection
let _opFilter  = { q: '', rarity: 0, prof: '' };
let _colFilter = { q: '', rarity: 0, fav: false };

function s() { return _state; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ── Public API ─────────────────────────────────────────────────────
export function mountArknights(container, state, save) {
  _el    = container;
  _state = {
    orundum:   0,
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
  const pullsAvail = Math.floor(s().orundum / 600) + s().hhPermit + (s().tenPermit * 10);

  // Resources
  const resWrap = document.createElement('div');
  resWrap.className = 'ak-resources';

  const resources = [
    { key: 'orundum',   label: 'Orundum',     icon: '💎', suffix: '' },
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
      ${Math.floor(s().orundum/600)} + ${s().hhPermit} + ${s().tenPermit*10}
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

  // Count + rarity + operator
  const row2 = document.createElement('div'); row2.className = 'ak-log-row ak-log-pull-row';

  const cntWrap = document.createElement('div'); cntWrap.className = 'ak-log-cnt-wrap';
  const cntLbl  = document.createElement('span'); cntLbl.className = 'ak-log-lbl'; cntLbl.textContent = 'Pulls';
  const cntInp  = document.createElement('input');
  cntInp.type = 'number'; cntInp.min = '1'; cntInp.max = '300';
  cntInp.className = 'ak-log-cnt'; cntInp.value = '10';
  cntWrap.append(cntLbl, cntInp);
  row2.appendChild(cntWrap);

  // Rarity chips
  const rarWrap = document.createElement('div'); rarWrap.className = 'ak-log-rar-wrap';
  const rarLbl  = document.createElement('span'); rarLbl.className = 'ak-log-lbl'; rarLbl.textContent = 'Got';
  const rarChips = document.createElement('div'); rarChips.className = 'ak-rarity-chips';
  let selRarity = null;
  const rarBtns = {};
  RARITIES.forEach(r => {
    const b = document.createElement('button');
    b.className = 'ak-rarity-btn ' + RARITY_CLASS[r];
    b.textContent = r + '★';
    b.addEventListener('click', () => {
      selRarity = selRarity === r ? null : r;
      Object.entries(rarBtns).forEach(([rr, bb]) => bb.classList.toggle('active', Number(rr) === selRarity));
      // Show/hide operator row
      opRow.style.display = selRarity === 6 || selRarity === 5 ? '' : 'none';
    });
    rarBtns[r] = b; rarChips.appendChild(b);
  });
  rarWrap.append(rarLbl, rarChips);
  row2.appendChild(rarWrap);
  wrap.appendChild(row2);

  // Operator name (shown when 5★ or 6★)
  const opRow = document.createElement('div'); opRow.className = 'ak-log-row'; opRow.style.display = 'none';
  const opLbl = document.createElement('span'); opLbl.className = 'ak-log-lbl'; opLbl.textContent = 'Operator';
  const opInp = document.createElement('input');
  opInp.type = 'text'; opInp.className = 'ak-log-name'; opInp.placeholder = 'Name (optional)';
  // Datalist autocomplete if DB loaded
  const dlId = 'ak-op-dl';
  const dl = document.createElement('datalist'); dl.id = dlId;
  OP_LIST.filter(o => o.rarity >= 5)
    .sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name))
    .forEach(o => { const opt = document.createElement('option'); opt.value = o.name; dl.appendChild(opt); });
  opInp.setAttribute('list', dlId);
  opRow.append(opLbl, opInp, dl);
  wrap.appendChild(opRow);

  // Add button
  const addBtn = document.createElement('button'); addBtn.className = 'ak-log-add'; addBtn.textContent = '+ Log';
  addBtn.addEventListener('click', () => {
    const cnt    = parseInt(cntInp.value) || 1;
    const banner = s().banner;
    const oldPity = s().pity[banner] ?? 0;
    const newPity = selRarity === 6 ? 0 : oldPity + cnt;
    const pull = {
      id: uid(),
      date: new Date().toISOString().slice(0, 10),
      banner, count: cnt, rarity: selRarity,
      operator: opInp.value.trim() || null,
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
    const cntEl    = document.createElement('span'); cntEl.className    = 'ak-h-cnt';    cntEl.textContent    = p.count + 'x';
    const rarEl    = document.createElement('span');
    if (p.rarity) { rarEl.className = 'ak-rarity-tag ' + RARITY_CLASS[p.rarity]; rarEl.textContent = p.rarity + '★'; }
    const opEl  = document.createElement('span'); opEl.className = 'ak-h-op'; opEl.textContent = p.operator ?? '';
    const rm    = document.createElement('button'); rm.className = 'ak-h-rm'; rm.innerHTML = '&times;';
    rm.addEventListener('click', () => _save({ pulls: s().pulls.filter(x => x.id !== p.id) }));

    row.append(dateEl, bannerEl, cntEl, rarEl, opEl, rm);
    list.appendChild(row);
  });
  wrap.appendChild(list);
  return wrap;
}

// ── Operators ──────────────────────────────────────────────────────
function _renderOperators(el) {
  const filterBar = document.createElement('div'); filterBar.className = 'ak-filter-bar';

  const qInp = document.createElement('input');
  qInp.type = 'text'; qInp.className = 'ak-filter-q'; qInp.placeholder = 'Search…';
  qInp.value = _opFilter.q;
  qInp.addEventListener('input', () => { _opFilter.q = qInp.value; _renderOpList(list); });
  requestAnimationFrame(() => qInp.focus());

  const rarSel = document.createElement('select'); rarSel.className = 'ak-filter-sel';
  [{ v: 0, l: 'All rarities' }, ...RARITIES.map(r => ({ v: r, l: r + '★' }))].forEach(({ v, l }) => {
    const opt = document.createElement('option'); opt.value = v; opt.textContent = l;
    if (Number(v) === _opFilter.rarity) opt.selected = true;
    rarSel.appendChild(opt);
  });
  rarSel.addEventListener('change', () => { _opFilter.rarity = parseInt(rarSel.value); _renderOpList(list); });

  const profSel = document.createElement('select'); profSel.className = 'ak-filter-sel';
  [{ v: '', l: 'All classes' }, ...PROFESSIONS.map(p => ({ v: p, l: profLabel(p) }))].forEach(({ v, l }) => {
    const opt = document.createElement('option'); opt.value = v; opt.textContent = l;
    if (v === _opFilter.prof) opt.selected = true;
    profSel.appendChild(opt);
  });
  profSel.addEventListener('change', () => { _opFilter.prof = profSel.value; _renderOpList(list); });

  filterBar.append(qInp, rarSel, profSel);
  el.appendChild(filterBar);

  const list = document.createElement('div'); list.className = 'ak-op-list';
  el.appendChild(list);
  _renderOpList(list);
}

function _renderOpList(list) {
  list.innerHTML = '';
  const q    = _opFilter.q.toLowerCase();
  const rFil = _opFilter.rarity;
  const pFil = _opFilter.prof;

  const filtered = OP_LIST.filter(op => {
    if (rFil && op.rarity !== rFil) return false;
    if (pFil && op.profession !== pFil) return false;
    if (q && !op.name.toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name));

  filtered.forEach(op => {
    const owned = !!s().collection[op.id]?.owned;
    const row   = document.createElement('div'); row.className = 'ak-op-row' + (owned ? ' ak-op-owned' : '');

    // Rarity-colored avatar placeholder
    const avatarEl = document.createElement('div');
    avatarEl.className = 'ak-op-avatar-ph ' + RARITY_CLASS[op.rarity];
    avatarEl.textContent = op.name[0];

    const info   = document.createElement('div'); info.className = 'ak-op-info';
    const nameEl = document.createElement('span'); nameEl.className = 'ak-op-name'; nameEl.textContent = op.name;
    const sub    = document.createElement('span'); sub.className   = 'ak-op-sub';
    sub.textContent = profLabel(op.profession) + (op.limited ? ' · Limited' : op.collab ? ' · Collab' : '');
    info.append(nameEl, sub);

    const rar = document.createElement('span'); rar.className = 'ak-rarity-tag ' + RARITY_CLASS[op.rarity]; rar.textContent = op.rarity + '★';

    const ownBtn = document.createElement('button'); ownBtn.className = 'ak-own-btn' + (owned ? ' owned' : '');
    ownBtn.textContent = owned ? 'Owned' : 'Add';
    ownBtn.addEventListener('click', e => {
      e.stopPropagation();
      const col = { ...(s().collection ?? {}) };
      if (owned) {
        delete col[op.id];
      } else {
        col[op.id] = { owned: true, potential: 1, elite: 0, level: 1, favorite: false };
      }
      _save({ collection: col });
    });

    row.append(avatarEl, info, rar, ownBtn);
    list.appendChild(row);
  });

  if (!filtered.length) {
    const e = document.createElement('div'); e.className = 'ak-history-empty'; e.textContent = 'No operators match';
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
