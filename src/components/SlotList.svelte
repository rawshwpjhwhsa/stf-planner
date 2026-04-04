<script>
  let { slots, size, onslotclick } = $props()

  const hasSlots = $derived(slots.some(s => s.size === size))
</script>

{#if hasSlots}
  <div class="slot-group">
    <h2 class="slot-group__heading">{size} slots</h2>
    <ul class="slot-list">
      {#each slots as slot, i}
        {#if slot.size === size}
          <li>
            <button
              class="slot-btn"
              class:slot-btn--empty={!slot.component}
              onclick={() => onslotclick(i)}
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
