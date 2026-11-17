import { BIOME_COLORS, MAP_HEIGHT, MAP_WIDTH, TRAIT_BY_ID } from './constants'
import { formatDecimal, formatMoney, truncate } from './format'
import { isHostile, militaryPower } from './selectors'
import type { Country, GameSettings, TradeDeal } from './types'

export type MapPoint = [number, number]
export type MapColorMode = 'terrain' | 'alignment' | 'relations' | 'economy' | 'power'
export type MapFilter = 'all' | 'sovereign' | 'bloc' | 'hostile' | 'integrated' | 'fallen'
export type MapRouteKind = 'import' | 'export' | 'mixed' | 'world'

export interface MapColorContext {
  settings: GameSettings
  gdpFloor: number
  gdpCeil: number
  powerFloor: number
  powerCeil: number
  gdpMinLog: number
  gdpMaxLog: number
  powerMinRoot: number
  powerMaxRoot: number
}

export interface MapRoute {
  id: string
  countryId: string
  countryIds?: string[]
  kind: MapRouteKind
  d: string
  duration: number
  delay: number
}

export interface MapLegendItem {
  label: string
  color: string
}

export type MapLegend =
  | { kind: 'swatches'; items: MapLegendItem[] }
  | { kind: 'gradient'; gradient: string; from: string; to: string }

export interface MapFilterState {
  filter: MapFilter
  continentId: string
  query: string
}

export const MAP_COLOR_MODES: { id: MapColorMode; label: string; hint: string }[] = [
  { id: 'terrain', label: 'Terrain', hint: 'Generated biome terrain' },
  { id: 'alignment', label: 'Politics', hint: 'Bloc alignment and state status' },
  { id: 'relations', label: 'Relations', hint: 'Diplomatic temperature toward you' },
  { id: 'economy', label: 'Economy', hint: 'GDP scale across sovereign states' },
  { id: 'power', label: 'Power', hint: 'Military power scale across sovereign states' },
]

export const MAP_FILTERS: { id: MapFilter; label: string }[] = [
  { id: 'all', label: 'All nations' },
  { id: 'sovereign', label: 'Sovereign states' },
  { id: 'bloc', label: 'Your bloc' },
  { id: 'hostile', label: 'Hostile states' },
  { id: 'integrated', label: 'Integrated' },
  { id: 'fallen', label: 'Fallen states' },
]

export const MAP_ALIGNMENT_COLORS = {
  player: 'var(--accent)',
  aligned: 'color-mix(in oklab, var(--accent-2) 58%, var(--map-land))',
  neutral: 'color-mix(in oklab, var(--muted) 16%, var(--map-land))',
  hostile: 'color-mix(in oklab, var(--error) 56%, var(--map-land))',
  integrated: 'color-mix(in oklab, var(--accent-2) 30%, var(--map-land))',
  fallen: 'color-mix(in oklab, var(--muted) 26%, var(--map-land))',
}

