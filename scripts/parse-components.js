#!/usr/bin/env node
/**
 * parse-components.js
 * Parses raw Star Traders Frontiers wiki component data into src/data/components.json
 *
 * Raw data format: tab-separated rows from the wiki Ship Components Reference page.
 * Each row: [WikiType] <tab> Name <tab> Faction <tab> Size <tab> Mass <tab>
 *           PILT <tab> SOPS <tab> GUNR <tab> ELEC <tab> NAVI <tab>
 *           Cargo <tab> Crew <tab> Officer <tab>
 *           Armor <tab> Shield <tab> Jump <tab> Fuel <tab>
 *           Guest <tab> Prison <tab> Medical
 *
 * WikiType prefix ("Ship comp cargo" etc.) is optional on a line — if absent the
 * line is treated as name-first and category is inferred from stats/name.
 *
 * Usage: node scripts/parse-components.js
 * Input: scripts/raw/components.txt (tab-separated)
 * Output: src/data/components.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Faction mapping ────────────────────────────────────────────────────────────
// Wiki uses "Small banner N" icons. Banner 51 = Jyeeta is confirmed.
// Others derived from in-game context — verify if unsure.
const BANNER_FACTION = {
  '1': 'De Valtos Syndicate',
  '2': 'Cadar Syndicate',
  '3': 'Rychart Syndicate',
  '4': 'House Thulun',
  '5': 'Clan Javat',
  '6': 'Clan Steel Song',
  '7': 'Clan Moklumnue',
  '8': 'Alta Mesa',
  '9': 'Clan Zenrin',
  '51': 'Jyeeta',
};

function parseFaction(raw) {
  if (!raw || raw === 'None') return null;
  const m = raw.match(/Small banner (\d+)/);
  if (m) return BANNER_FACTION[m[1]] ?? `Banner${m[1]}`;
  return null;
}

// ── Number parser ──────────────────────────────────────────────────────────────
// Handles "+0", "+4", "+-2", "-2", plain integers.
function num(s) {
  const n = parseInt(String(s ?? '0').replace(/^\+/, ''), 10);
  return isNaN(n) ? 0 : n;
}

// ── Category mapping ───────────────────────────────────────────────────────────
// weapons  = autocannons / lances / railguns / plasma / gravcannons / missiles / torpedoes
// crew     = barracks / officer quarters / medical
// cargo    = holds / passenger / prisoner
// combat   = armor / shields / battle prow / weapon lockers
// ship     = fuel / mass reducers / boosters / sensors / spikes / hangars
// operations = scanners / EVA / salvage / orbital
function getCategory(wikiType, name) {
  const t = (wikiType || '').replace(/^Ship comp\s*/, '').toLowerCase().trim();
  const n = name.toLowerCase();

  // Weapons
  if (t.startsWith('weapon') && !t.includes('locker')) return 'weapons';

  // Combat
  if (t.includes('locker'))                                    return 'combat';
  if (t === 'armor' || t === 'defensive' || t === 'shield')   return 'combat';
  if (t === 'seals') {
    if (n.includes('eva') || n.includes('airlock') || n.includes('deck') || n.includes('suit'))
      return 'operations';
    return 'combat'; // plating / coating / weather/radiation seals
  }

  // Crew
  if (t === 'medical') return 'crew';
  if (t === 'cabin')   return 'crew';
  if (t === 'barracks') {
    if (n.includes('passenger') || n.includes('luxury') || n.includes('suites') ||
        n.includes(' cabin'))  return 'cargo';
    if (n.includes('prison') || n.includes('interrogat') || n.includes('plague ward'))
      return 'cargo';
    return 'crew';
  }

  // Cargo
  if (t === 'cargo')    return 'cargo';

  // Operations
  if (t === 'extractor')                             return 'operations';
  if (t === 'exocrawler')                            return 'operations';
  if (t === 'intel bonus')                           return 'operations';
  if (t === 'fuelscoop' && n.includes('orbital'))   return 'operations';

  // Ship (fuel, mass reducers, boosters, sensors, reactor spikes, hangars, orbital scoops)
  return 'ship';
}

// ── Line parser ────────────────────────────────────────────────────────────────
function parseLine(line) {
  // Split on tabs; drop empty tokens from leading/trailing tabs
  const f = line.split('\t').map(s => s.trim()).filter(Boolean);
  if (f.length < 15) return null; // skip header rows or malformed lines

  let wikiType, name, factionRaw, size, massRaw;
  let pilt, sops, gunr, elec, navi;
  let cargoRaw, crewRaw, officersRaw;
  let armorRaw, shieldRaw, jumpRaw, fuelRaw;
  let guestsRaw, prisonRaw, medicalRaw;

  if (f[0].startsWith('Ship comp')) {
    [wikiType, name, factionRaw, size, massRaw,
     pilt, sops, gunr, elec, navi,
     cargoRaw, crewRaw, officersRaw,
     armorRaw, shieldRaw, jumpRaw, fuelRaw,
     guestsRaw, prisonRaw, medicalRaw] = f;
  } else {
    // No wiki-type prefix (e.g. first row in a copy-paste without the icon cell)
    wikiType = '';
    [name, factionRaw, size, massRaw,
     pilt, sops, gunr, elec, navi,
     cargoRaw, crewRaw, officersRaw,
     armorRaw, shieldRaw, jumpRaw, fuelRaw,
     guestsRaw, prisonRaw, medicalRaw] = f;
  }

  if (!name) return null;

  return {
    name,
    faction: parseFaction(factionRaw),
    size: size.toLowerCase(),
    mass: num(massRaw),
    skills: {
      pilot:       num(pilt),
      shipOps:     num(sops),
      gunnery:     num(gunr),
      electronics: num(elec),
      navigation:  num(navi),
    },
    crew:       num(crewRaw),
    officers:   num(officersRaw),
    armor:      num(armorRaw),
    shield:     num(shieldRaw),
    jumpCost:   num(jumpRaw),
    fuel:       num(fuelRaw),
    cargo:      num(cargoRaw),
    passengers: num(guestsRaw),
    prisoners:  num(prisonRaw),
    medical:    num(medicalRaw),
    category:   getCategory(wikiType, name),
  };
}

// ── Main ───────────────────────────────────────────────────────────────────────
const rawPath = path.resolve(__dirname, 'raw', 'components.txt');
const outPath = path.resolve(__dirname, '..', 'src', 'data', 'components.json');

if (!fs.existsSync(rawPath)) {
  console.error(`Error: raw data file not found at ${rawPath}`);
  console.error('Paste the wiki table text (tab-separated) into that file and re-run.');
  process.exit(1);
}

const raw = fs.readFileSync(rawPath, 'utf8');
const components = raw
  .split('\n')
  .filter(l => l.trim() && !l.trim().startsWith('#'))
  .map(parseLine)
  .filter(Boolean);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(components, null, 2));
console.log(`Wrote ${components.length} components → ${path.relative(process.cwd(), outPath)}`);
