#!/usr/bin/env node
/**
 * enrich-weapon-data.js
 * Adds `weapon` field to src/data/components.json using data from STFX snapshot.
 *
 * Weapon-category components get: { range, accuracy, damage_min, damage_max, weapon_type, ap, crit }
 * Non-weapon components get: weapon: null
 *
 * Usage: node scripts/enrich-weapon-data.js
 * Input:  scripts/raw/stfx-data.json, src/data/components.json
 * Output: src/data/components.json (modified in-place)
 */

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const stfx = JSON.parse(readFileSync(path.resolve(__dirname, 'raw/stfx-data.json'), 'utf8'))
const componentsPath = path.resolve(__dirname, '../src/data/components.json')
const components = JSON.parse(readFileSync(componentsPath, 'utf8'))

// Index STFX weapon components by normalised name
const stfxByName = new Map()
for (const c of Object.values(stfx.components)) {
  if (c.weapon) {
    stfxByName.set(c.name.trim().replace(/\s+/g, ' '), c)
  }
}

// Alias for known typo in wiki-sourced data
stfxByName.set('Vengence Gravcannon', stfxByName.get('Vengeance Gravcannon'))

let matched = 0, missing = 0

for (const comp of components) {
  if (comp.category === 'weapons') {
    const stfxComp = stfxByName.get(comp.name)
    if (stfxComp?.weapon) {
      const w = stfxComp.weapon
      comp.weapon = {
        range: w.range,
        accuracy: w.accuracy,
        damage_min: w.damage_min,
        damage_max: w.damage_max,
        weapon_type: w.weapon_type,
        ap: w.ap,
        crit: w.crit,
      }
      matched++
    } else {
      console.warn(`✗ No weapon data found: ${comp.name}`)
      comp.weapon = null
      missing++
    }
  } else {
    comp.weapon = null
  }
}

writeFileSync(componentsPath, JSON.stringify(components, null, 2))
console.log(`\nDone: ${matched} matched, ${missing} missing (set to null)`)
