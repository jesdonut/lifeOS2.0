// currency-view.js — currency holdings sub-view inside finance panel

const CURRENCIES = [
  { code: 'USD', flag: '🇺🇸', symbol: '$',   name: 'US Dollar'           },
  { code: 'JPY', flag: '🇯🇵', symbol: '¥',   name: 'Japanese Yen'        },
  { code: 'IDR', flag: '🇮🇩', symbol: 'Rp',  name: 'Indonesian Rupiah'   },
  { code: 'EUR', flag: '🇪🇺', symbol: '€',   name: 'Euro'                },
  { code: 'GBP', flag: '🇬🇧', symbol: '£',   name: 'British Pound'       },
  { code: 'SGD', flag: '🇸🇬', symbol: 'S$',  name: 'Singapore Dollar'    },
  { code: 'AUD', flag: '🇦🇺', symbol: 'A$',  name: 'Australian Dollar'   },
  { code: 'CHF', flag: '🇨🇭', symbol: 'Fr',  name: 'Swiss Franc'         },
  { code: 'CNY', flag: '🇨🇳', symbol: '¥',   name: 'Chinese Yuan'        },
  { code: 'HKD', flag: '🇭🇰', symbol: 'HK$', name: 'Hong Kong Dollar'    },
  { code: 'KRW', flag: '🇰🇷', symbol: '₩',   name: 'South Korean Won'    },
  { code: 'THB', flag: '🇹🇭', symbol: '฿',   name: 'Thai Baht'           },
  { code: 'MYR', flag: '🇲🇾', symbol: 'RM',  name: 'Malaysian Ringgit'   },
  { code: 'PHP', flag: '🇵🇭', symbol: '₱',   name: 'Philippine Peso'     },
  { code: 'TWD', flag: '🇹🇼', symbol: 'NT$', name: 'Taiwan Dollar'       },
];

const CUR_MAP   = Object.fromEntries(CURRENCIES.map(c => [c.code, c]));
const RATES_URL = 'https://open.er-api.com/v6/latest/USD';
const RATES_TTL = 3_600_000; // 1 hour

let _c = null;
let _d = null;
let _s = null;
let _fetching = false;

function uid()   { return Math.random().toString(36).slice(2, 9); }
function state() { return _d?.currency ?? { holdings: [], reference: 'IDR', rates: null, ratesAt: null }; }

function persist(patch) {
  const cur = { ...state(), ...patch };
  _d = { ..._d, currency: cur };
  _s({ currency: cur });
}

function convert(amount, from, to, rates) {
  if (!rates || !rates[from] || !rates[to]) return null;
  return amount * (rates[to] / rates[from]);
}

function fmt(amount, code) {
  if (amount === null || amount === undefined) return '—';
  const cur = CUR_MAP[code];
  const sym = cur ? cur.symbol : code;
  const noDecimals = ['JPY', 'IDR', 'KRW'];
  const val = noDecimals.includes(code)
    ? Math.round(amount).toLocaleString()
    : amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sym} ${val}`;
}

// ── Public API ─────────────────────────────────────────────────────
export function mount(container, data, onSave) {
  _c = container;
  _d = data;
  _s = onSave;
  _render();
  _autoFetch();
}

export function update(newData) {
  _d = newData;
}

export function unmount() {
  _c = _d = _s = null;
}

// ── Exchange rates ─────────────────────────────────────────────────
async function _autoFetch() {
  const s = state();
  if (s.rates && (Date.now() - new Date(s.ratesAt).getTime()) < RATES_TTL) return;
  await _fetchRates();
}

async function _fetchRates() {
  if (_fetching) return;
  _fetching = true;
  _setStatus('Fetching rates…');
  _setRefreshDisabled(true);
  try {
    const res  = await fetch(RATES_URL);
    const json = await res.json();
    if (json.result !== 'success') throw new Error('bad response');
    persist({ rates: json.rates, ratesAt: new Date().toISOString() });
    _updateConversions();
    _setStatus(_ratesLabel());
  } catch {
    _setStatus('Could not fetch rates');
  } finally {
    _fetching = false;
    _setRefreshDisabled(false);
  }
}

function _ratesLabel() {
  const s = state();
  if (!s.ratesAt) return 'No rate data';
  const d = new Date(s.ratesAt);
  return `Updated ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

