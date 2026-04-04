import shipsData from '../data/ships.json'
import componentsData from '../data/components.json'
import coreComponentsData from '../data/core_components.json'
import jobsData from '../data/jobs.json'

export { shipsData, componentsData, coreComponentsData, jobsData }

export const MASS_CLASS_ORDER = [2400, 3400, 5000, 6000, 7000, 8000, 9000]
export const RANGE_BAND_LABELS = ['I', 'II', 'III', 'IV', 'V']

export const SHIP_SKILL_KEYS = ['pilot', 'shipOps', 'gunnery', 'electronics', 'navigation']
export const SECONDARY_SKILL_KEYS = [
  'command', 'doctor', 'evasion', 'explorer', 'heavy_firearms',
  'intimidate', 'light_firearms', 'melee', 'negotiate', 'repair',
  'stealth', 'tactics',
]

export const ALL_SKILL_LABELS = {
  pilot: 'Pilot', shipOps: 'Ship Ops', gunnery: 'Gunnery',
  electronics: 'Electronics', navigation: 'Navigation',
  command: 'Command', doctor: 'Doctor', evasion: 'Evasion',
  explorer: 'Explorer', heavy_firearms: 'Heavy Firearms',
  intimidate: 'Intimidate', light_firearms: 'Light Firearms',
  melee: 'Melee', negotiate: 'Negotiate', repair: 'Repair',
  stealth: 'Stealth', tactics: 'Tactics',
}

export const jobsById = new Map(jobsData.map(j => [j.id, j]))

export const massClassGroups = MASS_CLASS_ORDER.map(mc => ({
  massClass: mc,
  ships: shipsData
    .filter(s => s.massClass === mc)
    .sort((a, b) => a.name.localeCompare(b.name)),
}))

export const componentsBySize = {
  large:  componentsData.filter(c => c.size === 'large'),
  medium: componentsData.filter(c => c.size === 'medium'),
  small:  componentsData.filter(c => c.size === 'small'),
}

export const componentsByName = new Map(
  componentsData.map(c => [`${c.name}::${c.faction ?? ''}`, c])
)

export const coreByType = {
  bridge: coreComponentsData.filter(c => c.type === 'bridge'),
  engine: coreComponentsData.filter(c => c.type === 'engine'),
  hyperwarp: coreComponentsData.filter(c => c.type === 'hyperwarp'),
}
