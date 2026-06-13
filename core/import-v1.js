// import-v1.js — converts a v1 JSON export to v2 format and writes to localStorage

const STORE_KEY = 'lifeOS_data';

export function doImportV1(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const v1 = JSON.parse(e.target.result);
        if (!v1.events && !v1.period && !v1.finance) {
          reject(new Error('This does not look like a v1 LifeOS file.'));
          return;
        }
        const v2 = _convert(v1);
        localStorage.setItem(STORE_KEY, JSON.stringify(v2));
        resolve(v2);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsText(file);
  });
}

function _convert(v1) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    version:  2,
    settings: _settings(v1),
    calendar: _calendar(v1),
    period:   _period(v1),
    finance:  _finance(v1, today),
    notes:    _notes(v1),
    currency: _currency(v1),
    tasks:    _tasks(v1),
    nisa:     { contributions: [] },
    savings:  { accounts: [], bonds: [], deposits: [] },
  };
}

// ── Settings ───────────────────────────────────────────────────────

function _settings(v1) {
  return {
    timezone: 'Asia/Tokyo',
    birthYear: null,
    currencies: ['JPY', 'IDR'],
    weekStart: 1,
    setupDone: true,
    spendCategories: [
      { id: 'food',          name: 'Food',              color: '#e8824a', sub: ['Breakfast', 'Lunch', 'Dinner', 'Others'],                                        isCustom: false },
      { id: 'bills',         name: 'Bills',             color: '#5b8fce', sub: ['Gas', 'Water', 'Electricity', 'Internet', 'Mobile'],                            isCustom: false },
      { id: 'commute',       name: 'Commute',           color: '#4aae8f', sub: ['Work', 'Bus', 'Train', 'Airplane', 'Taxi', 'Ship', 'Car'],                      isCustom: false },
      { id: 'entertainment', name: 'Entertainment',     color: '#a06fd8', sub: ['Game', 'Movie', 'Clothes', 'Gadget'],                                           isCustom: false },
      { id: 'beauty',        name: 'Beauty',            color: '#e06b9a', sub: ['Pedicure', 'Manicure', 'Hair cut', 'Hair color', 'Eyebrow', 'Eyelash'],         isCustom: false },
      { id: 'paperwork',     name: 'Paperwork',         color: '#c9a84c', sub: ['Visa', 'Government', 'Ward office'],                                            isCustom: false },
      { id: 'medical',       name: 'Medical',           color: '#e06060', sub: ['Hospital', 'Clinic', 'Pharmacy'],                                               isCustom: false },
      { id: 'necessities',   name: 'Daily necessities', color: '#7aab7a', sub: ['Shampoo', 'Body soap', 'Conditioner', 'Toothbrush', 'Detergent', 'Dish soap'], isCustom: false },
    ],
  };
}

// ── Calendar ───────────────────────────────────────────────────────

const V1_SPEND_MAP = {
  transport: 'commute',
  fun:       'entertainment',
  clothes:   'entertainment',
  project:   'entertainment',
  insurance: null,
  nhi:       null,
};

const V1_COLOR_TO_CAT = {
  '#8fafa2': 'education',
  '#86afc5': 'family',
  '#7c9ccb': 'friends',
  '#c79a9a': 'health',
  '#b7a6b5': 'partner',
  '#d69aa5': 'personal',
  '#c49a73': 'project',
  '#d1b36a': 'travel',
  '#b8c89a': 'work',
};

