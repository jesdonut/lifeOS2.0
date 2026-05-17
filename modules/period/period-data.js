// period-data.js — all math, no DOM

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function fd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function daysBetween(a, b) {
  return Math.round((b - a) / 86400000);
}

export function getPeriodEntries(data) {
  return [...(data.period?.entries ?? [])].sort((a, b) => a.start.localeCompare(b.start));
}

export function periodStats(entries) {
  if (entries.length < 2) return null;

  const allCycles = [];
  for (let i = 1; i < entries.length; i++) {
    allCycles.push(daysBetween(parseDate(entries[i - 1].start), parseDate(entries[i].start)));
  }

  // Only filter < 21 days (data artifacts). Long cycles are real — do not exclude.
  const usable = allCycles.filter(l => l >= 21);
  if (!usable.length) return null;

  // Exponential weighted moving average — all cycles contribute, recent ones count more.
  // λ=0.88: weight halves every ~5 cycles. A cycle from 5 years ago still counts, just less.
  const lambda = 0.88;
  let wSum = 0, wTotal = 0;
  for (let i = 0; i < usable.length; i++) {
    const w = Math.pow(lambda, usable.length - 1 - i);
    wSum   += usable[i] * w;
    wTotal += w;
  }
  const avg = wSum / wTotal;

  // Weighted stdev
  let wVarSum = 0;
  for (let i = 0; i < usable.length; i++) {
    const w = Math.pow(lambda, usable.length - 1 - i);
    wVarSum += w * Math.pow(usable[i] - avg, 2);
  }
  const stdev = Math.sqrt(wVarSum / wTotal);

  const sorted = [...usable].sort((a, b) => a - b);

  return {
    avg:       Math.round(avg),
    med:       sorted[Math.floor(sorted.length / 2)],
    min:       sorted[0],
    max:       sorted[sorted.length - 1],
    stdev:     Math.round(stdev * 10) / 10,
    count:     usable.length,
    windowMin: Math.round(avg - stdev),
    windowMax: Math.round(avg + stdev),
    irregular: stdev > 9,
  };
}

export function currentWindow(entries, stats) {
  if (!entries.length || !stats) return null;
  const last = parseDate(entries[entries.length - 1].start);
  return {
    earliest: addDays(last, stats.windowMin),
    center:   addDays(last, stats.avg),
    latest:   addDays(last, stats.windowMax),
  };
}

export function futurePredictions(entries, stats, n = 5) {
  if (!entries.length || !stats) return [];
  const last = parseDate(entries[entries.length - 1].start);
  // Uncertainty compounds: window widens honestly for further predictions
  return Array.from({ length: n }, (_, i) => {
    const k = i + 1;
    const spread = Math.round(Math.sqrt(k) * stats.stdev);
    return {
      earliest: addDays(last, stats.avg * k - spread),
      center:   addDays(last, stats.avg * k),
      latest:   addDays(last, stats.avg * k + spread),
    };
  });
}

export function ovulationDay(window) {
  return addDays(window.center, -14);
}

export function fertileWindow(window) {
  const ov = ovulationDay(window);
  return { start: addDays(ov, -5), end: addDays(ov, 5) };
}

export function isTravelAdjusted(window, travelDates = []) {
  return travelDates.some(d => {
    const td = parseDate(d);
    return td >= window.earliest && td <= window.latest;
  });
}

export function mergeEntry(entries, dateStr, field, value) {
  let sorted = [...entries].sort((a, b) => a.start.localeCompare(b.start));
  const d = parseDate(dateStr);

  let targetIdx = -1;
  let placement = null;

  for (let i = 0; i < sorted.length; i++) {
    const start = parseDate(sorted[i].start);
    const end   = parseDate(sorted[i].end);

    if (d >= start && d <= end)          { targetIdx = i; placement = 'within';      break; }
    if (daysBetween(d, start) === 1)     { targetIdx = i; placement = 'beforeStart'; break; }
    if (daysBetween(end, d) === 1)       { targetIdx = i; placement = 'afterEnd';    break; }
  }

  if (targetIdx === -1) {
    const entry = {
      id: 'p_' + dateStr.replaceAll('-', '_'),
      start: dateStr, end: dateStr,
      flow: {}, symptoms: {}, bbt: {}, discharge: {}, notes: '',
    };
    if (field === 'notes') entry.notes = value;
    else entry[field] = { [dateStr]: value };
    sorted = [...sorted, entry].sort((a, b) => a.start.localeCompare(b.start));
  } else {
    sorted = sorted.map((e, i) => {
      if (i !== targetIdx) return e;
      const updated = { ...e };
      if (field === 'notes') updated.notes = value;
      else updated[field] = { ...e[field], [dateStr]: value };
      if (placement === 'beforeStart') updated.start = dateStr;
      if (placement === 'afterEnd')    updated.end   = dateStr;
      return updated;
    });
  }

  // Merge any entries that are now adjacent (gap of 1 day)
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = daysBetween(parseDate(sorted[i].end), parseDate(sorted[i + 1].start));
      if (gap === 1) {
        const a = sorted[i], b = sorted[i + 1];
        const merged = {
          id: a.id,
          start: a.start,
          end: b.end,
          flow:      { ...a.flow,      ...b.flow },
          symptoms:  { ...a.symptoms,  ...b.symptoms },
          bbt:       { ...a.bbt,       ...b.bbt },
          discharge: { ...a.discharge, ...b.discharge },
          notes: [a.notes, b.notes].filter(Boolean).join(' / '),
        };
        sorted = [...sorted.slice(0, i), merged, ...sorted.slice(i + 2)];
        changed = true;
        break;
      }
    }
  }

  return sorted;
}
