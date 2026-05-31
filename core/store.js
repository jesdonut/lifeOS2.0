// store.js — localStorage load/save, pub/sub

const KEY = 'lifeOS_data';

function defaultData() {
  return {
    version: 2,
    settings: {
      timezone:   'Asia/Tokyo',
      birthYear:  null,
      currencies: ['JPY', 'IDR'],
      weekStart:  1,
      setupDone:  true,
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
    },
    period:   { entries: [], spotting: [], symptoms: {}, discharge: {}, bbt: {}, settings: {} },
    calendar: { events: [], spendEntries: {} },
    finance:  { months: {} },
    currency: { holdings: [], reference: 'IDR', rates: null, ratesAt: null },
    nisa:     { contributions: [] },
    savings:  { accounts: [], bonds: [], deposits: [] },
    notes:    { items: [], countdowns: [] },
    tasks:    {},
  };
}

let _data = null;
const _subs = new Set();

export function load() {
  if (_data) return _data;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const defaults = defaultData();
      const stored   = JSON.parse(raw);
      _data = { ...defaults, ...stored, settings: { ...defaults.settings, ...(stored.settings ?? {}) } };
    } else {
      _data = defaultData();
    }
  } catch {
    _data = defaultData();
  }
  return _data;
}

export function save(partial) {
  Object.assign(_data, partial);
  localStorage.setItem(KEY, JSON.stringify(_data));
  _subs.forEach(fn => fn(_data));
}

export function get() { return _data ?? load(); }

export function subscribe(fn) {
  _subs.add(fn);
  return () => _subs.delete(fn);
}

export function exportBackup() {
  const blob = new Blob([JSON.stringify(_data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: `lifeOS-${new Date().toISOString().slice(0, 10)}.json`,
  });
  a.click();
  URL.revokeObjectURL(url);
}

export function importBackup(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => {
      try {
        _data = JSON.parse(e.target.result);
        localStorage.setItem(KEY, JSON.stringify(_data));
        _subs.forEach(fn => fn(_data));
        resolve(_data);
      } catch { reject(new Error('Invalid JSON')); }
    };
    r.readAsText(file);
  });
}
