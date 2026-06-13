// import-delta.js — merges a mobile delta JSON into the main v2 store

const STORE_KEY = 'lifeOS_data';

export function doImportDelta(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const delta = JSON.parse(e.target.result);
        if (delta.type !== 'delta' || delta.version !== 2) {
          reject(new Error('Not a valid LifeOS mobile delta file.'));
          return;
        }
        const raw = localStorage.getItem(STORE_KEY);
        if (!raw) {
          reject(new Error('No main data found. Load your main data first.'));
          return;
        }
        const main   = JSON.parse(raw);
        const result = _merge(main, delta);
        localStorage.setItem(STORE_KEY, JSON.stringify(result));
        resolve(_summary(delta));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsText(file);
  });
}

function _merge(main, delta) {
  return {
    ...main,
    calendar: _mergeCalendar(main.calendar ?? {}, delta.calendar ?? {}),
    period:   _mergePeriod(main.period ?? {}, delta.period ?? {}),
    tasks:    _mergeTasks(main.tasks ?? {}, delta.tasks ?? {}),
  };
}

function _mergeCalendar(main, delta) {
  // spendEntries: merge by entry ID per date
  const se = { ...main.spendEntries };
  for (const [date, entries] of Object.entries(delta.spendEntries ?? {})) {
    const existIds = new Set((se[date] ?? []).map(e => e.id));
    const incoming = entries.filter(e => !existIds.has(e.id));
    if (incoming.length) se[date] = [...(se[date] ?? []), ...incoming];
  }

  // events: merge by ID
  const existEventIds = new Set((main.events ?? []).map(e => e.id));
  const newEvents = (delta.events ?? []).filter(e => !existEventIds.has(e.id));

  return {
    ...main,
    spendEntries: se,
    events: [...(main.events ?? []), ...newEvents],
  };
}

function _mergePeriod(main, delta) {
  // entries: add by ID (simple merge — no mergeEntry boundary logic needed since mobile adds single-day entries)
  const existIds = new Set((main.entries ?? []).map(e => e.id));
  const newEntries = (delta.entries ?? []).filter(e => !existIds.has(e.id));

  // spotting: union
  const spotting = [...new Set([...(main.spotting ?? []), ...(delta.spotting ?? [])])];

  // symptoms: merge per date
  const symptoms = { ...main.symptoms };
  for (const [date, syms] of Object.entries(delta.symptoms ?? {})) {
    symptoms[date] = { ...(symptoms[date] ?? {}), ...syms };
  }

  return {
    ...main,
    entries:  [...(main.entries ?? []), ...newEntries],
    spotting,
    symptoms,
  };
}

function _mergeTasks(main, delta) {
  const out = { ...main };
  for (const [date, items] of Object.entries(delta)) {
    const existIds = new Set((out[date] ?? []).map(t => t.id));
    const incoming = items.filter(t => !existIds.has(t.id));
    if (incoming.length) out[date] = [...(out[date] ?? []), ...incoming];
  }
  return out;
}

function _summary(delta) {
  const spendCount  = Object.values(delta.calendar?.spendEntries ?? {}).flat().length;
  const eventCount  = (delta.calendar?.events ?? []).length;
  const periodCount = (delta.period?.entries ?? []).length + (delta.period?.spotting ?? []).length;
  const taskCount   = Object.values(delta.tasks ?? {}).flat().length;
  const parts = [];
  if (spendCount)  parts.push(`${spendCount} spend ${spendCount === 1 ? 'entry' : 'entries'}`);
  if (eventCount)  parts.push(`${eventCount} ${eventCount === 1 ? 'event' : 'events'}`);
  if (periodCount) parts.push(`${periodCount} period log${periodCount === 1 ? '' : 's'}`);
  if (taskCount)   parts.push(`${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`);
  return parts.length ? 'Merged: ' + parts.join(', ') + '.' : 'Nothing new to merge.';
}
