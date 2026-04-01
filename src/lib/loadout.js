/**
 * Builds the flat slot array for a ship. Called on ship select.
 *
 * Slots are ordered: all large, then all medium, then all small.
 * This ordering must remain stable — future URL serialisation relies on it.
 *
 * @param {object} ship             - ship object from ships.json
 * @param {Map}    componentsByName - Map keyed by "name::faction" for O(1) lookup
 * @param {object} defaultLoadouts  - default_loadouts.json object (may be empty)
 * @returns {{ size: string, index: number, component: object|null }[]}
 */
export function buildInitialSlots(ship, componentsByName, defaultLoadouts) {
  const result = []
  for (const size of ['large', 'medium', 'small']) {
    const count = ship.slots[size]
    const defaults = defaultLoadouts?.[ship.name]?.[size] ?? []
    for (let i = 0; i < count; i++) {
      const defaultName = defaults[i]
      // Faction-variant components share a name; look up by name:: (no faction) as fallback
      // since defaults don't specify faction. This finds whichever was last in the Map for
      // that name — acceptable for now, revisit when defaults are populated.
      const component = defaultName
        ? (componentsByName.get(`${defaultName}::`) ??
           [...componentsByName.values()].find(c => c.name === defaultName) ??
           null)
        : null
      result.push({ size, index: i, component })
    }
  }
  return result
}

/**
 * Normalises a ship's defaultEngine string to the core_components.json engine name format.
 * Used in Stage 5 when wiring up the engine slot.
 *
 * Examples:
 *   "M3400 Balanced Engine"  → "M3400 Void Engine: Balanced"
 *   "M5000 Traveler Engine"  → "M5000 Void Engine: Traveler"
 *
 * @param {string} name - ship.defaultEngine value from ships.json
 * @returns {string}
 */
export function normalizeEngineName(name) {
  if (/^M\d+ Void Engine:/.test(name)) return name
  const match = name.match(/^(M\d+) (.+) Engine$/)
  if (!match) return name
  return `${match[1]} Void Engine: ${match[2]}`
}
