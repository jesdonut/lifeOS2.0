// draw-view.js — Drawing canvas tab

const CANVAS_W = 1600;
const CANVAS_H = 1000;
const MAX_HISTORY = 40;

const PALETTE = [
  '#1e1916', '#6b3a2e', '#b84a30', '#e07840',
  '#d4a860', '#6b9970', '#4a80a8', '#7b60a8',
  '#c05880', '#ffffff',
];

let _canvas, _ctx;
let _tool  = 'pen';
let _color = PALETTE[0];
let _size  = 4;
let _history = [], _histIdx = -1;
let _isDrawing = false;
let _lastX = 0, _lastY = 0;
let _currentId = null;
let _data, _onSave;
let _leftEl = null;
let _toolbarEl = null;
let _removeKeys = null;

// ── Data ───────────────────────────────────────────────────────────

function duid()    { return 'dr_' + Math.random().toString(36).slice(2, 9); }
function allDrawings() { return _data.notes?.drawings ?? []; }
function notesBase()   { return _data.notes ?? {}; }

function saveDrawing(id, dataUrl) {
  const list = allDrawings().map(d => d.id === id
    ? { ...d, dataUrl, updatedAt: new Date().toISOString() }
    : d
  );
  _onSave({ notes: { ...notesBase(), drawings: list } });
}

// ── History ────────────────────────────────────────────────────────

function pushHistory() {
  _history = _history.slice(0, _histIdx + 1);
  _history.push(_ctx.getImageData(0, 0, CANVAS_W, CANVAS_H));
  if (_history.length > MAX_HISTORY) _history.shift();
  _histIdx = _history.length - 1;
}

function undo() {
  if (_histIdx <= 0) return;
  _histIdx--;
  _ctx.putImageData(_history[_histIdx], 0, 0);
  autoSave();
}

function redo() {
  if (_histIdx >= _history.length - 1) return;
  _histIdx++;
  _ctx.putImageData(_history[_histIdx], 0, 0);
  autoSave();
}

function autoSave() {
  if (_currentId) saveDrawing(_currentId, _canvas.toDataURL('image/png'));
}

// ── Drawing ────────────────────────────────────────────────────────

function getPos(e) {
  const rect = _canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (CANVAS_W / rect.width),
    y: (e.clientY - rect.top)  * (CANVAS_H / rect.height),
  };
}

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function floodFill(startX, startY) {
  startX = Math.round(startX);
  startY = Math.round(startY);
  const img  = _ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
  const data = img.data;

  const si = (startY * CANVAS_W + startX) * 4;
  const tr = data[si], tg = data[si+1], tb = data[si+2], ta = data[si+3];
  const [fr, fg, fb] = hexToRgb(_color);
  if (tr === fr && tg === fg && tb === fb && ta === 255) return;

  const visited = new Uint8Array(CANVAS_W * CANVAS_H);
  const queue   = [startY * CANVAS_W + startX];

  while (queue.length) {
    const pos = queue.pop();
    if (visited[pos]) continue;
    visited[pos] = 1;

    const x = pos % CANVAS_W, y = Math.floor(pos / CANVAS_W);
    const i = pos * 4;
    if (data[i] !== tr || data[i+1] !== tg || data[i+2] !== tb || data[i+3] !== ta) continue;

    data[i] = fr; data[i+1] = fg; data[i+2] = fb; data[i+3] = 255;
    if (x > 0)            queue.push(pos - 1);
    if (x < CANVAS_W - 1) queue.push(pos + 1);
    if (y > 0)            queue.push(pos - CANVAS_W);
    if (y < CANVAS_H - 1) queue.push(pos + CANVAS_W);
  }
  _ctx.putImageData(img, 0, 0);
}

function onPointerDown(e) {
  if (e.button !== 0) return;
  const { x, y } = getPos(e);

  if (_tool === 'fill') {
    pushHistory();
    floodFill(x, y);
    pushHistory();
    autoSave();
    return;
  }

  _isDrawing = true;
  _lastX = x; _lastY = y;
  _canvas.setPointerCapture(e.pointerId);

  _ctx.save();
  if (_tool === 'eraser') {
    _ctx.globalCompositeOperation = 'destination-out';
    _ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    _ctx.globalCompositeOperation = 'source-over';
    _ctx.strokeStyle = _color;
  }
  _ctx.lineWidth  = _size;
  _ctx.lineCap    = 'round';
  _ctx.lineJoin   = 'round';
  _ctx.beginPath();
  _ctx.arc(x, y, _size / 2, 0, Math.PI * 2);
  _ctx.fillStyle = _tool === 'eraser' ? 'rgba(0,0,0,1)' : _color;
  _ctx.fill();
  _ctx.restore();
}

