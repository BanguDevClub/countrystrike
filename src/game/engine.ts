import {
  ACTIONS_PER_TURN,
  AUTO_DEAL_DURATION,
  AUTO_DEAL_MIN_QUANTITY,
  BUDGET_MULTIPLIERS,
  GOVERNMENT_BY_ID,
  HISTORY_LIMIT,
  MINISTRY_IDS,
  RESOURCE_BY_ID,
  RESOURCE_IDS,
  UNIT_BY_ID,
  UNIT_IDS,
} from './constants'
import type {
  BudgetBreakdown,
  Country,
  CountrySnapshot,
  Difficulty,
  GameState,
  HistoryPoint,
  IndustryAction,
  LogCategory,
  LogEntry,
  ResourceFlow,
  ResourceId,
  TradePricing,
  UnitId,
} from './types'
import { RNG, clamp, lerp, roundTo, sum } from './rng'
import {
  averageCorruption,
  combinedModifiers,
  computeBudget,
  computeComposites,
  countrySnapshot,
  gdpPerCapita,
  isHostile,
  militaryPower,
  resourceFlows,
  soldiersPer100k,
} from './selectors'
import { eventCandidates } from './events'

export const getPlayer = (game: GameState): Country =>
  game.countries.find((country) => country.id === game.playerId) ??
  game.countries.find((country) => country.isPlayer) ??
  game.countries[0]!

export const livingCountries = (game: GameState): Country[] =>
  game.countries.filter((country) => country.status === 'alive')

export const rivalCountries = (game: GameState): Country[] =>
  game.countries.filter((country) => country.status === 'alive' && !country.isPlayer)

export function pushLog(
  game: GameState,
  category: LogCategory,
  message: string,
  country?: Country,
  tone: LogEntry['tone'] = 'neutral',
): void {
  const entry: LogEntry = {
    id: `log-${game.turn}-${game.logs.length}-${Math.floor(Math.random() * 1_000_000)}`,
    turn: game.turn,
    category,
    message,
    countryId: country?.id,
    countryName: country?.name,
    tone,
  }
  game.logs.push(entry)
  if (game.logs.length > 1500) game.logs.splice(0, game.logs.length - 1500)
}

/* ── Prices ────────────────────────────────────────────────────────────── */

function updatePrices(
  game: GameState,
  flows: Map<string, Record<ResourceId, ResourceFlow>>,
  rng: RNG,
): void {
  for (const resourceId of RESOURCE_IDS) {
    const def = RESOURCE_BY_ID[resourceId]
    let supply = 0
    let demand = 0
    for (const country of livingCountries(game)) {
      const flow = flows.get(country.id)?.[resourceId]
      if (!flow) continue
      supply += flow.production
      demand += flow.consumption
    }
    const pressure = demand / Math.max(supply, 0.01)
    const target = def.basePrice * clamp(pressure ** 0.55, 0.55, 2.6)
    const current = game.prices[resourceId] ?? def.basePrice
    const next = clamp(
      lerp(current, target, 0.28) * rng.float(0.975, 1.025),
      def.basePrice * 0.35,
      def.basePrice * 3,
    )
    game.prices[resourceId] = roundTo(next, 2)
  }
}

/* ── Auto deals ────────────────────────────────────────────────────────── */

function autoDealMultiplier(mode: 'off' | TradePricing): number {
  if (mode === 'below') return 0.8
  if (mode === 'above') return 1.25
  return 1
}

function autoDealChance(mode: 'off' | TradePricing): number {
  if (mode === 'off') return 0
  if (mode === 'below') return 1
  if (mode === 'market') return 0.85
  return 0.55
}

