<script>
  import shipsData from './data/ships.json'
  import componentsData from './data/components.json'
  import coreComponentsData from './data/core_components.json'
  import defaultLoadouts from './data/default_loadouts.json'
  import jobsData from './data/jobs.json'
  import { buildInitialSlots } from './lib/loadout.js'
  import { serializeLoadout, deserializeLoadout } from './lib/serialize.js'

  // --- Module-level constants (computed once, not reactive) ---

  const MASS_CLASS_ORDER = [2400, 3400, 5000, 6000, 7000, 8000, 9000]
  const RANGE_BAND_LABELS = ['I', 'II', 'III', 'IV', 'V']

  const SHIP_SKILL_KEYS = ['pilot', 'shipOps', 'gunnery', 'electronics', 'navigation']
  const SECONDARY_SKILL_KEYS = [
    'command', 'doctor', 'evasion', 'explorer', 'heavy_firearms',
    'intimidate', 'light_firearms', 'melee', 'negotiate', 'repair',
    'stealth', 'tactics',
  ]

  const ALL_SKILL_LABELS = {
    pilot: 'Pilot', shipOps: 'Ship Ops', gunnery: 'Gunnery',
    electronics: 'Electronics', navigation: 'Navigation',
    command: 'Command', doctor: 'Doctor', evasion: 'Evasion',
    explorer: 'Explorer', heavy_firearms: 'Heavy Firearms',
    intimidate: 'Intimidate', light_firearms: 'Light Firearms',
    melee: 'Melee', negotiate: 'Negotiate', repair: 'Repair',
    stealth: 'Stealth', tactics: 'Tactics',
  }

  const jobsById = new Map(jobsData.map(j => [j.id, j]))

  const massClassGroups = MASS_CLASS_ORDER.map(mc => ({
    massClass: mc,
    ships: shipsData
      .filter(s => s.massClass === mc)
      .sort((a, b) => a.name.localeCompare(b.name)),
  }))

  const componentsBySize = {
    large:  componentsData.filter(c => c.size === 'large'),
    medium: componentsData.filter(c => c.size === 'medium'),
    small:  componentsData.filter(c => c.size === 'small'),
  }

  // Key: "name::faction" to avoid silent overwrites for faction-variant duplicates
  // (e.g. Adv. Mass Dampener 5 exists once per faction with identical stats)
  const componentsByName = new Map(
    componentsData.map(c => [`${c.name}::${c.faction ?? ''}`, c])
  )

  const coreByType = {
    bridge: coreComponentsData.filter(c => c.type === 'bridge'),
    engine: coreComponentsData.filter(c => c.type === 'engine'),
    hyperwarp: coreComponentsData.filter(c => c.type === 'hyperwarp'),
  }

  // --- Reactive state ---

  let selectedShipName = $state(null)
  let slots = $state([])
  let selectedBridge = $state(null)
  let selectedEngine = $state(null)
  let selectedHyperwarp = $state(null)
  let bridgeSubtype = $state(null)

  let pickerOpen = $state(false)
  let pickerTargetIndex = $state(null)
  let pickerSearch = $state('')
  let pickerCategoryFilter = $state('all')
  let pickerFactionFilter = $state('all')

  let corePickerOpen = $state(false)
  let corePickerType = $state(null)
  let corePickerSearch = $state('')

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

  const pickerAvailableFactions = $derived.by(() => {
    if (!pickerTargetSlot) return []
    return [
      ...new Set(
        componentsBySize[pickerTargetSlot.size]
          .filter(c => c.faction)
          .map(c => c.faction)
      ),
    ].sort()
  })

  const pickerCandidates = $derived.by(() => {
    if (!pickerTargetSlot) return []
    let list = componentsBySize[pickerTargetSlot.size]
    if (pickerCategoryFilter !== 'all')
      list = list.filter(c => c.category === pickerCategoryFilter)
    if (pickerFactionFilter !== 'all')
      list = list.filter(c => c.faction === pickerFactionFilter)
    if (pickerSearch.trim())
      list = list.filter(c =>
        c.name.toLowerCase().includes(pickerSearch.trim().toLowerCase())
      )
    return list
  })

  const corePickerCandidates = $derived.by(() => {
    if (!corePickerType || !selectedShip) return []
    let list = coreByType[corePickerType]
    if (corePickerType === 'engine')
      list = list.filter(c => c.massClass === selectedShip.massClass)
    else if (corePickerType === 'hyperwarp')
      list = list.filter(c => c.massClass === selectedShip.massClass)
    else if (corePickerType === 'bridge' && bridgeSubtype)
      list = list.filter(c => c.subtype === bridgeSubtype)
    if (corePickerSearch.trim())
      list = list.filter(c => c.name.toLowerCase().includes(corePickerSearch.trim().toLowerCase()))
    return list
  })

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
    pickerSearch = ''
    pickerCategoryFilter = 'all'
    pickerFactionFilter = 'all'
    pickerOpen = true
  }

  function closePicker() {
    pickerOpen = false
    pickerTargetIndex = null
  }

  function assignComponent(comp) {
    slots[pickerTargetIndex].component = comp
    closePicker()
  }

  function backdropClose(e) {
    if (e.target === e.currentTarget) closePicker()
  }

  function openCorePicker(type) {
    corePickerType = type
    corePickerSearch = ''
    corePickerOpen = true
  }

  function closeCorePicker() {
    corePickerOpen = false
    corePickerType = null
  }

  function assignCoreComponent(comp) {
    if (corePickerType === 'bridge') selectedBridge = comp
    else if (corePickerType === 'engine') selectedEngine = comp
    else if (corePickerType === 'hyperwarp') selectedHyperwarp = comp
    closeCorePicker()
  }

  function coreBackdropClose(e) {
    if (e.target === e.currentTarget) closeCorePicker()
  }

  // --- Officer / Crew handlers ---

  function addOfficer() {
    if (officers.length >= effectiveMaxOfficers) return
    officers.push({ jobs: [{ jobId: null, level: 1 }] })
  }

  function removeOfficer(index) {
    officers.splice(index, 1)
  }

  function addJobSlot(officerIndex) {
    const officer = officers[officerIndex]
    if (officer.jobs.length >= 3) return
    officer.jobs.push({ jobId: null, level: 1 })
  }

  function removeJobSlot(officerIndex, jobIndex) {
    const officer = officers[officerIndex]
    if (officer.jobs.length <= 1) {
      removeOfficer(officerIndex)
    } else {
      officer.jobs.splice(jobIndex, 1)
    }
  }

  function addCrew() {
    if (crew.length >= effectiveMaxCrew) return
    crew.push({ jobId: null, level: 1 })
  }

  function removeCrew(index) {
    crew.splice(index, 1)
  }

  // --- Dialog open/close effect ---

  $effect(() => {
    const d = document.getElementById('picker-dialog')
    if (!d) return
    if (pickerOpen) {
      d.showModal()
      d.querySelector('.picker-search')?.focus()
    } else if (d.open) {
      d.close()
    }
  })

  $effect(() => {
    const d = document.getElementById('core-picker-dialog')
    if (!d) return
    if (corePickerOpen) {
      d.showModal()
      d.querySelector('.picker-search')?.focus()
    } else if (d.open) {
      d.close()
    }
  })

  // --- URL hash serialization ---

  function restoreFromUrl() {
    const data = deserializeLoadout(location.hash)
    if (!data) return false

    const ship = shipsData.find(s => s.name === data.s)
    if (!ship) return false

    selectedShipName = data.s

    // Build base slot structure, then override components from hash
    const base = buildInitialSlots(ship, componentsByName, defaultLoadouts, coreComponentsData)
    if (Array.isArray(data.c)) {
      for (let i = 0; i < base.slots.length && i < data.c.length; i++) {
        base.slots[i].component = data.c[i]
          ? (componentsByName.get(data.c[i]) ?? null)
          : null
      }
    }
    slots = base.slots

    // Core components
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

    // Officers
    officers = (data.o ?? []).map(jobPairs => ({
      jobs: jobPairs.map(([jid, lvl]) => ({ jobId: jid || null, level: lvl }))
    }))

    // Crew
    crew = (data.r ?? []).map(([jid, lvl]) => ({ jobId: jid || null, level: lvl }))

    return true
  }

  // Write hash on every state change
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

  // Handle browser back/forward
  $effect(() => {
    function onPopState() {
      _skipNextHashWrite = true
      restoreFromUrl()
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  })

  // Restore from URL on initial load
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
        <div class="slot-group core-group">
          <h2 class="slot-group__heading">Core Components</h2>
          <ul class="slot-list">
            <li>
              <button
                class="slot-btn"
                class:slot-btn--empty={!selectedBridge}
                onclick={() => openCorePicker('bridge')}
              >
                <span class="slot-btn__label">
                  Bridge: {selectedBridge?.name ?? 'Unassigned'}
                </span>
              </button>
            </li>
            <li>
              <button
                class="slot-btn"
                class:slot-btn--empty={!selectedEngine}
                onclick={() => openCorePicker('engine')}
              >
                <span class="slot-btn__label">
                  Engine: {selectedEngine?.name ?? 'Unassigned'}
                </span>
              </button>
            </li>
            <li>
              <button
                class="slot-btn"
                class:slot-btn--empty={!selectedHyperwarp}
                onclick={() => openCorePicker('hyperwarp')}
              >
                <span class="slot-btn__label">
                  Hyperwarp: {selectedHyperwarp?.name ?? 'Unassigned'}
                </span>
              </button>
            </li>
          </ul>
        </div>
      {/if}

      {#each ['large', 'medium', 'small'] as size}
        {#if slots.some(s => s.size === size)}
          <div class="slot-group">
            <h2 class="slot-group__heading">{size} slots</h2>
            <ul class="slot-list">
              {#each slots as slot, i}
                {#if slot.size === size}
                  <li>
                    <button
                      class="slot-btn"
                      class:slot-btn--empty={!slot.component}
                      onclick={() => openPicker(i)}
                    >
                      <span class="slot-btn__label">
                        {slot.component?.name ?? 'Unassigned'}
                      </span>
                      {#if slot.component?.faction}
                        <span class="faction-tag">{slot.component.faction}</span>
                      {/if}
                    </button>
                  </li>
                {/if}
              {/each}
            </ul>
          </div>
        {/if}
      {/each}

      {#if selectedShip}
        <div class="slot-group crafts-group">
          <h2 class="slot-group__heading">Crafts</h2>
          <p class="muted">Craft bay: {selectedShip.maxCrafts} max (Stage 9)</p>
        </div>

        <div class="slot-group officers-group">
          <h2 class="slot-group__heading" class:slot-group__heading--over={officers.length > effectiveMaxOfficers}>
            Officers ({officers.length} / {effectiveMaxOfficers})
          </h2>

          {#each officers as officer, oi}
            <div class="officer-card">
              <div class="officer-card__header">
                <span>Officer {oi + 1}</span>
                <button class="remove-btn" onclick={() => removeOfficer(oi)} aria-label="Remove officer">&times;</button>
              </div>
              {#each officer.jobs as jobSlot, ji}
                <div class="job-row">
                  <select class="job-select" bind:value={jobSlot.jobId}>
                    <option value={null}>— Job —</option>
                    {#each jobsData as job}
                      <option value={job.id}>{job.name}</option>
                    {/each}
                  </select>
                  <input
                    class="level-input"
                    type="number"
                    min="1"
                    max="36"
                    bind:value={jobSlot.level}
                    aria-label="Officer {oi + 1} job {ji + 1} level"
                  />
                  <button class="remove-btn" onclick={() => removeJobSlot(oi, ji)} aria-label="Remove job">&times;</button>
                </div>
              {/each}
              {#if officer.jobs.length < 3}
                <button class="add-btn" onclick={() => addJobSlot(oi)}>+ Add Job</button>
              {/if}
            </div>
          {/each}

          {#if officers.length < effectiveMaxOfficers}
            <button class="add-btn" onclick={addOfficer}>+ Add Officer</button>
          {/if}
        </div>

        <div class="slot-group crew-group">
          <h2 class="slot-group__heading" class:slot-group__heading--over={crew.length > effectiveMaxCrew}>
            Crew ({crew.length} / {effectiveMaxCrew})
          </h2>

          {#each crew as member, ci}
            <div class="job-row">
              <select class="job-select" bind:value={member.jobId}>
                <option value={null}>— Job —</option>
                {#each jobsData as job}
                  <option value={job.id}>{job.name}</option>
                {/each}
              </select>
              <input
                class="level-input"
                type="number"
                min="1"
                max="36"
                bind:value={member.level}
                aria-label="Crew member {ci + 1} level"
              />
              <button class="remove-btn" onclick={() => removeCrew(ci)} aria-label="Remove crew">&times;</button>
            </div>
          {/each}

          {#if crew.length < effectiveMaxCrew}
            <button class="add-btn" onclick={addCrew}>+ Add Crew</button>
          {/if}
        </div>
      {/if}
    </section>

    <aside class="stats-panel">
      {#if selectedShip}
        <h2 class="stats-heading">{selectedShip.name}</h2>

        <div class="stat-row" class:stat-row--danger={massOverLimit}>
          <span class="stat-label">Mass</span>
          <span class="stat-value">{totalMass} / {selectedShip.massCapacity}</span>
        </div>

        {#if selectedEngine}
          <hr class="stat-divider" />
          <h3 class="stats-subheading">Engine</h3>
          <div class="stat-row">
            <span class="stat-label">Speed</span>
            <span class="stat-value">{selectedEngine.speed}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Agility</span>
            <span class="stat-value">{selectedEngine.agility}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Fuel / AU</span>
            <span class="stat-value">{selectedEngine.fuelPerAU}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Fuel / Combat</span>
            <span class="stat-value">{selectedEngine.fuelPerCombat}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Reactor Points</span>
            <span class="stat-value">{selectedEngine.reactorPoints}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Safety Rating</span>
            <span class="stat-value">{selectedEngine.safetyRating}</span>
          </div>
        {/if}

        <hr class="stat-divider" />

        <div class="stat-row">
          <span class="stat-label">Hull</span>
          <span class="stat-value">{selectedShip.hull}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Armor</span>
          <span class="stat-value">{totalArmor} [Blocks {armorBlock}%]</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Shield</span>
          <span class="stat-value">
            {selectedShip.shield !== null ? `${totalShield} [Blocks ${shieldBlock}%]` : 'T.B.C.'}
          </span>
        </div>

        <hr class="stat-divider" />

        <div class="stat-row">
          <span class="stat-label">Fuel</span>
          <span class="stat-value">{totalFuel}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Cargo</span>
          <span class="stat-value">{totalCargo}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Jump Cost</span>
          <span class="stat-value">{totalJumpCost}</span>
        </div>

        <hr class="stat-divider" />

        <div class="stat-row">
          <span class="stat-label">Crew</span>
          <span class="stat-value">{totalCrew} / {selectedShip.maxCrew}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Officers</span>
          <span class="stat-value">{totalOfficers} / {selectedShip.maxOfficers}</span>
        </div>
        {#if totalPassengers > 0}
          <div class="stat-row">
            <span class="stat-label">Passengers</span>
            <span class="stat-value">{totalPassengers}</span>
          </div>
        {/if}
        {#if totalPrisoners > 0}
          <div class="stat-row">
            <span class="stat-label">Prisoners</span>
            <span class="stat-value">{totalPrisoners}</span>
          </div>
        {/if}
        {#if totalMedical > 0}
          <div class="stat-row">
            <span class="stat-label">Medical</span>
            <span class="stat-value">{totalMedical}</span>
          </div>
        {/if}

        <hr class="stat-divider" />

        <div class="stat-row">
          <span class="stat-label">Install Cost</span>
          <span class="stat-value">{totalCost.toLocaleString()}</span>
        </div>

        <hr class="stat-divider" />

        <h3 class="stats-subheading">Ship Skills</h3>
        {#each SHIP_SKILL_KEYS as skill}
          {@const req = requiredSkills[skill]}
          {@const prov = providedSkills[skill]}
          {@const deficit = req > 0 && prov < req}
          <div class="stat-row" class:stat-row--danger={deficit} class:stat-row--met={req > 0 && prov >= req}>
            <span class="stat-label">{ALL_SKILL_LABELS[skill]}</span>
            <span class="stat-value">{prov} / {req}</span>
          </div>
        {/each}

        {#if SECONDARY_SKILL_KEYS.some(s => providedSkills[s] > 0)}
          <hr class="stat-divider" />
          <h3 class="stats-subheading">Secondary Skills</h3>
          {#each SECONDARY_SKILL_KEYS as skill}
            {#if providedSkills[skill] > 0}
              <div class="stat-row">
                <span class="stat-label">{ALL_SKILL_LABELS[skill]}</span>
                <span class="stat-value">{providedSkills[skill]}</span>
              </div>
            {/if}
          {/each}
        {/if}

        <hr class="stat-divider" />
        <h3 class="stats-subheading">Combat Scores</h3>

        <div class="combat-grid">
          <div class="combat-grid__header"></div>
          {#each RANGE_BAND_LABELS as label}
            <div class="combat-grid__header">{label}</div>
          {/each}

          <div class="combat-grid__label">Attack</div>
          {#if equippedWeapons.length > 0}
            {#each attackScores as score, i}
              {@const best = Math.max(...attackScores)}
              <div class="combat-grid__value" class:combat-grid__value--optimal={score === best && score > 0}>
                {Math.round(score)}
              </div>
            {/each}
          {:else}
            <div class="combat-grid__empty" style="grid-column: span 5;">No weapons</div>
          {/if}

          <div class="combat-grid__label">Defense</div>
          {#each defenseScores as score}
            <div class="combat-grid__value">{Math.round(score)}</div>
          {/each}

          <div class="combat-grid__label">Rng Chg</div>
          {#each rangeChangeScores as score}
            <div class="combat-grid__value">{Math.round(score)}</div>
          {/each}

          <div class="combat-grid__label">Board</div>
          {#each boardScores as score}
            <div class="combat-grid__value">{Math.round(score)}</div>
          {/each}

          <div class="combat-grid__label">Escape</div>
          {#each escapeScores as score}
            <div class="combat-grid__value">{Math.round(score)}</div>
          {/each}
        </div>
      {:else}
        <p class="stats-placeholder">Select a ship to begin.</p>
      {/if}
    </aside>
  </main>
</div>

<!-- Component picker modal -->
<dialog id="picker-dialog" class="picker-modal" onclick={backdropClose}>
  <div class="picker-header">
    <h3 class="picker-title">
      Select {pickerTargetSlot?.size} component
    </h3>
    <button class="picker-close" onclick={closePicker} aria-label="Close">×</button>
  </div>

  <div class="picker-filters">
    <input
      class="picker-search"
      type="search"
      bind:value={pickerSearch}
      placeholder="Search…"
    />
    <div class="picker-tabs" role="tablist">
      {#each ['all', 'cargo', 'combat', 'crew', 'operations', 'ship', 'weapons'] as cat}
        <button
          class="picker-tab"
          class:picker-tab--active={pickerCategoryFilter === cat}
          role="tab"
          aria-selected={pickerCategoryFilter === cat}
          onclick={() => (pickerCategoryFilter = cat)}
        >
          {cat}
        </button>
      {/each}
    </div>
    <select class="picker-faction-select" bind:value={pickerFactionFilter}>
      <option value="all">All factions</option>
      {#each pickerAvailableFactions as f}
        <option value={f}>{f}</option>
      {/each}
    </select>
  </div>

  {#if pickerCandidates.length > 0}
    <ul class="picker-list">
      {#each pickerCandidates as c (c.name + (c.faction ?? ''))}
        <li>
          <button class="picker-item" onclick={() => assignComponent(c)}>
            <span class="picker-item__name">{c.name}</span>
            {#if c.faction}
              <span class="faction-tag">{c.faction}</span>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="picker-empty">No components match.</p>
  {/if}

  <footer class="picker-footer">
    <button class="picker-cancel" onclick={closePicker}>Cancel</button>
  </footer>
</dialog>

<!-- Core component picker modal -->
<dialog id="core-picker-dialog" class="picker-modal" onclick={coreBackdropClose}>
  <div class="picker-header">
    <h3 class="picker-title">
      Select {corePickerType ?? ''}
    </h3>
    <button class="picker-close" onclick={closeCorePicker} aria-label="Close">×</button>
  </div>

  <div class="picker-filters">
    <input
      class="picker-search"
      type="search"
      bind:value={corePickerSearch}
      placeholder="Search…"
    />
  </div>

  {#if corePickerCandidates.length > 0}
    <ul class="picker-list">
      {#each corePickerCandidates as c (c.name + (c.massClass ?? '') + (c.subtype ?? ''))}
        <li>
          <button class="picker-item" onclick={() => assignCoreComponent(c)}>
            <span class="picker-item__name">{c.name}</span>
            {#if c.type === 'engine'}
              <span class="picker-item__meta">Spd {c.speed} / Agi {c.agility}</span>
            {:else if c.type === 'hyperwarp'}
              <span class="picker-item__meta">Jump {c.jumpCost}</span>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="picker-empty">No components match.</p>
  {/if}

  <footer class="picker-footer">
    <button class="picker-cancel" onclick={closeCorePicker}>Cancel</button>
  </footer>
</dialog>

<style>
  /* Layout */
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

  /* Slots panel */
  .slots-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .slot-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .slot-group__heading {
    font-size: var(--text-sm);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
  }

  .slot-group__heading--over {
    color: var(--color-danger);
  }

  .slot-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .slot-btn {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: var(--space-2) var(--space-3);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text);
    font-size: var(--text-sm);
    cursor: pointer;
    text-align: left;
    gap: var(--space-2);
    transition: background 0.15s, border-color 0.15s;
  }

  .slot-btn:hover {
    border-color: var(--color-accent);
    background: var(--color-surface-2);
  }

  .slot-btn:active {
    background: var(--color-border);
  }

  .slot-btn--empty .slot-btn__label {
    color: var(--color-text-muted);
    font-style: italic;
  }

  .slot-btn__label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Faction badge */
  .faction-tag {
    font-size: 0.7rem;
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    background: var(--faction-bg);
    color: var(--faction-text);
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* Crafts placeholder */
  .muted {
    color: var(--color-text-muted);
    font-style: italic;
    font-size: var(--text-sm);
  }

  /* Stats panel */
  .stats-panel {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    position: sticky;
    top: var(--space-3);
  }

  .stats-heading {
    font-size: var(--text-base);
    font-weight: 600;
    margin-bottom: var(--space-2);
  }

  .stats-subheading {
    font-size: var(--text-sm);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
    margin-bottom: var(--space-1);
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 2px 0;
    font-size: var(--text-sm);
  }

  .stat-row--danger {
    color: var(--color-danger);
    font-weight: 600;
  }

  .stat-label {
    color: var(--color-text-muted);
  }

  .stat-value {
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .stat-divider {
    border: none;
    border-top: 1px solid var(--color-border);
    margin: var(--space-2) 0;
  }

  .stats-placeholder {
    color: var(--color-text-muted);
    font-style: italic;
    font-size: var(--text-sm);
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

  /* Picker modal */
  .picker-modal {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    color: var(--color-text);
    padding: 0;
    max-width: 560px;
    width: 95vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }

  .picker-modal::backdrop {
    background: rgba(0, 0, 0, 0.6);
  }

  .picker-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-3);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .picker-title {
    font-size: var(--text-base);
    font-weight: 600;
    text-transform: capitalize;
  }

  .picker-close {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0 var(--space-1);
    line-height: 1;
  }

  .picker-close:hover {
    color: var(--color-text);
  }

  .picker-filters {
    padding: var(--space-2) var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .picker-search {
    width: 100%;
    padding: var(--space-2) var(--space-2);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text);
    font-size: var(--text-sm);
  }

  .picker-search:focus {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .picker-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }

  .picker-tab {
    padding: 2px var(--space-2);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: var(--text-sm);
    text-transform: capitalize;
  }

  .picker-tab:hover {
    color: var(--color-text);
    border-color: var(--color-text-muted);
  }

  .picker-tab:active {
    background: var(--color-surface-2);
  }

  .picker-tab--active {
    border-color: var(--color-accent);
    color: var(--color-accent);
    background: rgba(78, 154, 241, 0.1);
  }

  .picker-faction-select {
    padding: var(--space-1) var(--space-2);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text);
    font-size: var(--text-sm);
    align-self: flex-start;
  }

  .picker-list {
    list-style: none;
    overflow-y: auto;
    flex: 1;
    padding: var(--space-1) var(--space-2);
  }

  .picker-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: var(--space-2) var(--space-2);
    border-radius: var(--radius-sm);
    border: none;
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    gap: var(--space-2);
    text-align: left;
  }

  .picker-item:hover {
    background: var(--color-surface-2);
  }

  .picker-item:active {
    background: var(--color-border);
  }

  .picker-item__name {
    font-size: var(--text-sm);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .picker-item__meta {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .picker-empty {
    padding: var(--space-4) var(--space-3);
    color: var(--color-text-muted);
    font-style: italic;
    font-size: var(--text-sm);
    text-align: center;
  }

  .picker-footer {
    padding: var(--space-2) var(--space-3);
    border-top: 1px solid var(--color-border);
    display: flex;
    justify-content: flex-end;
    flex-shrink: 0;
  }

  .picker-cancel {
    padding: var(--space-1) var(--space-3);
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: var(--text-sm);
  }

  .picker-cancel:hover {
    color: var(--color-text);
    border-color: var(--color-text-muted);
  }

  /* Officer cards & crew rows */
  .officer-card {
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: var(--space-2);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .officer-card__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: var(--text-sm);
    font-weight: 600;
  }

  .job-row {
    display: flex;
    gap: var(--space-1);
    align-items: center;
  }

  .job-select {
    flex: 1;
    min-width: 0;
    padding: var(--space-1) var(--space-2);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text);
    font-size: var(--text-sm);
  }

  .level-input {
    width: 56px;
    padding: var(--space-1) var(--space-1);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text);
    font-size: var(--text-sm);
    text-align: center;
  }

  .remove-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 1.1rem;
    cursor: pointer;
    padding: 0 var(--space-1);
    line-height: 1;
    flex-shrink: 0;
  }

  .remove-btn:hover {
    color: var(--color-danger);
  }

  .add-btn {
    padding: var(--space-1) var(--space-2);
    background: transparent;
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: var(--text-sm);
    font-style: italic;
  }

  .add-btn:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  .add-btn:active {
    background: rgba(78, 154, 241, 0.1);
  }

  .stat-row--met {
    color: var(--color-accent);
  }

  /* Combat scores grid */
  .combat-grid {
    display: grid;
    grid-template-columns: auto repeat(5, 1fr);
    gap: 1px var(--space-1);
    font-size: var(--text-sm);
    align-items: center;
  }

  .combat-grid__header {
    color: var(--color-text-muted);
    font-weight: 600;
    text-align: center;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .combat-grid__label {
    color: var(--color-text-muted);
    padding: 2px 0;
  }

  .combat-grid__value {
    text-align: center;
    font-variant-numeric: tabular-nums;
    padding: 2px 0;
  }

  .combat-grid__value--optimal {
    color: var(--color-accent);
    font-weight: 600;
  }

  .combat-grid__empty {
    color: var(--color-text-muted);
    font-style: italic;
    text-align: center;
    padding: 2px 0;
  }

  /* Mobile */
  @media (max-width: 1024px) {
    .app-main {
      grid-template-columns: 1fr;
    }

    .stats-panel {
      order: -1;
      position: static;
    }
  }

  @media (max-width: 768px) {
    .picker-tabs {
      overflow-x: auto;
      flex-wrap: nowrap;
      -webkit-overflow-scrolling: touch;
    }

    .picker-tab {
      flex-shrink: 0;
    }
  }
</style>