function onPointerMove(e) {
  if (!_isDrawing) return;
  const { x, y } = getPos(e);

  _ctx.save();
  if (_tool === 'eraser') {
    _ctx.globalCompositeOperation = 'destination-out';
    _ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    _ctx.globalCompositeOperation = 'source-over';
    _ctx.strokeStyle = _color;
  }
  _ctx.lineWidth  = _size;
  _ctx.lineCap    = 'round';
  _ctx.lineJoin   = 'round';
  _ctx.beginPath();
  _ctx.moveTo(_lastX, _lastY);
  _ctx.lineTo(x, y);
  _ctx.stroke();
  _ctx.restore();

  _lastX = x; _lastY = y;
}

function onPointerUp() {
  if (!_isDrawing) return;
  _isDrawing = false;
  pushHistory();
  autoSave();
}

// ── Toolbar ────────────────────────────────────────────────────────

function syncToolbar() {
  if (!_toolbarEl) return;
  _toolbarEl.querySelectorAll('[data-tool]').forEach(b =>
    b.classList.toggle('dr-active', b.dataset.tool === _tool)
  );
  _toolbarEl.querySelectorAll('.dr-swatch').forEach(s =>
    s.classList.toggle('dr-active', s.dataset.color === _color)
  );
}

function mkBtn(icon, title, onClick, extra = '') {
  const b = document.createElement('button');
  b.className = 'dr-btn' + (extra ? ' ' + extra : '');
  b.title = title;
  b.innerHTML = `<span class="material-symbols-outlined">${icon}</span>`;
  b.addEventListener('click', onClick);
  return b;
}

function buildToolbar() {
  const bar = document.createElement('div');
  bar.className = 'dr-toolbar';
  _toolbarEl = bar;

  // Tools
  const tools = document.createElement('div');
  tools.className = 'dr-group';
  [
    { tool: 'pen',    icon: 'edit' },
    { tool: 'eraser', icon: 'ink_eraser' },
    { tool: 'fill',   icon: 'format_color_fill' },
  ].forEach(({ tool, icon }) => {
    const b = mkBtn(icon, tool.charAt(0).toUpperCase() + tool.slice(1), () => {
      _tool = tool; syncToolbar();
    });
    b.dataset.tool = tool;
    if (tool === _tool) b.classList.add('dr-active');
    tools.appendChild(b);
  });
  bar.appendChild(tools);

  bar.appendChild(sep());

  // Palette
  const palette = document.createElement('div');
  palette.className = 'dr-group dr-palette';
  PALETTE.forEach(c => {
    const s = document.createElement('button');
    s.className = 'dr-swatch' + (c === _color ? ' dr-active' : '');
    s.dataset.color = c;
    s.style.background = c;
    s.title = c;
    s.addEventListener('click', () => { _color = c; syncToolbar(); });
    palette.appendChild(s);
  });

  const custom = document.createElement('input');
  custom.type = 'color';
  custom.className = 'dr-color-input';
  custom.value = _color;
  custom.title = 'Custom color';
  custom.addEventListener('input', () => {
    _color = custom.value;
    _toolbarEl.querySelectorAll('.dr-swatch').forEach(s => s.classList.remove('dr-active'));
  });
  palette.appendChild(custom);
  bar.appendChild(palette);

  bar.appendChild(sep());

  // Brush size
  const sizeWrap = document.createElement('div');
  sizeWrap.className = 'dr-group';
  const slider = document.createElement('input');
  slider.type = 'range'; slider.min = 1; slider.max = 48;
  slider.value = _size; slider.className = 'dr-size';
  slider.title = 'Brush size';
  slider.addEventListener('input', () => { _size = +slider.value; });
  sizeWrap.appendChild(slider);
  bar.appendChild(sizeWrap);

  bar.appendChild(sep());

  // Undo / Redo / Clear
  const actions = document.createElement('div');
  actions.className = 'dr-group';
  actions.append(
    mkBtn('undo', 'Undo (⌘Z)',  undo),
    mkBtn('redo', 'Redo (⌘⇧Z)', redo),
    mkBtn('delete', 'Clear canvas', clearCanvas, 'dr-btn-danger'),
  );
  bar.appendChild(actions);

  return bar;
}

function sep() {
  const d = document.createElement('div');
  d.className = 'dr-sep';
  return d;
}

// ── Canvas ─────────────────────────────────────────────────────────

function clearCanvas() {
  pushHistory();
  _ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  pushHistory();
  autoSave();
}

