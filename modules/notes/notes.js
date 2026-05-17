// notes.js — sidebar notes + unscheduled events parking lot

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

  // ── Parking lot section ──────────────────────────────────────────
  const floatingEvts = floating();

  if (floatingEvts.length > 0) {
    const hdr = makeSectionHdr('Unscheduled', null);
    wrap.appendChild(hdr);

    const lot = document.createElement('div');
    lot.className = 'parking-lot';

    floatingEvts.forEach(evt => {
      const item = document.createElement('div');

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

    wrap.appendChild(lot);
    wrap.appendChild(makeDivider());
  }

  // ── Notes section ────────────────────────────────────────────────
  const notesHdr = makeSectionHdr('Notes', () => {
    const ta = wrap.querySelector('.notes-textarea');
    if (ta) ta.focus();
  });
  wrap.appendChild(notesHdr);

  const list = document.createElement('div');
  list.className = 'notes-list';

  if (notes().length === 0) {
    const empty = document.createElement('p');
    empty.style.cssText = 'font-size:var(--fs-xs);color:var(--text-3);padding:var(--s2) var(--s2);';
    empty.textContent = 'No notes yet.';
    list.appendChild(empty);
  } else {
    [...notes()].reverse().forEach(note => {
      const item = document.createElement('div');
      item.className = 'note-item';

      const text = document.createElement('div');
      text.className = 'note-text';
      text.textContent = note.text;

      const delBtn = document.createElement('button');
      delBtn.className = 'note-del-btn';
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', e => {
        e.stopPropagation();
        deleteNote(note.id);
      });

      // Click to edit: replace text with textarea
      item.addEventListener('click', () => startEditing(item, note));

      item.append(text, delBtn);
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

  composeRow.appendChild(saveBtn);
  compose.append(ta, composeRow);
  wrap.appendChild(compose);

  _container.appendChild(wrap);
}

// ── Inline edit ────────────────────────────────────────────────────

function startEditing(item, note) {
  item.innerHTML = '';

  const ta = document.createElement('textarea');
  ta.className = 'notes-textarea';
  ta.value = note.text;
  ta.style.cssText = 'width:100%;margin-bottom:var(--s2);';
  ta.rows = 3;

  const row = document.createElement('div');
  row.className = 'notes-compose-row';
  row.style.gap = 'var(--s2)';

  const cancel = document.createElement('button');
  cancel.style.cssText = 'font-size:var(--fs-xs);color:var(--text-3);padding:var(--s1) var(--s2);';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', render);

  const save = document.createElement('button');
  save.className = 'notes-save-btn';
  save.textContent = 'Save';
  save.addEventListener('click', () => {
    const text = ta.value.trim();
    if (!text) { deleteNote(note.id); return; }
    updateNote(note.id, text);
  });

  ta.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save.click();
    if (e.key === 'Escape') render();
  });

  row.append(cancel, save);
  item.append(ta, row);
  requestAnimationFrame(() => { ta.focus(); ta.select(); });
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
  _onSave({ notes: { items } });
}

function updateNote(id, text) {
  const items = notes().map(n =>
    n.id === id ? { ...n, text, updatedAt: new Date().toISOString() } : n
  );
  _onSave({ notes: { items } });
}

function deleteNote(id) {
  _onSave({ notes: { items: notes().filter(n => n.id !== id) } });
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