function runAutoDeals(game: GameState, player: Country, rng: RNG): void {
  if (player.status !== 'alive') return
  const playerFlows = resourceFlows(player, game.deals, game.prices)
  for (const resourceId of RESOURCE_IDS) {
    const mode = player.autoDeal[resourceId]
    if (mode === 'off') continue

    const flow = playerFlows[resourceId]
    let availableUnits = Math.max(
      0,
      flow.finalBalance > 0
        ? Math.floor(flow.finalBalance)
        : Math.floor((flow.stock - 5) / AUTO_DEAL_DURATION),
    )
    if (availableUnits < AUTO_DEAL_MIN_QUANTITY) continue

    const countriesInNeed = rivalCountries(game).filter((country) => {
      const alreadyHasDeal = game.deals.some(
        (deal) =>
          deal.auto &&
          deal.countryId === country.id &&
          deal.resource === resourceId &&
          deal.remainingTurns > 0,
      )
      if (alreadyHasDeal) return false
      const partnerFlows = resourceFlows(country, game.deals, game.prices)
      const partnerFlow = partnerFlows[resourceId]
      return (
        partnerFlow.finalBalance < -0.1 || (partnerFlow.stock < 5 && partnerFlow.finalBalance <= 0)
      )
    })

    if (countriesInNeed.length === 0) continue

    countriesInNeed.sort((a, b) => {
      const needA = -resourceFlows(a, game.deals, game.prices)[resourceId].finalBalance
      const needB = -resourceFlows(b, game.deals, game.prices)[resourceId].finalBalance
      return needB - needA
    })

    const def = RESOURCE_BY_ID[resourceId]
    const price = roundTo(game.prices[resourceId] * autoDealMultiplier(mode), 2)

    for (const country of countriesInNeed) {
      if (availableUnits < AUTO_DEAL_MIN_QUANTITY) break
      if (!rng.chance(autoDealChance(mode))) continue

      game.deals.push({
        id: `deal-auto-${game.turn}-${country.id}-${resourceId}-${Math.floor(rng.next() * 1_000_000)}`,
        countryId: country.id,
        resource: resourceId,
        direction: 'export',
        quantity: AUTO_DEAL_MIN_QUANTITY,
        unitPrice: price,
        pricing: mode,
        remainingTurns: AUTO_DEAL_DURATION,
        auto: true,
        createdAtTurn: game.turn,
      })
      availableUnits -= AUTO_DEAL_MIN_QUANTITY

      const relGain = mode === 'below' ? 2 : 1
      pushLog(
        game,
        'economy',
        `Auto-deal (${AUTO_DEAL_DURATION} turns): ${AUTO_DEAL_MIN_QUANTITY} ${def.unit} of ${def.name.toLowerCase()} exported to ${country.name} (+${relGain} rel/turn).`,
        country,
        'positive',
      )
    }
  }
}

/* ── AI actions ────────────────────────────────────────────────────────── */

function upgradeResource(
  rng: RNG,
  country: Country,
  game: GameState,
  difficulty: Difficulty,
): ResourceId {
  if (difficulty === 'hard') {
    const flows = resourceFlows(country, game.deals, game.prices)
    const ordered = [...RESOURCE_IDS].sort(
      (a, b) =>
        flows[a].finalBalance / Math.max(1, flows[a].consumption) -
        flows[b].finalBalance / Math.max(1, flows[b].consumption),
    )
    return ordered[0] ?? rng.pick(RESOURCE_IDS)
  }
  return rng.pick(RESOURCE_IDS)
}

