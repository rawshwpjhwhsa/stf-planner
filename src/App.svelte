<script>
  import { shipsData, coreComponentsData, componentsByName, coreByType, massClassGroups, jobsById, MASS_CLASS_ORDER, SHIP_SKILL_KEYS, SECONDARY_SKILL_KEYS } from './lib/constants.js'
  import defaultLoadouts from './data/default_loadouts.json'
  import { buildInitialSlots } from './lib/loadout.js'
  import { serializeLoadout, deserializeLoadout } from './lib/serialize.js'

  import ComponentPicker from './components/ComponentPicker.svelte'
  import CorePicker from './components/CorePicker.svelte'
  import StatsPanel from './components/StatsPanel.svelte'
  import OfficerList from './components/OfficerList.svelte'
  import CrewList from './components/CrewList.svelte'
  import SlotList from './components/SlotList.svelte'
  import CoreSlots from './components/CoreSlots.svelte'

  // --- Reactive state ---

  let selectedShipName = $state(null)
  let slots = $state([])
  let selectedBridge = $state(null)
  let selectedEngine = $state(null)
  let selectedHyperwarp = $state(null)
  let bridgeSubtype = $state(null)

  let pickerTargetIndex = $state(null)
  let corePickerType = $state(null)

  let officers = $state([])
  let crew = $state([])

  let hashFeedback = $state('')
  let _skipNextHashWrite = false

  // --- Derived values ---

  const selectedShip = $derived(
    selectedShipName ? shipsData.find(s => s.name === selectedShipName) : null
  )

  const pickerTargetSlot = $derived(
    pickerTargetIndex !== null ? slots[pickerTargetIndex] : null
  )

  // --- Block% formulas ---
  function armorBlockPct(armor) {
    return Math.min(0.6, (0.06 * armor) / (1 + 0.06 * Math.abs(armor)))
  }
  function shieldBlockPct(shield) {
    return Math.min(0.6, (0.03 * shield) / (1 + 0.03 * Math.abs(shield)))
  }

  // --- Stats derivations ---

  const equippedComponents = $derived(
    slots.filter(s => s.component !== null).map(s => s.component)
  )

  function normalizeCoreForStats(core) {
    if (!core) return null
    return {
      ...core,
      crew: core.crew ?? 0,
      officers: core.officers ?? 0,
      fuel: core.fuel ?? 0,
      cargo: core.cargo ?? 0,
      passengers: core.passengers ?? 0,
      prisoners: core.prisoners ?? 0,
      medical: core.medical ?? 0,
      skills: {
        pilot: core.skills?.pilot ?? 0,
        shipOps: core.skills?.shipOps ?? 0,
        gunnery: core.skills?.gunnery ?? 0,
        electronics: core.skills?.electronics ?? 0,
        navigation: core.skills?.navigation ?? 0,
      },
    }
  }

  const allEquippedComponents = $derived.by(() => {
    const list = [...equippedComponents]
    for (const core of [selectedBridge, selectedEngine, selectedHyperwarp]) {
      const normalized = normalizeCoreForStats(core)
      if (normalized) list.push(normalized)
    }
    return list
  })

  const totalMass = $derived(
    allEquippedComponents.reduce((sum, c) => sum + c.mass, 0)
  )
  const massOverLimit = $derived(
    selectedShip ? totalMass > selectedShip.massCapacity : false
  )

  const totalArmor = $derived(
    (selectedShip?.armor ?? 0) + allEquippedComponents.reduce((sum, c) => sum + c.armor, 0)
  )
  const totalShield = $derived(
    (selectedShip?.shield ?? 0) + allEquippedComponents.reduce((sum, c) => sum + c.shield, 0)
  )
  const armorBlock = $derived(Math.round(armorBlockPct(totalArmor) * 100))
  const shieldBlock = $derived(Math.round(shieldBlockPct(totalShield) * 100))
  const totalFuel = $derived(
    (selectedShip?.fuelTank ?? 0) + allEquippedComponents.reduce((sum, c) => sum + c.fuel, 0)
  )
  const totalCargo = $derived(
    (selectedShip?.defaultCargo ?? 0) + allEquippedComponents.reduce((sum, c) => sum + c.cargo, 0)
  )
  const totalJumpCost = $derived(
    (selectedShip?.jumpCost ?? 0) + allEquippedComponents.reduce((sum, c) => sum + c.jumpCost, 0)
  )
  const totalCrew = $derived(
    allEquippedComponents.reduce((sum, c) => sum + c.crew, 0)
  )
  const totalOfficers = $derived(
    allEquippedComponents.reduce((sum, c) => sum + c.officers, 0)
  )
  const totalPassengers = $derived(
    allEquippedComponents.reduce((sum, c) => sum + c.passengers, 0)
  )
  const totalPrisoners = $derived(
    allEquippedComponents.reduce((sum, c) => sum + c.prisoners, 0)
  )
  const totalMedical = $derived(
    allEquippedComponents.reduce((sum, c) => sum + c.medical, 0)
  )
  const totalCost = $derived(
    allEquippedComponents.reduce((sum, c) => sum + (c.cost ?? 0), 0)
  )

  const requiredSkills = $derived.by(() => {
    const skills = { pilot: 0, shipOps: 0, gunnery: 0, electronics: 0, navigation: 0 }
    for (const c of allEquippedComponents) {
      for (const key of SHIP_SKILL_KEYS) skills[key] += c.skills[key] ?? 0
    }
    return skills
  })

  function getJobSkills(jobId, level) {
    if (!jobId || level < 1) return {}
    const job = jobsById.get(jobId)
    if (!job) return {}
    const values = job.levels[Math.min(level, 36) - 1]
    const result = {}
    for (let i = 0; i < job.skills.length; i++) {
      result[job.skills[i]] = values[i]
    }
    return result
  }

  const providedSkills = $derived.by(() => {
    const skills = {}
    for (const key of [...SHIP_SKILL_KEYS, ...SECONDARY_SKILL_KEYS]) skills[key] = 0

    for (const officer of officers) {
      for (const jobSlot of officer.jobs) {
        if (!jobSlot.jobId) continue
        const contrib = getJobSkills(jobSlot.jobId, jobSlot.level)
        for (const [skill, value] of Object.entries(contrib)) {
          skills[skill] = (skills[skill] ?? 0) + value
        }
      }
    }

    for (const member of crew) {
      if (!member.jobId) continue
      const contrib = getJobSkills(member.jobId, member.level)
      for (const [skill, value] of Object.entries(contrib)) {
        skills[skill] = (skills[skill] ?? 0) + value
      }
    }

    return skills
  })

  const effectiveMaxOfficers = $derived(
    selectedShip ? Math.min(selectedShip.maxOfficers, totalOfficers) : 0
  )
  const effectiveMaxCrew = $derived(
    selectedShip ? Math.min(selectedShip.maxCrew, totalCrew) : 0
  )

  // --- Combat score derivations ---

  function combatScore(primaryA, primaryB, secondaryA, secondaryB) {
    return 0.4 * (primaryA + primaryB) + 0.2 * (secondaryA + secondaryB)
  }

  const engineSpeed = $derived(selectedEngine?.speed ?? 0)
  const engineAgility = $derived(selectedEngine?.agility ?? 0)

  const equippedWeapons = $derived(
    allEquippedComponents.filter(c => c.weapon != null)
  )

  const attackScores = $derived.by(() => {
    const scores = [0, 0, 0, 0, 0]
    const pilot = providedSkills.pilot
    const nav = providedSkills.navigation
    const gun = providedSkills.gunnery
    const tactics = providedSkills.tactics
    for (const comp of equippedWeapons) {
      const w = comp.weapon
      for (let b = 1; b <= 5; b++) {
        let score = (b >= 4)
          ? 0.4 * (w.accuracy + engineSpeed + nav) + 0.2 * (gun + tactics)
          : 0.4 * (w.accuracy + engineAgility + pilot) + 0.2 * (gun + tactics)
        if (b === w.range) score *= 1.25
        scores[b - 1] += score
      }
    }
    return scores
  })

  const defenseScores = $derived.by(() => {
    const pilot = providedSkills.pilot
    const elec = providedSkills.electronics
    const command = providedSkills.command
    const hi = Math.max(pilot, elec)
    const lo = Math.min(pilot, elec)
    const short = combatScore(engineAgility, hi, lo, command)
    const long = combatScore(engineSpeed, hi, lo, command)
    return [short, short, short, long, long]
  })

  const rangeChangeScores = $derived.by(() => {
    const pilot = providedSkills.pilot
    const nav = providedSkills.navigation
    const elec = providedSkills.electronics
    const tactics = providedSkills.tactics
    const short = combatScore(engineAgility, pilot, elec, tactics)
    const long = combatScore(engineSpeed, nav, elec, tactics)
    return [short, short, short, long, long]
  })

  const boardScores = $derived.by(() => {
    const pilot = providedSkills.pilot
    const nav = providedSkills.navigation
    const command = providedSkills.command
    const tactics = providedSkills.tactics
    const short = combatScore(engineAgility, pilot, command, tactics)
    const long = combatScore(engineSpeed, nav, command, tactics)
    return [short, short, short, long, long]
  })

  const escapeScores = $derived.by(() => {
    const pilot = providedSkills.pilot
    const nav = providedSkills.navigation
    const elec = providedSkills.electronics
    const command = providedSkills.command
    const short = combatScore(engineAgility, pilot, elec, command)
    const long = combatScore(engineSpeed, nav, elec, command)
    return [short, short, short, long, long]
  })

  // Grouped props for StatsPanel
  const stats = $derived({
    totalMass, massOverLimit, totalArmor, armorBlock, totalShield, shieldBlock,
    totalFuel, totalCargo, totalJumpCost, totalCrew, totalOfficers,
    totalPassengers, totalPrisoners, totalMedical, totalCost,
  })

  const combatScores = $derived({
    attackScores, defenseScores, rangeChangeScores, boardScores, escapeScores, equippedWeapons,
  })

  // --- Event handlers ---

  function onShipChange() {
    if (!selectedShipName) {
      slots = []
      selectedBridge = null
      selectedEngine = null
      selectedHyperwarp = null
      bridgeSubtype = null
      return
    }
    const ship = shipsData.find(s => s.name === selectedShipName)
    const result = buildInitialSlots(ship, componentsByName, defaultLoadouts, coreComponentsData)
    slots = result.slots
    selectedBridge = result.bridge
    selectedEngine = result.engine
    selectedHyperwarp = result.hyperwarp
    bridgeSubtype = result.bridge?.subtype ?? null
  }

  function openPicker(index) {
    pickerTargetIndex = index
  }

  function closePicker() {
    pickerTargetIndex = null
  }

  function assignComponent(comp) {
    slots[pickerTargetIndex].component = comp
    closePicker()
  }

  function openCorePicker(type) {
    corePickerType = type
  }

  function closeCorePicker() {
    corePickerType = null
  }

  function assignCoreComponent(comp) {
    if (corePickerType === 'bridge') selectedBridge = comp
    else if (corePickerType === 'engine') selectedEngine = comp
    else if (corePickerType === 'hyperwarp') selectedHyperwarp = comp
    closeCorePicker()
  }

  // --- URL hash serialization ---

  function restoreFromUrl() {
    const data = deserializeLoadout(location.hash)
    if (!data) return false

    const ship = shipsData.find(s => s.name === data.s)
    if (!ship) return false

    selectedShipName = data.s

    const base = buildInitialSlots(ship, componentsByName, defaultLoadouts, coreComponentsData)
    if (Array.isArray(data.c)) {
      for (let i = 0; i < base.slots.length && i < data.c.length; i++) {
        base.slots[i].component = data.c[i]
          ? (componentsByName.get(data.c[i]) ?? null)
          : null
      }
    }
    slots = base.slots

    selectedBridge = data.b
      ? coreByType.bridge.find(b => b.name === data.b[0] && b.subtype === data.b[1]) ?? null
      : null
    bridgeSubtype = selectedBridge?.subtype ?? null

    selectedEngine = data.e
      ? coreByType.engine.find(e => e.name === data.e && e.massClass === ship.massClass) ?? null
      : null

    selectedHyperwarp = data.h
      ? coreByType.hyperwarp.find(h => h.name === data.h && h.massClass === ship.massClass) ?? null
      : null

    officers = (data.o ?? []).map(jobPairs => ({
      jobs: jobPairs.map(([jid, lvl]) => ({ jobId: jid || null, level: lvl }))
    }))

    crew = (data.r ?? []).map(([jid, lvl]) => ({ jobId: jid || null, level: lvl }))

    return true
  }

  $effect(() => {
    if (!selectedShipName) {
      if (location.hash) history.replaceState(null, '', location.pathname)
      return
    }
    if (_skipNextHashWrite) {
      _skipNextHashWrite = false
      return
    }
    const compressed = serializeLoadout({
      ship: selectedShipName,
      slots,
      bridge: selectedBridge,
      engine: selectedEngine,
      hyperwarp: selectedHyperwarp,
      officers,
      crew,
    })
    history.replaceState(null, '', '#' + compressed)
  })

  $effect(() => {
    function onPopState() {
      _skipNextHashWrite = true
      restoreFromUrl()
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  })

  if (location.hash.length > 1) {
    _skipNextHashWrite = true
    restoreFromUrl()
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href)
      hashFeedback = 'Copied!'
    } catch {
      hashFeedback = 'Failed'
    }
    setTimeout(() => { hashFeedback = '' }, 2000)
  }
