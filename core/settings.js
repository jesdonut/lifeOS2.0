// core/settings.js — full settings modal

import { exportBackup, importBackup } from './store.js';
import { doImportV1 } from './import-v1.js';
import { doImportDelta } from './import-delta.js';

// ── Constants ──────────────────────────────────────────────────────

const TZ_LIST = [
  'Pacific/Honolulu','America/Los_Angeles','America/Denver','America/Chicago',
  'America/New_York','America/Sao_Paulo','Europe/London','Europe/Paris',
  'Europe/Berlin','Europe/Moscow','Asia/Dubai','Asia/Kolkata','Asia/Dhaka',
  'Asia/Bangkok','Asia/Singapore','Asia/Tokyo','Asia/Seoul','Asia/Shanghai',
  'Australia/Sydney','Pacific/Auckland',
];

const CURRENCIES = ['JPY','IDR','USD','EUR','GBP','SGD','AUD','CAD','KRW','THB','MYR','PHP','INR'];

const ACCENT_PALETTE = [
  { id: 'rose',     label: 'Rose',     dark: ['#c9a0b4', '#a07890'], light: ['#b07090', '#8a5070'] },
  { id: 'sage',     label: 'Sage',     dark: ['#8fafa2', '#6a8a7d'], light: ['#4a7a6a', '#2a5a4a'] },
  { id: 'blue',     label: 'Blue',     dark: ['#7a9cc4', '#5a7aa0'], light: ['#3a6090', '#1a4070'] },
  { id: 'amber',    label: 'Amber',    dark: ['#c4a46a', '#a08050'], light: ['#8a6030', '#6a4010'] },
  { id: 'lavender', label: 'Lavender', dark: ['#9b8fd4', '#7a6aaa'], light: ['#6a50a0', '#4a3080'] },
  { id: 'clay',     label: 'Clay',     dark: ['#c48a6a', '#a06a4a'], light: ['#8a5030', '#6a3010'] },
];

export function applyAccent(accentId, theme) {
  const entry  = ACCENT_PALETTE.find(p => p.id === accentId) ?? ACCENT_PALETTE[0];
  const colors = theme === 'light' ? entry.light : entry.dark;
  document.documentElement.style.setProperty('--accent',   colors[0]);
  document.documentElement.style.setProperty('--accent-2', colors[1]);
}

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Argentina','Armenia','Australia',
  'Austria','Azerbaijan','Bahrain','Bangladesh','Belarus','Belgium','Bolivia','Bosnia and Herzegovina',
  'Botswana','Brazil','Bulgaria','Cambodia','Cameroon','Canada','Chile','China','Colombia',
  'Costa Rica','Croatia','Cuba','Cyprus','Czech Republic','Denmark','Dominican Republic',
  'Ecuador','Egypt','El Salvador','Estonia','Ethiopia','Finland','France','Georgia','Germany',
  'Ghana','Greece','Guatemala','Honduras','Hong Kong','Hungary','Iceland','India','Indonesia',
  'Iran','Iraq','Ireland','Israel','Italy','Japan','Jordan','Kazakhstan','Kenya','Kosovo',
  'Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Libya','Liechtenstein','Lithuania',
  'Luxembourg','Malaysia','Malta','Mexico','Moldova','Monaco','Mongolia','Montenegro','Morocco',
  'Myanmar','Nepal','Netherlands','New Zealand','Nicaragua','Nigeria','North Korea','Norway',
  'Oman','Pakistan','Palestine','Panama','Paraguay','Peru','Philippines','Poland','Portugal',
  'Qatar','Romania','Russia','Rwanda','Saudi Arabia','Senegal','Serbia','Singapore','Slovakia',
  'Slovenia','Somalia','South Africa','South Korea','Spain','Sri Lanka','Sudan','Sweden',
  'Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Tunisia','Turkey',
  'Turkmenistan','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States',
  'Uruguay','Uzbekistan','Venezuela','Vietnam','Yemen','Zimbabwe',
];

export const DEFAULT_CATS = [
  { id: 'work',      name: 'Work',      isCustom: false },
  { id: 'personal',  name: 'Personal',  isCustom: false },
  { id: 'health',    name: 'Health',    isCustom: false },
  { id: 'family',    name: 'Family',    isCustom: false },
  { id: 'friends',   name: 'Friends',   isCustom: false },
  { id: 'travel',    name: 'Travel',    isCustom: false },
  { id: 'education', name: 'Education', isCustom: false },
  { id: 'project',   name: 'Project',   isCustom: false },
  { id: 'partner',   name: 'Partner',   isCustom: false },
];

// ── State ──────────────────────────────────────────────────────────

let _overlay     = null;
let _data, _onSave, _theme, _onThemeChange;
let _activeSection = 'profile';

// ── Public API ─────────────────────────────────────────────────────

