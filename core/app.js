// app.js — tab routing, gesture navigation, notes sidebar, theme

import { load, save, subscribe } from './store.js';
import { initGestures } from './gestures.js';
import { openSettings } from './settings.js';

const TABS = ['calendar', 'period', 'finance', 'bank'];

const MODULE_MAP = {
  calendar: () => import('../modules/calendar/calendar.js'),
  period:   () => import('../modules/period/period-ui.js'),
  finance:  () => import('../modules/finance/finance.js'),
  bank:     () => import('../modules/bank/bank.js'),
};

// ── DOM refs ───────────────────────────────────────────────────────
const tabBar      = document.getElementById('tab-bar');
const stage       = document.getElementById('stage');
const sidebar     = document.getElementById('sidebar');
const sidebarBody = document.getElementById('sidebar-body');
const sidebarBtn  = document.getElementById('sidebar-toggle');

// ── State ──────────────────────────────────────────────────────────
let activeIndex = 0;
const mods = {};   // name → loaded module instance

// ── Build stage panels ─────────────────────────────────────────────
TABS.forEach(name => {
  const panel = document.createElement('div');
  panel.className = 'module-panel';
  panel.id = `panel-${name}`;
  stage.appendChild(panel);
});

// ── Gestures ───────────────────────────────────────────────────────
const gestures = initGestures({
  stage,
  getIndex:  () => activeIndex,
  getCount:  () => TABS.length,
  onSwitch:  (delta) => switchTo(activeIndex + delta),
});

// ── Tab switching ──────────────────────────────────────────────────
async function switchTo(index) {
  index = Math.max(0, Math.min(TABS.length - 1, index));
  if (index === activeIndex && mods[TABS[index]]) return;

  activeIndex = index;
  const name  = TABS[index];

  // Update tab bar
  tabBar.querySelectorAll('.tab').forEach((t, i) =>
    t.classList.toggle('active', i === index)
  );

  // Animate stage
  gestures.jumpTo(index);

  // Load module if not yet loaded
  if (!mods[name]) {
    const panel = document.getElementById(`panel-${name}`);
    try {
      const mod = await MODULE_MAP[name]();
      mods[name] = mod;
      mod.init(panel, load(), partial => save(partial));
    } catch (err) {
      const panel = document.getElementById(`panel-${name}`);
      panel.innerHTML = `<p style="color:var(--red);font-size:var(--fs-sm);padding:var(--s5)">${name}: ${err.message}</p>`;
      console.error(`[${name}]`, err);
    }
  }
}

// ── Brand pill ─────────────────────────────────────────────────────
const brandWrap = document.createElement('div');
brandWrap.style.cssText = 'display:flex;align-items:center;gap:8px;margin-right:var(--s3);flex-shrink:0;';
brandWrap.innerHTML = `
  <span class="brand-pill-name" style="font-size:16px">Seratus</span>
  <span class="brand-pill" style="padding:3px 10px">
    <span class="brand-pill-ver">lifeOS v2.0</span>
  </span>
`;
tabBar.insertBefore(brandWrap, tabBar.firstChild);

// ── Tab bar clicks ─────────────────────────────────────────────────
TABS.forEach((name, i) => {
  const btn = document.createElement('button');
  btn.className = 'tab';
  btn.dataset.module = name;
  btn.textContent = name.charAt(0).toUpperCase() + name.slice(1);
  btn.addEventListener('click', () => switchTo(i));
  tabBar.appendChild(btn);
});

// ── Data updates ───────────────────────────────────────────────────
subscribe(newData => {
  Object.values(mods).forEach(mod => mod?.onDataChange?.(newData));
});

// ── Notes sidebar ──────────────────────────────────────────────────
const SIDEBAR_KEY = 'lifeOS_sidebar';

function initSidebar() {
  const collapsed = localStorage.getItem(SIDEBAR_KEY) !== '1';
  setSidebar(collapsed, false);

  import('../modules/notes/notes.js').then(mod => {
    mod.init(sidebarBody, load(), partial => save(partial));
    subscribe(d => mod.onDataChange?.(d));
  }).catch(err => {
    sidebarBody.innerHTML = `<p style="color:var(--red);padding:var(--s4);font-size:var(--fs-sm)">${err.message}</p>`;
  });

  sidebarBtn.addEventListener('click', () =>
    setSidebar(!sidebar.classList.contains('collapsed'), true)
  );

  const sidebarClose = document.getElementById('sidebar-close');
  if (sidebarClose) sidebarClose.addEventListener('click', () => setSidebar(true, true));
}

function setSidebar(collapsed, persist) {
  sidebar.classList.toggle('collapsed', collapsed);
  sidebarBtn.textContent = collapsed ? '›' : '‹';
if (persist) localStorage.setItem(SIDEBAR_KEY, collapsed ? '0' : '1');
}

// ── Theme ──────────────────────────────────────────────────────────
const THEME_KEY = 'lifeOS_landing_theme';
let _theme = localStorage.getItem(THEME_KEY) || 'dark';

function applyTheme(t) {
  _theme = t;
  document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : '');
  localStorage.setItem(THEME_KEY, t);
  themeBtn.innerHTML = `<span class="material-symbols-outlined">${t === 'light' ? 'dark_mode' : 'light_mode'}</span>`;
}

// ── Settings panel ─────────────────────────────────────────────────

function toggleSettings() {
  openSettings({
    data:          load(),
    onSave:        partial => save(partial),
    theme:         _theme,
    onThemeChange: t => applyTheme(t),
  });
}

// ── Tab bar — tabs + right-side controls ───────────────────────────
const tabRight = document.createElement('div');
tabRight.id = 'tab-right';

const themeBtn = document.createElement('button');
themeBtn.id = 'theme-btn';
themeBtn.className = 'tab-ctrl-btn';

const settingsBtn = document.createElement('button');
settingsBtn.id = 'settings-btn';
settingsBtn.className = 'tab-ctrl-btn';
settingsBtn.innerHTML = '<span class="material-symbols-outlined">settings</span>';
settingsBtn.addEventListener('click', e => { e.stopPropagation(); toggleSettings(); });

themeBtn.addEventListener('click', e => {
  e.stopPropagation();
  applyTheme(_theme === 'dark' ? 'light' : 'dark');
});

tabRight.append(themeBtn, settingsBtn);
tabBar.appendChild(tabRight);

// ── Boot ───────────────────────────────────────────────────────────
applyTheme(_theme);

const _data = load();
if (!_data.settings?.setupDone) {
  window.location.href = 'index.html';
} else {
  switchTo(0);
  initSidebar();
}
