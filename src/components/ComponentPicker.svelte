<script>
  import { componentsBySize } from '../lib/constants.js'

  let { targetSlot = null, onselect, onclose } = $props()

  let search = $state('')
  let categoryFilter = $state('all')
  let factionFilter = $state('all')

  const availableFactions = $derived.by(() => {
    if (!targetSlot) return []
    return [
      ...new Set(
        componentsBySize[targetSlot.size]
          .filter(c => c.faction)
          .map(c => c.faction)
      ),
    ].sort()
  })

  const candidates = $derived.by(() => {
    if (!targetSlot) return []
    let list = componentsBySize[targetSlot.size]
    if (categoryFilter !== 'all')
      list = list.filter(c => c.category === categoryFilter)
    if (factionFilter !== 'all')
      list = list.filter(c => c.faction === factionFilter)
    if (search.trim())
      list = list.filter(c =>
        c.name.toLowerCase().includes(search.trim().toLowerCase())
      )
    return list
  })

  function getStatChips(c) {
    const chips = []
    chips.push({ label: 'Mass', value: c.mass })
    if (c.weapon) {
      chips.push({ label: 'Dmg', value: `${c.weapon.damage_min}–${c.weapon.damage_max}` })
      chips.push({ label: 'Rng', value: c.weapon.range })
      chips.push({ label: 'AP', value: c.weapon.ap })
    } else {
      if (c.cargo > 0)    chips.push({ label: 'Cargo', value: c.cargo })
      if (c.fuel > 0)     chips.push({ label: 'Fuel', value: c.fuel })
      if (c.armor > 0)    chips.push({ label: 'Armor', value: c.armor })
      if (c.shield > 0)   chips.push({ label: 'Shield', value: c.shield })
      if (c.crew > 0)     chips.push({ label: 'Crew', value: c.crew })
      if (c.officers > 0) chips.push({ label: 'Officers', value: c.officers })
      if (c.jumpCost > 0) chips.push({ label: 'Jump', value: c.jumpCost })
      if (c.passengers > 0) chips.push({ label: 'Pax', value: c.passengers })
      if (c.prisoners > 0)  chips.push({ label: 'Prisoners', value: c.prisoners })
      if (c.medical > 0)    chips.push({ label: 'Medical', value: c.medical })
    }
    return chips
  }

  function backdropClose(e) {
    if (e.target === e.currentTarget) onclose()
  }

  $effect(() => {
    const d = document.getElementById('picker-dialog')
    if (!d) return
    if (targetSlot) {
      search = ''
      categoryFilter = 'all'
      factionFilter = 'all'
      d.showModal()
      d.querySelector('.picker-search')?.focus()
    } else if (d.open) {
      d.close()
    }
  })
</script>

<dialog id="picker-dialog" class="picker-modal" onclick={backdropClose}>
  <div class="picker-header">
    <h3 class="picker-title">
      Select {targetSlot?.size} component
    </h3>
    <button class="picker-close" onclick={onclose} aria-label="Close">×</button>
  </div>

  <div class="picker-filters">
    <input
      class="picker-search"
      type="search"
      bind:value={search}
      placeholder="Search…"
    />
    <div class="picker-tabs" role="tablist">
      {#each ['all', 'cargo', 'combat', 'crew', 'operations', 'ship', 'weapons'] as cat}
        <button
          class="picker-tab"
          class:picker-tab--active={categoryFilter === cat}
          role="tab"
          aria-selected={categoryFilter === cat}
          onclick={() => (categoryFilter = cat)}
        >
          {cat}
        </button>
      {/each}
    </div>
    <select class="picker-faction-select" bind:value={factionFilter}>
      <option value="all">All factions</option>
      {#each availableFactions as f}
        <option value={f}>{f}</option>
      {/each}
    </select>
  </div>

  {#if candidates.length > 0}
    <ul class="picker-list">
      {#each candidates as c (c.name + (c.faction ?? ''))}
        <li>
          <button class="picker-item" onclick={() => onselect(c)}>
            <span class="picker-item__name">{c.name}</span>
            <span class="picker-item__chips">
              {#each getStatChips(c) as chip}
                <span class="picker-stat">{chip.label} {chip.value}</span>
              {/each}
            </span>
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
    <button class="picker-cancel" onclick={onclose}>Cancel</button>
  </footer>
</dialog>
