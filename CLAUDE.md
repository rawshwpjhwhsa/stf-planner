# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server (localhost:5173)
npm run build        # Production build → /dist
npm run preview      # Preview production build locally
npm run adapt-loadouts  # Regenerate default_loadouts.json from scripts/raw/stfx-data.json
node validate-data.js   # Validate src/data/*.json for duplicates, missing fields, mass sanity
```

Data parsing scripts (run manually when raw source data changes):
```bash
node scripts/parse-components.js       # → src/data/components.json
node scripts/parse-core-components.js  # → src/data/core_components.json
```

## Architecture

**What it is:** A single-page ship fitting/loadout planner for *Star Traders: Frontiers*. Users pick a ship, assign components to slots, and see live stat totals. Loadouts will be shareable via URL hash (no backend).

**Stack:** Svelte 5 (runes API) + Vite. Fully static — no server, no API.

**Data pipeline:**
```
scripts/raw/*.txt + stfx-data.json
    ↓ parse scripts
src/data/*.json  (ships, components, core_components, default_loadouts)
    ↓ imported at runtime
App.svelte
```

**Core data files in `src/data/`:**
- `ships.json` — hull definitions: name, massClass (2400–9000), slot counts (large/medium/small), default engine
- `components.json` — swappable slot components: name, faction (null = neutral), size, mass (can be negative), category, skill/stat contributions
- `core_components.json` — bridges, engines, hyperwarps indexed by massClass
- `default_loadouts.json` — ship name → size → component name array, derived from STFX snapshot

**App structure (`src/App.svelte`):**
- Uses Svelte 5 runes: `$state()` for reactive state, `$derived` for computed values, `$effect()` for side effects
- Ship picker → `buildInitialSlots()` (from `src/lib/loadout.js`) populates slot array with default components
- Slot click → `openPicker()` → `<dialog>` modal filters components by size/category/faction
- Component selection → `assignComponent()` → Svelte reactivity updates stats automatically

**Lookup pattern:** Components are keyed as `"${name}::${faction ?? ''}"` for O(1) lookup.

## Development Stages (from PLAN.md)

- ✅ 0–2: Scaffold, data pipeline, ship selector, component slots, picker modal
- ⏳ 3: Stats panel (mass, skills, crew totals — partially implemented)
- ⏹️ 4: Armor block% formula (OQ-1: reverse-engineer from STFX source)
- ⏹️ 5: Core component slots (bridge/engine/hyperwarp)
- ⏹️ 6: Officer management (OQ-3: per-job skill contribution model)
- ⏹️ 7: Attack range distribution (OQ-2: formula to reverse-engineer)
- ⏹️ 8: URL hash serialization for shareable loadouts
- ⏹️ 9: Polish & QA

STFX source (gitlab.com/tswift/stfx) is the reference for formulas and algorithms for the open questions above.
