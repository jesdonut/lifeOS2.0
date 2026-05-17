// notes.js — Notes module

let _container = null;
let _data = null;
let _onSave = null;
let _selectedId = null;

// All DOM event listeners tracked for cleanup
const _listeners = [];

function addListener(el, event, handler, options) {
  el.addEventListener(event, handler, options);
  _listeners.push({ el, event, handler, options });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}/${y.slice(2)}`;
}

function getNotes() {
  return (_data && _data.items) ? _data.items : [];
}

function sortedNotes() {
  return [...getNotes()].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });
}

function save() {
  _onSave({ notes: { items: getNotes() } });
}

function updateNote(id, patch) {
  const items = getNotes();
  const idx = items.findIndex(n => n.id === id);
  if (idx === -1) return;
  items[idx] = { ...items[idx], ...patch };
  _data = { items };
  save();
}

// ── Render ───────────────────────────────────────────────────────────────────

export function init(container, data, onSave) {
  _container = container;
  _data = (data && data.items) ? data : { items: [] };
  _onSave = onSave;
  _selectedId = null;

  // Inject CSS
  if (!document.getElementById('notes-css')) {
    const link = document.createElement('link');
    link.id = 'notes-css';
    link.rel = 'stylesheet';
    link.href = 'modules/notes/notes.css';
    document.head.appendChild(link);
  }

  render();
}

export function destroy() {
  // Remove all event listeners
  for (const { el, event, handler, options } of _listeners) {
    el.removeEventListener(event, handler, options);
  }
  _listeners.length = 0;

  // Remove CSS link
  const link = document.getElementById('notes-css');
  if (link) link.remove();

  // Clear container
  if (_container) _container.innerHTML = '';

  _container = null;
  _data = null;
  _onSave = null;
  _selectedId = null;
}

export function onDataChange(newData) {
  if (!newData || !newData.notes) return;
  _data = newData.notes;
  // Re-render without losing selection if the selected note still exists
  const items = getNotes();
  if (_selectedId && !items.find(n => n.id === _selectedId)) {
    _selectedId = null;
  }
  render();
}

function render() {
  if (!_container) return;
  _container.innerHTML = '';

  // Remove old listeners before re-rendering (they'll be re-added fresh)
  for (const { el, event, handler, options } of _listeners) {
    el.removeEventListener(event, handler, options);
  }
  _listeners.length = 0;

  const layout = document.createElement('div');
  layout.className = 'notes-layout';

  layout.appendChild(renderListPane());
  layout.appendChild(renderEditorPane());

  _container.appendChild(layout);
}

// ── List pane ─────────────────────────────────────────────────────────────────

function renderListPane() {
  const pane = document.createElement('div');
  pane.className = 'notes-list-pane';

  // Header
  const header = document.createElement('div');
  header.className = 'notes-list-header';

  const title = document.createElement('span');
  title.className = 'notes-list-title';
  title.textContent = 'Notes';

  const newBtn = document.createElement('button');
  newBtn.className = 'btn btn-ghost';
  newBtn.textContent = '+ New';
  addListener(newBtn, 'click', handleNewNote);

  header.appendChild(title);
  header.appendChild(newBtn);
  pane.appendChild(header);

  // Scrollable list
  const scroll = document.createElement('div');
  scroll.className = 'notes-list-scroll';

  const notes = sortedNotes();

  if (notes.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No notes yet';
    scroll.appendChild(empty);
  } else {
    const pinned = notes.filter(n => n.pinned);
    const unpinned = notes.filter(n => !n.pinned);

    if (pinned.length > 0) {
      const label = document.createElement('div');
      label.className = 'notes-section-label';
      label.textContent = 'Pinned';
      scroll.appendChild(label);
      pinned.forEach(n => scroll.appendChild(renderNoteRow(n)));
    }

    if (unpinned.length > 0) {
      if (pinned.length > 0) {
        const label = document.createElement('div');
        label.className = 'notes-section-label';
        label.textContent = 'Notes';
        scroll.appendChild(label);
      }
      unpinned.forEach(n => scroll.appendChild(renderNoteRow(n)));
    }
  }

  pane.appendChild(scroll);
  return pane;
}

function renderNoteRow(note) {
  const row = document.createElement('div');
  row.className = 'note-row' + (note.id === _selectedId ? ' is-selected' : '');
  row.dataset.id = note.id;

  const body = document.createElement('div');
  body.className = 'note-row-body';

  const rowTitle = document.createElement('div');
  rowTitle.className = 'note-row-title' + (!note.title ? ' is-untitled' : '');
  rowTitle.textContent = note.title || 'Untitled';

  const rowDate = document.createElement('div');
  rowDate.className = 'note-row-date';
  rowDate.textContent = formatDate(note.updatedAt || note.createdAt);

  body.appendChild(rowTitle);
  body.appendChild(rowDate);

  const actions = document.createElement('div');
  actions.className = 'note-row-actions';

  const pinBtn = document.createElement('button');
  pinBtn.className = 'note-pin-btn' + (note.pinned ? ' is-pinned' : '');
  pinBtn.title = note.pinned ? 'Unpin' : 'Pin';
  pinBtn.textContent = '📌';
  addListener(pinBtn, 'click', (e) => {
    e.stopPropagation();
    handleTogglePin(note.id);
  });

  const delBtn = document.createElement('button');
  delBtn.className = 'note-delete-btn';
  delBtn.title = 'Delete note';
  delBtn.textContent = '✕';
  addListener(delBtn, 'click', (e) => {
    e.stopPropagation();
    handleDelete(note.id);
  });

  actions.appendChild(pinBtn);
  actions.appendChild(delBtn);

  row.appendChild(body);
  row.appendChild(actions);

  addListener(row, 'click', () => handleSelectNote(note.id));

  return row;
}

// ── Editor pane ───────────────────────────────────────────────────────────────

function renderEditorPane() {
  const pane = document.createElement('div');
  pane.className = 'notes-editor-pane';

  const note = _selectedId ? getNotes().find(n => n.id === _selectedId) : null;

  if (!note) {
    const empty = document.createElement('div');
    empty.className = 'notes-editor-empty';

    const icon = document.createElement('div');
    icon.className = 'notes-editor-empty-icon';
    icon.textContent = '📝';

    const msg = document.createElement('div');
    msg.textContent = 'Select a note or create a new one';

    empty.appendChild(icon);
    empty.appendChild(msg);
    pane.appendChild(empty);
    return pane;
  }

  // Toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'notes-editor-toolbar';

  const meta = document.createElement('div');
  meta.className = 'notes-editor-meta';
  const updated = note.updatedAt ? `Edited ${formatDate(note.updatedAt)}` : `Created ${formatDate(note.createdAt)}`;
  meta.textContent = updated;

  const editorActions = document.createElement('div');
  editorActions.className = 'notes-editor-actions';

  const pinBtn = document.createElement('button');
  pinBtn.className = 'notes-editor-pin-btn' + (note.pinned ? ' is-pinned' : '');
  pinBtn.textContent = note.pinned ? '📌 Pinned' : '📌 Pin';
  addListener(pinBtn, 'click', () => handleTogglePin(note.id));

  editorActions.appendChild(pinBtn);
  toolbar.appendChild(meta);
  toolbar.appendChild(editorActions);
  pane.appendChild(toolbar);

  // Content area
  const content = document.createElement('div');
  content.className = 'notes-editor-content';

  // Title input
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.className = 'notes-title-input';
  titleInput.placeholder = 'Untitled';
  titleInput.value = note.title || '';

  addListener(titleInput, 'blur', () => {
    const val = titleInput.value.trim();
    if (val !== note.title) {
      updateNote(note.id, { title: val, updatedAt: today() });
      render();
    }
  });

  // Prevent blur-triggered re-render from firing on Enter; just move to textarea
  addListener(titleInput, 'keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      bodyTextarea.focus();
    }
  });

  // Body textarea
  const bodyTextarea = document.createElement('textarea');
  bodyTextarea.className = 'notes-body-textarea';
  bodyTextarea.placeholder = 'Start writing…';
  bodyTextarea.value = note.body || '';

  addListener(bodyTextarea, 'blur', () => {
    const val = bodyTextarea.value;
    if (val !== note.body) {
      updateNote(note.id, { body: val, updatedAt: today() });
      // Update meta without full re-render to keep focus
      meta.textContent = `Edited ${formatDate(today())}`;
    }
  });

  content.appendChild(titleInput);
  content.appendChild(bodyTextarea);
  pane.appendChild(content);

  return pane;
}

// ── Handlers ──────────────────────────────────────────────────────────────────

function handleNewNote() {
  const id = 'note_' + Date.now();
  const newNote = {
    id,
    title: '',
    body: '',
    createdAt: today(),
    updatedAt: today(),
    pinned: false,
  };
  const items = getNotes();
  items.unshift(newNote);
  _data = { items };
  _selectedId = id;
  save();
  render();

  // Focus title input after render
  const titleInput = _container && _container.querySelector('.notes-title-input');
  if (titleInput) titleInput.focus();
}

function handleSelectNote(id) {
  if (_selectedId === id) return;

  // Flush any pending edits in current editor before switching
  if (_container) {
    const titleInput = _container.querySelector('.notes-title-input');
    const bodyTextarea = _container.querySelector('.notes-body-textarea');
    if (titleInput || bodyTextarea) {
      const currentNote = _selectedId ? getNotes().find(n => n.id === _selectedId) : null;
      if (currentNote) {
        const titleVal = titleInput ? titleInput.value.trim() : currentNote.title;
        const bodyVal = bodyTextarea ? bodyTextarea.value : currentNote.body;
        const changed = titleVal !== currentNote.title || bodyVal !== currentNote.body;
        if (changed) {
          updateNote(currentNote.id, { title: titleVal, body: bodyVal, updatedAt: today() });
        }
      }
    }
  }

  _selectedId = id;
  render();
}

function handleTogglePin(id) {
  const note = getNotes().find(n => n.id === id);
  if (!note) return;
  updateNote(id, { pinned: !note.pinned });
  render();
}

function handleDelete(id) {
  const items = getNotes().filter(n => n.id !== id);
  _data = { items };
  if (_selectedId === id) _selectedId = null;
  save();
  render();
}
