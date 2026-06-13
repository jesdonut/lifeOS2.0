// notes.js — sidebar notes + unscheduled events parking lot

import * as CountdownView from './countdown-view.js';

let _container, _data, _onSave;
let _schedulingId = null; // id of parking lot item currently being scheduled

function uid() {
  return 'n_' + Math.random().toString(36).slice(2, 9);
}

function notes() {
  return _data.notes?.items ?? [];
}

function floating() {
  return (_data.calendar?.events ?? []).filter(e => e.date === null || e.date === undefined);
}

// ── Module contract ────────────────────────────────────────────────

export function init(container, data, onSave) {
  _container = container;
  _data = data;
  _onSave = onSave;

  const cssHref = new URL('./notes.css', import.meta.url).href;
  if (!document.querySelector(`link[href="${cssHref}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssHref;
    document.head.appendChild(link);
  }

  render();
}

export function destroy() {
  CountdownView.unmount();
  _container.innerHTML = '';
  _schedulingId = null;
}

export function onDataChange(newData) {
  _data = newData;
  render();
}

// ── Render ─────────────────────────────────────────────────────────

function render() {
  _container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'notes-wrap';

  // ── Park for later section ───────────────────────────────────────
  const floatingEvts = floating();

  const parkHdr = makeSectionHdr('Park for later', null);
  wrap.appendChild(parkHdr);

  const lot = document.createElement('div');
  lot.className = 'parking-lot';

  if (floatingEvts.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'parking-empty';
    empty.textContent = 'Drag events here to unschedule.';
    lot.appendChild(empty);
  }

  floatingEvts.forEach(evt => {
    const item = document.createElement('div');
    item.dataset.id          = evt.id;
    item.dataset.fromParking = 'true';

    const row = document.createElement('div');
    row.className = 'parking-item';

    const dot = document.createElement('span');
    dot.className = 'parking-dot';
    dot.style.background = `var(--cat-${evt.category ?? 'personal'})`;

    const title = document.createElement('span');
    title.className = 'parking-title';
    title.textContent = evt.title;

    const schedBtn = document.createElement('button');
    schedBtn.className = 'parking-schedule-btn';
    schedBtn.textContent = 'schedule';
    schedBtn.addEventListener('click', () => toggleScheduler(item, evt.id));

    const delBtn = document.createElement('button');
    delBtn.className = 'parking-del-btn';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', () => deleteFloating(evt.id));

    row.append(dot, title, schedBtn, delBtn);
    item.appendChild(row);

    // Show inline date picker if this item is being scheduled
    if (_schedulingId === evt.id) {
      const dateRow = document.createElement('div');
      dateRow.className = 'parking-date-row';

      const dateInput = document.createElement('input');
      dateInput.type = 'date';
      dateInput.className = 'parking-date-input';
      dateInput.value = new Date().toLocaleDateString('sv', {
        timeZone: _data.settings?.timezone ?? 'Asia/Tokyo',
      });

      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'parking-confirm-btn';
      confirmBtn.textContent = 'confirm';
      confirmBtn.addEventListener('click', () => {
        const d = dateInput.value;
        if (!d) return;
        scheduleFloating(evt.id, d);
      });

      dateInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') confirmBtn.click();
        if (e.key === 'Escape') { _schedulingId = null; render(); }
      });

      dateRow.append(dateInput, confirmBtn);
      item.appendChild(dateRow);
      requestAnimationFrame(() => dateInput.focus());
    }

    lot.appendChild(item);
  });

  Sortable.create(lot, {
    group: { name: 'cal-events', pull: 'clone', put: true },
    sort:  false,
    onAdd(evt) {
      const id = evt.item.dataset.id;
      evt.item.remove();
      setTimeout(() => scheduleFloating(id, null), 0);
    },
  });

  wrap.appendChild(lot);
  wrap.appendChild(makeDivider());

  // ── Countdowns section ───────────────────────────────────────────
  const cdSection = document.createElement('div');
  wrap.appendChild(cdSection);
  CountdownView.mount(cdSection, _data, _onSave);
  wrap.appendChild(makeDivider());

  // ── Notes section ────────────────────────────────────────────────
  const notesHdr = makeSectionHdr('Notes', () => {
    const ta = wrap.querySelector('.notes-textarea');
    if (ta) ta.focus();
  });
  wrap.appendChild(notesHdr);

  const list = document.createElement('div');
  list.className = 'notes-list';

  const pinned = notes().filter(n => n.pinned && !n.archived);
  if (pinned.length === 0) {
    const empty = document.createElement('p');
    empty.style.cssText = 'font-size:var(--fs-xs);color:var(--text-3);padding:var(--s2) var(--s2);';
    empty.textContent = 'Pin notes from the Notes tab to see them here.';
    list.appendChild(empty);
  } else {
    [...pinned].reverse().forEach(note => {
      const item = document.createElement('div');
      item.className = 'note-item';

      const text = document.createElement('div');
      text.className = 'note-text';
      text.innerHTML = renderMd(note.text);

      const meta = document.createElement('div');
      meta.className = 'note-meta';

      const dateEl = document.createElement('span');
      dateEl.className = 'note-date';
      dateEl.textContent = fmtDate(note.createdAt);

      const editBtn = document.createElement('button');
      editBtn.className = 'note-edit-btn';
      editBtn.textContent = 'edit';
      editBtn.addEventListener('click', e => { e.stopPropagation(); openNoteModal(note); });

      const delBtn = document.createElement('button');
      delBtn.className = 'note-del-btn';
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', e => { e.stopPropagation(); deleteNote(note.id); });

      meta.append(dateEl, editBtn, delBtn);
      item.append(text, meta);
      list.appendChild(item);
    });
  }

  wrap.appendChild(list);

  // ── Compose ──────────────────────────────────────────────────────
  const compose = document.createElement('div');
  compose.className = 'notes-compose';

  const ta = document.createElement('textarea');
  ta.className = 'notes-textarea';
  ta.placeholder = 'Add a note...';
  ta.rows = 3;

  const composeRow = document.createElement('div');
  composeRow.className = 'notes-compose-row';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'notes-save-btn';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => {
    const text = ta.value.trim();
    if (!text) return;
    addNote(text);
    ta.value = '';
  });

  ta.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveBtn.click();
  });

  const expandBtn = document.createElement('button');
  expandBtn.className = 'notes-expand-btn';
  expandBtn.title = 'Open full editor';
  expandBtn.textContent = '⤢';
  expandBtn.addEventListener('click', () => openNoteModal(null, ta.value));

  composeRow.append(expandBtn, saveBtn);
  compose.append(ta, composeRow);
  wrap.appendChild(compose);

  _container.appendChild(wrap);
}

// ── Note modal (full editor) ───────────────────────────────────────

function openNoteModal(note, draft = '') {
  const overlay = document.createElement('div');
  overlay.className = 'note-modal-overlay';
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  const modal = document.createElement('div');
  modal.className = 'note-modal';
  modal.addEventListener('click', e => e.stopPropagation());

  // Header
  const hdr = document.createElement('div');
  hdr.className = 'note-modal-hdr';
  const title = document.createElement('span');
  title.className = 'note-modal-title';
  title.textContent = note ? 'Edit note' : 'New note';
  const hdrRight = document.createElement('div');
  hdrRight.className = 'note-modal-hdr-right';
  const hintBtn = document.createElement('button');
  hintBtn.className = 'note-modal-hint-btn';
  hintBtn.textContent = '?';
  hintBtn.title = 'Markdown reference';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'note-modal-close';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', close);
  hdrRight.append(hintBtn, closeBtn);
  hdr.append(title, hdrRight);

  // Body: editor | divider | preview/hint
  const body = document.createElement('div');
  body.className = 'note-modal-body';

  const ta = document.createElement('textarea');
  ta.className = 'note-modal-textarea';
  ta.placeholder = 'Write in markdown...';
  ta.value = note ? note.text : draft;

  const divider = document.createElement('div');
  divider.className = 'note-modal-divider';

  const preview = document.createElement('div');
  preview.className = 'note-modal-preview note-text';
  preview.innerHTML = renderMd(ta.value);

  const hint = document.createElement('div');
  hint.className = 'note-modal-hint';
  hint.innerHTML = `
    <div class="note-hint-row"><code>**text**</code><span>bold</span></div>
    <div class="note-hint-row"><code>*text*</code><span>italic</span></div>
    <div class="note-hint-row"><code>\`text\`</code><span>inline code</span></div>
    <div class="note-hint-row"><code># Heading</code><span>h1</span></div>
    <div class="note-hint-row"><code>## Heading</code><span>h2</span></div>
    <div class="note-hint-row"><code>### Heading</code><span>h3</span></div>
    <div class="note-hint-row"><code>- item</code><span>bullet list</span></div>
    <div class="note-hint-row"><code>blank line</code><span>paragraph break</span></div>
  `;
  hint.style.display = 'none';

  let showingHint = false;
  hintBtn.addEventListener('click', () => {
    showingHint = !showingHint;
    preview.style.display = showingHint ? 'none' : '';
    hint.style.display    = showingHint ? '' : 'none';
    hintBtn.classList.toggle('active', showingHint);
  });

  ta.addEventListener('input', () => { if (!showingHint) preview.innerHTML = renderMd(ta.value); });
  ta.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
    if (e.key === 'Escape') close();
  });

  body.append(ta, divider, preview, hint);

  // Footer
  const ftr = document.createElement('div');
  ftr.className = 'note-modal-ftr';

  if (note) {
    const delBtn = document.createElement('button');
    delBtn.className = 'note-modal-del';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => { deleteNote(note.id); close(); });
    ftr.appendChild(delBtn);
  }

  const saveBtn = document.createElement('button');
  saveBtn.className = 'notes-save-btn';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', save);
  ftr.appendChild(saveBtn);

  modal.append(hdr, body, ftr);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => { ta.focus(); if (note) { ta.setSelectionRange(ta.value.length, ta.value.length); } });

  function save() {
    const text = ta.value.trim();
    if (!text) return;
    if (note) updateNote(note.id, text);
    else addNote(text);
    close();
  }

  function close() {
    overlay.remove();
  }
}

