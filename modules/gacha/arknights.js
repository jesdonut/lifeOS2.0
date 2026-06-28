// arknights.js — Arknights pity + pull tracker

// Pity rules: 6★ guaranteed at 300 pulls (limited) or 200 (standard); soft pity ~150
// Simplified: track pity per banner type, log pulls
const BANNERS = [
  { id: 'standard', label: 'Standard',  hard: 300 },
  { id: 'limited',  label: 'Limited',   hard: 300 },
  { id: 'collab',   label: 'Collab',    hard: 300 },
];

const RARITIES = ['6★', '5★', '4★', '3★'];
const RARITY_CLASS = { '6★': 'ak-r6', '5★': 'ak-r5', '4★': 'ak-r4', '3★': 'ak-r3' };

let _el, _state, _save;

function s() { return _state; }

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export function mountArknights(container, state, save) {
  _el    = container;
  _state = {
    orundum:   0,
    tickets:   0,
    banner:    'standard',
    pity:      { standard: 0, limited: 0, collab: 0 },
    pulls:     [],
    ...state,
  };
  _save  = patch => { _state = { ..._state, ...patch }; save(patch); _render(); };
  _render();
}

function _render() {
  _el.innerHTML = '';

  // Resources row
  _el.appendChild(_buildResources());

  // Banner selector + pity
  _el.appendChild(_buildBannerRow());

  // Log pull form
  _el.appendChild(_buildLogForm());

  // Pull history
  _el.appendChild(_buildHistory());
}

function _buildResources() {
  const wrap = document.createElement('div'); wrap.className = 'ak-resources';

  const fields = [
    { key: 'orundum', label: 'Orundum', icon: '💎' },
    { key: 'tickets', label: 'Tickets', icon: '🎫' },
  ];

  fields.forEach(f => {
    const card = document.createElement('div'); card.className = 'ak-res-card';
    const top  = document.createElement('div'); top.className  = 'ak-res-top';
    const ico  = document.createElement('span'); ico.textContent = f.icon;
    const lbl  = document.createElement('span'); lbl.className = 'ak-res-lbl'; lbl.textContent = f.label;
    top.append(ico, lbl);

    const valRow = document.createElement('div'); valRow.className = 'ak-res-val-row';
    const valEl  = document.createElement('span'); valEl.className = 'ak-res-val';
    valEl.textContent = s()[f.key].toLocaleString();

    const editBtn = document.createElement('button'); editBtn.className = 'ak-res-edit';
    editBtn.innerHTML = '<span class="material-symbols-outlined">edit</span>';

    let editing = false;
    editBtn.addEventListener('click', () => {
      if (editing) return;
      editing = true;
      valEl.style.display = 'none';
      editBtn.style.display = 'none';
      const inp = document.createElement('input');
      inp.type = 'number'; inp.className = 'ak-res-inp'; inp.value = s()[f.key]; inp.min = '0';
      const ok = document.createElement('button'); ok.className = 'ak-res-ok'; ok.textContent = 'Save';
      const doSave = () => { _save({ [f.key]: parseInt(inp.value) || 0 }); };
      ok.addEventListener('click', doSave);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') doSave(); if (e.key === 'Escape') _render(); });
      valRow.append(inp, ok);
      requestAnimationFrame(() => { inp.focus(); inp.select(); });
    });

    valRow.append(valEl, editBtn);
    card.append(top, valRow);
    wrap.appendChild(card);
  });

  // Pulls equivalent
  const totalPulls = Math.floor(s().orundum / 600) + s().tickets;
  const pullCard = document.createElement('div'); pullCard.className = 'ak-res-card ak-res-pulls';
  pullCard.innerHTML = `<div class="ak-res-top"><span>🎲</span><span class="ak-res-lbl">Pulls available</span></div><div class="ak-res-val">${totalPulls.toLocaleString()}</div>`;
  wrap.appendChild(pullCard);

  return wrap;
}

function _buildBannerRow() {
  const wrap = document.createElement('div'); wrap.className = 'ak-banner-row';

  const lbl = document.createElement('span'); lbl.className = 'ak-section-lbl'; lbl.textContent = 'Banner';
  wrap.appendChild(lbl);

  const toggle = document.createElement('div'); toggle.className = 'ak-banner-toggle';
  BANNERS.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'ak-banner-btn' + (s().banner === b.id ? ' active' : '');
    btn.textContent = b.label;
    btn.addEventListener('click', () => { if (s().banner !== b.id) _save({ banner: b.id }); });
    toggle.appendChild(btn);
  });
  wrap.appendChild(toggle);

  const banner = BANNERS.find(b => b.id === s().banner);
  const pity   = s().pity[s().banner] ?? 0;
  const pct    = Math.round((pity / banner.hard) * 100);

  const pityWrap = document.createElement('div'); pityWrap.className = 'ak-pity-wrap';
  const pityTop  = document.createElement('div'); pityTop.className = 'ak-pity-top';
  pityTop.innerHTML = `<span class="ak-pity-lbl">Pity</span><span class="ak-pity-val">${pity} <span class="ak-pity-max">/ ${banner.hard}</span></span>`;

  const bar = document.createElement('div'); bar.className = 'ak-pity-bar';
  const fill = document.createElement('div'); fill.className = 'ak-pity-fill';
  fill.style.width = pct + '%';
  if (pct >= 80) fill.classList.add('ak-pity-fill--warn');
  bar.appendChild(fill);

  pityWrap.append(pityTop, bar);
  wrap.appendChild(pityWrap);

  return wrap;
}