function runAiActions(game: GameState, rng: RNG): void {
  const difficulty = game.settings.difficulty
  const actions =
    game.settings.difficulty === 'easy' ? 0 : game.settings.difficulty === 'normal' ? 3 : 5
  if (actions === 0) return
  for (const country of rivalCountries(game)) {
    for (let index = 0; index < actions; index += 1) {
      const roll = rng.next()
      if (roll < 0.3) {
        const resourceId = upgradeResource(rng, country, game, difficulty)
        if (country.resources[resourceId].extractionLevel < 12) {
          country.resources[resourceId].extractionLevel += 1
          pushLog(
            game,
            'industry',
            `${country.name} expands ${RESOURCE_BY_ID[resourceId].name.toLowerCase()} extraction.`,
            country,
          )
        }
      } else if (roll < 0.5) {
        const resourceId = upgradeResource(rng, country, game, difficulty)
        if (country.resources[resourceId].refinementLevel < 12) {
          country.resources[resourceId].refinementLevel += 1
          pushLog(
            game,
            'industry',
            `${country.name} upgrades ${RESOURCE_BY_ID[resourceId].name.toLowerCase()} refining capacity.`,
            country,
          )
        }
      } else if (roll < 0.74) {
        const unitId: UnitId =
          difficulty === 'hard'
            ? 'soldiers'
            : rng.weighted(
                ['soldiers', 'tanks', 'jets', 'warships', 'missiles'] as UnitId[],
                [5, 2, 2, 1, 1],
              )
        const unit = UNIT_BY_ID[unitId]
        const amount = Math.max(1, Math.round(unit.step * rng.float(0.5, 1.8)))
        country.military[unitId] += amount
        country.stats.treasury = Math.max(
          0,
          country.stats.treasury - amount * unit.recruitCost * 0.5,
        )
        pushLog(
          game,
          'military',
          `${country.name} expands its ${unit.name.toLowerCase()} corps by ${amount.toLocaleString('en-US')}.`,
          country,
        )
      } else if (roll < 0.9) {
        country.stats.gdp *= 1 + rng.float(0.001, 0.004)
        country.stats.treasury += country.stats.gdp * 0.0004
        pushLog(
          game,
          'economy',
          `${country.name} announces an industrial investment programme.`,
          country,
        )
      } else {
        const delta = rng.int(-2, 5)
        const player = getPlayer(game)
        country.relations = clamp(country.relations + delta, -100, 100)
        pushLog(
          game,
          'diplomacy',
          delta >= 0
            ? `${country.name} sends a diplomatic note to ${player.name}.`
            : `${country.name} recalls its ambassador from ${player.name}.`,
          country,
          delta >= 0 ? 'positive' : 'negative',
        )
      }
    }
    if (difficulty === 'hard') {
      const deficitResources = RESOURCE_IDS.filter(
        (id) =>
          country.resources[id].stock <
          country.stats.population * RESOURCE_BY_ID[id].civilPerMillion,
      )
      if (deficitResources.length > 0) {
        const id = deficitResources[0]!
        country.resources[id].extractionLevel = Math.min(
          12,
          country.resources[id].extractionLevel + 1,
        )
      }
    }
  }
}

/* ── Relations and attacks ─────────────────────────────────────────────── */

function updateRelations(game: GameState, player: Country, rng: RNG): void {
  const foreignBudget = BUDGET_MULTIPLIERS[player.ministries.foreign.budget]
  const tariffPressure = player.taxes.tariff / 90
  for (const country of rivalCountries(game)) {
    const previous = country.relations
    let delta = rng.float(-0.75, 0.75) - tariffPressure + foreignBudget * 0.25
    delta += (combinedModifiers(country).relation ?? 0) * 0.01

    const activeAutoDeals = game.deals.filter(
      (deal) => deal.auto && deal.countryId === country.id && deal.remainingTurns > 0,
    )
    let autoDealBoost = 0
    for (const deal of activeAutoDeals) {
      autoDealBoost += deal.pricing === 'below' ? 2 : 1
    }
    if (autoDealBoost > 0) {
      delta = Math.max(autoDealBoost, delta + autoDealBoost)
    }

    country.relations = clamp(country.relations + delta, -100, 100)
    const threshold =
      game.settings.difficulty === 'easy'
        ? null
        : game.settings.difficulty === 'normal'
          ? -100
          : -50
    if (threshold !== null && previous > threshold && country.relations <= threshold) {
      pushLog(
        game,
        'diplomacy',
        `${country.name} declares ${player.name} hostile. Relations have collapsed.`,
        country,
        'negative',
      )
    }
    if (previous < 100 && country.relations >= 100) {
      pushLog(
        game,
        'diplomacy',
        `${country.name} reaches full diplomatic alignment with ${player.name}. External approval is now available.`,
        country,
        'positive',
      )
    }
  }
}