export function openSettings({ data, onSave, theme, onThemeChange }) {
  if (_overlay) return;
  _data          = data;
  _onSave        = onSave;
  _theme         = theme;
  _onThemeChange = onThemeChange;

  const cssHref = new URL('../style/settings.css', import.meta.url).href;
  if (!document.querySelector(`link[href="${cssHref}"]`)) {
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = cssHref;
    document.head.appendChild(link);
  }

  _overlay = document.createElement('div');
  _overlay.className = 'settings-overlay';
  _overlay.addEventListener('click', e => { if (e.target === _overlay) closeSettings(); });
  _overlay.appendChild(buildModal());
  document.body.appendChild(_overlay);
}

export function closeSettings() {
  _overlay?.remove();
  _overlay = null;
}

// ── Modal skeleton ─────────────────────────────────────────────────

function buildModal() {
  const modal = document.createElement('div');
  modal.className = 'settings-modal';
  modal.addEventListener('click', e => e.stopPropagation());

  modal.innerHTML = `
    <div class="settings-modal-hdr">
      <span class="settings-modal-title">Settings</span>
      <button class="settings-modal-close">✕</button>
    </div>
    <div class="settings-body">
      <nav class="settings-nav" id="stnav"></nav>
      <div class="settings-content" id="stcontent"></div>
    </div>
  `;

  modal.querySelector('.settings-modal-close').addEventListener('click', closeSettings);

  const nav     = modal.querySelector('#stnav');
  const content = modal.querySelector('#stcontent');

  const SECTIONS = [
    { id: 'profile',    icon: 'person',         label: 'Profile' },
    { id: 'calendar',   icon: 'calendar_month', label: 'Calendar' },
    { id: 'spending',   icon: 'payments',       label: 'Spending' },
    { id: 'appearance', icon: 'palette',        label: 'Appearance' },
    { id: 'data',       icon: 'storage',        label: 'Data' },
  ];

  SECTIONS.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'settings-nav-btn' + (s.id === _activeSection ? ' active' : '');
    btn.dataset.section = s.id;
    btn.innerHTML = `<span class="material-symbols-outlined">${s.icon}</span>${s.label}`;
    btn.addEventListener('click', () => {
      nav.querySelectorAll('.settings-nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _activeSection = s.id;
      renderSection(content, s.id);
    });
    nav.appendChild(btn);
  });

  renderSection(content, _activeSection);
  return modal;
}

function renderSection(el, id) {
  el.innerHTML = '';
  if      (id === 'profile')    renderProfile(el);
  else if (id === 'calendar')   renderCalendar(el);
  else if (id === 'spending')   renderSpending(el);
  else if (id === 'appearance') renderAppearance(el);
  else if (id === 'data')       renderData(el);
}

// ── Profile ────────────────────────────────────────────────────────