function _buildLogForm() {
  const wrap = document.createElement('div'); wrap.className = 'ak-log-form';

  const lbl = document.createElement('span'); lbl.className = 'ak-section-lbl'; lbl.textContent = 'Log pull';
  wrap.appendChild(lbl);

  const row = document.createElement('div'); row.className = 'ak-log-row';

  // Count
  const cntInp = document.createElement('input');
  cntInp.type = 'number'; cntInp.min = '1'; cntInp.max = '200';
  cntInp.className = 'ak-log-cnt'; cntInp.value = '10'; cntInp.placeholder = 'pulls';

  // Rarity chips
  const rarityWrap = document.createElement('div'); rarityWrap.className = 'ak-rarity-chips';
  let selRarity = null;
  const rarityBtns = {};
  RARITIES.forEach(r => {
    const b = document.createElement('button');
    b.className = 'ak-rarity-btn ' + RARITY_CLASS[r];
    b.textContent = r;
    b.addEventListener('click', () => {
      selRarity = selRarity === r ? null : r;
      Object.entries(rarityBtns).forEach(([rr, bb]) => bb.classList.toggle('active', rr === selRarity));
    });
    rarityBtns[r] = b;
    rarityWrap.appendChild(b);
  });

  // Operator name
  const nameInp = document.createElement('input');
  nameInp.type = 'text'; nameInp.className = 'ak-log-name'; nameInp.placeholder = 'Operator name (optional)';

  const addBtn = document.createElement('button'); addBtn.className = 'ak-log-add'; addBtn.textContent = '+ Log';
  addBtn.addEventListener('click', () => {
    const cnt = parseInt(cntInp.value) || 1;
    const banner = s().banner;
    const newPity = (s().pity[banner] ?? 0) + cnt;
    const pull = {
      id: uid(), date: new Date().toISOString().slice(0, 10),
      banner, count: cnt, rarity: selRarity, operator: nameInp.value.trim() || null,
    };
    const finalPity = selRarity === '6★' ? 0 : newPity;
    _save({
      pulls: [pull, ...s().pulls],
      pity:  { ...s().pity, [banner]: finalPity },
    });
  });

  row.append(cntInp, rarityWrap, nameInp, addBtn);
  wrap.append(lbl, row);
  return wrap;
}

function _buildHistory() {
  const wrap = document.createElement('div'); wrap.className = 'ak-history';
  const hdr  = document.createElement('div'); hdr.className = 'ak-history-hdr';
  hdr.textContent = 'Pull log';
  wrap.appendChild(hdr);

  if (!s().pulls.length) {
    const empty = document.createElement('div'); empty.className = 'ak-history-empty';
    empty.textContent = 'No pulls logged yet';
    wrap.appendChild(empty);
    return wrap;
  }

  const list = document.createElement('div'); list.className = 'ak-history-list';
  s().pulls.slice(0, 50).forEach(p => {
    const row = document.createElement('div'); row.className = 'ak-history-row';

    const dateEl = document.createElement('span'); dateEl.className = 'ak-h-date'; dateEl.textContent = p.date ?? '';
    const bannerEl = document.createElement('span'); bannerEl.className = 'ak-h-banner'; bannerEl.textContent = BANNERS.find(b => b.id === p.banner)?.label ?? p.banner;
    const cntEl = document.createElement('span'); cntEl.className = 'ak-h-cnt'; cntEl.textContent = p.count + ' pulls';
    const rarEl = document.createElement('span');
    if (p.rarity) { rarEl.className = 'ak-rarity-tag ' + RARITY_CLASS[p.rarity]; rarEl.textContent = p.rarity; }
    const opEl  = document.createElement('span'); opEl.className = 'ak-h-op'; opEl.textContent = p.operator ?? '';

    const rm = document.createElement('button'); rm.className = 'ak-h-rm'; rm.innerHTML = '&times;';
    rm.addEventListener('click', () => _save({ pulls: s().pulls.filter(x => x.id !== p.id) }));

    row.append(dateEl, bannerEl, cntEl, rarEl, opEl, rm);
    list.appendChild(row);
  });
  wrap.appendChild(list);
  return wrap;
}