function runHostileAttacks(game: GameState, player: Country, rng: RNG): void {
  const aggression =
    game.settings.difficulty === 'easy' ? 0 : game.settings.difficulty === 'normal' ? 0.35 : 0.65
  if (aggression <= 0) return
  for (const country of rivalCountries(game)) {
    if (!isHostile(country, game.settings) || !rng.chance(aggression)) continue
    const attack = militaryPower(country) * rng.float(0.72, 1.3)
    const defense = militaryPower(player) * rng.float(0.8, 1.35) * (1 + player.stats.security / 400)
    if (attack > defense) {
      const stolen = Math.min(player.stats.treasury, player.stats.gdp * rng.float(0.002, 0.008))
      player.stats.treasury = Math.max(0, player.stats.treasury - stolen)
      country.stats.treasury += stolen
      for (const unitId of UNIT_IDS) {
        const loss = Math.max(0, Math.round(player.military[unitId] * rng.float(0.005, 0.03)))
        player.military[unitId] = Math.max(0, player.military[unitId] - loss)
      }
      player.stats.approval = clamp(player.stats.approval - rng.float(1.2, 3.2), 0, 100)
      pushLog(
        game,
        'military',
        `${country.name} launches a cross-border offensive. The treasury loses ${(stolen / 1000).toFixed(1)}B and units are lost.`,
        country,
        'negative',
      )
    } else {
      for (const unitId of UNIT_IDS) {
        const loss = Math.max(0, Math.round(country.military[unitId] * rng.float(0.01, 0.05)))
        country.military[unitId] = Math.max(0, country.military[unitId] - loss)
      }
      country.relations = clamp(country.relations - 3, -100, 100)
      player.stats.approval = clamp(player.stats.approval + 0.8, 0, 100)
      pushLog(
        game,
        'military',
        `${player.name} repels an incursion by ${country.name}. The border holds.`,
        country,
        'positive',
      )
    }
  }
}

/* ── Country economy tick ──────────────────────────────────────────────── */