// ── Markdown renderer ──────────────────────────────────────────────

function renderMd(raw) {
  const esc    = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = s => s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/`(.+?)`/g,       '<code>$1</code>');

  const lines = esc(raw).split('\n');
  let html = '';
  let inUl = false;
  const flush = () => { if (inUl) { html += '</ul>'; inUl = false; } };

  for (const line of lines) {
    let m;
    if      ((m = line.match(/^### (.+)/)))     { flush(); html += `<h3>${inline(m[1])}</h3>`; }
    else if ((m = line.match(/^## (.+)/)))      { flush(); html += `<h2>${inline(m[1])}</h2>`; }
    else if ((m = line.match(/^# (.+)/)))       { flush(); html += `<h1>${inline(m[1])}</h1>`; }
    else if ((m = line.match(/^[-*] (.+)/)))    { if (!inUl) { html += '<ul>'; inUl = true; } html += `<li>${inline(m[1])}</li>`; }
    else if (line === '')                        { flush(); html += '<br>'; }
    else                                         { flush(); html += `<p>${inline(line)}</p>`; }
  }
  flush();
  return html;
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const date = d.toLocaleDateString('en', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
  const time = d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });
  return `${date}, ${time}`;
}

// ── Helpers ────────────────────────────────────────────────────────

function makeSectionHdr(label, onAdd) {
  const hdr = document.createElement('div');
  hdr.className = 'notes-section-hdr';
  const span = document.createElement('span');
  span.className = 'notes-section-label';
  span.textContent = label;
  hdr.appendChild(span);
  if (onAdd) {
    const btn = document.createElement('button');
    btn.className = 'notes-add-btn';
    btn.textContent = '+';
    btn.addEventListener('click', onAdd);
    hdr.appendChild(btn);
  }
  return hdr;
}

function makeDivider() {
  const hr = document.createElement('hr');
  hr.className = 'notes-divider';
  return hr;
}

function toggleScheduler(item, id) {
  _schedulingId = _schedulingId === id ? null : id;
  render();
}

// ── Data ───────────────────────────────────────────────────────────

function addNote(text) {
  const now = new Date().toISOString();
  const items = [...notes(), { id: uid(), text, createdAt: now }];
  _onSave({ notes: { ...(_data.notes ?? {}), items } });
}

function updateNote(id, text) {
  const items = notes().map(n =>
    n.id === id ? { ...n, text, updatedAt: new Date().toISOString() } : n
  );
  _onSave({ notes: { ...(_data.notes ?? {}), items } });
}

function deleteNote(id) {
  _onSave({ notes: { ...(_data.notes ?? {}), items: notes().filter(n => n.id !== id) } });
}

function scheduleFloating(id, date) {
  const evts = (_data.calendar?.events ?? []).map(e =>
    e.id === id ? { ...e, date, updatedAt: new Date().toISOString() } : e
  );
  _schedulingId = null;
  _onSave({ calendar: { events: evts } });
}

function deleteFloating(id) {
  const evts = (_data.calendar?.events ?? []).filter(e => e.id !== id);
  _onSave({ calendar: { events: evts } });
}