</script>

<div class="app-layout">
  <header class="app-header">
    <h1 class="app-title">STF Ship Planner</h1>
    <select
      class="ship-select"
      bind:value={selectedShipName}
      onchange={onShipChange}
    >
      <option value="">— Select a ship —</option>
      {#each massClassGroups as { massClass, ships }}
        <optgroup label="Mass Class {massClass}">
          {#each ships as ship}
            <option value={ship.name}>{ship.name}</option>
          {/each}
        </optgroup>
      {/each}
    </select>
    {#if selectedShip}
      <button class="copy-link-btn" onclick={copyLink}>
        {hashFeedback || 'Copy Link'}
      </button>
    {/if}
  </header>

  <main class="app-main">
    <section class="slots-panel">
      {#if !selectedShip}
        <div class="empty-state">
          <h2 class="empty-state__title">Build Your Loadout</h2>
          <p class="empty-state__text">Pick a ship from the dropdown above to start fitting components, assigning officers, and calculating combat scores.</p>
          <p class="empty-state__hint">{shipsData.length} ships across {MASS_CLASS_ORDER.length} mass classes available</p>
        </div>
      {/if}
      {#if selectedShip}
        <CoreSlots bridge={selectedBridge} engine={selectedEngine} hyperwarp={selectedHyperwarp} onopenPicker={openCorePicker} />

        {#each ['large', 'medium', 'small'] as size}
          <SlotList {slots} {size} onslotclick={openPicker} />
        {/each}

        <div class="slot-group crafts-group">
          <h2 class="slot-group__heading">Crafts</h2>
          <p class="muted">Craft bay: {selectedShip.maxCrafts} max (Stage 9)</p>
        </div>

        <OfficerList bind:officers maxOfficers={effectiveMaxOfficers} />
        <CrewList bind:crew maxCrew={effectiveMaxCrew} />
      {/if}
    </section>

    <StatsPanel ship={selectedShip} engine={selectedEngine} {stats} {requiredSkills} {providedSkills} {combatScores} />
  </main>
</div>

<ComponentPicker targetSlot={pickerTargetSlot} onselect={assignComponent} onclose={closePicker} />
<CorePicker type={corePickerType} massClass={selectedShip?.massClass} {bridgeSubtype} onselect={assignCoreComponent} onclose={closeCorePicker} />

<style>
  .app-layout {
    max-width: 960px;
    margin: 0 auto;
    padding: var(--space-3);
  }

  .app-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
    flex-wrap: wrap;
  }

  .app-title {
    font-size: var(--text-lg, 1.0625rem);
    font-weight: 600;
    white-space: nowrap;
  }

  .ship-select {
    flex: 1;
    min-width: 200px;
    padding: var(--space-2) var(--space-3);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text);
    font-size: var(--text-base);
    cursor: pointer;
  }

  .ship-select:focus {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .copy-link-btn {
    padding: var(--space-2) var(--space-3);
    background: var(--color-accent);
    color: #fff;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--text-sm, 0.875rem);
    cursor: pointer;
    white-space: nowrap;
  }

  .copy-link-btn:hover {
    background: #3d89e0;
  }

  .copy-link-btn:active {
    background: #356fb8;
  }

  .app-main {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: var(--space-4);
    align-items: start;
  }

  .slots-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .empty-state {
    background: var(--color-surface);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-5) var(--space-4);
    text-align: center;
  }

  .empty-state__title {
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: var(--space-2);
  }

  .empty-state__text {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    line-height: 1.6;
    max-width: 36ch;
    margin: 0 auto var(--space-3);
  }

  .empty-state__hint {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-style: italic;
    opacity: 0.7;
  }
</style>
