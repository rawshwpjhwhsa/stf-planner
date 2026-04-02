<script>
  import shipsData from './data/ships.json'
  import componentsData from './data/components.json'
  import coreComponentsData from './data/core_components.json'
  import defaultLoadouts from './data/default_loadouts.json'
  import { buildInitialSlots } from './lib/loadout.js'

  // --- Module-level constants (computed once, not reactive) ---

  const MASS_CLASS_ORDER = [2400, 3400, 5000, 6000, 7000, 8000, 9000]

  const SKILL_LABELS = {
    pilot: 'Pilot', shipOps: 'Ship Ops', gunnery: 'Gunnery',
    electronics: 'Electronics', navigation: 'Navigation',
  }

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

  const totalSkills = $derived.by(() => {
    const skills = { pilot: 0, shipOps: 0, gunnery: 0, electronics: 0, navigation: 0 }
    for (const c of allEquippedComponents) {
      skills.pilot += c.skills.pilot
      skills.shipOps += c.skills.shipOps
      skills.gunnery += c.skills.gunnery
      skills.electronics += c.skills.electronics
      skills.navigation += c.skills.navigation
    }
    return skills
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
  </header>

  <main class="app-main">
    <section class="slots-panel">
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

        <h3 class="stats-subheading">Skill Requirements</h3>
        {#each Object.entries(totalSkills) as [skill, value]}
          {#if value > 0}
            <div class="stat-row">
              <span class="stat-label">{SKILL_LABELS[skill]}</span>
              <span class="stat-value">{value}</span>
            </div>
          {/if}
        {/each}
        {#if Object.values(totalSkills).every(v => v === 0)}
          <p class="muted">No skill requirements.</p>
        {/if}
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
  }

  .slot-btn:hover {
    border-color: var(--color-accent);
    background: var(--color-surface-2);
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

  /* Mobile */
  @media (max-width: 768px) {
    .app-main {
      grid-template-columns: 1fr;
    }

    .stats-panel {
      order: -1;
      position: static;
    }
  }
</style>
