<script>
  import { jobsData } from '../lib/constants.js'

  let { officers = $bindable(), maxOfficers } = $props()

  function addOfficer() {
    if (officers.length >= maxOfficers) return
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
</script>

<div class="slot-group officers-group">
  <h2 class="slot-group__heading" class:slot-group__heading--over={officers.length > maxOfficers}>
    Officers ({officers.length} / {maxOfficers})
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

  {#if officers.length < maxOfficers}
    <button class="add-btn" onclick={addOfficer}>+ Add Officer</button>
  {/if}
</div>
