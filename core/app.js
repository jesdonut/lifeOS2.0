// app.js — tab routing, module lifecycle, notes sidebar

import { load, save, subscribe } from './store.js';

const MODULE_MAP = {
  calendar: () => import('../modules/calendar/calendar.js'),
  period:   () => import('../modules/period/period-ui.js'),
  finance:  () => import('../modules/finance/finance.js'),
  bank:     () => import('../modules/bank/bank.js'),
  currency: () => import('../modules/currency/currency.js'),
  nisa:     () => import('../modules/nisa/nisa.js'),
  savings:  () => import('../modules/savings/savings.js'),
};

const panel       = document.getElementById('panel');
const tabs        = document.querySelectorAll('.tab');
const sidebar     = document.getElementById('sidebar');
const sidebarBody = document.getElementById('sidebar-body');
const sidebarBtn  = document.getElementById('sidebar-toggle');

let active      = null;  // { name, mod }
let notesMod    = null;

// ── Main tab routing ──────────────────────────────────────────────

async function switchTo(name) {
  if (active?.name === name) return;

  active?.mod.destroy();
  active = null;

  tabs.forEach(t => t.classList.toggle('active', t.dataset.module === name));
  panel.innerHTML = '';

  const data = load();

  try {
    const mod = await MODULE_MAP[name]();
    mod.init(panel, data, partial => save(partial));
    active = { name, mod };
  } catch (err) {
    panel.innerHTML = `<p style="color:var(--negative);padding:var(--space-5);font-family:var(--font-mono);font-size:var(--text-sm)">${name} error: ${err.message}</p>`;
    console.error(`[${name}]`, err);
  }
}

subscribe(newData => {
  active?.mod.onDataChange(newData);
  notesMod?.onDataChange(newData);
});

tabs.forEach(t => t.addEventListener('click', () => switchTo(t.dataset.module)));

// ── Notes sidebar ─────────────────────────────────────────────────

const SIDEBAR_KEY = 'lifeOS_sidebar_collapsed';

function initSidebar() {
  const collapsed = localStorage.getItem(SIDEBAR_KEY) === '1';
  setSidebarCollapsed(collapsed, false);

  import('../modules/notes/notes.js').then(mod => {
    notesMod = mod;
    mod.init(sidebarBody, load(), partial => save(partial));
  }).catch(err => {
    sidebarBody.innerHTML = `<p style="color:var(--negative);padding:var(--space-4);font-size:var(--text-sm)">${err.message}</p>`;
    console.error('[notes]', err);
  });

  sidebarBtn.addEventListener('click', () => {
    setSidebarCollapsed(!sidebar.classList.contains('collapsed'), true);
  });
}

function setSidebarCollapsed(collapsed, persist) {
  sidebar.classList.toggle('collapsed', collapsed);
  sidebarBtn.textContent = collapsed ? '›' : '‹';
  if (persist) localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '');
}

// ── Boot ──────────────────────────────────────────────────────────

switchTo('calendar');
initSidebar();
