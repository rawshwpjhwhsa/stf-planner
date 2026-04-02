# STF Ship Planner — Project Plan

## Overview

A modern replacement for the unmaintained [STFX tool](https://tswift.gitlab.io/stfx/) — a
ship fitting/loadout planner for *Star Traders: Frontiers*. The goal is a lightweight,
shareable, single-page app with up-to-date game data and the features the original left
unfinished (notably: officer management).

**Stack:** Vite + Svelte (static SPA, no backend)  
**Hosting:** GitHub + Vercel (auto-deploy on push to main)  
**Data:** Scraped from the STF wiki, baked into JSON files at build time  
**Sharing:** Loadouts encoded into the URL hash (no server required)

---

## Key Decisions (Already Made)

- **Framework:** Svelte via Vite. Reactivity model maps cleanly onto "change a component →
  stats update everywhere." No server, no database.
- **Hosting:** GitHub repo + Vercel free tier. One-click integration, auto-deploys, clean URLs.
- **Data strategy:** Scrape the wiki once into static JSON. The wiki has two key reference pages
  with flat, consistently-formatted tables:
  - `startraders.fandom.com/wiki/Ships` — all hull stats
  - `startraders.fandom.com/wiki/Ship_Components_Reference` — all swappable components
  - `startraders.fandom.com/wiki/Ship_Components_Core_Reference` — bridges, engines, hyperwarps
- **URL serialization:** JSON → compress (LZ or similar) → base64 → `window.location.hash`.
  Same approach as the original STFX tool (which used protobuf + base64).
- **No accounts, no persistence** beyond the URL.

---

## Data Schema

### `src/data/ships.json`

Array of ship hull objects:
```json
{
  "name": "Reach Defender",
  "massCapacity": 5000,
  "massCurrent": 4795,
  "price": 885000,
  "slots": { "large": 4, "medium": 7, "small": 10 },
  "hull": 1750,
  "armor": 165,
  "shield": 83,
  "maxCrafts": 2,
  "evadePct": 88,
  "defaultCargo": 80,
  "defaultEngine": "M5000 Balanced Engine",
  "engineSpeed": 19,
  "engineAgility": 19,
  "engineAU": 3,
  "fuelTank": 165,
  "fuelRange": 83,
  "jumpCost": 60,
  "maxCrew": 30,
  "maxOfficers": 5,
  "massClass": 5000
}
```

Notes:
- `massClass` (2400/3400/5000/6000/7000/8000/9000) determines which core components are valid.
- `massCurrent` is the pre-loaded mass (ship as delivered); `massCapacity` is the hard cap.
- A handful of newer ships have `"shield": null` (wiki lists T.B.C.) — flag these in UI.

### `src/data/components.json`

Array of swappable (non-core) component objects:
```json
{
  "name": "Battle Prow 4",
  "faction": "Cadar",
  "size": "large",
  "mass": 635,
  "skills": {
    "pilot": 0,
    "shipOps": 1,
    "gunnery": 0,
    "electronics": 4,
    "navigation": 0
  },
  "crew": 0,
  "officers": 0,
  "armor": 15,
  "shield": 2,
  "jumpCost": 9,
  "fuel": 0,
  "cargo": 0,
  "passengers": 0,
  "prisoners": 0,
  "medical": 0,
  "category": "combat"
}
```

Notes:
- `mass` can be negative (mass reducers like `Mass Dampener 1` = -150).
- `faction` is `null` for faction-neutral components.
- `category` is one of: `cargo`, `crew`, `weapons`, `combat`, `ship`, `operations`.
- Armor and shield are raw integers. Block% is derived (see Stage 4).

### `src/data/core_components.json`

Bridges, Void Engines, and Hyperwarp Drives. Engines have additional fields:
```json
{
  "name": "M5000 Void Engine: Balanced",
  "type": "engine",
  "massClass": 5000,
  "size": "large",
  "mass": 700,
  "skills": { "pilot": 9, "shipOps": 9, "electronics": 6, "navigation": 0 },
  "speed": 19,
  "agility": 19,
  "fuelPerAU": 3,
  "fuelPerCombat": 8,
  "reactorPoints": 4,
  "safetyRating": 10,
  "armor": 0,
  "shield": 0,
  "jumpCost": 0
}
```

Bridges and Hyperwarps follow the same base shape but omit engine-specific fields.

---

## Open Questions (To Be Resolved in Specific Stages)

### OQ-1: Armor block% formula (→ Stage 4) ✅ RESOLVED
Armor and shield use asymptotic damage-reduction formulas, both capped at 60%:
- **Armor:** `blockPct = min(0.6, (0.06 × armor) / (1 + 0.06 × |armor|))`
- **Shield:** `blockPct = min(0.6, (0.03 × shield) / (1 + 0.03 × |shield|))`
- Source: `startraders.fandom.com/wiki/Ship_Armor` and Steam community discussion

### OQ-2: Attack range distribution formula (→ Stage 7)
The original STFX tool showed a combat range breakdown (e.g. "I: 388, II: 452, III: 270...").
These values are derived from installed weapon components and their range bands. The formula
is not documented on the wiki. Approach:
- Check the STFX source (gitlab.com/tswift/stfx) for the calculation logic
- Cross-reference with wiki weapon range band documentation
- May need to reverse-engineer from known loadouts

### OQ-3: Officer skill contribution model (→ Stage 6) ✅ RESOLVED
Officers and crew both contribute skills via their assigned jobs:
- **Jobs** are the atomic unit: 38 jobs, each with 2–4 skills (from a pool of 17) and 36 levels
- **Officers** have up to 3 jobs at independent levels; **crew** have 1 job each
- Skill values sourced from STFX `data.json` snapshot, parsed into `src/data/jobs.json`
- The 5 ship skills (pilot, shipOps, gunnery, electronics, navigation) satisfy component requirements
- The 12 secondary skills (command, tactics, repair, etc.) are tracked for future use

---

## Stages

### Stage 0 — Project Setup
**Goal:** Working skeleton deployed to Vercel. Nothing game-specific yet.

Tasks:
- [ ] `npm create vite@latest stf-planner -- --template svelte`
- [ ] Add `src/data/` directory (empty placeholder JSONs)
- [ ] Basic `App.svelte` with "hello world"
- [ ] Create GitHub repo, push
- [ ] Connect repo to Vercel (import project → auto-detect Vite)
- [ ] Confirm deploy at `stf-planner.vercel.app` (or chosen name)
- [ ] Add `PLAN.md` to repo root

**Done when:** Pushing to `main` auto-deploys a live URL.

---

### Stage 1 — Data: Ships & Components
**Goal:** All game data in clean JSON files, importable by the app.

Tasks:
- [ ] Parse `Ships` wiki page into `ships.json` (~80 ships)
  - Handle T.B.C. shield values as `null`
  - Derive `massClass` from massCapacity
  - Parse engine string into structured speed/agility/AU fields
- [ ] Parse `Ship_Components_Reference` into `components.json`
  - Handle negative mass (mass reducers)
  - Assign `category` field per component type
  - Tag faction-locked components
- [ ] Parse `Ship_Components_Core_Reference` into `core_components.json`
  - Bridges (by mass class and type)
  - Void Engines (with speed/agility/fuel/RP/safety fields)
  - Hyperwarp Drives (by mass class and type)
- [ ] Write a quick validation script: check for duplicates, missing required fields, mass sanity
- [ ] Spot-check ~10 components against wiki manually

**Done when:** All three JSON files load without errors and pass validation.

---

### Stage 2 — Core UI: Ship Selector + Component Slots
**Goal:** You can pick a ship and see its component slots. No stats yet.

Tasks:
- [ ] Ship selector dropdown (searchable, grouped by mass class)
- [ ] On ship select: populate Large / Medium / Small slot sections with the ship's default
  components (loaded from data)
- [ ] Each slot shows component name; clicking opens a picker modal/dropdown
  - Picker filters to correct size
  - Shows faction tag where relevant
- [ ] "Crafts" section (slots + add button, even if non-functional yet)
- [ ] Basic layout: left panel (slots) + right panel (stats placeholder)
- [ ] Mobile-friendly layout check (flexbox/grid)

**Done when:** You can select any ship, see its slots, and swap components.

---

### Stage 3 — Stats Panel: Mass, Skill Pools, Crew
**Goal:** Live stat calculations update as components change.

Tasks:
- [x] **Mass:** sum of all component masses vs. ship capacity; warning if over limit
- [x] **Skill pools:** sum of pilot/shipOps/gunnery/electronics/navigation across all components
  - Displayed as total requirements only (provided side deferred to Stage 6 officer management)
  - Color indicator deferred to Stage 6 (needs officer/crew skill contributions)
- [x] **Crew:** total crew slots provided vs. max crew
- [x] **Officers:** total officer slots provided vs. max officers
- [x] **Hull / Armor / Shield / Fuel / Cargo / Medical / Passengers / Prisoners** totals
- [x] **Jump cost** total
- [x] Install cost running total (cumulative) — cost field added to components.json from STFX data

**Clarification needed at this stage:** The wiki `Ship_Components_Reference` table has columns
for both "skill requirements added by this component" and potentially "skill points provided."
Need to verify the exact model before coding. Cross-check with Getting Started Guide and
original STFX display.

**Done when:** Stats update live and match the original STFX tool for a known loadout.

---

### Stage 4 — Armor Block% Formula
**Goal:** Resolve OQ-1 and display armor with block percentage.

Tasks:
- [x] Research formula using wiki Ship_Armor page and Steam community discussion
- [x] Implement `armorBlockPct(armor)` and `shieldBlockPct(shield)` in App.svelte
- [x] Display as "165 [Blocks 60%]" format in stats panel
- [x] Shield block% displayed (with T.B.C. fallback preserved)

**Done when:** Block% displays correctly and updates live with component changes.

---

### Stage 5 — Core Component Management
**Goal:** Bridge, Engine, and Hyperwarp slots are selectable and contribute to stats.

Tasks:
- [x] Add dedicated core component slots to the UI (distinct from swappable slots)
- [x] On ship select, auto-assign default core components matching the ship's mass class
  and the engine listed in `ships.json`
- [x] Core component pickers filter to the correct mass class
- [x] Engine stat display: Speed, Agility, Fuel/AU, Fuel/Combat, Reactor Points, Safety Rating
- [x] Core component skills contribute to skill pool totals
- [x] Core component mass contributes to total mass

**Done when:** Selecting a different bridge/engine/hyperwarp updates all stats correctly.

---

### Stage 6 — Officer & Crew Management
**Goal:** Officers and crew modeled individually; all 17 skills tracked and displayed.

Tasks:
- [x] Resolve OQ-3: sourced per-job skill values from STFX `data.json` (38 jobs, 36 levels each)
- [x] Parse jobs data into `src/data/jobs.json` via `scripts/parse-jobs.js`
- [x] Officer cards: up to 3 job slots per officer, each with job picker + level input
- [x] Add/remove officers (capped by `min(ship.maxOfficers, component-provided officer slots)`)
- [x] Individual crew members: 1 job + level each, add/remove up to effective crew cap
- [x] All 17 skills aggregated from officer + crew jobs into `providedSkills`
- [x] Stats panel: ship skills shown as "provided / required" with deficit highlighting;
  secondary skills shown when non-zero
- [x] Officers and crew reset on ship change

**Done when:** Adding an officer/crew with jobs updates all skill pool totals.

---

### Stage 7 — Attack Range Distribution
**Goal:** Resolve OQ-2 and display the range band breakdown.

Tasks:
- [ ] Research formula: check STFX source code, wiki combat/weapons pages
- [ ] Understand range bands I–V and how weapon components contribute
- [ ] Implement range distribution calculation
- [ ] Display as the original STFX tool did (list of I: N, II: N... or a bar chart)

**Done when:** Range display matches original STFX for a known weapon loadout.

---

### Stage 8 — URL Serialization (Shareable Builds)
**Goal:** Full loadout encoded in URL hash; shareable link works.

Tasks:
- [ ] Define serialization format: minimal representation of
  `{ shipId, componentSlots[], coreSlots[], officers[] }`
- [ ] JSON → LZ-compress (use `lz-string` or similar) → base64 → `#hash`
- [ ] On page load: read hash → decompress → restore full state
- [ ] "Copy link" button (copies `window.location.href`)
- [ ] Graceful fallback if hash is malformed or refers to unknown components
- [ ] Test round-trip: build a loadout → copy link → open in new tab → same loadout

**Done when:** Any loadout can be shared via URL and perfectly restored.

---

### Stage 9 — Polish & QA
**Goal:** Production-ready, community-shareable.

Tasks:
- [ ] Craft bay: add/remove craft cards (craft data TBD — may need additional wiki scraping)
- [ ] Data accuracy pass: spot-check 10+ ships and 20+ components against the game
- [ ] Handle any components added to the game since the wiki scrape
- [ ] T.B.C. shield values: resolve or surface clearly in UI
- [ ] Mobile layout final check
- [ ] Page title, favicon, basic meta tags
- [ ] README.md with: what it is, how to use it, how to contribute, data sources
- [ ] License (suggest MIT)
- [ ] Post to the STF community (Reddit / Discord) for feedback

**Done when:** It's live, linked from the community, and you're not embarrassed by it.

---

## Reference Links

- Original tool: https://tswift.gitlab.io/stfx/
- Original source: https://gitlab.com/tswift/stfx
- Wiki — Ships: https://startraders.fandom.com/wiki/Ships
- Wiki — Components Reference: https://startraders.fandom.com/wiki/Ship_Components_Reference
- Wiki — Core Components Reference: https://startraders.fandom.com/wiki/Ship_Components_Core_Reference
- Wiki — Ship Components (descriptive): https://startraders.fandom.com/wiki/Ship_Components
- Wiki — Getting Started: https://startraders.fandom.com/wiki/Getting_Started_Guide

## Current Status

- [x] Feasibility assessed
- [x] Stack decided (Vite + Svelte + GitHub + Vercel)
- [x] Data sources identified and scraped
- [x] Schema designed
- [x] Open questions identified
- [x] Stages 0–2 complete
- [x] Stage 3 complete (stats panel — mass, skills, crew, defense, resources)
- [x] Stage 4 complete (armor/shield block% formulas and display)
- [x] Stage 5 complete (core component management — bridge/engine/hyperwarp slots, pickers, engine stats)
- [x] Stage 6 complete (officer & crew management — individual jobs/levels, all 17 skills tracked)
