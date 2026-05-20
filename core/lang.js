// core/lang.js — EN/ID language toggle for public pages

const _LK = 'lifeOS_lang';

function _apply(lang) {
  localStorage.setItem(_LK, lang);
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-en]').forEach(el => {
    const val = lang === 'id' ? (el.dataset.id ?? el.dataset.en) : el.dataset.en;
    el.innerHTML = val;
  });
  const btn = document.getElementById('lang-toggle');
  if (btn) btn.textContent = lang === 'id' ? 'EN' : 'ID';
}

document.addEventListener('DOMContentLoaded', () => {
  _apply(localStorage.getItem(_LK) || 'en');
  const btn = document.getElementById('lang-toggle');
  if (btn) btn.addEventListener('click', () => {
    _apply((localStorage.getItem(_LK) || 'en') === 'en' ? 'id' : 'en');
  });
});
