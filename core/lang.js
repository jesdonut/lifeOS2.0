// core/lang.js — EN/ID/JP language toggle for public pages

const _LK    = 'lifeOS_lang';
const _CYCLE = { en: 'id', id: 'jp', jp: 'en' };
const _LABEL = { en: 'ID', id: 'JP', jp: 'EN' };

const _THEME_LIGHT = { en: '☀︎ Light', id: '☀︎ Terang', jp: '☀︎ ライト' };
const _THEME_DARK  = { en: '☾ Dark',  id: '☾ Gelap',  jp: '☾ ダーク' };

function _apply(lang) {
  localStorage.setItem(_LK, lang);
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-en]').forEach(el => {
    const val = el.dataset[lang] ?? el.dataset.en;
    el.innerHTML = val;
  });
  const langBtn = document.getElementById('lang-toggle');
  if (langBtn) langBtn.textContent = _LABEL[lang];
  _updateThemeBtn(lang);
}

function _updateThemeBtn(lang) {
  const themeBtn = document.getElementById('theme-toggle');
  if (!themeBtn) return;
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  themeBtn.textContent = isLight ? _THEME_DARK[lang] : _THEME_LIGHT[lang];
}

document.addEventListener('DOMContentLoaded', () => {
  const lang = localStorage.getItem(_LK) || 'en';
  _apply(lang);

  const langBtn = document.getElementById('lang-toggle');
  if (langBtn) langBtn.addEventListener('click', () => {
    const cur = localStorage.getItem(_LK) || 'en';
    _apply(_CYCLE[cur] ?? 'en');
  });

  // Patch each page's theme toggle to also update translated text
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    const _orig = themeBtn.onclick;
    themeBtn.addEventListener('click', () => {
      requestAnimationFrame(() => _updateThemeBtn(localStorage.getItem(_LK) || 'en'));
    });
  }
});
