import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from 'lz-string'

/**
 * Serializes a full loadout state into a URL-safe compressed string.
 *
 * @param {object} params
 * @param {string} params.ship - ship name
 * @param {object[]} params.slots - slot array (ordered large→medium→small)
 * @param {object|null} params.bridge
 * @param {object|null} params.engine
 * @param {object|null} params.hyperwarp
 * @param {object[]} params.officers - array of { jobs: [{ jobId, level }] }
 * @param {object[]} params.crew - array of { jobId, level }
 * @returns {string} compressed, URL-safe string
 */
export function serializeLoadout({ ship, slots, bridge, engine, hyperwarp, officers, crew }) {
  const data = {
    v: 1,
    s: ship,
    c: slots.map(sl =>
      sl.component ? `${sl.component.name}::${sl.component.faction ?? ''}` : null
    ),
    b: bridge ? [bridge.name, bridge.subtype] : null,
    e: engine?.name ?? null,
    h: hyperwarp?.name ?? null,
    o: officers.map(off => off.jobs.map(j => [j.jobId ?? 0, j.level])),
    r: crew.map(m => [m.jobId ?? 0, m.level]),
  }
  return compressToEncodedURIComponent(JSON.stringify(data))
}

/**
 * Deserializes a URL hash string back into a loadout data object.
 * Returns null on any failure (malformed, wrong version, etc.).
 *
 * @param {string} hash - location.hash (with or without leading #)
 * @returns {object|null} parsed loadout data, or null
 */
export function deserializeLoadout(hash) {
  try {
    const raw = hash.startsWith('#') ? hash.slice(1) : hash
    if (!raw) return null
    const json = decompressFromEncodedURIComponent(raw)
    if (!json) return null
    const data = JSON.parse(json)
    if (data.v !== 1 || typeof data.s !== 'string') return null
    return data
  } catch {
    return null
  }
}