function renderProfile(el) {
  const s = _data.settings ?? {};

  sectionLabel(el, 'About you');

  // Name
  el.appendChild(field('Your name',
    `<input class="sp-input" id="sp-name" type="text" autocomplete="off"
      value="${esc(s.name ?? '')}" placeholder="Your name" />`
  ));

  // Birth + timezone
  const row = document.createElement('div');
  row.className = 'sp-row';
  row.appendChild(field('Date of birth',
    `<input class="sp-input" id="sp-birth" type="date" value="${esc(s.birth ?? '')}" />`
  ));
  const tzField = field('Timezone', '');
  const tzSel = document.createElement('select');
  tzSel.id = 'sp-tz';
  tzSel.className = 'sp-input';
  TZ_LIST.forEach(tz => {
    const opt = document.createElement('option');
    opt.value = tz;
    opt.textContent = tz.replace(/_/g, ' ');
    if (tz === (s.timezone ?? 'Asia/Tokyo')) opt.selected = true;
    tzSel.appendChild(opt);
  });
  tzField.appendChild(tzSel);
  row.appendChild(tzField);
  el.appendChild(row);

  // Nationalities
  const natField = field('Nationalities', '');
  const natTags  = document.createElement('div');
  natTags.className = 'sp-tags';
  natField.appendChild(natTags);
  el.appendChild(natField);
  const natItems = [...(s.nationalities ?? [])];
  const getNat   = makeTagInput(natTags, natField, natItems);

  // Locations
  const locField = field('Countries lived in', '');
  const locTags  = document.createElement('div');
  locTags.className = 'sp-tags';
  locField.appendChild(locTags);
  el.appendChild(locField);
  const locItems = [...(s.locations ?? [])];
  const getLoc   = makeTagInput(locTags, locField, locItems);

  // Currencies
  sectionLabel(el, 'Currencies', 'var(--s4)');

  const selectedCurs = new Set(s.currencies ?? ['JPY', 'IDR']);
  const chipGrid = document.createElement('div');
  chipGrid.className = 'sp-chip-grid';

  function addCurrencyChip(code) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'sp-chip' + (selectedCurs.has(code) ? ' selected' : '');
    chip.textContent = code;
    chip.addEventListener('click', () => {
      if (selectedCurs.has(code)) { selectedCurs.delete(code); chip.classList.remove('selected'); }
      else { selectedCurs.add(code); chip.classList.add('selected'); }
    });
    chipGrid.appendChild(chip);
  }

  CURRENCIES.forEach(addCurrencyChip);
  (s.currencies ?? []).filter(c => !CURRENCIES.includes(c)).forEach(addCurrencyChip);
  el.appendChild(chipGrid);

  const customRow = document.createElement('div');
  customRow.style.cssText = 'display:flex;gap:var(--s2);align-items:center;margin-bottom:var(--s4)';
  const customInput = document.createElement('input');
  customInput.className = 'sp-input';
  customInput.style.cssText = 'width:120px;font-size:var(--fs-xs)';
  customInput.placeholder = 'Other (e.g. BRL)';
  customInput.maxLength = 6;
  customInput.autocomplete = 'off';
  const customAddBtn = document.createElement('button');
  customAddBtn.type = 'button';
  customAddBtn.className = 'sp-data-btn';
  customAddBtn.textContent = '+ Add';
  customAddBtn.addEventListener('click', () => {
    const code = customInput.value.trim().toUpperCase();
    if (!code || selectedCurs.has(code)) return;
    selectedCurs.add(code);
    addCurrencyChip(code);
    customInput.value = '';
  });
  customInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); customAddBtn.click(); }
  });
  customRow.append(customInput, customAddBtn);
  el.appendChild(customRow);

  // Modules
  sectionLabel(el, 'Modules');

  let periodEnabled = s.periodEnabled ?? false;
  const toggleRow = document.createElement('div');
  toggleRow.className = 'sp-toggle-row';
  toggleRow.innerHTML = `
    <div>
      <div class="sp-toggle-name">Period tracker</div>
      <div class="sp-toggle-desc">Cycle logging, predictions, symptoms</div>
    </div>
    <div class="sp-switch${periodEnabled ? ' on' : ''}" id="sp-period-sw"></div>
  `;
  toggleRow.addEventListener('click', () => {
    periodEnabled = !periodEnabled;
    toggleRow.querySelector('#sp-period-sw').classList.toggle('on', periodEnabled);
  });
  el.appendChild(toggleRow);

  // Save
  const actions = document.createElement('div');
  actions.className = 'sp-actions';
  const saveBtn = document.createElement('button');
  saveBtn.className = 'sp-save-btn';
  saveBtn.textContent = 'Save changes';
  saveBtn.addEventListener('click', () => {
    const name  = el.querySelector('#sp-name').value.trim();
    const birth = el.querySelector('#sp-birth').value;
    const tz    = el.querySelector('#sp-tz').value;
    if (!name) { el.querySelector('#sp-name').focus(); return; }
    const birthYear = birth ? new Date(birth).getFullYear() : (s.birthYear ?? null);
    _onSave({
      settings: {
        ..._data.settings,
        name,
        birth,
        birthYear,
        timezone:      tz,
        nationalities: getNat(),
        locations:     getLoc(),
        currencies:    [...selectedCurs],
        periodEnabled,
      }
    });
    saveBtn.textContent = 'Saved';
    setTimeout(() => { saveBtn.textContent = 'Save changes'; }, 1500);
  });
  actions.appendChild(saveBtn);
  el.appendChild(actions);
}

// ── Calendar categories ────────────────────────────────────────────