function _calendar(v1) {
  const events = [];
  for (const [date, evts] of Object.entries(v1.events ?? {})) {
    for (const e of evts) {
      const category = V1_COLOR_TO_CAT[(e.color ?? '').toLowerCase()] ?? 'personal';
      events.push({ id: e.id, title: e.text, color: e.color, category, date });
    }
  }

  const spendEntries = {};

  // v1.spend: aggregated totals per category per day — goes back to 2021
  for (const [date, cats] of Object.entries(v1.spend ?? {})) {
    const day = [];
    for (const [v1CatId, amount] of Object.entries(cats)) {
      if (amount <= 0) continue;
      if (v1CatId in V1_SPEND_MAP) {
        const mapped = V1_SPEND_MAP[v1CatId];
        if (!mapped) continue;
        day.push({ id: 'imp_' + date + '_' + v1CatId, categoryId: mapped, subcategory: null, amount, currency: 'JPY' });
      } else {
        day.push({ id: 'imp_' + date + '_' + v1CatId, categoryId: v1CatId, subcategory: null, amount, currency: 'JPY' });
      }
    }
    if (day.length) spendEntries[date] = day;
  }

  // v1.spendLog: per-item detail — merges with spend for those dates
  for (const [date, cats] of Object.entries(v1.spendLog ?? {})) {
    const day = [];
    const coveredCats = new Set();
    for (const [v1CatId, items] of Object.entries(cats)) {
      if (v1CatId in V1_SPEND_MAP && !V1_SPEND_MAP[v1CatId]) continue;
      const categoryId = V1_SPEND_MAP[v1CatId] ?? v1CatId;
      coveredCats.add(v1CatId);
      for (const item of items) {
        day.push({
          id:          item.id,
          categoryId,
          subcategory: null,
          note:        item.label || null,
          amount:      item.amount,
          currency:    'JPY',
        });
      }
    }
    // Add any spend categories not present in spendLog (e.g. medical logged as total only)
    for (const [v1CatId, amount] of Object.entries(v1.spend?.[date] ?? {})) {
      if (amount <= 0 || coveredCats.has(v1CatId)) continue;
      if (v1CatId in V1_SPEND_MAP) {
        const mapped = V1_SPEND_MAP[v1CatId];
        if (!mapped) continue;
        day.push({ id: 'imp_' + date + '_' + v1CatId, categoryId: mapped, subcategory: null, amount, currency: 'JPY' });
      } else {
        day.push({ id: 'imp_' + date + '_' + v1CatId, categoryId: v1CatId, subcategory: null, amount, currency: 'JPY' });
      }
    }
    if (day.length) spendEntries[date] = day;
  }

  return { events, spendEntries };
}

// ── Period ─────────────────────────────────────────────────────────

function _period(v1) {
  const p = v1.period ?? {};

  const entries  = (p.entries ?? []).filter(e => e.start).map(e => {
    const len  = e.length ?? 1;
    const d    = new Date(e.start + 'T12:00:00');
    d.setDate(d.getDate() + len - 1);
    const end  = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return { id: e.id, start: e.start, end };
  });
  const spotting = [];
  const symptoms = {};

  for (const log of (p.symptomLogs ?? [])) {
    const date = log.date;
    if (!date) continue;

    if (log.flow === 'spotting') {
      if (!spotting.includes(date)) spotting.push(date);
    }

    if (log.symptoms?.length) {
      if (!symptoms[date]) symptoms[date] = {};
      for (const s of log.symptoms) symptoms[date][s] = true;
    }
  }

  return {
    entries,
    spotting,
    symptoms,
    discharge: {},
    bbt:       {},
    settings:  { defaultLength: p.defaultLength ?? 5 },
  };
}

// ── Finance ────────────────────────────────────────────────────────

const BILLS_MAP = [
  { v1: 'rent',            id: 'rent',        label: '家賃' },
  { v1: 'electricity',     id: 'electricity', label: '電気' },
  { v1: 'gas',             id: 'gas',         label: 'ガス' },
  { v1: 'water',           id: 'water',       label: '水道' },
  { v1: 'internet',        id: 'internet',    label: 'インターネット' },
  { v1: 'phone',           id: 'phone',       label: '携帯' },
  { v1: 'commutationPass', id: 'commute',     label: '定期券' },
];

const INCOME_MAP = [
  { v1: 'salary',         id: 'salary',      label: '給料',            isNeg: false },
  { v1: 'transportReimb', id: 'transport',   label: '交通費補助',       isNeg: false },
  { v1: 'otherIncome',    id: 'other',       label: 'その他収入',       isNeg: false },
  { v1: 'taxWithheld',    id: 'incometax',   label: '所得税',           isNeg: true  },
  { v1: 'incomeTax',      id: 'incometax',   label: '所得税',           isNeg: true  },
  { v1: 'insuranceDed',   id: 'health',      label: '健康保険',         isNeg: true  },
  { v1: 'healthIns',      id: 'health',      label: '健康保険',         isNeg: true  },
  { v1: 'pensionIns',     id: 'pension',     label: '厚生年金保険',     isNeg: true  },
  { v1: 'employmentIns',  id: 'employment',  label: '雇用保険',         isNeg: true  },
];