export function polygonPath(points: MapPoint[]): string {
  return `${points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x},${y}`).join(' ')} Z`
}

function roundCoord(value: number): number {
  return Math.round(value * 10) / 10
}

/** Closed Catmull-Rom spline converted to cubic Béziers for organic coastlines. */
export function smoothPolygonPath(points: MapPoint[]): string {
  if (points.length < 3) return polygonPath(points)
  const [startX, startY] = points[0]!
  let path = `M${roundCoord(startX)},${roundCoord(startY)}`
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index - 1 + points.length) % points.length]!
    const current = points[index]!
    const next = points[(index + 1) % points.length]!
    const after = points[(index + 2) % points.length]!
    const controlA: MapPoint = [
      roundCoord(current[0] + (next[0] - previous[0]) / 6),
      roundCoord(current[1] + (next[1] - previous[1]) / 6),
    ]
    const controlB: MapPoint = [
      roundCoord(next[0] - (after[0] - current[0]) / 6),
      roundCoord(next[1] - (after[1] - current[1]) / 6),
    ]
    path += ` C${controlA[0]},${controlA[1]} ${controlB[0]},${controlB[1]} ${roundCoord(
      next[0],
    )},${roundCoord(next[1])}`
  }
  return `${path} Z`
}

function polygonArea(points: MapPoint[]): number {
  let twiceArea = 0
  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index]!
    const [x2, y2] = points[(index + 1) % points.length]!
    twiceArea += x1 * y2 - x2 * y1
  }
  return Math.abs(twiceArea) / 2
}

export function countryLabel(country: Country, narrow: boolean): string {
  if (narrow || polygonArea(country.map.polygon) < 1700) return country.code
  return truncate(country.name, 13)
}

export function countryLabelSize(country: Country): number {
  const area = polygonArea(country.map.polygon)
  if (area > 16000) return 12.5
  if (area > 9000) return 11
  if (area > 4500) return 9.5
  return 8
}

function normalize(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || max - min < 1e-9) return 0.5
  return Math.max(0, Math.min(1, (value - min) / (max - min)))
}

export function buildMapColorContext(
  countries: Country[],
  settings: GameSettings,
): MapColorContext {
  const living = countries.filter((country) => country.status === 'alive')
  const gdpValues = living.map((country) => Math.max(1, country.stats.gdp))
  const powerValues = living.map((country) => Math.sqrt(Math.max(0, militaryPower(country))))
  const gdpFloor = gdpValues.length > 0 ? Math.min(...gdpValues) : 0
  const gdpCeil = gdpValues.length > 0 ? Math.max(...gdpValues) : 1
  const powerFloorRoot = powerValues.length > 0 ? Math.min(...powerValues) : 0
  const powerCeilRoot = powerValues.length > 0 ? Math.max(...powerValues) : 1
  return {
    settings,
    gdpFloor,
    gdpCeil,
    powerFloor: powerFloorRoot ** 2,
    powerCeil: powerCeilRoot ** 2,
    gdpMinLog: Math.log10(Math.max(1, gdpFloor)),
    gdpMaxLog: Math.log10(Math.max(1, gdpCeil)),
    powerMinRoot: powerFloorRoot,
    powerMaxRoot: powerCeilRoot,
  }
}

export function countryFill(
  country: Country,
  mode: MapColorMode,
  context: MapColorContext,
): string {
  if (mode === 'terrain') return country.map.color
  if (country.isPlayer) return MAP_ALIGNMENT_COLORS.player
  if (mode === 'alignment') {
    if (country.status === 'destroyed') return MAP_ALIGNMENT_COLORS.fallen
    if (country.status === 'merged') return MAP_ALIGNMENT_COLORS.integrated
    if (country.relations >= 100) return MAP_ALIGNMENT_COLORS.aligned
    if (isHostile(country, context.settings) || country.relations <= -50) {
      return MAP_ALIGNMENT_COLORS.hostile
    }
    return MAP_ALIGNMENT_COLORS.neutral
  }
  if (mode === 'relations') {
    const share = Math.round(Math.max(0, Math.min(1, (country.relations + 100) / 200)) * 100)
    return `color-mix(in oklab, color-mix(in oklab, var(--error), var(--accent-2) ${share}%) 78%, var(--map-land))`
  }
  if (mode === 'economy') {
    const share =
      8 +
      Math.round(
        normalize(
          Math.log10(Math.max(1, country.stats.gdp)),
          context.gdpMinLog,
          context.gdpMaxLog,
        ) * 78,
      )
    return `color-mix(in oklab, var(--accent) ${share}%, var(--map-land))`
  }
  const share =
    8 +
    Math.round(
      normalize(
        Math.sqrt(Math.max(0, militaryPower(country))),
        context.powerMinRoot,
        context.powerMaxRoot,
      ) * 82,
    )
  return `color-mix(in oklab, var(--warning) ${share}%, var(--map-land))`
}

export function buildMapLegend(
  mode: MapColorMode,
  countries: Country[],
  context: MapColorContext,
): MapLegend {
  if (mode === 'terrain') {
    const biomeIds = Array.from(new Set(countries.map((country) => country.biome)))
    const items = (biomeIds.length > 0 ? biomeIds : ['temperate']).map((id) => ({
      label: TRAIT_BY_ID[id]?.name ?? id,
      color: BIOME_COLORS[id] ?? BIOME_COLORS.temperate!,
    }))
    return { kind: 'swatches', items }
  }
  if (mode === 'alignment') {
    return {
      kind: 'swatches',
      items: [
        { label: 'You', color: MAP_ALIGNMENT_COLORS.player },
        { label: 'Aligned', color: MAP_ALIGNMENT_COLORS.aligned },
        { label: 'Neutral', color: MAP_ALIGNMENT_COLORS.neutral },
        { label: 'Hostile', color: MAP_ALIGNMENT_COLORS.hostile },
        { label: 'Integrated', color: MAP_ALIGNMENT_COLORS.integrated },
        { label: 'Fallen', color: MAP_ALIGNMENT_COLORS.fallen },
      ],
    }
  }
  if (mode === 'relations') {
    return {
      kind: 'gradient',
      gradient:
        'linear-gradient(90deg, var(--error), color-mix(in oklab, var(--error), var(--accent-2) 50%), var(--accent-2))',
      from: 'Hostile',
      to: 'Allied',
    }
  }
  if (mode === 'economy') {
    return {
      kind: 'gradient',
      gradient: 'linear-gradient(90deg, var(--map-land), var(--accent))',
      from: formatMoney(context.gdpFloor),
      to: formatMoney(context.gdpCeil),
    }
  }
  return {
    kind: 'gradient',
    gradient: 'linear-gradient(90deg, var(--map-land), var(--warning))',
    from: formatDecimal(context.powerFloor, 0),
    to: formatDecimal(context.powerCeil, 0),
  }
}

export function filterMapCountries(
  countries: Country[],
  state: MapFilterState,
  settings: GameSettings,
): Set<string> {
  const query = state.query.trim().toLowerCase()
  return new Set(
    countries
      .filter((country) => {
        if (state.continentId !== 'all' && country.continentId !== state.continentId) return false
        if (state.filter === 'sovereign' && country.status !== 'alive') return false
        if (
          state.filter === 'bloc' &&
          !country.isPlayer &&
          (country.status !== 'alive' || country.relations < 100)
        ) {
          return false
        }
        if (state.filter === 'hostile' && !isHostile(country, settings)) return false
        if (state.filter === 'integrated' && country.status !== 'merged') return false
        if (state.filter === 'fallen' && country.status !== 'destroyed') return false
        if (query.length > 0) {
          const haystack = `${country.name} ${country.code} ${country.capital}`.toLowerCase()
          return haystack.includes(query)
        }
        return true
      })
      .map((country) => country.id),
  )
}

function routeGeometry(
  from: MapPoint,
  to: MapPoint,
  index: number,
): { d: string; duration: number } {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const distance = Math.hypot(dx, dy)
  const side = to[0] >= from[0] ? 1 : -1
  const bend = side * (index % 2 === 0 ? 1 : -1) * Math.min(58, 12 + distance * 0.13)
  const midX = (from[0] + to[0]) / 2 - (dy / Math.max(1, distance)) * bend
  const midY = (from[1] + to[1]) / 2 + (dx / Math.max(1, distance)) * bend
  const controlX = Math.max(8, Math.min(MAP_WIDTH - 8, midX))
  const controlY = Math.max(8, Math.min(MAP_HEIGHT - 8, midY))
  return {
    d: `M${Math.round(from[0])},${Math.round(from[1])} Q${Math.round(controlX)},${Math.round(
      controlY,
    )} ${Math.round(to[0])},${Math.round(to[1])}`,
    duration: Math.min(8, Math.max(3.4, 2.6 + distance / 150)),
  }
}

export function buildMapRoutes(
  countries: Country[],
  player: Country,
  deals: TradeDeal[],
  limit = 20,
): MapRoute[] {
  const countryById = new Map(countries.map((country) => [country.id, country]))
  const byPartner = new Map<string, { imports: number; exports: number }>()
  const worldPairs = new Map<string, { buyerId: string; sellerId: string; volume: number }>()

  for (const deal of deals) {
    if (deal.remainingTurns <= 0) continue
    if (deal.buyerId === player.id || deal.sellerId === player.id) {
      const partnerId = deal.buyerId === player.id ? deal.sellerId : deal.buyerId
      if (partnerId === player.id) continue
      const entry = byPartner.get(partnerId) ?? { imports: 0, exports: 0 }
      if (deal.buyerId === player.id) entry.imports += 1
      else entry.exports += 1
      byPartner.set(partnerId, entry)
      continue
    }

    const buyer = countryById.get(deal.buyerId)
    const seller = countryById.get(deal.sellerId)
    if (!buyer || !seller || buyer.status !== 'alive' || seller.status !== 'alive') continue
    const key = [buyer.id, seller.id].sort().join('|')
    const entry = worldPairs.get(key) ?? {
      buyerId: buyer.id,
      sellerId: seller.id,
      volume: 0,
    }
    entry.volume += deal.quantity
    worldPairs.set(key, entry)
  }

  const playerRanked = countries
    .filter(
      (country) => country.status === 'alive' && !country.isPlayer && byPartner.has(country.id),
    )
    .sort((a, b) => {
      const left = byPartner.get(a.id)!
      const right = byPartner.get(b.id)!
      return right.imports + right.exports - (left.imports + left.exports)
    })

  const worldRanked = [...worldPairs.values()]
    .sort((a, b) => b.volume - a.volume)
    .filter((entry) => countryById.get(entry.buyerId) && countryById.get(entry.sellerId))

  const worldSlots = Math.min(worldRanked.length, Math.max(3, Math.floor(limit * 0.45)))
  const playerSlots = Math.min(playerRanked.length, limit - worldSlots)
  const finalWorldSlots = Math.min(worldRanked.length, limit - playerSlots)

  const routes: MapRoute[] = playerRanked.slice(0, playerSlots).map((country, index) => {
    const trade = byPartner.get(country.id)!
    const geometry = routeGeometry(player.map.centroid, country.map.centroid, index)
    const kind: MapRouteKind =
      trade.imports > 0 && trade.exports > 0 ? 'mixed' : trade.imports > 0 ? 'import' : 'export'
    return {
      id: `trade-${country.id}`,
      countryId: country.id,
      countryIds: [country.id],
      kind,
      d: geometry.d,
      duration: geometry.duration,
      delay: -(index * 0.62),
    }
  })

  worldRanked.slice(0, finalWorldSlots).forEach((entry, index) => {
    const buyer = countryById.get(entry.buyerId)!
    const seller = countryById.get(entry.sellerId)!
    const geometry = routeGeometry(seller.map.centroid, buyer.map.centroid, routes.length + index)
    routes.push({
      id: `world-trade-${buyer.id}-${seller.id}`,
      countryId: buyer.id,
      countryIds: [buyer.id, seller.id],
      kind: 'world',
      d: geometry.d,
      duration: geometry.duration,
      delay: -(index * 0.62),
    })
  })

  return routes
}
