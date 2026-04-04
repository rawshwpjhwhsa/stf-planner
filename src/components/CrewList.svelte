<script>
  import { jobsData } from '../lib/constants.js'

  let { crew = $bindable(), maxCrew } = $props()

  function addCrew() {
    if (crew.length >= maxCrew) return
    crew.push({ jobId: null, level: 1 })
  }

  function removeCrew(index) {
    crew.splice(index, 1)
  }
</script>

<div class="slot-group crew-group">
  <h2 class="slot-group__heading" class:slot-group__heading--over={crew.length > maxCrew}>
    Crew ({crew.length} / {maxCrew})
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

  {#if crew.length < maxCrew}
    <button class="add-btn" onclick={addCrew}>+ Add Crew</button>
  {/if}
</div>