function _finance(v1, today) {
  const months = {};
  for (const [key, v] of Object.entries(v1.finance ?? {})) {
    const byId = new Map();
    for (const m of INCOME_MAP) {
      if (v[m.v1] == null || v[m.v1] === 0) continue;
      const existing = byId.get(m.id);
      if (!existing || v[m.v1] > existing.amount) {
        byId.set(m.id, { id: m.id, label: m.label, amount: v[m.v1], isNeg: m.isNeg });
      }
    }
    const billsById = new Map();
    for (const m of BILLS_MAP) {
      if (v[m.v1] == null || v[m.v1] === 0) continue;
      billsById.set(m.id, { id: m.id, label: m.label, amount: v[m.v1] });
    }

    if (byId.size || billsById.size) {
      months[key] = {};
      if (byId.size)    months[key].income = [...byId.values()];
      if (billsById.size) months[key].bills  = [...billsById.values()];
    }
  }

  // Extract NHI from v1.spend: entries keyed to first of month are monthly totals
  for (const [date, cats] of Object.entries(v1.spend ?? {})) {
    if (!date.endsWith('-01')) continue;
    const amount = cats['nhi'];
    if (!amount || amount <= 0) continue;
    const month = date.slice(0, 7);
    if (!months[month]) months[month] = {};
    const existing = months[month].income ?? [];
    if (!existing.find(r => r.id === 'nhi')) {
      existing.push({ id: 'nhi', label: '国民健康保険', amount, isNeg: true });
      months[month].income = existing;
    }
  }

  const investments = _bonds(v1, today);
  return { months, investments };
}

function _bonds(v1, today) {
  return (v1.bonds ?? []).map(b => ({
    id:                 b.id,
    country:            'ID',
    productType:        'governmentBond',
    displayName:        b.series,
    currency:           'IDR',
    principal:          b.faceValue ?? 0,
    couponRate:         (b.couponRate ?? 0) * 100,
    startDate:          b.settlementDate ?? null,
    maturityDate:       b.maturityDate ?? null,
    interestRate:       0,
    contributionAmount: 0,
    currentMarketValue: b.matured ? (b.faceValue ?? 0) : null,
    taxTreatment:       'taxable',
    notes:              b.matured ? 'Matured' : '',
    lastUpdated:        today,
  }));
}

// ── Notes ──────────────────────────────────────────────────────────

function _htmlToPlain(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/th>/gi, '  ')
    .replace(/<\/td>/gi, '  ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function _notes(v1) {
  const items = (v1.notes ?? []).map(n => ({
    id:        n.id,
    text:      _htmlToPlain(n.text ?? ''),
    createdAt: n.date ?? new Date().toISOString(),
  }));

  const countdowns = (v1.countdowns ?? []).map(c => ({
    id:     c.id,
    label:  c.label,
    date:   c.date,
    mode:   c.mode ?? 'since',
    yearly: c.yearly ?? false,
  }));

  return { items, countdowns };
}

// ── Tasks ──────────────────────────────────────────────────────────

function _tasks(v1) {
  const raw = v1.tasks ?? {};
  const out = {};
  for (const [date, items] of Object.entries(raw)) {
    const list = (items ?? []).map(t => ({ id: t.id, text: t.text ?? '', done: t.done ?? false }));
    if (list.length) out[date] = list;
  }
  return out;
}

// ── Currency ───────────────────────────────────────────────────────

function _currency(v1) {
  const lots = (v1.currencyLots ?? []).map(l => {
    const perUnit = l.amount > 0 ? l.rateIDR / l.amount : 0;
    return {
      id:       l.id,
      currency: l.code,
      amount:   l.amount,
      date:     l.date ?? null,
      buyRates: perUnit > 0 ? { IDR: perUnit } : {},
    };
  });

  // Uppercase-key rates: {MYR: {jpy: 39.66}} → {MYR: {JPY: 39.66}}
  const currentRates = {};
  for (const [code, rates] of Object.entries(v1.currencyRates ?? {})) {
    currentRates[code] = Object.fromEntries(
      Object.entries(rates).map(([k, v]) => [k.toUpperCase(), v])
    );
  }

  // Currency codes the user had added
  const currencies = Object.keys(v1.currencies ?? {}).filter(Boolean);

  return { currencies, lots, targets: ['JPY', 'IDR'], currentRates };
}