function initCanvas() {
  _canvas = document.createElement('canvas');
  _canvas.className = 'dr-canvas';
  _canvas.width  = CANVAS_W;
  _canvas.height = CANVAS_H;
  _ctx = _canvas.getContext('2d');

  _canvas.addEventListener('pointerdown', onPointerDown);
  _canvas.addEventListener('pointermove', onPointerMove);
  _canvas.addEventListener('pointerup',   onPointerUp);
  _canvas.addEventListener('pointerleave', onPointerUp);
  return _canvas;
}

// ── Left list ──────────────────────────────────────────────────────

function buildLeft() {
  const pane = document.createElement('div');
  pane.className = 'nt-left dr-left';
  _leftEl = pane;
  refreshList();
  return pane;
}

function refreshList() {
  if (!_leftEl) return;
  _leftEl.innerHTML = '';

  const hdr = document.createElement('div');
  hdr.className = 'nt-section-hdr';
  const lbl = document.createElement('span');
  lbl.className = 'nt-section-label'; lbl.textContent = 'Drawings';
  const addBtn = document.createElement('button');
  addBtn.className = 'nt-add-btn';
  addBtn.title = 'New drawing';
  addBtn.innerHTML = '<span class="material-symbols-outlined">add</span>';
  addBtn.addEventListener('click', newDrawing);
  hdr.append(lbl, addBtn);
  _leftEl.appendChild(hdr);

  const list = allDrawings();
  if (!list.length) {
    const empty = document.createElement('p');
    empty.className = 'nt-empty'; empty.textContent = 'No drawings yet.';
    _leftEl.appendChild(empty);
    return;
  }

  [...list].reverse().forEach(d => {
    const card = document.createElement('div');
    card.className = 'dr-list-card' + (d.id === _currentId ? ' selected' : '');

    const thumb = document.createElement('img');
    thumb.className = 'dr-thumb';
    thumb.src = d.dataUrl || '';
    thumb.alt = '';

    const title = document.createElement('span');
    title.className = 'dr-list-title';
    title.textContent = d.title || 'Untitled';

    card.append(thumb, title);
    card.addEventListener('click', () => loadDrawing(d.id));
    _leftEl.appendChild(card);
  });
}

// ── Load / New ─────────────────────────────────────────────────────

function loadDrawing(id) {
  if (_currentId === id) return;
  if (_currentId) autoSave();
  _currentId = id;
  _history = []; _histIdx = -1;
  const d = allDrawings().find(x => x.id === id);
  if (!d || !d.dataUrl) {
    _ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    pushHistory();
    refreshList();
    return;
  }
  const img = new Image();
  img.onload = () => {
    _ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    _ctx.drawImage(img, 0, 0);
    pushHistory();
  };
  img.src = d.dataUrl;
  refreshList();
}

function newDrawing() {
  if (_currentId) autoSave();
  const id  = duid();
  const now = new Date().toISOString();
  const entry = { id, title: 'Untitled', dataUrl: '', createdAt: now, updatedAt: now };
  const list  = [...allDrawings(), entry];
  _data = { ..._data, notes: { ...notesBase(), drawings: list } };
  _onSave({ notes: _data.notes });
  _currentId = id;
  _history = []; _histIdx = -1;
  _ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  pushHistory();
  refreshList();
}

// ── Public API ─────────────────────────────────────────────────────

export function buildDrawPane(container, data, onSave) {
  _data   = data;
  _onSave = onSave;

  const root = document.createElement('div');
  root.className = 'nt-root';

  // Left
  root.appendChild(buildLeft());

  // Right
  const right = document.createElement('div');
  right.className = 'dr-right';
  right.appendChild(buildToolbar());

  const wrap = document.createElement('div');
  wrap.className = 'dr-canvas-wrap';
  wrap.appendChild(initCanvas());
  right.appendChild(wrap);

  root.appendChild(right);
  container.appendChild(root);

  // Load most recent or create new
  const list = allDrawings();
  if (list.length) {
    loadDrawing(list[list.length - 1].id);
  } else {
    newDrawing();
  }

  // Keyboard shortcuts
  function onKey(e) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
  }
  document.addEventListener('keydown', onKey);
  _removeKeys = () => document.removeEventListener('keydown', onKey);
}

export function updateDrawData(newData) {
  _data = newData;
  refreshList();
}

export function destroyDrawPane() {
  if (_removeKeys) { _removeKeys(); _removeKeys = null; }
  _canvas = null; _ctx = null;
  _currentId = null;
  _history = []; _histIdx = -1;
  _leftEl = null; _toolbarEl = null;
}
