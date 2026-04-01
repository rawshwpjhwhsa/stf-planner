#!/usr/bin/env node
/**
 * adapt-stfx-loadouts.js
 * Derives src/data/default_loadouts.json from the local STFX data file.
 *
 * Usage: node scripts/adapt-stfx-loadouts.js
 * Input:  scripts/raw/stfx-data.json
 * Output: src/data/default_loadouts.json
 */

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const stfx  = JSON.parse(readFileSync(path.resolve(__dirname, 'raw/stfx-data.json'), 'utf8'))
const ships = JSON.parse(readFileSync(path.resolve(__dirname, '../src/data/ships.json'), 'utf8'))

// Index STFX ships by normalised name (trim + collapse internal whitespace).
// Handles the "Horizon  Cruiser" double-space typo in the source data.
const stfxByName = new Map()
Object.values(stfx.ships).forEach(s => {
  stfxByName.set(s.name.trim().replace(/\s+/g, ' '), s)
})

const loadouts = {}
let found = 0, missing = 0

for (const ship of ships) {
  const stfxShip = stfxByName.get(ship.name)
  if (!stfxShip) {
    console.warn(`✗ Not in STFX: ${ship.name}`)
    missing++
    continue
  }

  const large = [], medium = [], small = []

  for (const id of stfxShip.components) {
    const c = stfx.components[id]
    if (!c) { console.warn(`  ⚠ Unknown ID ${id} in ${ship.name}`); continue }
    if      (c.size === 'large')  large.push(c.name)
    else if (c.size === 'medium') medium.push(c.name)
    else if (c.size === 'small')  small.push(c.name)
  }

  // Data quality: slot counts should match ships.json
  for (const [key, arr, expected] of [
    ['large',  large,  ship.slots.large],
    ['medium', medium, ship.slots.medium],
    ['small',  small,  ship.slots.small],
  ]) {
    if (arr.length !== expected) {
      console.warn(`  ⚠ ${ship.name}: ${key} has ${arr.length}, expected ${expected}`)
    }
  }

  loadouts[ship.name] = { large, medium, small }
  console.log(`✓ ${ship.name}`)
  found++
}

writeFileSync(
  path.resolve(__dirname, '../src/data/default_loadouts.json'),
  JSON.stringify(loadouts, null, 2)
)
console.log(`\nDone: ${found} ships adapted, ${missing} not found`)
