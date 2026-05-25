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

function mean(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdev(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function percentile(arr, p) {
  const s = [...arr].sort((a, b) => a - b);
  const i = p * (s.length - 1);
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? s[lo] : s[lo] + (i - lo) * (s[hi] - s[lo]);
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

  // Exclude obvious artifacts (< 21 days). Long cycles are valid data, keep them.
  const validCycles = allCycles.filter(l => l >= 21);
  if (!validCycles.length) return null;

  // Use most recent 12 valid completed cycles for all calculations.
  const recent = validCycles.slice(-12);

  const avg  = Math.round(mean(recent));
  const med  = Math.round(median(recent));
  const sd   = Math.round(stdev(recent) * 10) / 10;
  const sorted = [...recent].sort((a, b) => a - b);

  const shortestCycle = sorted[0];
  const longestCycle  = sorted[sorted.length - 1];
  const variationDays = longestCycle - shortestCycle;

  // Prediction window: p20/p80 bounds, widened by at least 1 stdev on each side.
  // Guarantees at least a 4-day spread so the window is never misleadingly narrow.
  const p20 = percentile(recent, 0.20);
  const p80 = percentile(recent, 0.80);
  let windowMin = Math.floor(Math.min(p20, med - Math.max(2, sd)));
  let windowMax = Math.ceil(Math.max(p80,  med + Math.max(2, sd)));
  if (windowMax - windowMin < 4) {
    const c = Math.round((windowMin + windowMax) / 2);
    windowMin = c - 2;
    windowMax = c + 2;
  }

  // Length pattern: classify based on where most cycles fall.
  const shortCount   = recent.filter(d => d >= 21 && d <= 23).length;
  const typicalCount = recent.filter(d => d >= 24 && d <= 38).length;
  const longCount    = recent.filter(d => d >= 39).length;
  let lengthPattern  = 'Mixed length';
  if      (typicalCount / recent.length >= 0.7) lengthPattern = 'Typical length';
  else if (shortCount   / recent.length >= 0.5) lengthPattern = 'Short / frequent';
  else if (longCount    / recent.length >= 0.5) lengthPattern = 'Long / infrequent';

  return {
    avg,
    med,
    min:           shortestCycle,
    max:           longestCycle,
    stdev:         sd,
    count:         recent.length,
    windowMin,
    windowMax,
    shortestCycle,
    longestCycle,
    variationDays,
    // Requires both spread > 9 days AND stdev > 4 to avoid flagging one outlier as irregular.
    irregular:     recent.length >= 3 && variationDays > 9 && sd > 4,
    notEnoughData: recent.length < 3,
    lengthPattern,
  };
}

export function currentWindow(entries, stats) {
  if (!entries.length || !stats) return null;
  const last = parseDate(entries[entries.length - 1].start);
  const predictionCenter = stats.med ?? stats.avg;
  return {
    earliest: addDays(last, stats.windowMin),
    center:   addDays(last, predictionCenter),
    latest:   addDays(last, stats.windowMax),
  };
}

export function futurePredictions(entries, stats, n = 5) {
  if (!entries.length || !stats) return [];
  const last = parseDate(entries[entries.length - 1].start);
  const predictionCenter = stats.med ?? stats.avg;
  const baseSpread = Math.max(2, stats.stdev);
  // Uncertainty compounds: window widens honestly for further predictions.
  return Array.from({ length: n }, (_, i) => {
    const k = i + 1;
    const spread = Math.round(Math.sqrt(k) * baseSpread);
    return {
      earliest: addDays(last, predictionCenter * k - spread),
      center:   addDays(last, predictionCenter * k),
      latest:   addDays(last, predictionCenter * k + spread),
    };
  });
}

// Approximate: ovulation is estimated as ~14 days before the next period.
// Actual timing varies by person and cycle. Not medical advice.
export function ovulationDay(window) {
  return addDays(window.center, -14);
}

// Approximate fertile window around estimated ovulation.
// Sperm can survive ~5 days; egg viable ~1 day post-ovulation.
// Actual fertile days vary. Not medical advice.
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

// ── Duration helpers ───────────────────────────────────────────────

export function periodDuration(entry) {
  return daysBetween(parseDate(entry.start), parseDate(entry.end)) + 1;
}

export function avgPeriodDuration(entries) {
  if (!entries.length) return null;
  const total = entries.reduce((sum, e) => sum + periodDuration(e), 0);
  return Math.round(total / entries.length);
}

// ── Remove a single day from entries ──────────────────────────────
// Trims start/end or splits the entry if day is in the middle.

export function removeDay(entries, dateStr) {
  let sorted = [...entries].sort((a, b) => a.start.localeCompare(b.start));
  const d = parseDate(dateStr);
  const idx = sorted.findIndex(e => d >= parseDate(e.start) && d <= parseDate(e.end));
  if (idx === -1) return sorted;

  const e     = sorted[idx];
  const start = parseDate(e.start);
  const end   = parseDate(e.end);

  const stripKey = (obj, key) =>
    Object.fromEntries(Object.entries(obj ?? {}).filter(([k]) => k !== key));

  if (fd(start) === dateStr && fd(end) === dateStr) {
    sorted.splice(idx, 1);
  } else if (fd(start) === dateStr) {
    sorted[idx] = {
      ...e,
      start:     fd(addDays(start, 1)),
      flow:      stripKey(e.flow, dateStr),
      symptoms:  stripKey(e.symptoms, dateStr),
      bbt:       stripKey(e.bbt, dateStr),
      discharge: stripKey(e.discharge, dateStr),
    };
  } else if (fd(end) === dateStr) {
    sorted[idx] = {
      ...e,
      end:       fd(addDays(end, -1)),
      flow:      stripKey(e.flow, dateStr),
      symptoms:  stripKey(e.symptoms, dateStr),
      bbt:       stripKey(e.bbt, dateStr),
      discharge: stripKey(e.discharge, dateStr),
    };
  } else {
    const before = {
      ...e,
      end:       fd(addDays(d, -1)),
      flow:      Object.fromEntries(Object.entries(e.flow      ?? {}).filter(([k]) => k < dateStr)),
      symptoms:  Object.fromEntries(Object.entries(e.symptoms  ?? {}).filter(([k]) => k < dateStr)),
      bbt:       Object.fromEntries(Object.entries(e.bbt       ?? {}).filter(([k]) => k < dateStr)),
      discharge: Object.fromEntries(Object.entries(e.discharge ?? {}).filter(([k]) => k < dateStr)),
    };
    const after = {
      ...e,
      id:        'p_' + fd(addDays(d, 1)).replaceAll('-', '_'),
      start:     fd(addDays(d, 1)),
      flow:      Object.fromEntries(Object.entries(e.flow      ?? {}).filter(([k]) => k > dateStr)),
      symptoms:  Object.fromEntries(Object.entries(e.symptoms  ?? {}).filter(([k]) => k > dateStr)),
      bbt:       Object.fromEntries(Object.entries(e.bbt       ?? {}).filter(([k]) => k > dateStr)),
      discharge: Object.fromEntries(Object.entries(e.discharge ?? {}).filter(([k]) => k > dateStr)),
    };
    sorted.splice(idx, 1, before, after);
  }

  return sorted;
}

// ── Spotting (pure helpers — pass period.spotting array) ───────────

export function addSpotting(spottingArr, dateStr) {
  const s = [...(spottingArr ?? [])];
  return s.includes(dateStr) ? s : [...s, dateStr];
}

export function removeSpotting(spottingArr, dateStr) {
  return (spottingArr ?? []).filter(d => d !== dateStr);
}

// ── Per-day data helpers (pure — pass the map, get a new map) ─────
// Symptoms, BBT, and discharge are tracked for any day, not just period days.
// Stored in period.symptoms[dateStr], period.bbt[dateStr], period.discharge[dateStr].

export function setSymptom(map, dateStr, key, value) {
  const day = { ...(map?.[dateStr] ?? {}) };
  if (value === null || value === false || value === '') {
    delete day[key];
  } else {
    day[key] = value;
  }
  if (!Object.keys(day).length) {
    const next = { ...(map ?? {}) };
    delete next[dateStr];
    return next;
  }
  return { ...(map ?? {}), [dateStr]: day };
}

export function setBbt(map, dateStr, value) {
  if (value === null || value === '') {
    const next = { ...(map ?? {}) };
    delete next[dateStr];
    return next;
  }
  return { ...(map ?? {}), [dateStr]: value };
}

export function setDischarge(map, dateStr, value) {
  if (value === null || value === '') {
    const next = { ...(map ?? {}) };
    delete next[dateStr];
    return next;
  }
  return { ...(map ?? {}), [dateStr]: value };
}

// ── Cycle phase for a date ─────────────────────────────────────────
// Returns: 'menstrual' | 'follicular' | 'ovulatory' | 'luteal' | null

export function getPhase(entries, stats, dateStr) {
  const d      = parseDate(dateStr);
  const sorted = [...entries].sort((a, b) => a.start.localeCompare(b.start));

  if (sorted.some(e => d >= parseDate(e.start) && d <= parseDate(e.end))) return 'menstrual';
  if (!stats || !sorted.length) return null;

  let lastStart = null;
  for (const e of sorted) {
    if (parseDate(e.start) <= d) lastStart = parseDate(e.start);
  }
  if (!lastStart) return null;

  const cycleDay = daysBetween(lastStart, d) + 1;
  const ovDay    = stats.avg - 14;

  if (cycleDay < ovDay - 4)                          return 'follicular';
  if (cycleDay >= ovDay - 4 && cycleDay <= ovDay + 1) return 'ovulatory';
  return 'luteal';
}

// ── Comprehensive day info (used by calendar and day detail view) ──

export function getDayInfo(data, stats, dateStr) {
  const entries     = getPeriodEntries(data);
  const d           = parseDate(dateStr);
  const periodEntry = entries.find(e => d >= parseDate(e.start) && d <= parseDate(e.end));

  const flow      = periodEntry?.flow?.[dateStr]      ?? null;
  const spotting  = (data.period?.spotting ?? []).includes(dateStr);
  const phase     = getPhase(entries, stats, dateStr);

  const win  = entries.length ? currentWindow(entries, stats) : null;
  const preds = entries.length ? futurePredictions(entries, stats, 5) : [];

  let isPredicted = false;
  if (!periodEntry && !spotting && win) {
    isPredicted = (d >= win.earliest && d <= win.latest)
      || preds.some(p => d >= p.earliest && d <= p.latest);
  }

  let isFertile   = false;
  let isOvulation = false;
  if (win) {
    const fw = fertileWindow(win);
    const ov = ovulationDay(win);
    if (d >= fw.start && d <= fw.end) isFertile   = true;
    if (fd(d) === fd(ov))             isOvulation = true;
  }

  return {
    isPeriod:    !!periodEntry,
    flow,
    isSpotting:  spotting,
    isFertile,
    isOvulation,
    isPredicted,
    phase,
    symptoms:    data.period?.symptoms?.[dateStr]  ?? periodEntry?.symptoms?.[dateStr]  ?? {},
    bbt:         data.period?.bbt?.[dateStr]        ?? periodEntry?.bbt?.[dateStr]        ?? null,
    discharge:   data.period?.discharge?.[dateStr]  ?? periodEntry?.discharge?.[dateStr]  ?? null,
    notes:       periodEntry?.notes ?? null,
  };
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
