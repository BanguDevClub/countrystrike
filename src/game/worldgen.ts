import {
  ACTIONS_PER_TURN,
  BIOMES,
  BONUS_TRAITS,
  CAPITAL_ROOTS,
  CAPITAL_SUFFIXES,
  CELL_COLORS,
  CONTINENT_LAYOUTS,
  CONTINENT_NAMES,
  COUNTRY_ROOTS,
  COUNTRY_SUFFIXES,
  CULTURES,
  FIRST_NAMES,
  GAME_NAME,
  GOVERNMENTS,
  LAST_NAMES,
  MAP_HEIGHT,
  MAP_WIDTH,
  MINISTRIES,
  RESOURCE_BY_ID,
  RESOURCE_IDS,
  SAVE_VERSION,
  UNIT_BY_ID,
  UNIT_IDS,
  WEATHERS,
} from './constants'
import type {
  AutoDealMode,
  Continent,
  Country,
  CountryStats,
  GameSettings,
  GameState,
  LogEntry,
  Ministry,
  MinistryId,
  ModifierBlock,
  ResourceId,
  ResourceState,
  TaxRates,
  UnitId,
} from './types'
import { RNG, clamp, randomSeed, roundTo } from './rng'
import { combinedModifiers, resourceModifier } from './selectors'

/* ── Name helpers ──────────────────────────────────────────────────────── */

function pickUniqueName(rng: RNG, used: Set<string>): string {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const name = `${rng.pick(COUNTRY_ROOTS)}${rng.pick(COUNTRY_SUFFIXES)}`
    if (!used.has(name)) {
      used.add(name)
      return name
    }
  }
  let index = 1
  while (used.has(`Aurelia ${index}`)) index += 1
  const fallback = `Aurelia ${index}`
  used.add(fallback)
  return fallback
}

function makeCapital(rng: RNG): string {
  return `${rng.pick(CAPITAL_ROOTS)}${rng.pick(CAPITAL_SUFFIXES)}`
}

function makePerson(rng: RNG): string {
  return `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`
}

function makeCode(name: string, used: Set<string>): string {
  const letters = name.replace(/[^a-zA-Z]/g, '').toUpperCase()
  let code = (letters.slice(0, 3) || 'NAT').padEnd(3, 'X')
  let suffix = 1
  while (used.has(code)) {
    code = `${letters.slice(0, 2) || 'NA'}${suffix}`
    suffix += 1
  }
  used.add(code)
  return code
}

/* ── Geometry ──────────────────────────────────────────────────────────── */

type Point = [number, number]

function ellipsePolygon(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rotation: number,
  segments = 56,
): Point[] {
  const radians = (rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const points: Point[] = []
  for (let i = 0; i < segments; i += 1) {
    const angle = (Math.PI * 2 * i) / segments
    const x = rx * Math.cos(angle)
    const y = ry * Math.sin(angle)
    points.push([cx + x * cos - y * sin, cy + x * sin + y * cos])
  }
  return points
}

/** Sutherland–Hodgman clip of a convex polygon by the half-plane n·p ≤ c. */
function clipHalfPlane(polygon: Point[], nx: number, ny: number, c: number): Point[] {
  if (polygon.length === 0) return []
  const output: Point[] = []
  const epsilon = 1e-9

  for (let i = 0; i < polygon.length; i += 1) {
    const current = polygon[i] as Point
    const next = polygon[(i + 1) % polygon.length] as Point
    const currentDistance = nx * current[0] + ny * current[1] - c
    const nextDistance = nx * next[0] + ny * next[1] - c

    if (currentDistance <= epsilon) output.push(current)
    if (currentDistance <= epsilon !== nextDistance <= epsilon) {
      const denominator = currentDistance - nextDistance
      if (Math.abs(denominator) > epsilon) {
        const t = currentDistance / denominator
        output.push([
          current[0] + (next[0] - current[0]) * t,
          current[1] + (next[1] - current[1]) * t,
        ])
      }
    }
  }
  return output
}

function voronoiCells(seeds: Point[], boundary: Point[]): Point[][] {
  return seeds.map((site) => {
    let polygon = boundary
    for (const other of seeds) {
      if (site === other) continue
      const nx = other[0] - site[0]
      const ny = other[1] - site[1]
      const c = (other[0] ** 2 + other[1] ** 2 - site[0] ** 2 - site[1] ** 2) / 2
      polygon = clipHalfPlane(polygon, nx, ny, c)
      if (polygon.length === 0) break
    }
    return polygon
  })
}

function polygonCentroid(polygon: Point[]): Point {
  if (polygon.length === 0) return [0, 0]
  let twiceArea = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < polygon.length; i += 1) {
    const [x1, y1] = polygon[i] as Point
    const [x2, y2] = polygon[(i + 1) % polygon.length] as Point
    const cross = x1 * y2 - x2 * y1
    twiceArea += cross
    cx += (x1 + x2) * cross
    cy += (y1 + y2) * cross
  }
  if (Math.abs(twiceArea) < 1e-7) {
    const total = polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0])
    return [total[0] / polygon.length, total[1] / polygon.length]
  }
  return [cx / (3 * twiceArea), cy / (3 * twiceArea)]
}

