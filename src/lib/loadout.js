/**
 * Builds the flat slot array for a ship, separating core components (bridge,
 * engine, hyperwarp) from swappable components. Called on ship select.
 *
 * Slots are ordered: all large, then all medium, then all small.
 * This ordering must remain stable — future URL serialisation relies on it.
 *
 * @param {object} ship             - ship object from ships.json
 * @param {Map}    componentsByName - Map keyed by "name::faction" for O(1) lookup
 * @param {object} defaultLoadouts  - default_loadouts.json object (may be empty)
 * @param {object[]} coreComponents - core_components.json array
 * @returns {{ slots: { size: string, index: number, component: object|null }[],
 *             bridge: object|null, engine: object|null, hyperwarp: object|null }}
 */
export function buildInitialSlots(ship, componentsByName, defaultLoadouts, coreComponents) {
  const defaults = defaultLoadouts?.[ship.name] ?? {}

  // Resolve core components from the default loadout
  const coreResult = resolveDefaultCoreComponents(ship, defaults, coreComponents)

  // Build a set of slot indices to skip (occupied by core components)
  const coreSlotKeys = new Set(coreResult.skipEntries)

  const result = []
  for (const size of ['large', 'medium', 'small']) {
    const count = ship.slots[size]
    const sizeDefaults = defaults[size] ?? []
    let slotIndex = 0
    for (let i = 0; i < count; i++) {
      const defaultName = sizeDefaults[i]
      const skipKey = `${size}:${i}`
      if (coreSlotKeys.has(skipKey)) continue

      const component = defaultName
        ? (componentsByName.get(`${defaultName}::`) ??
           [...componentsByName.values()].find(c => c.name === defaultName) ??
           null)
        : null
      result.push({ size, index: slotIndex++, component })
    }
  }
  return {
    slots: result,
    bridge: coreResult.bridge,
    engine: coreResult.engine,
    hyperwarp: coreResult.hyperwarp,
  }
}

/**
 * Identifies and resolves default core components from a ship's default loadout.
 * Returns the resolved objects and a list of slot entries to skip in buildInitialSlots.
 */
function resolveDefaultCoreComponents(ship, defaults, coreComponents) {
  let bridge = null
  let engine = null
  let hyperwarp = null
  const skipEntries = []

  for (const size of ['large', 'medium', 'small']) {
    const sizeDefaults = defaults[size] ?? []
    for (let i = 0; i < sizeDefaults.length; i++) {
      const name = sizeDefaults[i]
      if (!name) continue

      // Engine: "M3400 Void Engine: Balanced"
      if (!engine && /^M\d+ Void Engine:/.test(name)) {
        engine = coreComponents.find(c => c.type === 'engine' && c.name === name) ?? null
        if (engine) skipEntries.push(`${size}:${i}`)
        continue
      }

      // Hyperwarp: "M3400 Basic Hyperwarp Drive" → "Basic Hyperwarp Drive" + massClass
      if (!hyperwarp && /Hyperwarp Drive$/.test(name)) {
        const stripped = name.replace(/^M\d+ /, '')
        hyperwarp = coreComponents.find(
          c => c.type === 'hyperwarp' && c.name === stripped && c.massClass === ship.massClass
        ) ?? null
        if (hyperwarp) skipEntries.push(`${size}:${i}`)
        continue
      }

      // Bridge: multiple naming conventions
      if (!bridge) {
        const bridgeResult = resolveBridge(name, size, coreComponents)
        if (bridgeResult) {
          bridge = bridgeResult
          skipEntries.push(`${size}:${i}`)
          continue
        }
      }
    }
  }

  // Fallback: resolve engine from ship.defaultEngine if not found in loadout
  if (!engine && ship.defaultEngine) {
    const normalized = normalizeEngineName(ship.defaultEngine)
    engine = coreComponents.find(c => c.type === 'engine' && c.name === normalized) ?? null
  }

  return { bridge, engine, hyperwarp, skipEntries }
}

/**
 * Attempts to resolve a default loadout entry as a bridge.
 * Returns the matching core_components bridge object, or null.
 */
function resolveBridge(name, slotSize, coreComponents) {
  // Infer subtype from slot size
  const subtypeForSize = { small: 'scout', medium: 'standard', large: 'capital' }
  const subtype = subtypeForSize[slotSize]
  if (!subtype) return null

  const bridges = coreComponents.filter(c => c.type === 'bridge' && c.subtype === subtype)

  // Direct name match (handles "Bridge", "Bridge 3", "Battle Bridge", "Scout Bridge",
  // faction bridges like "Compact Capital Bridge 4", etc.)
  const direct = bridges.find(b => b.name === name)
  if (direct) return direct

  // "Capital Bridge" → "Bridge", "Capital Bridge 2" → "Bridge 2"
  if (/^Capital /.test(name)) {
    const stripped = name.replace(/^Capital /, '')
    const match = bridges.find(b => b.name === stripped)
    if (match) return match
  }

  return null
}

/**
 * Normalises a ship's defaultEngine string to the core_components.json engine name format.
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