function _setStatus(text) {
  if (!_c) return;
  const el = _c.querySelector('.fin-cur-status');
  if (el) el.textContent = text;
}

function _setRefreshDisabled(val) {
  if (!_c) return;
  const btn = _c.querySelector('.fin-cur-refresh');
  if (btn) btn.disabled = val;
}

// ── Live conversion update (no re-render) ─────────────────────────
function _updateConversions() {
  if (!_c) return;
  const { reference, rates } = state();
  _c.querySelectorAll('.fin-cur-card').forEach(card => {
    const inp  = card.querySelector('.fin-cur-amt-inp');
    const conv = card.querySelector('.fin-cur-conv');
    if (!inp || !conv) return;
    const amt = parseFloat(inp.value) || 0;
    conv.textContent = fmt(convert(amt, card.dataset.code, reference, rates), reference);
  });
  _updateTotal();
}

function _updateTotal() {
  if (!_c) return;
  const { reference, rates } = state();
  const totalEl = _c.querySelector('.fin-cur-total-val');
  if (!totalEl) return;
  if (!rates) { totalEl.textContent = '—'; return; }
  let total = 0;
  _c.querySelectorAll('.fin-cur-card').forEach(card => {
    const amt = parseFloat(card.querySelector('.fin-cur-amt-inp')?.value) || 0;
    const v = convert(amt, card.dataset.code, reference, rates);
    if (v !== null) total += v;
  });
  totalEl.textContent = fmt(total, reference);
}

// ── Render ─────────────────────────────────────────────────────────
function _render() {
  if (!_c) return;
  _c.innerHTML = '';
  const s = state();

  // Control bar
  const ctrl = document.createElement('div'); ctrl.className = 'fin-cur-ctrl';

  const refWrap = document.createElement('div'); refWrap.className = 'fin-cur-ref-wrap';
  const refLbl  = document.createElement('span'); refLbl.className = 'fin-cur-ref-lbl';
  refLbl.textContent = 'Convert to';
  const refSel = document.createElement('select'); refSel.className = 'fin-cur-ref-sel';
  CURRENCIES.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.code;
    opt.textContent = `${c.flag} ${c.code}`;
    if (c.code === s.reference) opt.selected = true;
    refSel.appendChild(opt);
  });
  refSel.addEventListener('change', () => {
    persist({ reference: refSel.value });
    _updateConversions();
  });
  refWrap.append(refLbl, refSel);

  const statusEl = document.createElement('span'); statusEl.className = 'fin-cur-status';
  statusEl.textContent = _ratesLabel();

  const refreshBtn = document.createElement('button'); refreshBtn.className = 'fin-cur-refresh';
  refreshBtn.textContent = 'Refresh rates';
  refreshBtn.addEventListener('click', () => _fetchRates());

  ctrl.append(refWrap, statusEl, refreshBtn);
  _c.appendChild(ctrl);

  // Card list
  const list = document.createElement('div'); list.className = 'fin-cur-list';
  s.holdings.forEach(h => list.appendChild(_buildCard(h, s)));

  Sortable.create(list, {
    handle:    '.fin-cur-drag',
    animation: 120,
    onEnd() {
      const ids  = [...list.querySelectorAll('.fin-cur-card')].map(el => el.dataset.id);
      const hMap = Object.fromEntries(state().holdings.map(h => [h.id, h]));
      persist({ holdings: ids.map(id => hMap[id]).filter(Boolean) });
    },
  });
  _c.appendChild(list);

  // Add button
  const addBtn = document.createElement('button'); addBtn.className = 'fin-cur-add';
  addBtn.innerHTML = '<span class="material-symbols-outlined">add</span>Add currency';
  addBtn.addEventListener('click', () => _showPicker(list, addBtn));
  _c.appendChild(addBtn);

  // Total
  const totalRow = document.createElement('div'); totalRow.className = 'fin-cur-total';
  totalRow.innerHTML = '<span>Total</span><span class="fin-cur-total-val">—</span>';
  _c.appendChild(totalRow);

  _updateConversions();
}