function pointIsInsidePolygon(point: Point, polygon: Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i] as Point
    const [xj, yj] = polygon[j] as Point
    const intersects = yi > point[1] !== yj > point[1]
    if (intersects && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

const biomeFill: Record<string, string> = {
  tundra: '#8096a3',
  desert: '#b09a6d',
  tropical: '#6d9068',
  temperate: '#829b6d',
  alpine: '#858c9b',
  coastal: '#638d96',
  steppe: '#9a9364',
}

/* ── Country construction ──────────────────────────────────────────────── */

function emptyResources(): Record<ResourceId, ResourceState> {
  return RESOURCE_IDS.reduce(
    (result, id) => {
      result[id] = {
        reserves: 0,
        extractionLevel: 1,
        refinementLevel: 1,
        stock: 0,
        advances: 0,
        researchLevel: 0,
        researchBonus: 0,
      }
      return result
    },
    {} as Record<ResourceId, ResourceState>,
  )
}

function emptyMilitary(): Record<UnitId, number> {
  return UNIT_IDS.reduce(
    (result, id) => {
      result[id] = 0
      return result
    },
    {} as Record<UnitId, number>,
  )
}

function governmentMilitaryBias(government: string): number {
  if (government === 'empire' || government === 'dictatorship') return 1.45
  if (government === 'kingdom') return 1.15
  if (government === 'communistAnarchy') return 1.1
  return 1
}

function makeMinistries(rng: RNG): Record<MinistryId, Ministry> {
  const ministries = {} as Record<MinistryId, Ministry>
  for (const ministry of MINISTRIES) {
    const budgetRoll = rng.next()
    const budget = budgetRoll < 0.14 ? 'low' : budgetRoll > 0.84 ? 'high' : 'normal'
    ministries[ministry.id] = {
      head: {
        name: makePerson(rng),
        corruption: rng.int(8, 74),
        loyalty: rng.int(36, 96),
        skill: rng.int(28, 88),
      },
      budget,
      level: 1,
      upgrades: [],
    }
  }
  return ministries
}

function makeTaxes(rng: RNG): TaxRates {
  return {
    corporate: rng.int(8, 38),
    income: rng.int(8, 40),
    tariff: rng.int(0, 30),
    royalty: rng.int(3, 35),
  }
}

function makeMilitary(rng: RNG, government: string, culture: string): Record<UnitId, number> {
  const bias = governmentMilitaryBias(government) * (culture === 'martial' ? 1.3 : 1)
  const military = emptyMilitary()
  military.soldiers = Math.round((rng.int(8, 90) * 1_000 * bias) / 1_000) * 1_000
  military.tanks = Math.round(rng.int(0, 260) * bias)
  military.jets = Math.round(rng.int(0, 18) * bias)
  military.warships = Math.round(rng.int(0, 5) * bias)
  military.missiles = Math.round(rng.int(0, 40) * bias)
  military.nukes = rng.next() < 0.06 ? rng.int(1, 2) : 0
  return military
}

function makeResources(
  rng: RNG,
  country: Country,
  modifiers: ModifierBlock,
): Record<ResourceId, ResourceState> {
  const resources = emptyResources()
  for (const resourceId of RESOURCE_IDS) {
    const def = RESOURCE_BY_ID[resourceId]
    const mods = resourceModifier(modifiers, resourceId)
    const civil =
      country.stats.population * def.civilPerMillion * Math.max(0.1, 1 + mods.consumption)
    const military = UNIT_IDS.reduce((total, unitId) => {
      const unit = UNIT_BY_ID[unitId]
      return total + (country.military[unitId] ?? 0) * (unit.upkeepResources[resourceId] ?? 0)
    }, 0)
    const consumption = civil + military
    const targetProduction = Math.max(
      def.capacityPerLevel * 0.7,
      consumption * rng.float(0.72, 1.38),
    )
    const extractionFactor = Math.max(0.25, 1 + mods.extraction)
    const extractionLevel = clamp(
      Math.round(targetProduction / (def.capacityPerLevel * extractionFactor)),
      1,
      10,
    )
    const refinementLevel = clamp(Math.round(extractionLevel * rng.float(0.82, 1.14)), 1, 10)
    const reserveFactor =
      (def.category === 'commodity' ? rng.float(55, 190) : rng.float(28, 95)) *
      Math.max(0.2, 1 + mods.reserves)
    const reserves = Math.max(
      def.capacityPerLevel * 25,
      extractionLevel * def.capacityPerLevel * reserveFactor,
    )
    const stock = Math.max(10, consumption * rng.float(1.3, 3.2) + rng.float(5, 40))
    const researchLevel = rng.next() < 0.24 ? rng.int(1, 2) : 0
    const advances = rng.next() < 0.14 ? 1 : 0
    resources[resourceId] = {
      reserves: roundTo(reserves, 1),
      extractionLevel,
      refinementLevel,
      stock: roundTo(stock, 1),
      advances,
      researchLevel,
      researchBonus: researchLevel * 0.05,
    }
  }
  return resources
}

function chooseTraits(rng: RNG): {
  culture: string
  biome: string
  weather: string
  traits: string[]
} {
  const culture = rng.pick(CULTURES).id
  const biome = rng.pick(BIOMES).id
  const weather = rng.pick(WEATHERS).id
  const traits = rng.sample(BONUS_TRAITS, 2).map((trait) => trait.id)
  return { culture, biome, weather, traits }
}

function initAutoDeals(): Record<ResourceId, AutoDealMode> {
  return RESOURCE_IDS.reduce(
    (result, id) => {
      result[id] = 'off'
      return result
    },
    {} as Record<ResourceId, AutoDealMode>,
  )
}

function generateCountry(
  rng: RNG,
  settings: GameSettings,
  continentId: string,
  usedNames: Set<string>,
  usedCodes: Set<string>,
  config: { culture: string; biome: string; weather: string; traits: string[] },
  mapData: { seed: Point; polygon: Point[]; centroid: Point; color: string },
  index: number,
): Country {
  const traits = config
  const government = rng.pick(GOVERNMENTS).id
  const population = roundTo(rng.float(2.2, 62) ** 1.02, 1)
  const cultureBias =
    traits.culture === 'scholarly' ? 6_000 : traits.culture === 'industrial' ? 4_000 : 0
  const gdpPerCapita = roundTo(rng.float(7_500, 43_000) + cultureBias, 0)
  const gdp = population * gdpPerCapita

  const name = pickUniqueName(rng, usedNames)
  const stats: CountryStats = {
    population,
    gdp,
    treasury: gdp * rng.float(0.035, 0.11),
    debt: gdp * rng.float(0.25, 0.82),
    debtRate: roundTo(rng.float(3, 12), 1),
    approval: 50,
    hdi: 0.62,
    gini: 38,
    violence: 4,
    depression: 9,
    security: 55,
    corruption: 40,
  }

  const country: Country = {
    id: `country-${index + 1}`,
    name,
    capital: makeCapital(rng),
    code: makeCode(name, usedCodes),
    continentId,
    culture: traits.culture,
    biome: traits.biome,
    weather: traits.weather,
    traits: traits.traits,
    government,
    isPlayer: false,
    status: 'alive',
    flagSeed: rng.int(1, 999_999),
    map: {
      seed: mapData.seed,
      centroid: mapData.centroid,
      polygon: mapData.polygon,
      color: mapData.color,
    },
    stats,
    taxes: makeTaxes(rng),
    ministries: makeMinistries(rng) as Country['ministries'],
    resources: emptyResources(),
    military: makeMilitary(rng, government, traits.culture),
    relations: 0,
    externalApproval: 0,
    autoDeal: initAutoDeals(),
  }

  const modifiers = combinedModifiers(country)
  country.resources = makeResources(rng, country, modifiers)

  const gov = GOVERNMENTS.find((entry) => entry.id === government)
  country.stats.approval = clamp(rng.int(34, 74) + (modifiers.approval ?? 0), 12, 92)
  country.stats.hdi = roundTo(
    clamp(
      0.36 +
        (gdpPerCapita / 48_000) * 0.42 +
        rng.float(-0.04, 0.08) +
        (modifiers.research ?? 0) * 0.15,
      0.25,
      0.95,
    ),
    3,
  )
  country.stats.gini = roundTo(clamp((gov?.giniTarget ?? 38) + rng.float(-8, 8), 20, 66), 1)
  country.stats.violence = roundTo(
    clamp(
      0.7 + country.stats.gini * 0.055 + (100 - country.stats.approval) * 0.03 + rng.float(-1, 2),
      0.2,
      35,
    ),
    1,
  )
  country.stats.depression = roundTo(
    clamp(
      3 + (100 - country.stats.approval) * 0.11 + (0.7 - country.stats.hdi) * 16 + rng.float(-1, 2),
      0.5,
      45,
    ),
    1,
  )
  country.stats.security = roundTo(
    clamp(
      32 +
        (country.military.soldiers / (country.stats.population * 1_000_000)) * 100_000 * 0.035 +
        (modifiers.security ?? 0) +
        rng.float(-10, 14),
      10,
      96,
    ),
    1,
  )
  country.stats.corruption = roundTo(
    clamp(
      18 + (modifiers.corruption ?? 0) + (100 - country.stats.security) * 0.18 + rng.float(-8, 12),
      4,
      92,
    ),
    1,
  )

  const relationRoll = rng.int(-18, 55) + Math.round(modifiers.relation ?? 0)
  country.relations =
    settings.difficulty === 'easy' ? Math.max(0, relationRoll) : clamp(relationRoll, -100, 100)

  return country
}

/* ── Continent/country placement ───────────────────────────────────────── */

function distributeCounts(total: number, buckets: number): number[] {
  const safeBuckets = Math.max(1, Math.min(buckets, total))
  const base = Math.floor(total / safeBuckets)
  const remainder = total % safeBuckets
  const counts = Array.from({ length: safeBuckets }, (_, index) =>
    index < remainder ? base + 1 : base,
  )
  while (counts.length < buckets) counts.push(0)
  return counts
}

function createMap(
  rng: RNG,
  countryCount: number,
  continentCount: number,
  countryConfigs: { culture: string; biome: string }[],
): {
  continents: Continent[]
  mapCells: {
    seed: Point
    polygon: Point[]
    centroid: Point
    color: string
    continentId: string
  }[]
} {
  const safeContinents = Math.max(1, Math.min(continentCount, countryCount, 5))
  const slots = CONTINENT_LAYOUTS[safeContinents] ?? CONTINENT_LAYOUTS[1]!
  const counts = distributeCounts(countryCount, safeContinents)
  const continents: Continent[] = []
  const mapCells: {
    seed: Point
    polygon: Point[]
    centroid: Point
    color: string
    continentId: string
  }[] = []
  const usedContinentNames = new Set<string>()

  for (let continentIndex = 0; continentIndex < safeContinents; continentIndex += 1) {
    const slot = slots[continentIndex]!
    const localBoundary = ellipsePolygon(slot.cx, slot.cy, slot.rx, slot.ry, slot.rot)
    let name = rng.pick(CONTINENT_NAMES)
    let nameAttempts = 0
    while (usedContinentNames.has(name) && nameAttempts < 50) {
      name = rng.pick(CONTINENT_NAMES)
      nameAttempts += 1
    }
    if (usedContinentNames.has(name)) name = `${name} ${continentIndex + 1}`
    usedContinentNames.add(name)

    const continent: Continent = {
      id: `continent-${continentIndex + 1}`,
      name,
      polygon: localBoundary.map(([x, y]) => [roundTo(x, 1), roundTo(y, 1)] as Point),
      center: [slot.cx, slot.cy],
      label: [slot.cx, Math.max(30, slot.cy - slot.ry - 14)],
      color: '#4c6b60',
    }
    continents.push(continent)

    const count = counts[continentIndex] ?? 0
    if (count === 0) continue
    const seeds: Point[] = []
    const cos = Math.cos((slot.rot * Math.PI) / 180)
    const sin = Math.sin((slot.rot * Math.PI) / 180)
    const localPoints: Point[] = []

    if (count === 1) {
      localPoints.push([slot.cx, slot.cy])
    } else {
      for (let attempt = 0; attempt < 800 && localPoints.length < count; attempt += 1) {
        const angle = rng.float(0, Math.PI * 2)
        const radius = Math.sqrt(rng.next()) * 0.78
        const x = slot.cx + Math.cos(angle) * slot.rx * radius
        const y = slot.cy + Math.sin(angle) * slot.ry * radius
        const minDistance = Math.min(slot.rx, slot.ry) * 0.18
        if (localPoints.every(([px, py]) => Math.hypot(px - x, py - y) > minDistance)) {
          localPoints.push([x, y])
        }
      }
      // Fallback ring if the rejection sampler could not place every seed.
      while (localPoints.length < count) {
        const angle = (Math.PI * 2 * localPoints.length) / count
        localPoints.push([
          slot.cx + Math.cos(angle) * slot.rx * 0.55,
          slot.cy + Math.sin(angle) * slot.ry * 0.55,
        ])
      }
    }

    for (const point of localPoints) {
      const dx = point[0] - slot.cx
      const dy = point[1] - slot.cy
      seeds.push([slot.cx + dx * cos - dy * sin, slot.cy + dx * sin + dy * cos])
    }

    const cells = voronoiCells(seeds, localBoundary)
    cells.forEach((cellPolygon, cellIndex) => {
      const config = countryConfigs[mapCells.length] ?? countryConfigs[0]
      const seed = seeds[cellIndex] as Point
      let centroid = polygonCentroid(cellPolygon)
      if (!pointIsInsidePolygon(centroid, cellPolygon)) centroid = seed
      if (
        centroid[0] < 12 ||
        centroid[0] > MAP_WIDTH - 12 ||
        centroid[1] < 12 ||
        centroid[1] > MAP_HEIGHT - 12
      ) {
        centroid = [clamp(centroid[0], 18, MAP_WIDTH - 18), clamp(centroid[1], 18, MAP_HEIGHT - 18)]
      }
      const color =
        biomeFill[config?.biome ?? 'temperate'] ?? CELL_COLORS[cellIndex % CELL_COLORS.length]!
      mapCells.push({
        seed: [roundTo(seed[0], 1), roundTo(seed[1], 1)],
        polygon: cellPolygon.map(([x, y]) => [roundTo(x, 1), roundTo(y, 1)] as Point),
        centroid: [roundTo(centroid[0], 1), roundTo(centroid[1], 1)],
        color,
        continentId: continent.id,
      })
    })
  }

  return { continents, mapCells }
}

/* ── Main entry ────────────────────────────────────────────────────────── */

export function generateWorld(settings: GameSettings, seed = randomSeed()): GameState {
  const rng = new RNG(seed)
  const countryCount = clamp(Math.round(settings.countries), 10, 20)
  const continentCount = clamp(Math.round(settings.continents), 1, 5)
  const usedNames = new Set<string>()
  const usedCodes = new Set<string>()

  // Generate traits once so the map colour and the country dossier agree.
  const configs = Array.from({ length: countryCount }, () => chooseTraits(rng))
  const { continents, mapCells } = createMap(rng, countryCount, continentCount, configs)

  const countries: Country[] = []
  mapCells.forEach((cell, index) => {
    countries.push(
      generateCountry(
        rng,
        settings,
        cell.continentId,
        usedNames,
        usedCodes,
        configs[index]!,
        cell,
        index,
      ),
    )
  })

  // Pick a player country, favouring a median-sized nation for a readable start.
  const sorted = [...countries].sort((a, b) => a.stats.gdp - b.stats.gdp)
  const median = sorted[Math.floor(sorted.length / 2)] ?? countries[0]!
  const player = rng.next() < 0.65 ? median : rng.pick(countries)
  player.isPlayer = true
  player.relations = 100
  player.externalApproval = 0
  player.stats.treasury = Math.max(player.stats.treasury, player.stats.gdp * 0.06)
  player.military.soldiers = Math.max(player.military.soldiers, 24_000)
  player.military.tanks = Math.max(player.military.tanks, 40)
  player.military.jets = Math.max(player.military.jets, 4)
  player.autoDeal = RESOURCE_IDS.reduce(
    (result, id) => {
      result[id] = 'off'
      return result
    },
    {} as Record<ResourceId, AutoDealMode>,
  )

  for (const country of countries) {
    if (country.id !== player.id) country.relations = clamp(country.relations, -100, 100)
  }

  const prices = RESOURCE_IDS.reduce(
    (result, id) => {
      result[id] = roundTo(RESOURCE_BY_ID[id].basePrice * rng.float(0.86, 1.16), 2)
      return result
    },
    {} as Record<ResourceId, number>,
  )

  const logs: LogEntry[] = [
    {
      id: 'log-1',
      turn: 1,
      category: 'world',
      message: `A new ${GAME_NAME} world is drawn: ${countryCount} nations across ${continents.length} continent${continents.length === 1 ? '' : 's'}.`,
      tone: 'neutral',
    },
    {
      id: 'log-2',
      turn: 1,
      category: 'governance',
      message: `${player.name} enters a new political era under a ${GOVERNMENTS.find((g) => g.id === player.government)?.name ?? 'new government'}.`,
      countryId: player.id,
      countryName: player.name,
      tone: 'positive',
    },
  ]

  return {
    version: SAVE_VERSION,
    seed: seed >>> 0,
    rngState: rng.value,
    createdAt: Date.now(),
    status: 'playing',
    settings: { ...settings, countries: countryCount, continents: continentCount },
    turn: 1,
    actionsLeft: ACTIONS_PER_TURN,
    playerId: player.id,
    countries,
    continents,
    prices,
    deals: [],
    logs,
    history: [],
    eventQueue: ['inauguration'],
    seenEvents: [],
    lastOutcome: null,
    eventHistory: [],
  }
}
