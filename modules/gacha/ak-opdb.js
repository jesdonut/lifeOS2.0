// ak-opdb.js — fetch + cache Arknights operator DB from Kengxxiao

const URL_EN = 'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/en_US/gamedata/excel/character_table.json';
const CACHE_KEY = 'ak_char_table_v3';
const AVATAR_BASE = 'https://raw.githubusercontent.com/Aceship/Arknight-Images/main/avatars/';

const PROF_LABEL = {
  CASTER: 'Caster', DEFENDER: 'Defender', GUARD: 'Guard',
  MEDIC: 'Medic', PIONEER: 'Vanguard', SNIPER: 'Sniper',
  SPECIAL: 'Specialist', SUPPORT: 'Supporter', TOKEN: 'Token', TRAP: 'Trap',
};

export function avatarUrl(charId) {
  return AVATAR_BASE + charId + '.png';
}

export function profLabel(p) {
  return PROF_LABEL[p] ?? p;
}

export async function loadOpDB() {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    try { return JSON.parse(cached); } catch { /* re-fetch */ }
  }
  const res = await fetch(URL_EN);
  const raw = await res.json();
  const db = {};
  for (const [id, op] of Object.entries(raw)) {
    if (!id.startsWith('char_')) continue;
    if (op.isNotObtainable) continue;
    if (!op.name) continue;
    const rarity = parseInt(op.rarity.replace('TIER_', '')); // 1–6
    db[id] = {
      name:       op.name,
      rarity,
      profession: op.profession,
      sub:        op.subProfessionId ?? '',
    };
  }
  localStorage.setItem(CACHE_KEY, JSON.stringify(db));
  return db;
}

export function clearOpDBCache() {
  localStorage.removeItem(CACHE_KEY);
}
