// core/settings/util.js — shared, stateless DOM helpers used across settings sections.

export function sectionLabel(parent, text, marginTop) {
  const div = document.createElement('div');
  div.className = 'sp-section-label';
  if (marginTop) div.style.marginTop = marginTop;
  div.textContent = text;
  parent.appendChild(div);
}

export function field(labelText, innerHtml) {
  const div = document.createElement('div');
  div.className = 'sp-field';
  const lbl = document.createElement('div');
  lbl.className   = 'sp-field-label';
  lbl.textContent = labelText;
  div.appendChild(lbl);
  if (innerHtml) div.insertAdjacentHTML('beforeend', innerHtml);
  return div;
}

export function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
