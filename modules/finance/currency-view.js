// currency-view.js — currency lots sub-view inside finance panel

const CURRENCIES = [
  { code: 'USD', flag: '🇺🇸', symbol: '$',   name: 'US Dollar'         },
  { code: 'JPY', flag: '🇯🇵', symbol: '¥',   name: 'Japanese Yen'      },
  { code: 'IDR', flag: '🇮🇩', symbol: 'Rp',  name: 'Indonesian Rupiah' },
  { code: 'EUR', flag: '🇪🇺', symbol: '€',   name: 'Euro'              },
  { code: 'GBP', flag: '🇬🇧', symbol: '£',   name: 'British Pound'     },
  { code: 'SGD', flag: '🇸🇬', symbol: 'S$',  name: 'Singapore Dollar'  },
  { code: 'AUD', flag: '🇦🇺', symbol: 'A$',  name: 'Australian Dollar' },
  { code: 'CHF', flag: '🇨🇭', symbol: 'Fr',  name: 'Swiss Franc'       },
  { code: 'CNY', flag: '🇨🇳', symbol: '¥',   name: 'Chinese Yuan'      },
  { code: 'HKD', flag: '🇭🇰', symbol: 'HK$', name: 'Hong Kong Dollar'  },
  { code: 'KRW', flag: '🇰🇷', symbol: '₩',   name: 'South Korean Won'  },
  { code: 'THB', flag: '🇹🇭', symbol: '฿',   name: 'Thai Baht'         },
  { code: 'MYR', flag: '🇲🇾', symbol: 'RM',  name: 'Malaysian Ringgit' },
  { code: 'PHP', flag: '🇵🇭', symbol: '₱',   name: 'Philippine Peso'   },
  { code: 'TWD', flag: '🇹🇼', symbol: 'NT$', name: 'Taiwan Dollar'     },
];

const CUR_MAP     = Object.fromEntries(CURRENCIES.map(c => [c.code, c]));
const NO_DECIMALS = new Set(['JPY', 'IDR', 'KRW']);
const MAX_TARGETS = 5;

let _c = null, _d = null, _s = null;

function uid() { return Math.random().toString(36).slice(2, 9); }

function state() {
  const c = _d?.currency ?? {};
  return {
    currencies:   c.currencies   ?? [],
    lots:         c.lots         ?? [],
    targets:      c.targets      ?? ['JPY', 'IDR'],
    currentRates: c.currentRates ?? {},
  };
}

function persist(patch) {
  const cur = { ...state(), ...patch };
  _d = { ..._d, currency: cur };
  _s({ currency: cur });
}