function renderCalendar(el) {
  const cats = (_data.settings?.categories ?? DEFAULT_CATS).map(c => ({ ...c }));
  let editingId = null;

  sectionLabel(el, 'Week');

  const wsRow = document.createElement('div');
  wsRow.className = 'sp-toggle-row';

  const wsLabel = document.createElement('div');
  wsLabel.innerHTML = '<div class="sp-toggle-name">First day of week</div>';

  const wsBtns = document.createElement('div');
  wsBtns.className = 'sp-theme-btns';

  let weekStart = _data.settings?.weekStart ?? 1;

  ['Monday', 'Sunday'].forEach((label, i) => {
    const val = i === 0 ? 1 : 0;
    const btn = document.createElement('button');
    btn.className = 'sp-theme-btn' + (weekStart === val ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      weekStart = val;
      wsBtns.querySelectorAll('.sp-theme-btn').forEach((b, j) => b.classList.toggle('active', j === i));
      _onSave({ settings: { ..._data.settings, weekStart } });
    });
    wsBtns.appendChild(btn);
  });

  wsRow.append(wsLabel, wsBtns);
  el.appendChild(wsRow);

  sectionLabel(el, 'Event categories', 'var(--s4)');

  const listEl = document.createElement('div');
  listEl.className = 'sp-cat-list';
  el.appendChild(listEl);

  function renderCats() {
    listEl.innerHTML = '';

    cats.forEach(cat => {
      const row = document.createElement('div');
      row.className = 'sp-cat-row';

      const swatch = document.createElement('div');
      swatch.className = 'sp-cat-swatch';
      swatch.style.background = cat.color ?? `var(--cat-${cat.id})`;

      if (editingId === cat.id) {
        const inp = document.createElement('input');
        inp.className = 'sp-cat-input';
        inp.value = cat.name;
        inp.autocomplete = 'off';

        const okBtn = document.createElement('button');
        okBtn.className = 'sp-cat-btn';
        okBtn.textContent = 'Save';
        okBtn.addEventListener('click', () => {
          const val = inp.value.trim();
          if (val) cat.name = val;
          editingId = null;
          saveCats(cats);
          renderCats();
        });
        inp.addEventListener('keydown', e => {
          if (e.key === 'Enter')  { e.preventDefault(); okBtn.click(); }
          if (e.key === 'Escape') { editingId = null; renderCats(); }
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'sp-cat-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => { editingId = null; renderCats(); });

        row.append(swatch, inp, okBtn, cancelBtn);
        listEl.appendChild(row);
        requestAnimationFrame(() => inp.focus());
        return;
      }

      const name = document.createElement('span');
      name.className = 'sp-cat-name';
      name.textContent = cat.name;

      const renameBtn = document.createElement('button');
      renameBtn.className = 'sp-cat-btn';
      renameBtn.textContent = 'Rename';
      renameBtn.addEventListener('click', () => { editingId = cat.id; renderCats(); });

      row.append(swatch, name, renameBtn);

      if (cat.isCustom) {
        const delBtn = document.createElement('button');
        delBtn.className = 'sp-cat-btn del';
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', () => {
          cats.splice(cats.findIndex(c => c.id === cat.id), 1);
          saveCats(cats);
          renderCats();
        });
        row.appendChild(delBtn);
      }

      listEl.appendChild(row);
    });

    // Add row
    const addRow = document.createElement('div');
    addRow.className = 'sp-add-cat-row';

    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.className = 'sp-color-input';
    colorPicker.value = '#9b5cd4';

    const newName = document.createElement('input');
    newName.className = 'sp-input';
    newName.style.flex = '1';
    newName.placeholder = 'New category name';
    newName.autocomplete = 'off';

    const addBtn = document.createElement('button');
    addBtn.className = 'sp-cat-btn';
    addBtn.textContent = '+ Add';
    addBtn.addEventListener('click', () => {
      const name = newName.value.trim();
      if (!name) { newName.focus(); return; }
      cats.push({
        id:       'custom_' + Math.random().toString(36).slice(2, 7),
        name,
        color:    colorPicker.value,
        isCustom: true,
      });
      saveCats(cats);
      newName.value = '';
      renderCats();
    });
    newName.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addBtn.click(); }
    });

    addRow.append(colorPicker, newName, addBtn);
    listEl.appendChild(addRow);
  }

  renderCats();
}

function saveCats(cats) {
  _onSave({ settings: { ..._data.settings, categories: cats } });
}

// ── Spending categories ────────────────────────────────────────────

const DEFAULT_SPEND_CATS = [
  { id: 'food',          name: 'Food',              color: '#e8824a', sub: ['Breakfast', 'Lunch', 'Dinner', 'Others'],                                        isCustom: false },
  { id: 'bills',         name: 'Bills',             color: '#5b8fce', sub: ['Gas', 'Water', 'Electricity', 'Internet', 'Mobile'],                            isCustom: false },
  { id: 'commute',       name: 'Commute',           color: '#4aae8f', sub: ['Work', 'Bus', 'Train', 'Airplane', 'Taxi', 'Ship', 'Car'],                      isCustom: false },
  { id: 'entertainment', name: 'Entertainment',     color: '#a06fd8', sub: ['Game', 'Movie', 'Clothes', 'Gadget'],                                           isCustom: false },
  { id: 'beauty',        name: 'Beauty',            color: '#e06b9a', sub: ['Pedicure', 'Manicure', 'Hair cut', 'Hair color', 'Eyebrow', 'Eyelash'],         isCustom: false },
  { id: 'paperwork',     name: 'Paperwork',         color: '#c9a84c', sub: ['Visa', 'Government', 'Ward office'],                                            isCustom: false },
  { id: 'medical',       name: 'Medical',           color: '#e06060', sub: ['Hospital', 'Clinic', 'Pharmacy'],                                               isCustom: false },
  { id: 'necessities',   name: 'Daily necessities', color: '#7aab7a', sub: ['Shampoo', 'Body soap', 'Conditioner', 'Toothbrush', 'Detergent', 'Dish soap'], isCustom: false },
];

