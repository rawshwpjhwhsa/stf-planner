#!/usr/bin/env node
/**
 * validate-data.js
 * Checks src/data/*.json for duplicates, null required fields, and mass sanity.
 * Run periodically to track what still needs manual verification.
 *
 * Exit code 0 = clean (warnings only), 1 = hard errors found.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Helpers ────────────────────────────────────────────────────────────────────
const VALID_MASS_CLASSES = new Set([2400, 3400, 5000, 6000, 7000, 8000, 9000]);
const VALID_SIZES        = new Set(['small', 'medium', 'large']);
const VALID_CATEGORIES   = new Set(['weapons', 'combat', 'cargo', 'crew', 'ship', 'operations']);

function load(relPath) {
  const abs = path.resolve(__dirname, relPath);
  if (!fs.existsSync(abs)) {
    console.error(`  ✗ File not found: ${relPath}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

const errors   = [];
const warnings = [];

function err(msg)  { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

function section(title) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 60 - title.length - 4))}`);
}

function report(label, issues, symbol) {
  if (issues.length === 0) {
    console.log(`  ✓ ${label}`);
  } else {
    console.log(`  ${symbol} ${label}`);
    for (const i of issues) console.log(`      ${i}`);
  }
}

// ── ships.json ────────────────────────────────────────────────────────────────
section('ships.json');
const ships = load('src/data/ships.json');

if (ships) {
  console.log(`  ${ships.length} ships loaded`);

  // Duplicates
  const seenShip = new Set();
  const dupShips = [];
  for (const s of ships) {
    if (seenShip.has(s.name)) dupShips.push(s.name);
    seenShip.add(s.name);
  }
  report('Duplicate names', dupShips, '✗');
  dupShips.forEach(d => err(`[ships] Duplicate: "${d}"`));

  // Required fields (non-null)
  const SHIP_REQUIRED = [
    'name','massCapacity','massCurrent','massClass','price',
    'hull','maxOfficers','maxCrew','maxCrafts','evadePct',
    'defaultCargo','defaultEngine','engineSpeed','engineAgility','engineAU',
    'fuelTank','jumpCost',
  ];
  const shipMissingRequired = [];
  for (const s of ships) {
    for (const f of SHIP_REQUIRED) {
      if (s[f] == null) {
        shipMissingRequired.push(`"${s.name}" missing ${f}`);
        err(`[ships] "${s.name}" missing required field: ${f}`);
      }
    }
    if (!s.slots || s.slots.large == null || s.slots.medium == null || s.slots.small == null) {
      shipMissingRequired.push(`"${s.name}" has incomplete slots`);
      err(`[ships] "${s.name}" has incomplete slots`);
    }
  }
  report('Required fields present', shipMissingRequired, '✗');

  // fuelRange nulls (known TBC — warn not error)
  const nullFuelRange = ships.filter(s => s.fuelRange == null).map(s => s.name);
  report(`fuelRange null — ${nullFuelRange.length} ships (needs wiki verification)`, nullFuelRange, '⚠');
  if (nullFuelRange.length) warn(`[ships] ${nullFuelRange.length} ships have null fuelRange`);

  // Mass sanity
  const massIssues = [];
  for (const s of ships) {
    if (s.massCurrent != null && s.massCapacity != null && s.massCurrent > s.massCapacity)
      massIssues.push(`"${s.name}" massCurrent (${s.massCurrent}) > massCapacity (${s.massCapacity})`);
    if (!VALID_MASS_CLASSES.has(s.massClass))
      massIssues.push(`"${s.name}" invalid massClass: ${s.massClass}`);
  }
  report('Mass sanity (massCurrent ≤ massCapacity, valid massClass)', massIssues, '✗');
  massIssues.forEach(i => err(`[ships] ${i}`));

  // Slot sanity
  const slotIssues = [];
  for (const s of ships) {
    if (!s.slots) continue;
    const total = (s.slots.large ?? 0) + (s.slots.medium ?? 0) + (s.slots.small ?? 0);
    if (total === 0) slotIssues.push(`"${s.name}" has 0 total slots`);
  }
  report('Slot sanity (at least one slot)', slotIssues, '⚠');
  slotIssues.forEach(i => warn(`[ships] ${i}`));
}

// ── components.json ───────────────────────────────────────────────────────────
section('components.json');
const components = load('src/data/components.json');

if (components) {
  console.log(`  ${components.length} components loaded`);

  // Duplicates — keyed on (name, faction) since the same component name can
  // legitimately appear once per faction (e.g. Adv. Mass Dampener 5 × 9 factions).
  // A true duplicate is same name + same faction with differing stats.
  const compByKey = new Map();
  const dupComps = [];
  for (const c of components) {
    const key = `${c.name}::${c.faction ?? 'null'}`;
    if (compByKey.has(key)) {
      dupComps.push(`"${c.name}" (faction=${c.faction ?? 'none'}) — appears more than once with the same faction`);
      err(`[components] Duplicate (name+faction): "${c.name}" faction=${c.faction ?? 'none'}`);
    }
    compByKey.set(key, c);
  }
  report('Duplicate (name + faction) combinations', dupComps, '✗');

  // Required fields
  const COMP_REQUIRED = ['name','size','mass','category'];
  const compMissing = [];
  for (const c of components) {
    for (const f of COMP_REQUIRED) {
      if (c[f] == null) {
        compMissing.push(`"${c.name}" missing ${f}`);
        err(`[components] "${c.name}" missing required field: ${f}`);
      }
    }
    if (c.size && !VALID_SIZES.has(c.size)) {
      compMissing.push(`"${c.name}" invalid size: "${c.size}"`);
      err(`[components] "${c.name}" invalid size: "${c.size}"`);
    }
    if (c.category && !VALID_CATEGORIES.has(c.category)) {
      compMissing.push(`"${c.name}" invalid category: "${c.category}"`);
      err(`[components] "${c.name}" invalid category: "${c.category}"`);
    }
  }
  report('Required fields and valid enums', compMissing, '✗');

  // Mass sanity — flag extreme outliers
  const MASS_MIN = -600, MASS_MAX = 3000;
  const massSuspect = components
    .filter(c => c.mass != null && (c.mass < MASS_MIN || c.mass > MASS_MAX))
    .map(c => `"${c.name}" mass=${c.mass}`);
  report(`Mass in plausible range [${MASS_MIN}, ${MASS_MAX}]`, massSuspect, '⚠');
  massSuspect.forEach(i => warn(`[components] Suspect mass: ${i}`));

  // Category breakdown (informational)
  const catCounts = {};
  for (const c of components) catCounts[c.category] = (catCounts[c.category] ?? 0) + 1;
  console.log(`  ℹ Category breakdown: ${Object.entries(catCounts).map(([k,v]) => `${k}=${v}`).join(', ')}`);
}

// ── core_components.json ──────────────────────────────────────────────────────
section('core_components.json');
const core = load('src/data/core_components.json');

if (core) {
  console.log(`  ${core.length} entries loaded`);

  // Duplicates — name must be unique within (type, massClass) for engines/hyperwarps
  // Bridges don't have massClass so check within (type, subtype)
  const seenCore = new Map();
  const dupCore = [];
  for (const c of core) {
    const key = c.type === 'bridge'
      ? `bridge::${c.subtype}::${c.name}`
      : `${c.type}::${c.massClass}::${c.name}`;
    if (seenCore.has(key)) dupCore.push(key);
    seenCore.set(key, true);
  }
  report('Duplicate entries within (type, massClass/subtype)', dupCore, '✗');
  dupCore.forEach(d => err(`[core] Duplicate: ${d}`));

  // Required fields
  const CORE_BASE = ['name','type','size','mass'];
  const ENGINE_EXTRA = ['speed','agility','fuelPerAU','fuelPerCombat','reactorPoints','safetyRating'];
  const coreMissing = [];
  for (const c of core) {
    for (const f of CORE_BASE) {
      if (c[f] == null) {
        coreMissing.push(`${c.type} "${c.name}" missing ${f}`);
        err(`[core] "${c.name}" missing required field: ${f}`);
      }
    }
    if (c.type !== 'bridge' && c.massClass == null) {
      coreMissing.push(`${c.type} "${c.name}" missing massClass`);
      err(`[core] "${c.name}" missing massClass`);
    }
    if (c.type === 'engine') {
      for (const f of ENGINE_EXTRA) {
        if (c[f] == null) {
          coreMissing.push(`engine "${c.name}" missing ${f}`);
          err(`[core] engine "${c.name}" missing ${f}`);
        }
      }
    }
    if (c.size && !VALID_SIZES.has(c.size)) {
      coreMissing.push(`${c.type} "${c.name}" invalid size: "${c.size}"`);
      err(`[core] "${c.name}" invalid size: "${c.size}"`);
    }
    if (c.massClass && !VALID_MASS_CLASSES.has(c.massClass)) {
      coreMissing.push(`${c.type} "${c.name}" invalid massClass: ${c.massClass}`);
      err(`[core] "${c.name}" invalid massClass: ${c.massClass}`);
    }
  }
  report('Required fields present', coreMissing, '✗');

  // Mass sanity
  const coreMassIssues = core
    .filter(c => c.mass != null && c.mass === 0)
    .map(c => `${c.type} "${c.name}" has mass=0`);
  report('No entries with suspicious mass=0', coreMassIssues, '⚠');
  coreMassIssues.forEach(i => warn(`[core] ${i}`));

  // rpPerRangeChange needs manual fill
  const engines = core.filter(c => c.type === 'engine');
  const rpUnfilled = engines.filter(c => c.rpPerRangeChange === 0).map(c => c.name);
  report(`rpPerRangeChange filled (${engines.length - rpUnfilled.length}/${engines.length} engines)`, rpUnfilled, '⚠');
  if (rpUnfilled.length) warn(`[core] ${rpUnfilled.length} engines have rpPerRangeChange=0 (needs manual fill)`);

  // Capital bridge placeholder warning
  const capitalFlagged = core.filter(c => c._wikiNote);
  if (capitalFlagged.length) {
    console.log(`  ⚠ ${capitalFlagged.length} capital bridge entries are wiki-copy placeholders — verify against game`);
    warn(`[core] ${capitalFlagged.length} capital bridge entries need verification`);
  }

  // Type breakdown (informational)
  const typeCounts = {};
  for (const c of core) typeCounts[c.type] = (typeCounts[c.type] ?? 0) + 1;
  console.log(`  ℹ Type breakdown: ${Object.entries(typeCounts).map(([k,v]) => `${k}=${v}`).join(', ')}`);
}

// ── Summary ────────────────────────────────────────────────────────────────────
section('Summary');
console.log(`  Errors:   ${errors.length}`);
console.log(`  Warnings: ${warnings.length}`);
if (errors.length === 0 && warnings.length === 0) {
  console.log('  All checks passed.\n');
}
if (errors.length)   console.log('\n  Errors to fix:');
for (const e of errors)   console.log(`    ✗ ${e}`);
if (warnings.length) console.log('\n  Warnings to investigate:');
for (const w of warnings) console.log(`    ⚠ ${w}`);
console.log();

process.exit(errors.length > 0 ? 1 : 0);