function fmtAmt(amount, code) {
  if (amount == null) return '—';
  const sym = CUR_MAP[code]?.symbol ?? code;
  const val = NO_DECIMALS.has(code)
    ? Math.round(amount).toLocaleString()
    : amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sym}${val}`;
}

function fmtGain(gain, code) {
  if (gain == null) return null;
  const sym  = CUR_MAP[code]?.symbol ?? code;
  const sign = gain > 0 ? '+' : gain < 0 ? '−' : '±';
  const val  = NO_DECIMALS.has(code)
    ? Math.round(Math.abs(gain)).toLocaleString()
    : Math.abs(gain).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return { text: `${sign}${sym}${val}`, dir: gain > 0 ? 'up' : gain < 0 ? 'down' : 'flat' };
}

// ── Rate stepper ────────────────────────────────────────────────────
function rateStep(rate) {
  if (!rate || rate < 1)    return 0.01;
  if (rate < 10)            return 0.1;
  if (rate < 100)           return 1;
  if (rate < 10000)         return 10;
  return 100;
}

// ── Public API ─────────────────────────────────────────────────────
export function mount(container, data, onSave) {
  _c = container; _d = data; _s = onSave;
  _render();
}
export function update(newData) { _d = newData; }
export function unmount() { _c = _d = _s = null; }

// ── Render ─────────────────────────────────────────────────────────
function _render() {
  if (!_c) return;
  _c.innerHTML = '';
  const s = state();

  // Target chips bar
  _c.appendChild(_buildTargetsBar(s));

  // Card grid — ordered by currencies array, which is the source of truth for which cards exist
  const grid = document.createElement('div'); grid.className = 'fin-cur-grid';
  // Merge: currencies array + any currencies present in lots but not yet in the array
  const seen = [...s.currencies];
  s.lots.forEach(l => { if (!seen.includes(l.currency)) seen.push(l.currency); });
  seen.forEach(code => grid.appendChild(_buildCard(code, s)));

  // Add slot — same card size, toggles between ghost and picker in-place
  const addSlot = document.createElement('div'); addSlot.className = 'fin-cur-card2 fin-cur-add-slot';
  _renderAddSlot(addSlot, s);
  grid.appendChild(addSlot);
  _c.appendChild(grid);

  // Total bar
  if (seen.length && s.targets.length) {
    const bar = document.createElement('div'); bar.className = 'fin-cur-total-bar';
    const lbl = document.createElement('span'); lbl.className = 'fin-cur-total-lbl'; lbl.textContent = 'total held';
    bar.appendChild(lbl);
    const vals = document.createElement('div'); vals.className = 'fin-cur-total-vals';
    s.targets.forEach((t, i) => {
      if (i > 0) { const dot = document.createElement('span'); dot.className = 'fin-cur-total-dot'; dot.textContent = '·'; vals.appendChild(dot); }
      let sum = 0, hasAll = true;
      s.lots.forEach(l => {
        if (l.currency === t) { sum += l.amount || 0; return; }
        const r = s.currentRates?.[l.currency]?.[t];
        if (r) sum += (l.amount || 0) * r; else hasAll = false;
      });
      const v = document.createElement('span'); v.className = 'fin-cur-total-item';
      v.textContent = hasAll && seen.length ? fmtAmt(sum, t) : '—';
      vals.appendChild(v);
    });
    bar.appendChild(vals);
    _c.appendChild(bar);
  }
}

// ── Targets bar ────────────────────────────────────────────────────
function _buildTargetsBar(s) {
  const bar = document.createElement('div'); bar.className = 'fin-cur-targets';
  const lbl = document.createElement('span'); lbl.className = 'fin-cur-ref-lbl'; lbl.textContent = 'Convert to';
  bar.appendChild(lbl);
  const chips = document.createElement('div'); chips.className = 'fin-cur-target-chips';
  s.targets.forEach(t => {
    const chip = document.createElement('div'); chip.className = 'fin-cur-target-chip';
    const name = document.createElement('span'); name.textContent = `${CUR_MAP[t]?.flag ?? ''} ${t}`;
    const rm   = document.createElement('button'); rm.className = 'fin-cur-target-rm'; rm.innerHTML = '&times;';
    rm.addEventListener('click', () => { persist({ targets: s.targets.filter(x => x !== t) }); _render(); });
    chip.append(name, rm); chips.appendChild(chip);
  });
  if (s.targets.length < MAX_TARGETS) {
    const add = document.createElement('button'); add.className = 'fin-cur-target-add'; add.textContent = '+ Add';
    add.addEventListener('click', () => _showTargetPicker(add, s));
    chips.appendChild(add);
  }
  bar.appendChild(chips);
  return bar;
}

// ── Currency card ──────────────────────────────────────────────────
function _buildCard(code, s) {
  const cur  = CUR_MAP[code] ?? { code, flag: '🏳', symbol: code };
  const lots = s.lots.filter(l => l.currency === code);
  const totalAmt = lots.reduce((sum, l) => sum + (l.amount || 0), 0);

  const card = document.createElement('div'); card.className = 'fin-cur-card2';

  // ── Card top: flag + code + total amount ──
  const top = document.createElement('div'); top.className = 'fin-cur-card-top';
  const flag = document.createElement('span'); flag.className = 'fin-cur-card-flag'; flag.textContent = cur.flag;
  const info = document.createElement('div'); info.className = 'fin-cur-card-info';
  const codeEl = document.createElement('div'); codeEl.className = 'fin-cur-card-code'; codeEl.textContent = code;
  const amtEl  = document.createElement('div'); amtEl.className = 'fin-cur-card-amt';
  amtEl.textContent = NO_DECIMALS.has(code)
    ? Math.round(totalAmt).toLocaleString()
    : totalAmt.toLocaleString(undefined, { maximumFractionDigits: 2 });
  info.append(codeEl, amtEl);

  const rmCard = document.createElement('button'); rmCard.className = 'fin-cur-card-rm';
  rmCard.title = `Remove all ${code}`;
  rmCard.innerHTML = '<span class="material-symbols-outlined">close</span>';
  rmCard.addEventListener('click', () => {
    const s2 = state();
    persist({ currencies: s2.currencies.filter(c => c !== code), lots: s2.lots.filter(l => l.currency !== code) });
    _render();
  });
  top.append(flag, info, rmCard);
  card.appendChild(top);

  // ── Rate row: 1 CODE = [stepper per target] + converted totals ──
  const rateRow = document.createElement('div'); rateRow.className = 'fin-cur-card-ratebar';
  const ratePre = document.createElement('span'); ratePre.className = 'fin-cur-rate-pre'; ratePre.textContent = `1${code}=`;
  rateRow.appendChild(ratePre);

  s.targets.forEach(t => {
    if (t === code) return;
    const tc   = CUR_MAP[t];
    const cur_ = s.currentRates?.[code]?.[t] ?? null;

    const stepWrap = document.createElement('div'); stepWrap.className = 'fin-cur-stepper';
    const sym = document.createElement('span'); sym.className = 'fin-cur-stepper-sym'; sym.textContent = tc?.symbol ?? t;
    const inp = document.createElement('input');
    inp.type = 'number'; inp.step = 'any'; inp.min = '0';
    inp.className = 'fin-cur-stepper-inp';
    inp.value = cur_ ?? ''; inp.placeholder = '—';
    inp.addEventListener('change', () => _saveRate(code, t, parseFloat(inp.value) || null));
    const dn = document.createElement('button'); dn.className = 'fin-cur-step-btn'; dn.textContent = '−';
    const up = document.createElement('button'); up.className = 'fin-cur-step-btn'; up.textContent = '+';
    dn.addEventListener('click', () => {
      const v = parseFloat(inp.value) || 0;
      const step = rateStep(v);
      const nv = Math.max(0, Math.round((v - step) * 1e6) / 1e6);
      inp.value = nv; _saveRate(code, t, nv || null);
    });
    up.addEventListener('click', () => {
      const v = parseFloat(inp.value) || 0;
      const step = rateStep(v || 1);
      const nv = Math.round((v + step) * 1e6) / 1e6;
      inp.value = nv; _saveRate(code, t, nv);
    });
    stepWrap.append(sym, dn, inp, up);
    rateRow.appendChild(stepWrap);
  });
  card.appendChild(rateRow);

  // Computed totals line
  if (s.targets.some(t => t !== code && s.currentRates?.[code]?.[t])) {
    const totLine = document.createElement('div'); totLine.className = 'fin-cur-card-tots';
    s.targets.forEach(t => {
      if (t === code) return;
      const r = s.currentRates?.[code]?.[t];
      if (!r) return;
      const v = document.createElement('span'); v.className = 'fin-cur-card-tot-val';
      v.textContent = fmtAmt(totalAmt * r, t);
      totLine.appendChild(v);
    });
    card.appendChild(totLine);
  }

  // ── Divider ──
  const div = document.createElement('div'); div.className = 'fin-cur-card-divider';
  card.appendChild(div);

  // ── Lots ──
  lots.forEach(lot => card.appendChild(_buildLotRow(lot, code, s)));

  // ── P&L row ──
  const pnl = _computePnl(lots, code, s);
  if (pnl !== null) {
    const pnlRow = document.createElement('div'); pnlRow.className = 'fin-cur-pnl';
    const g = fmtGain(pnl.gain, pnl.target);
    if (g) {
      pnlRow.innerHTML = `<span class="fin-cur-pnl-lbl">P&amp;L</span><span class="fin-cur-pnl-val ${g.dir}">${g.text}</span>`;
    }
    card.appendChild(pnlRow);
  }

  // ── Add lot ──
  const addLot = document.createElement('button'); addLot.className = 'fin-cur-add-lot';
  addLot.textContent = '+ lot';
  addLot.addEventListener('click', () => _openAddLotForm(card, addLot, code, s));
  card.appendChild(addLot);

  return card;
}

function _computePnl(lots, code, s) {
  // Use the first target that has a current rate AND at least one lot with a buy rate
  const t = s.targets.find(t => t !== code && s.currentRates?.[code]?.[t] &&
    lots.some(l => l.buyRates?.[t]));
  if (!t) return null;
  const curRate = s.currentRates[code][t];
  let gain = 0;
  lots.forEach(l => {
    const br = l.buyRates?.[t];
    if (br) gain += (l.amount || 0) * (curRate - br);
  });
  return { gain, target: t };
}

// ── Lot row (compact) ──────────────────────────────────────────────
function _buildLotRow(lot, code, s) {
  const row = document.createElement('div'); row.className = 'fin-cur-lot-row';

  // Date (MM-YY)
  const dateEl = document.createElement('span'); dateEl.className = 'fin-cur-lot-date';
  dateEl.textContent = _fmtLotDate(lot.date);

  // Amount @ buy rate (pick first target with a buy rate)
  const t = s.targets.find(t => t !== code && lot.buyRates?.[t]);
  const mainEl = document.createElement('span'); mainEl.className = 'fin-cur-lot-main';
  if (t && lot.amount) {
    const br  = lot.buyRates[t];
    const sym = CUR_MAP[t]?.symbol ?? t;
    mainEl.textContent = `${_fmtCompact(lot.amount, code)}@${_fmtCompact(br, t)}`;
  } else {
    mainEl.textContent = _fmtCompact(lot.amount || 0, code);
  }

  // Gain
  const gainEl = document.createElement('span'); gainEl.className = 'fin-cur-lot-gain-cell';
  if (t) {
    const curRate = s.currentRates?.[code]?.[t];
    if (curRate && lot.amount && lot.buyRates?.[t]) {
      const gain = lot.amount * (curRate - lot.buyRates[t]);
      const g    = fmtGain(gain, t);
      if (g) { gainEl.textContent = g.text; gainEl.classList.add(g.dir); }
    }
  }

  const rm = document.createElement('button'); rm.className = 'fin-cur-lot-rm';
  rm.innerHTML = '&times;';
  rm.addEventListener('click', () => { persist({ lots: state().lots.filter(l => l.id !== lot.id) }); _render(); });

  row.append(dateEl, mainEl, gainEl, rm);
  return row;
}

// ── Add lot inline form ────────────────────────────────────────────
function _openAddLotForm(card, addBtn, code, s) {
  card.querySelector('.fin-cur-lot-form')?.remove();
  const cur = CUR_MAP[code] ?? { symbol: code };

  const form = document.createElement('div'); form.className = 'fin-cur-lot-form';

  // Date input (full date)
  const dateInp = document.createElement('input');
  dateInp.type = 'date'; dateInp.className = 'fin-cur-form-inp fin-cur-form-date';

  // Amount input
  const amtWrap = document.createElement('div'); amtWrap.className = 'fin-cur-form-amt-wrap';
  const amtSym  = document.createElement('span'); amtSym.className = 'fin-cur-form-sym'; amtSym.textContent = cur.symbol;
  const amtInp  = document.createElement('input');
  amtInp.type = 'number'; amtInp.step = 'any'; amtInp.min = '0'; amtInp.placeholder = '0';
  amtInp.className = 'fin-cur-form-inp';
  amtWrap.append(amtSym, amtInp);

  // Buy rate inputs per target
  const rateWrap = document.createElement('div'); rateWrap.className = 'fin-cur-form-rates';
  const rateInps = {};
  s.targets.forEach(t => {
    if (t === code) return;
    const tc = CUR_MAP[t];
    const wrap = document.createElement('div'); wrap.className = 'fin-cur-form-rate';
    const sym  = document.createElement('span'); sym.className = 'fin-cur-form-sym'; sym.textContent = `@${tc?.symbol ?? t}`;
    const inp  = document.createElement('input');
    inp.type = 'number'; inp.step = 'any'; inp.min = '0'; inp.placeholder = 'buy rate';
    inp.className = 'fin-cur-form-inp';
    rateInps[t] = inp;
    wrap.append(sym, inp); rateWrap.appendChild(wrap);
  });

  const ok = document.createElement('button'); ok.className = 'fin-cur-form-ok'; ok.textContent = 'Add';
  ok.addEventListener('click', () => {
    const amt = parseFloat(amtInp.value) || 0;
    if (!amt) return;
    const brs = {};
    s.targets.forEach(t => { if (rateInps[t]) { const v = parseFloat(rateInps[t].value); if (v) brs[t] = v; } });
    const dateStr = dateInp.value; // already YYYY-MM-DD from date input
    const newLot  = { id: uid(), currency: code, amount: amt, date: dateStr, buyRates: brs };
    persist({ lots: [...state().lots, newLot] });
    _render();
  });

  const cancel = document.createElement('button'); cancel.className = 'fin-cur-form-cancel'; cancel.textContent = '×';
  cancel.addEventListener('click', () => form.remove());

  form.append(dateInp, amtWrap, rateWrap, ok, cancel);
  addBtn.insertAdjacentElement('beforebegin', form);
  dateInp.focus();
}

// ── Helpers ────────────────────────────────────────────────────────
function _saveRate(code, target, val) {
  const cr = JSON.parse(JSON.stringify(state().currentRates ?? {}));
  if (val) { cr[code] = { ...(cr[code] ?? {}), [target]: val }; }
  else     { if (cr[code]) { delete cr[code][target]; if (!Object.keys(cr[code]).length) delete cr[code]; } }
  persist({ currentRates: cr });
  // Re-render just the value cells without full render for smoother UX
  _render();
}

function _fmtLotDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  if (!y) return '';
  if (d) return `${d}/${m}/${String(y).slice(2)}`;
  return `${m}/${String(y).slice(2)}`;
}

function _fmtCompact(val, code) {
  if (!val && val !== 0) return '—';
  if (NO_DECIMALS.has(code)) {
    const n = Math.round(val);
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return n.toLocaleString();
  }
  return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// ── Pickers ────────────────────────────────────────────────────────
function _renderAddSlot(el, s) {
  el.innerHTML = '';
  const taken     = new Set(s.currencies);
  const available = CURRENCIES.filter(c => !taken.has(c.code));
  if (!available.length) { el.style.display = 'none'; return; }
  el.style.display = '';

  // Ghost state
  const ghost = document.createElement('button'); ghost.className = 'fin-cur-add-ghost';
  ghost.innerHTML = '<span class="material-symbols-outlined">add</span>Add currency';
  ghost.addEventListener('click', () => {
    el.innerHTML = '';
    // Picker state (same card, different content)
    const title = document.createElement('div'); title.className = 'fin-cur-slot-title'; title.textContent = 'Add currency';
    const sel = document.createElement('select'); sel.className = 'fin-cur-slot-sel';
    available.forEach(c => {
      const opt = document.createElement('option'); opt.value = c.code;
      opt.textContent = `${c.flag} ${c.code} — ${c.name}`; sel.appendChild(opt);
    });
    const ok = document.createElement('button'); ok.className = 'fin-cur-slot-ok'; ok.textContent = 'Add currency';
    ok.addEventListener('click', () => {
      if (!sel.value) return;
      persist({ currencies: [...state().currencies, sel.value] }); _render();
    });
    const cancel = document.createElement('button'); cancel.className = 'fin-cur-slot-cancel'; cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => _renderAddSlot(el, state()));
    el.append(title, sel, ok, cancel);
  });
  el.appendChild(ghost);
}

function _showTargetPicker(btn, s) {
  _c?.querySelector('.fin-cur-picker')?.remove();
  const available = CURRENCIES.filter(c => !s.targets.includes(c.code));
  if (!available.length) return;
  const picker = _makePicker(available, '+ Add target', code => {
    persist({ targets: [...state().targets, code] }); _render();
  });
  btn.insertAdjacentElement('afterend', picker);
}

function _makePicker(options, confirmLabel, onConfirm) {
  const picker = document.createElement('div'); picker.className = 'fin-cur-picker';
  const sel = document.createElement('select'); sel.className = 'fin-cur-ref-sel';
  options.forEach(c => {
    const opt = document.createElement('option'); opt.value = c.code;
    opt.textContent = `${c.flag} ${c.code} — ${c.name}`; sel.appendChild(opt);
  });
  const ok = document.createElement('button'); ok.className = 'fin-cur-pick-confirm'; ok.textContent = confirmLabel;
  ok.addEventListener('click', () => { if (sel.value) { picker.remove(); onConfirm(sel.value); } });
  const cancel = document.createElement('button'); cancel.className = 'fin-cur-pick-cancel'; cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => picker.remove());
  picker.append(sel, ok, cancel);
  return picker;
}