function renderSpending(el) {
  const cats = (_data.settings?.spendCategories ?? DEFAULT_SPEND_CATS).map(c => ({ ...c, sub: [...(c.sub ?? [])] }));
  let editingId    = null;
  let editingSub   = null; // 'add' | index number
  let newSubValue  = '';

  sectionLabel(el, 'Spending categories');

  const listEl = document.createElement('div');
  listEl.className = 'sp-cat-list';
  el.appendChild(listEl);

  function saveSpendCats(updated) {
    _onSave({ settings: { ..._data.settings, spendCategories: updated } });
  }

  function renderCats() {
    listEl.innerHTML = '';

    cats.forEach((cat, ci) => {
      const block = document.createElement('div');
      block.className = 'sp-spend-block';

      // Category row
      const row = document.createElement('div');
      row.className = 'sp-cat-row';

      const swatch = document.createElement('div');
      swatch.className = 'sp-cat-swatch';
      swatch.style.background = cat.color;

      if (editingId === cat.id) {
        const inp = document.createElement('input');
        inp.className = 'sp-cat-input';
        inp.value = cat.name;
        inp.autocomplete = 'off';

        const colorPick = document.createElement('input');
        colorPick.type = 'color';
        colorPick.className = 'sp-color-input';
        colorPick.value = cat.color;
        colorPick.addEventListener('input', () => { swatch.style.background = colorPick.value; });

        const okBtn = document.createElement('button');
        okBtn.className = 'sp-cat-btn';
        okBtn.textContent = 'Save';
        okBtn.addEventListener('click', () => {
          const val = inp.value.trim();
          if (val) { cats[ci].name = val; cats[ci].color = colorPick.value; }
          editingId = null;
          saveSpendCats(cats);
          renderCats();
        });
        inp.addEventListener('keydown', e => {
          if (e.key === 'Enter')  { e.preventDefault(); okBtn.click(); }
          if (e.key === 'Escape') { editingId = null; renderCats(); }
        });
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'sp-cat-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => { editingId = null; renderCats(); });

        row.append(swatch, colorPick, inp, okBtn, cancelBtn);
      } else {
        const name = document.createElement('span');
        name.className = 'sp-cat-name';
        name.textContent = cat.name;

        const renameBtn = document.createElement('button');
        renameBtn.className = 'sp-cat-btn';
        renameBtn.textContent = 'Rename';
        renameBtn.addEventListener('click', () => { editingId = cat.id; editingSub = null; renderCats(); });

        row.append(swatch, name, renameBtn);

        if (cat.isCustom) {
          const delBtn = document.createElement('button');
          delBtn.className = 'sp-cat-btn del';
          delBtn.textContent = 'Delete';
          delBtn.addEventListener('click', () => {
            cats.splice(ci, 1);
            saveSpendCats(cats);
            renderCats();
          });
          row.appendChild(delBtn);
        }
      }
      block.appendChild(row);

      // Subcategories
      const subWrap = document.createElement('div');
      subWrap.className = 'sp-sub-wrap';

      cat.sub.forEach((s, si) => {
        const subRow = document.createElement('div');
        subRow.className = 'sp-sub-row';

        if (editingSub === `${cat.id}:${si}`) {
          const inp = document.createElement('input');
          inp.className = 'sp-cat-input';
          inp.value = s;
          inp.autocomplete = 'off';
          const okBtn = document.createElement('button');
          okBtn.className = 'sp-cat-btn';
          okBtn.textContent = 'Save';
          okBtn.addEventListener('click', () => {
            const val = inp.value.trim();
            if (val) cats[ci].sub[si] = val;
            editingSub = null;
            saveSpendCats(cats);
            renderCats();
          });
          inp.addEventListener('keydown', e => {
            if (e.key === 'Enter')  { e.preventDefault(); okBtn.click(); }
            if (e.key === 'Escape') { editingSub = null; renderCats(); }
          });
          const cancelBtn = document.createElement('button');
          cancelBtn.className = 'sp-cat-btn';
          cancelBtn.textContent = 'Cancel';
          cancelBtn.addEventListener('click', () => { editingSub = null; renderCats(); });
          subRow.append(inp, okBtn, cancelBtn);
        } else {
          const chip = document.createElement('span');
          chip.className = 'sp-sub-chip';
          chip.textContent = s;
          chip.style.setProperty('--chip-color', cat.color);

          const editBtn = document.createElement('button');
          editBtn.className = 'sp-sub-edit-btn';
          editBtn.textContent = 'Edit';
          editBtn.addEventListener('click', () => { editingSub = `${cat.id}:${si}`; editingId = null; renderCats(); });

          const delBtn = document.createElement('button');
          delBtn.className = 'sp-sub-del-btn';
          delBtn.textContent = '×';
          delBtn.addEventListener('click', () => {
            cats[ci].sub.splice(si, 1);
            saveSpendCats(cats);
            renderCats();
          });
          subRow.append(chip, editBtn, delBtn);
        }
        subWrap.appendChild(subRow);
      });

      // Add subcategory row
      if (editingSub === `${cat.id}:add`) {
        const addInpRow = document.createElement('div');
        addInpRow.className = 'sp-sub-row';
        const inp = document.createElement('input');
        inp.className = 'sp-cat-input';
        inp.placeholder = 'New subcategory';
        inp.autocomplete = 'off';
        inp.value = newSubValue;
        inp.addEventListener('input', () => { newSubValue = inp.value; });
        const okBtn = document.createElement('button');
        okBtn.className = 'sp-cat-btn';
        okBtn.textContent = 'Add';
        okBtn.addEventListener('click', () => {
          const val = inp.value.trim();
          if (val) cats[ci].sub.push(val);
          editingSub = null;
          newSubValue = '';
          saveSpendCats(cats);
          renderCats();
        });
        inp.addEventListener('keydown', e => {
          if (e.key === 'Enter')  { e.preventDefault(); okBtn.click(); }
          if (e.key === 'Escape') { editingSub = null; newSubValue = ''; renderCats(); }
        });
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'sp-cat-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => { editingSub = null; newSubValue = ''; renderCats(); });
        addInpRow.append(inp, okBtn, cancelBtn);
        subWrap.appendChild(addInpRow);
        requestAnimationFrame(() => inp.focus());
      } else {
        const addSubBtn = document.createElement('button');
        addSubBtn.className = 'sp-sub-add-btn';
        addSubBtn.textContent = '+ subcategory';
        addSubBtn.addEventListener('click', () => { editingSub = `${cat.id}:add`; editingId = null; renderCats(); });
        subWrap.appendChild(addSubBtn);
      }

      block.appendChild(subWrap);
      listEl.appendChild(block);
    });

    // Add new category row
    const addRow = document.createElement('div');
    addRow.className = 'sp-add-cat-row';
    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.className = 'sp-color-input';
    colorPicker.value = '#9b5cd4';
    const newName = document.createElement('input');
    newName.className = 'sp-input';
    newName.style.flex = '1';
    newName.placeholder = 'New category name';
    newName.autocomplete = 'off';
    const addBtn = document.createElement('button');
    addBtn.className = 'sp-cat-btn';
    addBtn.textContent = '+ Add';
    addBtn.addEventListener('click', () => {
      const name = newName.value.trim();
      if (!name) { newName.focus(); return; }
      cats.push({ id: 'custom_' + Math.random().toString(36).slice(2, 7), name, color: colorPicker.value, sub: [], isCustom: true });
      saveSpendCats(cats);
      newName.value = '';
      renderCats();
    });
    newName.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addBtn.click(); } });
    addRow.append(colorPicker, newName, addBtn);
    listEl.appendChild(addRow);
  }

  renderCats();
}

