#!/usr/bin/env node
/**
 * enrich-component-costs.js
 * Adds `cost` field to src/data/components.json using install_cost from STFX data.
 *
 * Usage: node scripts/enrich-component-costs.js
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

// Index STFX components by normalised name
const stfxByName = new Map()
for (const c of Object.values(stfx.components)) {
  stfxByName.set(c.name.trim().replace(/\s+/g, ' '), c)
}

let matched = 0, missing = 0

for (const comp of components) {
  const stfxComp = stfxByName.get(comp.name)
  if (stfxComp && stfxComp.install_cost != null) {
    comp.cost = stfxComp.install_cost
    matched++
  } else {
    console.warn(`✗ No cost found: ${comp.name}`)
    comp.cost = 0
    missing++
  }
}

writeFileSync(componentsPath, JSON.stringify(components, null, 2))
console.log(`\nDone: ${matched} matched, ${missing} missing (set to 0)`)