function _buildCard(h, s) {
  const cur  = CUR_MAP[h.currency] ?? { code: h.currency, flag: '🏳', symbol: h.currency };
  const card = document.createElement('div');
  card.className = 'fin-cur-card';
  card.dataset.id   = h.id;
  card.dataset.code = h.currency;

  const drag = document.createElement('span');
  drag.className = 'fin-cur-drag material-symbols-outlined';
  drag.textContent = 'drag_indicator';

  const flagEl = document.createElement('span'); flagEl.className = 'fin-cur-flag';
  flagEl.textContent = `${cur.flag} ${cur.code}`;

  const inpWrap = document.createElement('div');
  inpWrap.className = 'fin-inp-wrap' + (h.amount ? ' filled' : '');
  const symEl = document.createElement('span'); symEl.className = 'fin-yen'; symEl.textContent = cur.symbol;
  const inp   = document.createElement('input');
  inp.type = 'number'; inp.step = 'any'; inp.min = '0';
  inp.className = 'fin-cur-amt-inp';
  inp.value = h.amount || '';
  inp.placeholder = '0';
  inp.addEventListener('input', () => {
    const amt  = parseFloat(inp.value) || 0;
    const { reference, rates } = state();
    convEl.textContent = fmt(convert(amt, h.currency, reference, rates), reference);
    inpWrap.classList.toggle('filled', amt > 0);
    _updateTotal();
  });
  inp.addEventListener('change', () => {
    const amt = parseFloat(inp.value) || 0;
    persist({ holdings: state().holdings.map(x => x.id === h.id ? { ...x, amount: amt } : x) });
  });
  inpWrap.append(symEl, inp);

  const eqEl   = document.createElement('span'); eqEl.className = 'fin-cur-eq'; eqEl.textContent = '=';
  const convEl = document.createElement('span'); convEl.className = 'fin-cur-conv';
  convEl.textContent = fmt(convert(h.amount || 0, h.currency, s.reference, s.rates), s.reference);

  const rmBtn = document.createElement('button'); rmBtn.className = 'fin-rm-btn';
  rmBtn.innerHTML = '<span class="material-symbols-outlined">close</span>';
  rmBtn.title = 'Remove';
  rmBtn.addEventListener('click', () => {
    persist({ holdings: state().holdings.filter(x => x.id !== h.id) });
    card.remove();
    _updateTotal();
  });

  card.append(drag, flagEl, inpWrap, eqEl, convEl, rmBtn);
  return card;
}

function _showPicker(list, addBtn) {
  if (list.querySelector('.fin-cur-picker')) return;
  const taken = new Set(state().holdings.map(h => h.currency));
  const available = CURRENCIES.filter(c => !taken.has(c.code));
  if (!available.length) return;

  const picker = document.createElement('div'); picker.className = 'fin-cur-picker';

  const sel = document.createElement('select'); sel.className = 'fin-cur-ref-sel';
  available.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.code;
    opt.textContent = `${c.flag} ${c.code} — ${c.name}`;
    sel.appendChild(opt);
  });

  const confirmBtn = document.createElement('button'); confirmBtn.className = 'fin-cur-pick-confirm';
  confirmBtn.textContent = 'Add';
  confirmBtn.addEventListener('click', () => {
    const code = sel.value; if (!code) return;
    const newH = { id: uid(), currency: code, amount: 0 };
    persist({ holdings: [...state().holdings, newH] });
    picker.remove();
    list.insertBefore(_buildCard(newH, state()), null);
    _updateConversions();
  });

  const cancelBtn = document.createElement('button'); cancelBtn.className = 'fin-cur-pick-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => picker.remove());

  picker.append(sel, confirmBtn, cancelBtn);
  list.insertBefore(picker, null);
}