// ── Appearance ─────────────────────────────────────────────────────

function renderAppearance(el) {
  sectionLabel(el, 'Theme');

  const row = document.createElement('div');
  row.className = 'sp-theme-row';

  const name = document.createElement('span');
  name.className = 'sp-theme-name';
  name.textContent = 'Color scheme';

  const btns = document.createElement('div');
  btns.className = 'sp-theme-btns';

  ['dark', 'light'].forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'sp-theme-btn' + (_theme === t ? ' active' : '');
    btn.textContent = t.charAt(0).toUpperCase() + t.slice(1);
    btn.addEventListener('click', () => {
      _theme = t;
      _onThemeChange(t);
      applyAccent(_data.settings?.accentId, t);
      btns.querySelectorAll('.sp-theme-btn').forEach(b =>
        b.classList.toggle('active', b.textContent.toLowerCase() === t)
      );
    });
    btns.appendChild(btn);
  });

  row.append(name, btns);
  el.appendChild(row);

  sectionLabel(el, 'Accent color', 'var(--s4)');

  const swatchRow = document.createElement('div');
  swatchRow.className = 'sp-accent-row';

  let currentAccentId = _data.settings?.accentId ?? 'rose';

  ACCENT_PALETTE.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'sp-accent-swatch' + (currentAccentId === p.id ? ' active' : '');
    btn.title = p.label;
    btn.style.setProperty('--swatch', p.dark[0]);
    btn.addEventListener('click', () => {
      currentAccentId = p.id;
      swatchRow.querySelectorAll('.sp-accent-swatch').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyAccent(p.id, _theme);
      _onSave({ settings: { ..._data.settings, accentId: p.id } });
    });
    swatchRow.appendChild(btn);
  });

  el.appendChild(swatchRow);
}

// ── Data ───────────────────────────────────────────────────────────

