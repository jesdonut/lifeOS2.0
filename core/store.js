// store.js — load/save from localStorage, notify subscribers

const KEY = 'lifeOS_data';

function defaultData() {
  return {
    version: 2,
    settings: {
      timezone: 'Asia/Tokyo',
      birthYear: null,
      currencies: ['JPY', 'IDR'],
    },
    period:   { entries: [], spotting: [], symptoms: {}, discharge: {}, bbt: {}, settings: {} },
    calendar: { events: [] },
    finance:  { months: {} },
    bank:     { accounts: [] },
    currency: { lots: [] },
    nisa:     { contributions: [] },
    savings:  { accounts: [], bonds: [], deposits: [] },
    notes:    { items: [] },
  };
}

let _data = null;
const _subs = new Set();

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    _data = raw ? JSON.parse(raw) : defaultData();
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

export function get() {
  return _data ?? load();
}

export function subscribe(fn) {
  _subs.add(fn);
  return () => _subs.delete(fn);
}

export function exportJSON() {
  const blob = new Blob([JSON.stringify(_data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: `lifeOS-backup-${new Date().toISOString().slice(0, 10)}.json`,
  });
  a.click();
  URL.revokeObjectURL(url);
}

export function importJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        _data = JSON.parse(e.target.result);
        localStorage.setItem(KEY, JSON.stringify(_data));
        _subs.forEach(fn => fn(_data));
        resolve(_data);
      } catch {
        reject(new Error('Invalid JSON'));
      }
    };
    reader.readAsText(file);
  });
}
