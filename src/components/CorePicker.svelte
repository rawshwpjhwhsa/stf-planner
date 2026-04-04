<script>
  import { coreByType } from '../lib/constants.js'

  let { type = null, massClass = null, bridgeSubtype = null, onselect, onclose } = $props()

  let search = $state('')

  const candidates = $derived.by(() => {
    if (!type) return []
    let list = coreByType[type]
    if (type === 'engine')
      list = list.filter(c => c.massClass === massClass)
    else if (type === 'hyperwarp')
      list = list.filter(c => c.massClass === massClass)
    else if (type === 'bridge' && bridgeSubtype)
      list = list.filter(c => c.subtype === bridgeSubtype)
    if (search.trim())
      list = list.filter(c => c.name.toLowerCase().includes(search.trim().toLowerCase()))
    return list
  })

  function backdropClose(e) {
    if (e.target === e.currentTarget) onclose()
  }

  $effect(() => {
    const d = document.getElementById('core-picker-dialog')
    if (!d) return
    if (type) {
      search = ''
      d.showModal()
      d.querySelector('.picker-search')?.focus()
    } else if (d.open) {
      d.close()
    }
  })
</script>

<dialog id="core-picker-dialog" class="picker-modal" onclick={backdropClose}>
  <div class="picker-header">
    <h3 class="picker-title">
      Select {type ?? ''}
    </h3>
    <button class="picker-close" onclick={onclose} aria-label="Close">×</button>
  </div>

  <div class="picker-filters">
    <input
      class="picker-search"
      type="search"
      bind:value={search}
      placeholder="Search…"
      aria-label="Search core components"
    />
  </div>

  {#if candidates.length > 0}
    <ul class="picker-list">
      {#each candidates as c (c.name + (c.massClass ?? '') + (c.subtype ?? ''))}
        <li>
          <button class="picker-item" onclick={() => onselect(c)}>
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
    <button class="picker-cancel" onclick={onclose}>Cancel</button>
  </footer>
</dialog>