function showLogoutModal() {
  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.7)',
    'z-index:2000', 'display:flex', 'align-items:center',
    'justify-content:center', 'padding:var(--s4)',
  ].join(';');

  const box = document.createElement('div');
  box.style.cssText = [
    'background:var(--surface)', 'border:1px solid var(--border)',
    'border-radius:var(--radius-lg)', 'padding:var(--s6)',
    'max-width:380px', 'width:100%',
    'display:flex', 'flex-direction:column', 'gap:var(--s4)',
  ].join(';');

  const title = document.createElement('div');
  title.style.cssText = 'font-size:var(--fs-lg);font-weight:600;color:var(--text)';
  title.textContent = 'Log out';

  const body = document.createElement('p');
  body.style.cssText = 'font-size:var(--fs-sm);color:var(--text-2);line-height:1.7;margin:0';
  body.textContent = 'This will clear all your data from this browser. Download a backup first so you can pick up where you left off.';

  const dlBtn = document.createElement('button');
  dlBtn.className = 'sp-data-btn';
  dlBtn.style.cssText = 'width:100%;padding:var(--s3)';
  dlBtn.textContent = 'Download backup';
  dlBtn.addEventListener('click', () => {
    exportBackup();
    dlBtn.textContent = 'Downloaded';
    dlBtn.style.opacity = '0.5';
  });

  const hr = document.createElement('hr');
  hr.style.cssText = 'border:none;border-top:1px solid var(--border-dim)';

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:var(--s3);align-items:center';

  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'sp-data-btn danger';
  logoutBtn.style.cssText = 'flex:1;padding:var(--s3);opacity:0.4;pointer-events:none';
  let secs = 5;
  logoutBtn.textContent = `Log out (${secs})`;

  const timer = setInterval(() => {
    secs--;
    if (secs > 0) {
      logoutBtn.textContent = `Log out (${secs})`;
    } else {
      clearInterval(timer);
      logoutBtn.textContent = 'Log out';
      logoutBtn.style.opacity = '';
      logoutBtn.style.pointerEvents = '';
    }
  }, 1000);

  logoutBtn.addEventListener('click', () => {
    clearInterval(timer);
    ['lifeOS_data', 'lifeOS_landing_theme', 'lifeOS_sidebar'].forEach(k =>
      localStorage.removeItem(k)
    );
    window.location.href = 'index.html';
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'sp-data-btn';
  cancelBtn.style.cssText = 'padding:var(--s3) var(--s4)';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => { clearInterval(timer); overlay.remove(); });

  overlay.addEventListener('click', e => { if (e.target === overlay) { clearInterval(timer); overlay.remove(); } });

  actions.append(logoutBtn, cancelBtn);
  box.append(title, body, dlBtn, hr, actions);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function renderData(el) {
  sectionLabel(el, 'Your data');

  el.appendChild(dataRow('Log out', 'Clear this browser session and return to the start.', 'Log out', true,
    () => showLogoutModal()
  ));

  el.appendChild(dataRow('Export backup', 'Download all your data as a JSON file.', 'Export', false,
    () => exportBackup()
  ));

  el.appendChild(dataRow('Import backup', 'Restore from a previously exported JSON file.', 'Import', false,
    () => {
      const fi = document.createElement('input');
      fi.type   = 'file';
      fi.accept = '.json';
      fi.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          await importBackup(file);
          closeSettings();
          location.reload();
        } catch {
          alert('Could not read that file. Make sure it is a valid LifeOS backup.');
        }
      });
      fi.click();
    }
  ));

  el.appendChild(dataRow('Import mobile data', 'Merge entries from a mobile delta export. Adds new entries without overwriting.', 'Import delta', false,
    () => {
      const fi = document.createElement('input');
      fi.type   = 'file';
      fi.accept = '.json';
      fi.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const summary = await doImportDelta(file);
          closeSettings();
          location.reload();
          setTimeout(() => alert(summary), 300);
        } catch (err) {
          alert('Import failed: ' + err.message);
        }
      });
      fi.click();
    }
  ));

  el.appendChild(dataRow('Import from v1', 'Convert a v1 LifeOS save file. Replaces all current data.', 'Import v1', false,
    () => {
      const fi = document.createElement('input');
      fi.type   = 'file';
      fi.accept = '.json';
      fi.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          await doImportV1(file);
          closeSettings();
          location.reload();
        } catch (err) {
          alert('Import failed: ' + err.message);
        }
      });
      fi.click();
    }
  ));

  let confirmOpen = false;
  const clearRowEl = dataRow('Clear all data', 'Permanently remove everything from this browser.', 'Clear', true,
    () => {
      if (confirmOpen) return;
      confirmOpen = true;
      const box = document.createElement('div');
      box.className = 'sp-confirm-box';
      box.innerHTML = `
        <p class="sp-confirm-text">This cannot be undone. All your data will be permanently deleted from this browser. Export a backup first if you want to keep it.</p>
        <div class="sp-confirm-actions">
          <button class="sp-confirm-yes" id="sp-confirm-yes">Yes, delete everything</button>
          <button class="sp-confirm-no"  id="sp-confirm-no">Cancel</button>
        </div>
      `;
      box.querySelector('#sp-confirm-yes').addEventListener('click', () => {
        ['lifeOS_data', 'lifeOS_landing_theme', 'lifeOS_sidebar'].forEach(k =>
          localStorage.removeItem(k)
        );
        window.location.href = 'setup.html';
      });
      box.querySelector('#sp-confirm-no').addEventListener('click', () => {
        box.remove();
        confirmOpen = false;
      });
      clearRowEl.after(box);
    }
  );
  el.appendChild(clearRowEl);

  // Manual clearing guide
  const guideTitle = document.createElement('div');
  guideTitle.className = 'sp-guide-title';
  guideTitle.textContent = 'Clear data manually from browser';
  el.appendChild(guideTitle);

  [
    {
      browser: 'Chrome / Edge',
      steps:   'Open DevTools (F12), go to Application tab, then Storage, then Local Storage, find this page, right-click lifeOS_data and delete.',
    },
    {
      browser: 'Safari',
      steps:   'Safari menu, Settings, Advanced, enable Show Develop menu, then Develop, Web Inspector, Storage, Local Storage, select the entry and delete.',
    },
    {
      browser: 'Firefox',
      steps:   'Open DevTools (F12), go to Storage tab, then Local Storage, find this page, select lifeOS_data and delete.',
    },
    {
      browser: 'Other browsers',
      steps:   'Look for Developer Tools, Storage, or Site Data in settings. Search for lifeOS_data in local storage.',
    },
  ].forEach(g => {
    const block   = document.createElement('div');
    block.className = 'sp-guide-block';
    const browser = document.createElement('div');
    browser.className   = 'sp-guide-browser';
    browser.textContent = g.browser;
    const steps = document.createElement('div');
    steps.className   = 'sp-guide-step';
    steps.textContent = g.steps;
    block.append(browser, steps);
    el.appendChild(block);
  });
}

