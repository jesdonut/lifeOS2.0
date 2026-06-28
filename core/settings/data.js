// core/settings/data.js — the "Data" settings section: export / import / logout / clear.
// Stateless: takes closeSettings as a param so it doesn't depend back on settings.js.

import { exportBackup, importBackup } from '../store.js';
import { doImportV1, doMergeInvestments } from '../import/import-v1.js';
import { doImportDelta } from '../import/import-delta.js';
import { sectionLabel } from './util.js';

const _isMobile = /Mobi|Android/i.test(navigator.userAgent);

function exportAndConfirm(onConfirmed) {
  exportBackup();
  if (!_isMobile) { onConfirmed?.(); return; }

  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.75)',
    'z-index:3000', 'display:flex', 'align-items:center',
    'justify-content:center', 'padding:var(--s4)',
  ].join(';');

  const box = document.createElement('div');
  box.style.cssText = [
    'background:var(--surface)', 'border:1px solid var(--border)',
    'border-radius:var(--radius-lg)', 'padding:var(--s6)',
    'max-width:340px', 'width:100%',
    'display:flex', 'flex-direction:column', 'gap:var(--s4)',
  ].join(';');

  const title = document.createElement('div');
  title.style.cssText = 'font-size:var(--fs-base);font-weight:600;color:var(--text)';
  title.textContent = 'Did the file save?';

  const hint = document.createElement('p');
  hint.style.cssText = 'font-size:var(--fs-xs);color:var(--text-2);line-height:1.6;margin:0';
  hint.textContent = 'On iOS, the file opens in your browser — tap Share, then Save to Files to keep it. On Android, check your Downloads folder.';

  const acts = document.createElement('div');
  acts.style.cssText = 'display:flex;flex-direction:column;gap:var(--s2)';

  const yesBtn = document.createElement('button');
  yesBtn.className = 'sp-data-btn';
  yesBtn.style.cssText = 'padding:var(--s3);background:var(--accent);color:var(--bg);font-weight:600';
  yesBtn.textContent = 'Yes, I have the file';
  yesBtn.addEventListener('click', () => { overlay.remove(); onConfirmed?.(); });

  const retryBtn = document.createElement('button');
  retryBtn.className = 'sp-data-btn';
  retryBtn.style.cssText = 'padding:var(--s3)';
  retryBtn.textContent = 'Not yet — try again';
  retryBtn.addEventListener('click', () => { overlay.remove(); exportAndConfirm(onConfirmed); });

  acts.append(yesBtn, retryBtn);
  box.append(title, hint, acts);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

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
    exportAndConfirm(() => {
      dlBtn.textContent = 'Downloaded';
      dlBtn.style.opacity = '0.5';
    });
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

export function renderData(el, closeSettings) {
  sectionLabel(el, 'Your data');

  el.appendChild(dataRow('Log out', 'Clear this browser session and return to the start.', 'Log out', true,
    () => showLogoutModal()
  ));

  el.appendChild(dataRow('Export backup', 'Download all your data as a JSON file.', 'Export', false,
    () => exportAndConfirm()
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

  el.appendChild(dataRow('Import investments', 'Merge bonds and NISA config from a JSON file. Skips already-imported entries.', 'Import', false,
    () => {
      const fi = document.createElement('input');
      fi.type   = 'file';
      fi.accept = '.json';
      fi.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const r = await doMergeInvestments(file);
          const parts = [];
          if (r.bondsAdded)   parts.push(`${r.bondsAdded} bond${r.bondsAdded === 1 ? '' : 's'} imported`);
          if (r.bondsSkipped) parts.push(`${r.bondsSkipped} skipped`);
          if (r.hasNisa)      parts.push('NISA config saved');
          closeSettings();
          location.reload();
          setTimeout(() => alert(parts.length ? parts.join(', ') + '.' : 'Nothing new to import.'), 300);
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