function updateCountryStats(
  country: Country,
  flows: Record<ResourceId, ResourceFlow>,
  budget: BudgetBreakdown,
  rng: RNG,
): void {
  const modifiers = combinedModifiers(country)
  const government = GOVERNMENT_BY_ID[country.government]
  const highBudgets = MINISTRY_IDS.filter((id) => country.ministries[id].budget === 'high').length
  const lowBudgets = MINISTRY_IDS.filter((id) => country.ministries[id].budget === 'low').length
  const shortages = RESOURCE_IDS.filter((id) => flows[id].shortage > 0).length
  const surplusScore =
    RESOURCE_IDS.reduce((total, id) => {
      const flow = flows[id]
      return total + clamp(flow.finalBalance / Math.max(1, flow.consumption), -1, 1)
    }, 0) / RESOURCE_IDS.length
  const burden = budget.taxBurden

  const approvalDelta =
    0.25 * highBudgets -
    0.24 * lowBudgets -
    Math.max(0, burden - 40) * 0.055 -
    shortages * 1.15 -
    Math.max(0, country.stats.corruption - 40) * 0.012 +
    Math.max(0, country.stats.security - 50) * 0.012 +
    (modifiers.approval ?? 0) * 0.03 +
    (country.stats.gdp > 0 && budget.net > 0 ? 0.2 : -0.2) +
    rng.float(-0.5, 0.5)
  country.stats.approval = clamp(country.stats.approval + approvalDelta, 0, 100)

  const growth =
    0.006 +
    (modifiers.growth ?? 0) * 0.25 +
    highBudgets * 0.0008 -
    lowBudgets * 0.0008 +
    surplusScore * 0.004 -
    Math.max(0, burden - 45) * 0.00022 -
    (country.stats.corruption / 100) * 0.004 +
    (budget.net > 0 ? 0.0015 : -0.0025) +
    rng.float(-0.004, 0.004)
  country.stats.gdp = Math.max(100, country.stats.gdp * (1 + clamp(growth, -0.04, 0.05)))

  const populationGrowth =
    0.0025 +
    (country.stats.hdi - 0.5) * 0.002 +
    (modifiers.growth ?? 0) * 0.1 +
    country.stats.approval / 20_000 -
    country.stats.depression / 30_000
  country.stats.population = Math.max(
    0.3,
    roundTo(country.stats.population * (1 + clamp(populationGrowth, -0.004, 0.02)), 2),
  )

  const healthBudget = BUDGET_MULTIPLIERS[country.ministries.health.budget]
  const hdiTarget = clamp(
    0.28 +
      (gdpPerCapita(country) / 70_000) * 0.42 +
      (healthBudget + 1) * 0.024 +
      country.stats.approval / 900 -
      country.stats.corruption / 1_400,
    0.2,
    0.97,
  )
  country.stats.hdi = roundTo(clamp(lerp(country.stats.hdi, hdiTarget, 0.07), 0.2, 0.98), 3)

  const giniTarget = clamp(
    (government?.giniTarget ?? 38) -
      country.taxes.income * 0.045 +
      (country.taxes.corporate < 12 ? 3 : 0) +
      (country.ministries.health.budget === 'low' ? 2 : 0) +
      (country.government === 'capitalistAnarchy' ? 5 : 0),
    18,
    68,
  )
  country.stats.gini = roundTo(
    clamp(lerp(country.stats.gini, giniTarget, 0.06) + rng.float(-0.2, 0.2), 18, 68),
    1,
  )

  const violenceTarget = clamp(
    0.8 +
      country.stats.gini * 0.055 +
      (100 - country.stats.approval) * 0.028 +
      (100 - country.stats.security) * 0.025,
    0.2,
    40,
  )
  country.stats.violence = roundTo(
    clamp(lerp(country.stats.violence, violenceTarget, 0.09) + rng.float(-0.2, 0.2), 0.2, 40),
    1,
  )

  const depressionTarget = clamp(
    4 +
      (100 - country.stats.approval) * 0.13 +
      (0.7 - country.stats.hdi) * 14 +
      country.stats.violence * 0.25,
    1,
    45,
  )
  country.stats.depression = roundTo(
    clamp(lerp(country.stats.depression, depressionTarget, 0.07) + rng.float(-0.2, 0.2), 1, 45),
    1,
  )

  const interiorBudget = BUDGET_MULTIPLIERS[country.ministries.interior.budget]
  const securityTarget = clamp(
    26 +
      Math.min(30, soldiersPer100k(country) / 18) +
      interiorBudget * 4 -
      country.stats.corruption * 0.24 +
      (modifiers.security ?? 0) * 0.4,
    8,
    98,
  )
  country.stats.security = roundTo(
    clamp(lerp(country.stats.security, securityTarget, 0.16), 0, 100),
    1,
  )

  const corruptionTarget = clamp(
    8 +
      averageCorruption(country) * 0.36 +
      lowBudgets * 2.2 +
      (modifiers.corruption ?? 0) * 0.35 -
      country.stats.security * 0.22,
    2,
    96,
  )
  country.stats.corruption = roundTo(
    clamp(lerp(country.stats.corruption, corruptionTarget, 0.13) + rng.float(-0.25, 0.25), 0, 100),
    1,
  )
}

/* ── History ───────────────────────────────────────────────────────────── */

