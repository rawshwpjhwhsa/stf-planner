#!/usr/bin/env node
/**
 * parse-core-components.js
 * Parses raw Star Traders Frontiers wiki core component data into src/data/core_components.json
 *
 * Sections in scripts/raw/core_components.txt are delimited by:
 *   # SECTION type=<type> [subtype=<s>] [size=<s>] [massClass=<n>]
 *
 * Bridge columns (intCount=9):
 *   mass | pilot | shipOps | electronics | navigation | officers | armor | shield | jumpCost
 *
 * Engine columns (intCount=12):
 *   mass | pilot | shipOps | electronics | navigation |
 *   speed | agility | fuelPerAU | fuelPerCombat | reactorPoints | safetyRating | shielding
 *   NOTE: wiki data has 12 integers per row (not 13); rpPerRangeChange is absent in source data.
 *
 * Hyperwarp columns (intCount=7):
 *   mass | pilot | electronics | navigation | armor | shield | jumpCost
 *
 * Usage:  node scripts/parse-core-components.js
 * Input:  scripts/raw/core_components.txt
 * Output: src/data/core_components.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Helpers ────────────────────────────────────────────────────────────────────
function parseCost(s) {
  const m = String(s).match(/\$([\d.]+)([km])/i);
  if (!m) return 0;
  const v = parseFloat(m[1]);
  return m[2].toLowerCase() === 'm' ? Math.round(v * 1_000_000) : Math.round(v * 1_000);
}

function num(s) {
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

// Returns { name, ints, cost } or null.
// Collects exactly intCount integers right-to-left from the end (before cost).
// Everything remaining to the left is the name.
function parseDataLine(line, intCount) {
  const raw = line.trim();
  if (!raw || raw.startsWith('#')) return null;

  const costMatch = raw.match(/(\$[\d.]+[km])\s*$/i);
  if (!costMatch) return null;

  const cost = parseCost(costMatch[1]);
  const body = raw.slice(0, raw.lastIndexOf(costMatch[0])).trim();
  const tokens = body.split(/\s+/);

  const ints = [];
  let i = tokens.length - 1;
  while (i >= 0 && ints.length < intCount) {
    if (/^-?\d+$/.test(tokens[i])) {
      ints.unshift(num(tokens[i]));
      i--;
    } else {
      break;
    }
  }

  if (ints.length !== intCount) return null;

  const name = tokens.slice(0, tokens.length - intCount).join(' ').trim();
  if (!name) return null;

  return { name, ints, cost };
}

// ── Section-aware builders ────────────────────────────────────────────────────
function buildBridge(parsed, subtype, size) {
  const [mass, pilot, shipOps, electronics, navigation, officers, armor, shield, jumpCost] = parsed.ints;
  const obj = {
    name: parsed.name,
    type: 'bridge',
    subtype,
    size,
    mass,
    skills: { pilot, shipOps, electronics, navigation },
    officers,
    armor,
    shield,
    jumpCost,
    cost: parsed.cost,
  };
  return obj;
}

function buildEngine(parsed, massClass) {
  const [mass, pilot, shipOps, electronics, navigation,
         speed, agility, fuelPerAU, fuelPerCombat,
         reactorPoints, safetyRating, shielding] = parsed.ints;
  return {
    name: parsed.name,
    type: 'engine',
    massClass,
    size: 'large',
    mass,
    skills: { pilot, shipOps, electronics, navigation },
    speed,
    agility,
    fuelPerAU,
    fuelPerCombat,
    reactorPoints,
    rpPerRangeChange: 0,
    safetyRating,
    armor: 0,
    shield: shielding,
    jumpCost: 0,
    cost: parsed.cost,
  };
}

function buildHyperwarp(parsed, massClass, size) {
  const [mass, pilot, electronics, navigation, armor, shield, jumpCost] = parsed.ints;
  return {
    name: parsed.name,
    type: 'hyperwarp',
    massClass,
    size,
    mass,
    skills: { pilot, electronics, navigation },
    armor,
    shield,
    jumpCost,
    cost: parsed.cost,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────────
const rawPath = path.resolve(__dirname, 'raw', 'core_components.txt');
const outPath = path.resolve(__dirname, '..', 'src', 'data', 'core_components.json');

if (!fs.existsSync(rawPath)) {
  console.error(`Error: raw data file not found at ${rawPath}`);
  process.exit(1);
}

const INT_COUNT = { bridge: 9, engine: 12, hyperwarp: 7 };

let section = null;  // { type, subtype, size, massClass, flagged }
const output = [];

const lines = fs.readFileSync(rawPath, 'utf8').split('\n');

for (const line of lines) {
  const trimmed = line.trim();

  // Section directive
  if (trimmed.startsWith('# SECTION')) {
    const attrs = {};
    for (const m of trimmed.matchAll(/(\w+)=([^\s]+)/g)) {
      attrs[m[1]] = m[2];
    }
    section = {
      type:      attrs.type,
      subtype:   attrs.subtype ?? null,
      size:      attrs.size ?? null,
      massClass: attrs.massClass ? parseInt(attrs.massClass, 10) : null,
      flagged:   trimmed.includes('flagged') || trimmed.includes('WARNING'),
    };
    if (section.flagged) {
      console.warn(`WARNING: capital bridge section is flagged as a wiki copy error — using standard Bridge data as placeholder`);
    }
    continue;
  }

  if (trimmed.startsWith('#') || !trimmed) continue;
  if (!section) continue;

  const intCount = INT_COUNT[section.type];
  if (!intCount) continue;

  const parsed = parseDataLine(trimmed, intCount);
  if (!parsed) continue;

  let entry;
  if (section.type === 'bridge') {
    entry = buildBridge(parsed, section.subtype, section.size);
    if (section.flagged) entry._wikiNote = 'capital bridge data unverified — copied from standard Bridge';
  } else if (section.type === 'engine') {
    entry = buildEngine(parsed, section.massClass);
  } else if (section.type === 'hyperwarp') {
    entry = buildHyperwarp(parsed, section.massClass, section.size);
  }

  if (entry) output.push(entry);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

const counts = {};
for (const e of output) counts[e.type] = (counts[e.type] ?? 0) + 1;
console.log(`Wrote ${output.length} core components → ${path.relative(process.cwd(), outPath)}`);
console.log('  By type:', counts);