function dataRow(title, desc, btnLabel, isDanger, onClick) {
  const row = document.createElement('div');
  row.className = 'sp-data-row';
  row.innerHTML = `
    <div>
      <div class="sp-data-title">${title}</div>
      <div class="sp-data-desc">${desc}</div>
    </div>
    <button class="sp-data-btn${isDanger ? ' danger' : ''}">${btnLabel}</button>
  `;
  row.querySelector('.sp-data-btn').addEventListener('click', onClick);
  return row;
}

// ── Tag input helper ───────────────────────────────────────────────

function makeTagInput(tagsEl, parentEl, items) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative';

  const input = document.createElement('input');
  input.className   = 'sp-input';
  input.type        = 'text';
  input.placeholder = 'Search country...';
  input.autocomplete = 'off';
  input.style.marginTop = 'var(--s2)';

  const dropdown = document.createElement('div');
  dropdown.style.cssText = [
    'position:absolute',
    'top:calc(100% + 2px)',
    'left:0',
    'right:0',
    'background:var(--surface-2)',
    'border:1px solid var(--border)',
    'border-radius:var(--radius-sm)',
    'z-index:100',
    'max-height:160px',
    'overflow-y:auto',
    'display:none',
  ].join(';');

  wrap.append(input, dropdown);
  parentEl.appendChild(wrap);

  let focusIdx = -1;

  function renderTags() {
    tagsEl.innerHTML = '';
    items.forEach(val => {
      const tag = document.createElement('span');
      tag.className = 'sp-tag';
      tag.innerHTML = `${esc(val)} <button class="sp-tag-del">✕</button>`;
      tag.querySelector('.sp-tag-del').addEventListener('click', () => {
        items.splice(items.indexOf(val), 1);
        renderTags();
      });
      tagsEl.appendChild(tag);
    });
  }

  function openDropdown(query) {
    const matches = COUNTRIES.filter(c =>
      c.toLowerCase().startsWith(query.toLowerCase()) && !items.includes(c)
    ).slice(0, 8);
    dropdown.innerHTML = '';
    focusIdx = -1;
    if (!matches.length) { dropdown.style.display = 'none'; return; }
    matches.forEach(c => {
      const opt = document.createElement('div');
      opt.style.cssText = 'padding:var(--s2) var(--s3);font-size:var(--fs-sm);color:var(--text-2);cursor:pointer';
      opt.textContent = c;
      opt.addEventListener('mouseover', () => { opt.style.background = 'var(--surface-3)'; });
      opt.addEventListener('mouseout',  () => { opt.style.background = ''; });
      opt.addEventListener('mousedown', e => { e.preventDefault(); addItem(c); });
      dropdown.appendChild(opt);
    });
    dropdown.style.display = 'block';
  }

  function addItem(val) {
    if (!val || items.includes(val)) return;
    items.push(val);
    renderTags();
    input.value = '';
    dropdown.style.display = 'none';
    focusIdx = -1;
  }

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (q) openDropdown(q); else dropdown.style.display = 'none';
  });

  input.addEventListener('keydown', e => {
    const opts = [...dropdown.querySelectorAll('div')];
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusIdx = Math.min(focusIdx + 1, opts.length - 1);
      opts.forEach((o, i) => { o.style.background = i === focusIdx ? 'var(--surface-3)' : ''; });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusIdx = Math.max(focusIdx - 1, 0);
      opts.forEach((o, i) => { o.style.background = i === focusIdx ? 'var(--surface-3)' : ''; });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusIdx >= 0 && opts[focusIdx]) addItem(opts[focusIdx].textContent);
    } else if (e.key === 'Escape') {
      dropdown.style.display = 'none';
    }
  });

  input.addEventListener('blur', () => setTimeout(() => { dropdown.style.display = 'none'; }, 150));

  renderTags();
  return () => [...items];
}

// ── Utilities ──────────────────────────────────────────────────────

function sectionLabel(parent, text, marginTop) {
  const div = document.createElement('div');
  div.className = 'sp-section-label';
  if (marginTop) div.style.marginTop = marginTop;
  div.textContent = text;
  parent.appendChild(div);
}

function field(labelText, innerHtml) {
  const div = document.createElement('div');
  div.className = 'sp-field';
  const lbl = document.createElement('div');
  lbl.className   = 'sp-field-label';
  lbl.textContent = labelText;
  div.appendChild(lbl);
  if (innerHtml) div.insertAdjacentHTML('beforeend', innerHtml);
  return div;
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
