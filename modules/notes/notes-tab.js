// notes-tab.js — full Notes + Tasks tab

let _container, _data, _onSave;
let _selectedId   = null;
let _showArchived = false;
let _addingTask   = false;

// ── Module contract ────────────────────────────────────────────────
export function init(container, data, onSave) {
  _container = container;
  _data      = data;
  _onSave    = onSave;
  _loadCss();
  _render();
}

export function destroy() {
  _container.innerHTML = '';
  _selectedId   = null;
  _showArchived = false;
  _addingTask   = false;
}

export function onDataChange(newData) {
  _data = newData;
  if (!_container) return;
  // If editing, only refresh the left pane to preserve textarea state
  const left = _container.querySelector('.nt-left');
  if (left && _selectedId) {
    left.replaceWith(_buildLeftPane());
  } else {
    _render();
  }
}

function _loadCss() {
  const href = new URL('./notes-tab.css', import.meta.url).href;
  if (!document.querySelector(`link[href="${href}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href;
    document.head.appendChild(link);
  }
}

// ── Data helpers ───────────────────────────────────────────────────
function uid()   { return 'n_'    + Math.random().toString(36).slice(2, 9); }
function tuid()  { return 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function allNotes() { return _data.notes?.items ?? []; }
function allTasks() {
  const raw = _data.tasks ?? {};
  const out = [];
  for (const [date, list] of Object.entries(raw))
    for (const t of (list ?? [])) out.push({ ...t, date });
  return out;
}

function saveNotes(items) { _onSave({ notes: { ...(_data.notes ?? {}), items } }); }
function saveTasks(raw)   { _onSave({ tasks: raw }); }
function patchNote(id, patch) {
  saveNotes(allNotes().map(n => n.id === id ? { ...n, ...patch } : n));
}

// ── Render ─────────────────────────────────────────────────────────
function _render() {
  if (!_container) return;
  _container.innerHTML = '';
  const root = el('div', 'nt-root');
  root.appendChild(_buildLeftPane());
  root.appendChild(_buildRightPane());
  _container.appendChild(root);
}

// ── Left pane ──────────────────────────────────────────────────────
function _buildLeftPane() {
  const pane = el('div', 'nt-left');

  // Tasks
  pane.appendChild(_buildTaskSection());
  pane.appendChild(el('div', 'nt-divider'));

  // Notes header
  const hdr = el('div', 'nt-section-hdr');
  const lbl = el('span', 'nt-section-label'); lbl.textContent = 'Notes';
  const addBtn = btn('nt-add-btn', '', () => {
    _selectedId = null;
    const note = { id: uid(), title: '', text: '', createdAt: new Date().toISOString(), pinned: false, archived: false, dueDate: null };
    const items = [...allNotes(), note];
    _data = { ..._data, notes: { ...(_data.notes ?? {}), items } };
    _selectedId = note.id;
    saveNotes(items);
    _render();
  });
  addBtn.innerHTML = '<span class="material-symbols-outlined">add</span>';
  addBtn.title = 'New note';
  hdr.append(lbl, addBtn);
  pane.appendChild(hdr);

  // Note list
  const visible = allNotes().filter(n => _showArchived ? n.archived : !n.archived);
  const list = el('div', 'nt-note-list');

  if (!visible.length) {
    const empty = el('p', 'nt-empty');
    empty.textContent = _showArchived ? 'No archived notes.' : 'No notes yet.';
    list.appendChild(empty);
  } else {
    visible.slice().reverse().forEach(n => list.appendChild(_buildNoteCard(n)));
  }
  pane.appendChild(list);

  const archToggle = btn('nt-archive-toggle', _showArchived ? '↑ Hide archived' : '↓ Show archived', () => {
    _showArchived = !_showArchived; _render();
  });
  pane.appendChild(archToggle);

  return pane;
}

function _buildNoteCard(note) {
  const card = el('div', 'nt-note-card' + (_selectedId === note.id ? ' active' : '') + (note.archived ? ' archived' : ''));
  card.addEventListener('click', () => { _selectedId = note.id; _render(); });

  const title = el('div', 'nt-note-title');
  title.textContent = note.title || 'Untitled';

  const meta = el('div', 'nt-note-meta');

  if (note.dueDate) {
    const now = new Date(); now.setHours(0,0,0,0);
    const due = new Date(note.dueDate + 'T00:00:00');
    const diff = Math.round((due - now) / 86400000);
    const cd = el('span', 'nt-cd-badge ' + (diff < 0 ? 'past' : diff === 0 ? 'now' : 'future'));
    cd.textContent = diff === 0 ? 'Today' : diff > 0 ? `in ${diff}d` : `${Math.abs(diff)}d ago`;
    meta.appendChild(cd);
  }

  const dateEl = el('span', 'nt-note-date');
  dateEl.textContent = _fmtDate(note.updatedAt ?? note.createdAt);
  meta.appendChild(dateEl);

  if (note.pinned) {
    const pin = el('span', 'nt-pin-badge'); pin.textContent = 'sidebar';
    meta.appendChild(pin);
  }

  card.append(title, meta);
  return card;
}

// ── Task section ───────────────────────────────────────────────────
function _buildTaskSection() {
  const section = el('div', 'nt-task-section');

  const hdr = el('div', 'nt-section-hdr');
  const lbl = el('span', 'nt-section-label'); lbl.textContent = 'Tasks';
  const addBtn = btn('nt-add-btn', '', () => { _addingTask = !_addingTask; _render(); });
  addBtn.innerHTML = '<span class="material-symbols-outlined">add</span>';
  hdr.append(lbl, addBtn);
  section.appendChild(hdr);

  if (_addingTask) section.appendChild(_buildTaskForm());

  const td      = today();
  const tasks   = allTasks();
  const urgent  = tasks.filter(t => !t.done && t.urgent).sort((a, b) => a.date.localeCompare(b.date));
  const active  = tasks.filter(t => !t.done && !t.urgent).sort((a, b) => a.date.localeCompare(b.date));
  const done    = tasks.filter(t => t.done);

  if (!tasks.length && !_addingTask) {
    const empty = el('p', 'nt-empty'); empty.textContent = 'No tasks yet.';
    section.appendChild(empty);
  } else {
    urgent.forEach(t => section.appendChild(_buildTaskRow(t, td)));
    active.forEach(t => section.appendChild(_buildTaskRow(t, td)));
    if (done.length) {
      const doneHdr = el('div', 'nt-done-hdr'); doneHdr.textContent = `Done (${done.length})`;
      section.appendChild(doneHdr);
      done.slice(0, 5).forEach(t => section.appendChild(_buildTaskRow(t, td)));
    }
  }

  return section;
}

function _buildTaskRow(t, td) {
  const row = el('div', 'nt-task-row' + (t.done ? ' done' : '') + (t.urgent ? ' urgent' : ''));

  const check = btn('nt-check' + (t.done ? ' checked' : ''), '', () => {
    const raw = { ...(_data.tasks ?? {}) };
    raw[t.date] = (raw[t.date] ?? []).map(x => x.id === t.id ? { ...x, done: !x.done } : x);
    saveTasks(raw);
  });

  const textEl = el('span', 'nt-task-text');
  if (t.urgent) {
    const flag = el('span', 'nt-urgent-flag'); flag.textContent = 'CHECK THIS';
    textEl.appendChild(flag);
  }
  const textNode = document.createTextNode(t.text);
  textEl.appendChild(textNode);

  const right = el('div', 'nt-task-right');

  if (t.date !== td) {
    const dateEl = el('span', 'nt-task-date' + (t.date < td ? ' overdue' : ''));
    dateEl.textContent = new Date(t.date + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' });
    right.appendChild(dateEl);
  }

  const urgentBtn = btn('nt-urgent-btn' + (t.urgent ? ' on' : ''), '', () => {
    const raw = { ...(_data.tasks ?? {}) };
    raw[t.date] = (raw[t.date] ?? []).map(x => x.id === t.id ? { ...x, urgent: !x.urgent } : x);
    saveTasks(raw);
  });
  urgentBtn.innerHTML = '<span class="material-symbols-outlined">priority_high</span>';
  urgentBtn.title = t.urgent ? 'Remove flag' : 'CHECK THIS';

  const del = btn('nt-task-del', '', () => {
    const raw = { ...(_data.tasks ?? {}) };
    raw[t.date] = (raw[t.date] ?? []).filter(x => x.id !== t.id);
    if (!raw[t.date].length) delete raw[t.date];
    saveTasks(raw);
  });
  del.innerHTML = '<span class="material-symbols-outlined">close</span>';

  right.append(urgentBtn, del);
  row.append(check, textEl, right);
  return row;
}

function _buildTaskForm() {
  const form  = el('div', 'nt-task-form');
  const textI = document.createElement('input');
  textI.type = 'text'; textI.className = 'nt-task-inp'; textI.placeholder = 'Task...';

  const dateI = document.createElement('input');
  dateI.type = 'date'; dateI.className = 'nt-task-date-inp'; dateI.value = today();

  const urgentCb = document.createElement('input');
  urgentCb.type = 'checkbox'; urgentCb.id = 'nt-urg-cb'; urgentCb.className = 'nt-urg-cb';
  const urgentLbl = document.createElement('label');
  urgentLbl.htmlFor = 'nt-urg-cb'; urgentLbl.className = 'nt-urg-lbl';
  urgentLbl.textContent = 'CHECK THIS';

  const saveB = btn('nt-inline-save', 'Add', () => {
    const text = textI.value.trim();
    if (!text || !dateI.value) return;
    const raw = { ...(_data.tasks ?? {}) };
    raw[dateI.value] = [...(raw[dateI.value] ?? []), { id: tuid(), text, done: false, urgent: urgentCb.checked }];
    _addingTask = false;
    saveTasks(raw);
  });
  const cancelB = btn('nt-inline-cancel', 'Cancel', () => { _addingTask = false; _render(); });

  textI.addEventListener('keydown', e => { if (e.key === 'Enter') saveB.click(); if (e.key === 'Escape') cancelB.click(); });

  const urgRow = el('div', 'nt-urg-row'); urgRow.append(urgentCb, urgentLbl);
  const acts   = el('div', 'nt-form-acts'); acts.append(saveB, cancelB);
  form.append(textI, dateI, urgRow, acts);
  requestAnimationFrame(() => textI.focus());
  return form;
}

// ── Right pane ─────────────────────────────────────────────────────
function _buildRightPane() {
  const pane = el('div', 'nt-right');
  const note = allNotes().find(n => n.id === _selectedId);

  if (!note) {
    const empty = el('div', 'nt-editor-empty');
    empty.textContent = 'Select a note or create a new one.';
    pane.appendChild(empty);
    return pane;
  }

  // Toolbar
  const toolbar = el('div', 'nt-toolbar');

  const pinBtn = btn('nt-tb-btn' + (note.pinned ? ' active' : ''), '', () => patchNote(note.id, { pinned: !note.pinned }));
  pinBtn.innerHTML = '<span class="material-symbols-outlined">push_pin</span>';
  pinBtn.title = note.pinned ? 'Unpin from sidebar' : 'Pin to sidebar';

  const archBtn = btn('nt-tb-btn' + (note.archived ? ' active' : ''), '', () => patchNote(note.id, { archived: !note.archived }));
  archBtn.innerHTML = '<span class="material-symbols-outlined">inventory_2</span>';
  archBtn.title = note.archived ? 'Unarchive' : 'Archive';

  const delBtn = btn('nt-tb-btn nt-tb-del', '', () => {
    if (confirm('Delete this note?')) {
      saveNotes(allNotes().filter(n => n.id !== note.id));
      _selectedId = null;
      _render();
    }
  });
  delBtn.innerHTML = '<span class="material-symbols-outlined">delete</span>';
  delBtn.title = 'Delete';

  const hintBtn = btn('nt-tb-btn nt-hint-btn', '?', () => {
    const hint    = pane.querySelector('.nt-hint-panel');
    const preview = pane.querySelector('.nt-editor-preview');
    if (!hint || !preview) return;
    const showing = hint.style.display !== 'none';
    hint.style.display    = showing ? 'none' : '';
    preview.style.display = showing ? '' : 'none';
    hintBtn.classList.toggle('active', !showing);
  });
  hintBtn.title = 'Markdown reference';

  toolbar.append(pinBtn, archBtn, delBtn, hintBtn);
  pane.appendChild(toolbar);

  // Title
  const titleInp = document.createElement('input');
  titleInp.type = 'text'; titleInp.className = 'nt-title-inp';
  titleInp.placeholder = 'Untitled'; titleInp.value = note.title ?? '';
  titleInp.addEventListener('change', () => patchNote(note.id, { title: titleInp.value, updatedAt: new Date().toISOString() }));
  pane.appendChild(titleInp);

  // Date + countdown
  const dateRow = el('div', 'nt-date-row');
  const dateLbl = el('label', 'nt-date-lbl'); dateLbl.textContent = 'Date';
  const dateInp = document.createElement('input');
  dateInp.type = 'date'; dateInp.className = 'nt-date-inp'; dateInp.value = note.dueDate ?? '';
  dateInp.addEventListener('change', () => patchNote(note.id, { dueDate: dateInp.value || null }));
  dateRow.append(dateLbl, dateInp);

  if (note.dueDate) {
    const now  = new Date(); now.setHours(0,0,0,0);
    const due  = new Date(note.dueDate + 'T00:00:00');
    const diff = Math.round((due - now) / 86400000);
    const cd   = el('span', 'nt-cd-inline ' + (diff < 0 ? 'past' : diff === 0 ? 'now' : 'future'));
    cd.textContent = diff === 0 ? 'Today!' : diff > 0 ? `in ${diff} day${diff === 1 ? '' : 's'}` : `${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'} ago`;
    dateRow.appendChild(cd);
  }
  pane.appendChild(dateRow);

  // Split editor
  const body    = el('div', 'nt-editor-body');
  const ta      = document.createElement('textarea');
  ta.className  = 'nt-editor-ta';
  ta.placeholder = 'Write in markdown...';
  ta.value      = note.text ?? '';

  const preview = el('div', 'nt-editor-preview note-text');
  preview.innerHTML = _renderMd(ta.value);

  const hint = el('div', 'nt-hint-panel');
  hint.style.display = 'none';
  hint.innerHTML = `
    <div class="nt-hint-row"><code>**text**</code><span>bold</span></div>
    <div class="nt-hint-row"><code>*text*</code><span>italic</span></div>
    <div class="nt-hint-row"><code>\`text\`</code><span>inline code</span></div>
    <div class="nt-hint-row"><code># Heading</code><span>h1</span></div>
    <div class="nt-hint-row"><code>## Heading</code><span>h2</span></div>
    <div class="nt-hint-row"><code>### Heading</code><span>h3</span></div>
    <div class="nt-hint-row"><code>- item</code><span>bullet list</span></div>
    <div class="nt-hint-row"><code>| A | B |</code><span>table row</span></div>
    <div class="nt-hint-row"><code>| — | — |</code><span>table separator</span></div>
    <div class="nt-hint-row"><code>blank line</code><span>paragraph break</span></div>
  `;

  ta.addEventListener('input',  () => { preview.innerHTML = _renderMd(ta.value); });
  ta.addEventListener('change', () => patchNote(note.id, { text: ta.value, updatedAt: new Date().toISOString() }));

  body.append(ta, preview, hint);
  pane.appendChild(body);
  return pane;
}

// ── Markdown ───────────────────────────────────────────────────────
function _renderMd(raw) {
  if (!raw) return '';
  const esc    = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = s => s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/`(.+?)`/g,       '<code>$1</code>');

  const parseCells = line => line.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  const isSep      = line => /^\|?[\s\-:|]+(\|[\s\-:|]+)*\|?$/.test(line);
  const isPipe     = line => line.trim().startsWith('|');

  const lines = esc(raw).split('\n');
  let html = '', inUl = false, tableBuf = [];

  const flush = () => { if (inUl) { html += '</ul>'; inUl = false; } };

  const flushTable = () => {
    if (!tableBuf.length) return;
    const rows = tableBuf;
    tableBuf = [];
    if (rows.length < 2) { rows.forEach(r => { html += `<p>${inline(r)}</p>`; }); return; }
    const headers = parseCells(rows[0]);
    // rows[1] is the separator — skip it, start body from rows[2]
    const bodyRows = rows.slice(2);
    html += '<table class="nt-md-table"><thead><tr>';
    headers.forEach(h => { html += `<th>${inline(h)}</th>`; });
    html += '</tr></thead><tbody>';
    bodyRows.forEach(row => {
      const cells = parseCells(row);
      html += '<tr>';
      cells.forEach(c => { html += `<td>${inline(c)}</td>`; });
      html += '</tr>';
    });
    html += '</tbody></table>';
  };

  for (const line of lines) {
    if (isPipe(line)) {
      flush();
      tableBuf.push(line);
      continue;
    }
    flushTable();
    let m;
    if      ((m = line.match(/^### (.+)/)))  { flush(); html += `<h3>${inline(m[1])}</h3>`; }
    else if ((m = line.match(/^## (.+)/)))   { flush(); html += `<h2>${inline(m[1])}</h2>`; }
    else if ((m = line.match(/^# (.+)/)))    { flush(); html += `<h1>${inline(m[1])}</h1>`; }
    else if ((m = line.match(/^[-*] (.+)/))){ if (!inUl) { html += '<ul>'; inUl = true; } html += `<li>${inline(m[1])}</li>`; }
    else if (line === '')                     { flush(); html += '<br>'; }
    else                                      { flush(); html += `<p>${inline(line)}</p>`; }
  }
  flush();
  flushTable();
  return html;
}

function _fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

// ── Tiny helpers ───────────────────────────────────────────────────
function el(tag, cls) { const e = document.createElement(tag); e.className = cls; return e; }
function btn(cls, text, onClick) {
  const b = document.createElement('button');
  b.className = cls; b.textContent = text;
  b.addEventListener('click', onClick); return b;
}