function captureHistory(
  game: GameState,
  budgetActual: BudgetBreakdown | undefined,
  playerFlows: Record<ResourceId, ResourceFlow> | undefined,
  turnOverride?: number,
): void {
  const player = getPlayer(game)
  const composites = computeComposites(game.countries)
  const countries: Record<string, CountrySnapshot> = {}
  for (const country of livingCountries(game)) {
    const composite = composites.get(country.id)?.score ?? 0
    countries[country.id] = countrySnapshot(country, composite, militaryPower(country))
  }
  const budget = budgetActual ?? computeBudget(player, game.deals, game.prices)
  const flows = playerFlows ?? resourceFlows(player, game.deals, game.prices)
  const resourceHistory = {} as Record<ResourceId, ResourceFlow>
  for (const id of RESOURCE_IDS) {
    resourceHistory[id] = { ...flows[id] }
  }
  const point: HistoryPoint = {
    turn: turnOverride ?? game.turn,
    revenue: budget.totalRevenue,
    expenses: budget.totalExpenses,
    net: budget.net,
    treasury: player.stats.treasury,
    debt: player.stats.debt,
    gdp: player.stats.gdp,
    approval: player.stats.approval,
    hdi: player.stats.hdi,
    gini: player.stats.gini,
    violence: player.stats.violence,
    depression: player.stats.depression,
    prices: { ...game.prices },
    resources: resourceHistory,
    countries,
  }
  game.history.push(point)
  if (game.history.length > HISTORY_LIMIT)
    game.history.splice(0, game.history.length - HISTORY_LIMIT)
}

/** Records a baseline point at turn 0 so charts start with a reference. */
export function seedHistory(game: GameState): void {
  captureHistory(game, undefined, undefined, 0)
}

/* ── Event scheduling ──────────────────────────────────────────────────── */

function generateEvents(game: GameState, rng: RNG): void {
  const player = getPlayer(game)
  if (game.status !== 'playing') return
  const candidates = eventCandidates(game, player).filter(
    (event) => !game.eventQueue.includes(event.id),
  )
  if (candidates.length === 0) return
  const hasConditional = candidates.some((event) => Boolean(event.condition))
  const chance = 0.48 + (hasConditional ? 0.2 : 0) + (game.history.length < 3 ? 0.12 : 0)
  if (!rng.chance(chance)) return
  const weights = candidates.map((event) => Math.max(1, event.weight))
  const first = rng.weighted(candidates, weights)
  game.eventQueue.push(first.id)
  if (candidates.length > 1 && rng.chance(0.22)) {
    const remaining = candidates.filter((event) => event.id !== first.id)
    if (remaining.length > 0) {
      game.eventQueue.push(
        rng.weighted(
          remaining,
          remaining.map((event) => event.weight),
        ).id,
      )
    }
  }
}

/* ── Public: advance one turn ──────────────────────────────────────────── */

