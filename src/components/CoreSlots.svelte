<script>
  let { bridge, engine, hyperwarp, onopenPicker } = $props()
</script>

<div class="slot-group core-group">
  <h2 class="slot-group__heading">Core Components</h2>
  <ul class="slot-list">
    <li>
      <button
        class="slot-btn"
        class:slot-btn--empty={!bridge}
        onclick={() => onopenPicker('bridge')}
      >
        <span class="slot-btn__label">
          Bridge: {bridge?.name ?? 'Unassigned'}
        </span>
      </button>
    </li>
    <li>
      <button
        class="slot-btn"
        class:slot-btn--empty={!engine}
        onclick={() => onopenPicker('engine')}
      >
        <span class="slot-btn__label">
          Engine: {engine?.name ?? 'Unassigned'}
        </span>
      </button>
    </li>
    <li>
      <button
        class="slot-btn"
        class:slot-btn--empty={!hyperwarp}
        onclick={() => onopenPicker('hyperwarp')}
      >
        <span class="slot-btn__label">
          Hyperwarp: {hyperwarp?.name ?? 'Unassigned'}
        </span>
      </button>
    </li>
  </ul>
</div>
