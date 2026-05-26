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
    bank:     { accounts: [] },
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
  for (const [date, cats] of Object.entries(v1.spendLog ?? {})) {
    const day = [];
    for (const [categoryId, items] of Object.entries(cats)) {
      for (const item of items) {
        day.push({
          id:          item.id,
          categoryId,
          subcategory: item.label || null,
          amount:      item.amount,
          currency:    'JPY',
        });
      }
    }
    if (day.length) spendEntries[date] = day;
  }

  return { events, spendEntries };
}

// ── Period ─────────────────────────────────────────────────────────

function _period(v1) {
  const p = v1.period ?? {};

  const entries  = (p.entries ?? []).map(e => ({ id: e.id, start: e.start, length: e.length ?? 1 }));
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

const INCOME_MAP = [
  { v1: 'salary',       id: 'salary',     label: '給料',            isNeg: false },
  { v1: 'transportReimb', id: 'transport', label: '交通費補助',       isNeg: false },
  { v1: 'otherIncome',  id: 'other',      label: 'その他収入',       isNeg: false },
  { v1: 'taxWithheld',  id: 'incometax',  label: '所得税',           isNeg: true  },
  { v1: 'insuranceDed', id: 'health',     label: '健康保険',         isNeg: true  },
];

function _finance(v1, today) {
  const months = {};
  for (const [key, v] of Object.entries(v1.finance ?? {})) {
    const rows = INCOME_MAP
      .filter(m => v[m.v1] != null && v[m.v1] !== 0)
      .map(m => ({ id: m.id, label: m.label, amount: v[m.v1], isNeg: m.isNeg }));
    if (rows.length) months[key] = { income: rows };
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
    currentMarketValue: null,
    taxTreatment:       'taxable',
    notes:              '',
    lastUpdated:        today,
  }));
}

// ── Notes ──────────────────────────────────────────────────────────

function _notes(v1) {
  const items = (v1.notes ?? []).map(n => ({
    id:        n.id,
    text:      n.text ?? '',
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
