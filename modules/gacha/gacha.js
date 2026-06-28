// gacha.js — Gacha tracker module

import { mountArknights } from './arknights.js';

let _container, _data, _onSave;
let _game = 'arknights'; // 'arknights' | 'other'

const GAMES = [
  { id: 'arknights', label: 'Arknights' },
  { id: 'other',     label: '???' },
];

export function init(container, data, onSave) {
  _container = container;
  _data      = data;
  _onSave    = onSave;
  _loadCss();
  _render();
}

export function destroy() {
  _container.innerHTML = '';
}

export function onDataChange(newData) {
  _data = newData;
}

function _loadCss() {
  if (document.getElementById('gacha-css')) return;
  const link = document.createElement('link');
  link.id   = 'gacha-css';
  link.rel  = 'stylesheet';
  link.href = 'modules/gacha/gacha.css';
  document.head.appendChild(link);
}

function _save(patch) {
  const gacha = { ...(_data?.gacha ?? {}), ...patch };
  _data = { ..._data, gacha };
  _onSave({ gacha });
}

function _render() {
  _container.innerHTML = '';

  // Header
  const hdr = document.createElement('div');
  hdr.className = 'gacha-hdr';

  const toggle = document.createElement('div');
  toggle.className = 'cal-view-toggle';
  GAMES.forEach(g => {
    const btn = document.createElement('button');
    btn.className = 'cal-view-btn' + (_game === g.id ? ' active' : '');
    btn.textContent = g.label;
    btn.addEventListener('click', () => { if (_game !== g.id) { _game = g.id; _render(); } });
    toggle.appendChild(btn);
  });
  hdr.appendChild(toggle);
  _container.appendChild(hdr);

  // Game content
  const body = document.createElement('div');
  body.className = 'gacha-body';
  _container.appendChild(body);

  if (_game === 'arknights') {
    mountArknights(body, _data?.gacha?.arknights ?? {}, patch => _save({ arknights: { ...(_data?.gacha?.arknights ?? {}), ...patch } }));
  } else {
    const ph = document.createElement('div');
    ph.className = 'gacha-placeholder';
    ph.textContent = 'Coming soon';
    body.appendChild(ph);
  }
}