export function advanceTurn(game: GameState): GameState {
  const rng = new RNG(game.rngState)
  const player = getPlayer(game)
  if (player.status !== 'alive') {
    game.status = 'won'
    return game
  }

  runAiActions(game, rng)
  runAutoDeals(game, player, rng)

  const actualBudgets = new Map<string, BudgetBreakdown>()
  const flowsByCountry = new Map<string, Record<ResourceId, ResourceFlow>>()
  let playerFlows: Record<ResourceId, ResourceFlow> | undefined

  for (const country of livingCountries(game)) {
    const flows = resourceFlows(country, game.deals, game.prices)
    const budget = computeBudget(country, game.deals, game.prices)
    actualBudgets.set(country.id, budget)
    flowsByCountry.set(country.id, flows)

    for (const resourceId of RESOURCE_IDS) {
      const state = country.resources[resourceId]
      const flow = flows[resourceId]
      state.reserves = roundTo(Math.max(0, state.reserves - flow.production), 1)
      const available = state.stock + flow.finalBalance
      state.stock = roundTo(Math.max(0, available), 1)
      flow.stock = state.stock
      flow.reserves = state.reserves
      flow.shortage = Math.max(0, -available)
    }

    country.stats.treasury += budget.net
    if (country.stats.treasury < 0) {
      country.stats.debt += -country.stats.treasury
      country.stats.treasury = 0
    }

    updateCountryStats(country, flows, budget, rng)
    if (country.id === player.id) playerFlows = flows
  }

  updateRelations(game, player, rng)
  if (player.status === 'alive') runHostileAttacks(game, player, rng)
  updatePrices(game, flowsByCountry, rng)

  for (const deal of game.deals) deal.remainingTurns -= 1
  game.deals = game.deals.filter((deal) => deal.remainingTurns > 0)

  const actual = actualBudgets.get(player.id)
  captureHistory(game, actual, playerFlows)
  pushLog(
    game,
    'economy',
    `Turn ${game.turn} closes: net ${actual && actual.net >= 0 ? '+' : ''}${(actual?.net ?? 0).toFixed(0)}M, treasury ${player.stats.treasury.toFixed(0)}M.`,
    player,
    actual && actual.net >= 0 ? 'positive' : 'negative',
  )

  game.turn += 1
  game.actionsLeft = ACTIONS_PER_TURN
  game.rngState = rng.value

  const aliveRivals = rivalCountries(game)
  if (aliveRivals.length === 0) {
    game.status = 'won'
    game.eventQueue = []
    return game
  }

  generateEvents(game, rng)
  game.rngState = rng.value
  return game
}

/* ── Industry helpers ──────────────────────────────────────────────────── */

export const INDUSTRY_ACTION_FACTORS: Record<IndustryAction, number> = {
  prospect: 0.0006,
  extraction: 0.0016,
  refinement: 0.0026,
  research: 0.004,
}

export const INDUSTRY_ACTION_LABELS: Record<IndustryAction, string> = {
  prospect: 'Prospect fields',
  extraction: 'Upgrade extraction',
  refinement: 'Upgrade refinement',
  research: 'Research stimulus',
}

export function industryActionCost(
  country: Country,
  resourceId: ResourceId,
  action: IndustryAction,
): number {
  const def = RESOURCE_BY_ID[resourceId]
  const state = country.resources[resourceId]
  const levelFactor =
    1 + (state.extractionLevel + state.refinementLevel) * 0.16 + state.advances * 0.32
  const categoryFactor = def.category === 'strategic' ? 2.25 : 1
  const governmentIndustry = 1 - BUDGET_MULTIPLIERS[country.ministries.industry.budget] * 0.05
  const cost =
    country.stats.gdp *
    INDUSTRY_ACTION_FACTORS[action] *
    levelFactor *
    categoryFactor *
    governmentIndustry
  return Math.max(12, roundTo(cost, 2))
}

/* ── Unit helpers ──────────────────────────────────────────────────────── */

export function unitPurchasePlan(
  country: Country,
  unitId: UnitId,
  quantity: number,
): { money: number; resources: Partial<Record<ResourceId, number>>; allowed: boolean } {
  const unit = UNIT_BY_ID[unitId]
  const resources: Partial<Record<ResourceId, number>> = {}
  let allowed = quantity > 0
  for (const [key, amount] of Object.entries(unit.resourceCost)) {
    const id = key as ResourceId
    const total = (amount ?? 0) * quantity
    resources[id] = total
    if ((country.resources[id]?.stock ?? 0) < total) allowed = false
  }
  return { money: unit.recruitCost * quantity, resources, allowed }
}

/* ── Misc helpers used by the store ────────────────────────────────────── */

export function averageWorldApproval(game: GameState): number {
  const countries = livingCountries(game)
  return countries.length > 0
    ? sum(countries.map((country) => country.stats.approval)) / countries.length
    : 0
}

export function totalWorldGdp(game: GameState): number {
  return sum(livingCountries(game).map((country) => country.stats.gdp))
}

export function worldPopulation(game: GameState): number {
  return sum(livingCountries(game).map((country) => country.stats.population))
}
