<script>
  import { SHIP_SKILL_KEYS, SECONDARY_SKILL_KEYS, ALL_SKILL_LABELS, RANGE_BAND_LABELS } from '../lib/constants.js'

  let { ship, engine, stats, requiredSkills, providedSkills, combatScores } = $props()
</script>

<aside class="stats-panel">
  {#if ship}
    <h2 class="stats-heading">{ship.name}</h2>

    <div class="stat-row" class:stat-row--danger={stats.massOverLimit}>
      <span class="stat-label">Mass</span>
      <span class="stat-value">{stats.totalMass} / {ship.massCapacity}</span>
    </div>

    {#if engine}
      <hr class="stat-divider" />
      <h3 class="stats-subheading">Engine</h3>
      <div class="stat-row">
        <span class="stat-label">Speed</span>
        <span class="stat-value">{engine.speed}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Agility</span>
        <span class="stat-value">{engine.agility}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Fuel / AU</span>
        <span class="stat-value">{engine.fuelPerAU}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Fuel / Combat</span>
        <span class="stat-value">{engine.fuelPerCombat}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Reactor Points</span>
        <span class="stat-value">{engine.reactorPoints}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Safety Rating</span>
        <span class="stat-value">{engine.safetyRating}</span>
      </div>
    {/if}

    <hr class="stat-divider" />

    <div class="stat-row">
      <span class="stat-label">Hull</span>
      <span class="stat-value">{ship.hull}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Armor</span>
      <span class="stat-value">{stats.totalArmor} [Blocks {stats.armorBlock}%]</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Shield</span>
      <span class="stat-value">
        {ship.shield !== null ? `${stats.totalShield} [Blocks ${stats.shieldBlock}%]` : 'T.B.C.'}
      </span>
    </div>

    <hr class="stat-divider" />

    <div class="stat-row">
      <span class="stat-label">Fuel</span>
      <span class="stat-value">{stats.totalFuel}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Cargo</span>
      <span class="stat-value">{stats.totalCargo}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Jump Cost</span>
      <span class="stat-value">{stats.totalJumpCost}</span>
    </div>

    <hr class="stat-divider" />

    <div class="stat-row">
      <span class="stat-label">Crew</span>
      <span class="stat-value">{stats.totalCrew} / {ship.maxCrew}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Officers</span>
      <span class="stat-value">{stats.totalOfficers} / {ship.maxOfficers}</span>
    </div>
    {#if stats.totalPassengers > 0}
      <div class="stat-row">
        <span class="stat-label">Passengers</span>
        <span class="stat-value">{stats.totalPassengers}</span>
      </div>
    {/if}
    {#if stats.totalPrisoners > 0}
      <div class="stat-row">
        <span class="stat-label">Prisoners</span>
        <span class="stat-value">{stats.totalPrisoners}</span>
      </div>
    {/if}
    {#if stats.totalMedical > 0}
      <div class="stat-row">
        <span class="stat-label">Medical</span>
        <span class="stat-value">{stats.totalMedical}</span>
      </div>
    {/if}

    <hr class="stat-divider" />

    <div class="stat-row">
      <span class="stat-label">Install Cost</span>
      <span class="stat-value">{stats.totalCost.toLocaleString()}</span>
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
      {#if combatScores.equippedWeapons.length > 0}
        {#each combatScores.attackScores as score, i}
          {@const best = Math.max(...combatScores.attackScores)}
          <div class="combat-grid__value" class:combat-grid__value--optimal={score === best && score > 0}>
            {Math.round(score)}
          </div>
        {/each}
      {:else}
        <div class="combat-grid__empty" style="grid-column: span 5;">No weapons</div>
      {/if}

      <div class="combat-grid__label">Defense</div>
      {#each combatScores.defenseScores as score}
        <div class="combat-grid__value">{Math.round(score)}</div>
      {/each}

      <div class="combat-grid__label">Rng Chg</div>
      {#each combatScores.rangeChangeScores as score}
        <div class="combat-grid__value">{Math.round(score)}</div>
      {/each}

      <div class="combat-grid__label">Board</div>
      {#each combatScores.boardScores as score}
        <div class="combat-grid__value">{Math.round(score)}</div>
      {/each}

      <div class="combat-grid__label">Escape</div>
      {#each combatScores.escapeScores as score}
        <div class="combat-grid__value">{Math.round(score)}</div>
      {/each}
    </div>
  {:else}
    <p class="stats-placeholder">Select a ship to begin.</p>
  {/if}
</aside>
