import {
  BUDGET_MULTIPLIERS,
  COMMERCE_GOODS,
  COMPOSITE_METRICS,
  COMPOSITE_WEIGHT_TOTAL,
  DIFFICULTY_BY_ID,
  GOVERNMENT_BY_ID,
  MINISTRIES,
  MINISTRY_COST_FACTORS,
  RESOURCE_BY_ID,
  RESOURCE_IDS,
  TRAIT_BY_ID,
  UNIT_BY_ID,
  UNIT_IDS,
} from './constants'
import type {
  BudgetBreakdown,
  BudgetLevel,
  CommerceGoodId,
  CommerceGoodSnapshot,
  CommerceSnapshot,
  CompositeMetricKey,
  Country,
  CountrySnapshot,
  Difficulty,
  GameSettings,
  MarketSnapshot,
  ModifierBlock,
  ResourceFlow,
  ResourceId,
  ResourceProduction,
  TaxRates,
  TradeDeal,
  TradePricing,
  UnitId,
} from './types'
import { clamp, roundTo } from './rng'

const SCALAR_MODIFIER_KEYS = [
  'extraction',
  'reserves',
  'consumption',
  'trade',
  'taxEfficiency',
  'militaryUpkeep',
  'research',
  'approval',
  'corruption',
  'security',
  'growth',
  'relation',
] as const

const emptyModifiers = (): ModifierBlock => ({
  extraction: 0,
  reserves: 0,
  consumption: 0,
  trade: 0,
  taxEfficiency: 0,
  militaryUpkeep: 0,
  research: 0,
  approval: 0,
  corruption: 0,
  security: 0,
  growth: 0,
  relation: 0,
  resource: {},
})

function addModifiers(target: ModifierBlock, source: Partial<ModifierBlock>): void {
  for (const key of SCALAR_MODIFIER_KEYS) {
    target[key] += source[key] ?? 0
  }
  if (!source.resource) return
  for (const [resourceId, entry] of Object.entries(source.resource)) {
    if (!entry) continue
    const id = resourceId as ResourceId
    const current = target.resource[id] ?? {}
    target.resource[id] = {
      extraction: (current.extraction ?? 0) + (entry.extraction ?? 0),
      reserves: (current.reserves ?? 0) + (entry.reserves ?? 0),
      consumption: (current.consumption ?? 0) + (entry.consumption ?? 0),
    }
  }
}

/** Culture + biome + weather + bonuses + government, combined into one block. */
export function combinedModifiers(country: Country): ModifierBlock {
  const modifiers = emptyModifiers()
  const traitIds = [country.culture, country.biome, country.weather, ...country.traits]
  for (const traitId of traitIds) {
    const trait = TRAIT_BY_ID[traitId]
    if (trait) addModifiers(modifiers, trait.modifiers)
  }
  const government = GOVERNMENT_BY_ID[country.government]
  if (government) addModifiers(modifiers, government.modifiers)
  return modifiers
}

export function militaryPower(country: Country): number {
  const base = UNIT_IDS.reduce((total, id) => {
    const unit = UNIT_BY_ID[id]
    return total + (country.military[id] ?? 0) * unit.power
  }, 0)
  const defHead = country.ministries.defense?.head
  const defLevel = country.ministries.defense?.level ?? 1
  const defBonus = 1 + (defHead ? (defHead.skill - 50) * 0.001 : 0) + (defLevel - 1) * 0.025
  return Math.max(0, Math.round(base * Math.max(0.7, defBonus)))
}

export function unitUpkeep(country: Country): number {
  const modifiers = combinedModifiers(country)
  const defenseBudget = BUDGET_MULTIPLIERS[country.ministries.defense.budget]
  const budgetFactor = 1 - defenseBudget * 0.04
  const defHead = country.ministries.defense?.head
  const defLevel = country.ministries.defense?.level ?? 1
  const efficiency =
    1 -
    (defHead ? (defHead.skill / 100) * 0.06 : 0) -
    (defLevel - 1) * 0.02 +
    (defHead ? (defHead.corruption / 100) * 0.04 : 0)
  return (
    UNIT_IDS.reduce((total, id) => {
      const unit = UNIT_BY_ID[id]
      return total + (country.military[id] ?? 0) * unit.upkeep
    }, 0) *
    Math.max(0.2, 1 + modifiers.militaryUpkeep) *
    budgetFactor *
    Math.max(0.6, efficiency)
  )
}

export function taxBurden(taxes: TaxRates): number {
  return taxes.corporate * 0.35 + taxes.income * 0.35 + taxes.tariff * 0.05 + taxes.royalty * 0.25
}

/** Corporate tax competitiveness: 20% is neutral, lower rates lift civil capacity, higher rates drag it. */
export function corporateTaxCapacityEffect(taxes: TaxRates): number {
  return clamp((20 - taxes.corporate) * 0.002, -0.03, 0.03)
}

/** Income tax pressure on households: 20% is neutral, low rates ease depression, high rates deepen it. */
export function incomeTaxDepressionEffect(taxes: TaxRates): number {
  return (taxes.income - 20) * 0.18
}

/** Effective collections curve. Peaks at a burden of 40 and tapers on both sides. */
export function lafferAtBurden(burden: number): number {
  return clamp(1 - ((burden - 40) / 70) ** 2, 0.2, 1)
}

export function gdpPerCapita(country: Country): number {
  return country.stats.population > 0 ? country.stats.gdp / country.stats.population : 0
}

export function debtToGdp(country: Country): number {
  return country.stats.gdp > 0 ? (country.stats.debt / country.stats.gdp) * 100 : 0
}

/** Absolute deviation of the market rate from purchasing-power-parity fair value, percent. */
export function currencyGap(country: Country): number {
  const currency = country.currency
  if (!currency || currency.fairRate <= 0) return 0
  return roundTo(Math.abs((currency.rate / currency.fairRate - 1) * 100), 2)
}

/** Stable-currency score: low inflation, low PPP gap and no depreciation rank higher. */
export function currencyStrength(country: Country): number {
  const inflation = Math.max(0, country.stats.inflation ?? 0)
  const gap = currencyGap(country)
  const depreciation = Math.max(0, country.currency?.changePct ?? 0)
  return roundTo(clamp(100 - inflation * 1.6 - gap * 1.2 - depreciation * 0.4, 0, 100), 1)
}

/**
 * Average foreign relations for one country in the living world. The game
 * stores each rival's alignment toward the player, so the player's baseline is
 * the mean rival alignment and every pair is the mean of the two baselines.
 */
export function averageRelationsForCountry(country: Country, countries: Country[]): number {
  const living = countries.filter((entry) => entry.status === 'alive')
  if (living.length <= 1) return country.isPlayer ? 100 : country.relations
  const rivals = living.filter((entry) => !entry.isPlayer)
  const rivalMean =
    rivals.length > 0
      ? rivals.reduce((total, entry) => total + entry.relations, 0) / rivals.length
      : 0
  const baseline = (entry: Country): number => (entry.isPlayer ? rivalMean : entry.relations)
  const own = baseline(country)
  let total = 0
  let count = 0
  for (const other of living) {
    if (other.id === country.id) continue
    total += (own + baseline(other)) / 2
    count += 1
  }
  return roundTo(clamp(total / Math.max(1, count), -100, 100), 1)
}

/** Average external approval standing in the living world, 0–100. */
export function worldApprovalForCountry(country: Country, countries: Country[]): number {
  const living = countries.filter((entry) => entry.status === 'alive')
  if (living.length <= 1) return country.isPlayer ? 100 : country.externalApproval
  const rivals = living.filter((entry) => !entry.isPlayer)
  const rivalMean =
    rivals.length > 0
      ? rivals.reduce((total, entry) => total + entry.externalApproval, 0) / rivals.length
      : 0
  const baseline = (entry: Country): number => (entry.isPlayer ? rivalMean : entry.externalApproval)
  const own = baseline(country)
  let total = 0
  let count = 0
  for (const other of living) {
    if (other.id === country.id) continue
    total += (own + baseline(other)) / 2
    count += 1
  }
  return roundTo(clamp(total / Math.max(1, count), 0, 100), 1)
}

export function debtLimit(country: Country): number {
  const approvalFactor = clamp(0.6 + country.stats.approval / 150, 0.55, 1.25)
  return country.stats.gdp * (0.55 + country.stats.debtRate / 25) * approvalFactor
}

export function hostilityThreshold(difficulty: Difficulty): number | null {
  return DIFFICULTY_BY_ID[difficulty].hostileAt
}

export function isHostile(country: Country, settings: GameSettings): boolean {
  const threshold = hostilityThreshold(settings.difficulty)
  return (
    threshold !== null &&
    country.status === 'alive' &&
    !country.isPlayer &&
    country.relations <= threshold
  )
}

export function relationTone(relations: number): 'positive' | 'neutral' | 'negative' {
  if (relations >= 60) return 'positive'
  if (relations <= 0) return 'negative'
  return 'neutral'
}

export function relationLabel(relations: number): string {
  if (relations >= 100) return 'Allied'
  if (relations >= 60) return 'Friendly'
  if (relations >= 20) return 'Cordial'
  if (relations >= -19) return 'Neutral'
  if (relations >= -49) return 'Strained'
  if (relations >= -79) return 'Hostile'
  return 'At war'
}

export function resourceModifier(
  modifiers: ModifierBlock,
  resourceId: ResourceId,
): { extraction: number; reserves: number; consumption: number } {
  const entry = modifiers.resource[resourceId]
  return {
    extraction: modifiers.extraction + (entry?.extraction ?? 0),
    reserves: modifiers.reserves + (entry?.reserves ?? 0),
    consumption: modifiers.consumption + (entry?.consumption ?? 0),
  }
}

export function resourceProduction(country: Country, resourceId: ResourceId): ResourceProduction {
  const def = RESOURCE_BY_ID[resourceId]
  const state = country.resources[resourceId]
  const modifiers = combinedModifiers(country)
  const resourceMods = resourceModifier(modifiers, resourceId)
  const industryBudget = BUDGET_MULTIPLIERS[country.ministries.industry.budget]
  const indHead = country.ministries.industry?.head
  const indLevel = country.ministries.industry?.level ?? 1
  const budgetFactor =
    1 +
    industryBudget * 0.04 +
    (indHead ? (indHead.skill - 50) * 0.0012 : 0) +
    (indLevel - 1) * 0.025
  const researchBonus = state.researchBonus ?? state.researchLevel * 0.05
  const extractionCapacity = Math.max(
    0,
    state.extractionLevel *
      def.capacityPerLevel *
      Math.max(0.1, 1 + resourceMods.extraction) *
      budgetFactor *
      (1 + researchBonus),
  )
  const refinementCapacity = Math.max(
    0,
    state.refinementLevel *
      def.capacityPerLevel *
      Math.max(0.1, 1 + resourceMods.extraction * 0.55) *
      budgetFactor *
      (1 + researchBonus),
  )
  const advancementMultiplier = 1 + state.advances * 0.15
  const capacity = Math.min(extractionCapacity, refinementCapacity) * advancementMultiplier
  return {
    extractionCapacity,
    refinementCapacity,
    production: Math.max(0, Math.min(capacity, state.reserves)),
  }
}
/**
 * Turn depletion rate for known reserves: base minimum of extraction and refinement,
 * ignoring trait, budget, research and advancement buffs.
 */
export function resourceDepletion(country: Country, resourceId: ResourceId): number {
  const def = RESOURCE_BY_ID[resourceId]
  const state = country.resources[resourceId]
  const baseExtraction = state.extractionLevel * def.capacityPerLevel
  const baseRefinement = state.refinementLevel * def.capacityPerLevel
  return Math.min(baseExtraction, baseRefinement)
}

export function militaryResourceConsumption(country: Country, resourceId: ResourceId): number {
  return UNIT_IDS.reduce((total, id) => {
    const unit = UNIT_BY_ID[id]
    return total + (country.military[id] ?? 0) * (unit.upkeepResources[resourceId] ?? 0)
  }, 0)
}

/**
 * Number of turns remaining until known reserves are exhausted by current depletion rate.
 * Returns null if depletion is 0 or negative (reserves do not deplete).
 * Returns 0 if reserves are already 0 or negative.
 */
export function reserveRunway(reserves: number, depletion: number): number | null {
  if (reserves <= 0) return 0
  if (depletion <= 0) return null
  return reserves / depletion
}

/**
 * Number of turns remaining until stored stock is depleted by net deficit.
 * Returns null if net balance is positive or zero (stock is growing or stable).
 * Returns 0 if stock is already 0 or negative and net balance is negative.
 */
export function stockRunway(stock: number, finalBalance: number): number | null {
  if (finalBalance >= 0) return null
  if (stock <= 0) return 0
  return stock / Math.abs(finalBalance)
}

export function resourceFlows(
  country: Country,
  deals: TradeDeal[],
  prices: Record<ResourceId, number>,
): Record<ResourceId, ResourceFlow> {
  const modifiers = combinedModifiers(country)
  const entries = {} as Record<ResourceId, ResourceFlow>

  for (const resourceId of RESOURCE_IDS) {
    const def = RESOURCE_BY_ID[resourceId]
    const state = country.resources[resourceId]
    const { extractionCapacity, refinementCapacity, production } = resourceProduction(
      country,
      resourceId,
    )
    const depletion = resourceDepletion(country, resourceId)
    const resourceMods = resourceModifier(modifiers, resourceId)
    const civilConsumption =
      country.stats.population * def.civilPerMillion * Math.max(0.1, 1 + resourceMods.consumption)
    const militaryConsumption = militaryResourceConsumption(country, resourceId)
    const consumption = civilConsumption + militaryConsumption

    let imports = 0
    let exports = 0
    for (const deal of deals) {
      if (deal.resource !== resourceId || deal.remainingTurns <= 0) continue
      if (deal.buyerId === country.id) imports += deal.quantity
      if (deal.sellerId === country.id) exports += deal.quantity
    }

    const finalBalance = production + imports - consumption - exports
    const shortage = Math.max(0, -(state.stock + finalBalance))

    entries[resourceId] = {
      production,
      depletion,
      extractionCapacity,
      refinementCapacity,
      civilConsumption,
      militaryConsumption,
      consumption,
      imports,
      exports,
      finalBalance,
      stock: state.stock,
      reserves: state.reserves,
      shortage,
      price: prices[resourceId] ?? def.basePrice,
      reserveRunway: reserveRunway(state.reserves, depletion),
      stockRunway: stockRunway(state.stock, finalBalance),
    }
  }

  return entries
}

export function laborForce(country: Country): number {
  return country.stats.population * 0.0005
}

/**
 * Global market snapshot for every resource. Prices are driven by aggregate
 * deficits, the export volume that actually covers those deficits, stock cover
 * and how quickly reserves are being exhausted.
 */
export function computeMarket(
  countries: Country[],
  flowsByCountry: Map<string, Record<ResourceId, ResourceFlow>>,
  deals: TradeDeal[],
  prices: Record<ResourceId, number>,
  priceMultiplier = 1,
): Record<ResourceId, MarketSnapshot> {
  const market = {} as Record<ResourceId, MarketSnapshot>
  const living = countries.filter((country) => country.status === 'alive')

  for (const resourceId of RESOURCE_IDS) {
    const def = RESOURCE_BY_ID[resourceId]
    let supply = 0
    let demand = 0
    let stock = 0
    let reserves = 0
    let depletion = 0
    let deficit = 0
    let surplus = 0

    for (const country of living) {
      const flow = flowsByCountry.get(country.id)?.[resourceId]
      if (!flow) continue
      supply += Math.max(0, flow.production)
      demand += Math.max(0, flow.consumption)
      stock += Math.max(0, flow.stock)
      reserves += Math.max(0, flow.reserves)
      depletion += Math.max(0, flow.depletion)
      if (flow.consumption > flow.production) deficit += flow.consumption - flow.production
      else surplus += flow.production - flow.consumption
    }

    let exports = 0
    for (const deal of deals) {
      if (deal.resource !== resourceId || deal.remainingTurns <= 0) continue
      exports += Math.max(0, deal.quantity)
    }

    const coveredDeficit = Math.min(deficit, exports)
    const uncoveredDeficit = Math.max(0, deficit - exports)
    const balance = demand / Math.max(supply, 0.01)
    const deficitShare = demand > 0 ? uncoveredDeficit / demand : 0
    const stockTurns = demand > 0 ? stock / demand : 0
    const reserveTurns = depletion > 0 ? reserves / depletion : null
    const stockFactor = clamp(1.18 - clamp(stockTurns, 0, 8) * 0.045, 0.82, 1.18)
    const reserveFactor = clamp(1.12 - (clamp(reserveTurns ?? 240, 0, 240) / 240) * 0.22, 0.9, 1.12)
    const pressure = clamp(
      Math.pow(balance, 0.5) * (1 + deficitShare * 1.8) * stockFactor * reserveFactor,
      0.35,
      3.6,
    )
    const targetPrice = roundTo(def.basePrice * priceMultiplier * pressure, 2)
    const price = roundTo(prices[resourceId] ?? targetPrice, 2)

    market[resourceId] = {
      resource: resourceId,
      price,
      previousPrice: price,
      changePct: 0,
      targetPrice,
      supply,
      demand,
      surplus,
      deficit,
      exports,
      coveredDeficit,
      uncoveredDeficit,
      stock,
      reserves,
      reserveTurns,
      stockTurns,
      pressure,
      trend: 'stable',
    }
  }

  return market
}

export function resourceValuation(flows: Record<ResourceId, ResourceFlow>): {
  productionValue: number
  stockValue: number
  reserveValue: number
} {
  let productionValue = 0
  let stockValue = 0
  let reserveValue = 0
  for (const resourceId of RESOURCE_IDS) {
    const flow = flows[resourceId]
    productionValue += flow.production * flow.price
    stockValue += flow.stock * flow.price
    reserveValue += flow.reserves * flow.price
  }
  return { productionValue, stockValue, reserveValue }
}

/** Service capacity rises with human development and the industrial/finance administration. */
function serviceCapacityFactor(country: Country, goodId: CommerceGoodId): number {
  if (
    goodId !== 'healthcare' &&
    goodId !== 'education' &&
    goodId !== 'transport' &&
    goodId !== 'telecom'
  ) {
    return 1
  }
  const industry = BUDGET_MULTIPLIERS[country.ministries.industry.budget]
  const finance = BUDGET_MULTIPLIERS[country.ministries.finance.budget]
  const health =
    goodId === 'healthcare' ? BUDGET_MULTIPLIERS[country.ministries.health.budget] * 0.12 : 0
  return clamp(
    0.78 + (country.stats.hdi - 0.5) * 0.7 + (industry + finance) * 0.05 + health,
    0.55,
    1.5,
  )
}

/**
 * The citizen checkout: household demand is met from the domestic input
 * available after trade, then priced by coverage. Policy rates move consumer
 * prices and fiscal balances, and the basket feeds GDP, approval, depression
 * and HDI.
 */
export function computeCommerce(
  country: Country,
  flows: Record<ResourceId, ResourceFlow>,
  policyOverride?: Partial<Record<CommerceGoodId, number>>,
): CommerceSnapshot {
  const goods = {} as Record<CommerceGoodId, CommerceGoodSnapshot>
  const population = Math.max(0.1, country.stats.population)
  const currencyRate = Math.max(0.0001, country.currency?.rate ?? 1)
  let weightTotal = 0
  let basketWeighted = 0
  let availabilityWeighted = 0
  let essentialsWeighted = 0
  let essentialsWeightTotal = 0
  let shortageWeighted = 0
  let householdCost = 0
  let taxRevenue = 0
  let subsidyCost = 0
  let importCost = 0
  let exportRevenue = 0

  for (const def of COMMERCE_GOODS) {
    const flow = flows[def.resource]
    const netInput = flow ? Math.max(0, flow.production + flow.imports - flow.exports) : 0
    const domesticSupply =
      (netInput * def.resourceShare * serviceCapacityFactor(country, def.id)) /
      Math.max(0.000001, def.inputPerUnit)
    const demand = population * def.demandPerMillion
    const policy = clamp(
      policyOverride?.[def.id] ?? country.commercePolicy?.[def.id] ?? 0,
      -60,
      120,
    )
    const policyFactor = 1 + policy / 100
    const policyDemandFactor = clamp(1 - (policy / 100) * def.elasticity * 0.55, 0.55, 1.35)
    const effectiveDemand = demand * policyDemandFactor
    const domesticCoverage = domesticSupply / Math.max(effectiveDemand, 0.000001)
    const importCap =
      def.category === 'services' ? 0.4 : def.category === 'manufactured' ? 0.6 : 0.8
    const imported = effectiveDemand * clamp((1 - domesticCoverage) * 0.85, 0, importCap)
    const exported = Math.max(0, domesticSupply - effectiveDemand)
    const supply = domesticSupply + imported
    const coverage = supply / Math.max(effectiveDemand, 0.000001)
    const importedShare = imported / Math.max(effectiveDemand, 0.000001)
    const pricePressure = clamp(
      Math.pow(effectiveDemand / Math.max(supply, 0.000001), def.elasticity) *
        (1 + importedShare * 0.2),
      0.4,
      3,
    )
    const marketPrice = def.basePrice * pricePressure
    const price = marketPrice * policyFactor
    const sold = Math.max(0, Math.min(supply, effectiveDemand))
    const fiscal = marketPrice * sold * (policy / 100)
    const weight = def.demandPerMillion * def.basePrice
    const localPrice = price * currencyRate
    const shortage = Math.max(0, effectiveDemand - supply)
    const goodImportCost = imported * marketPrice
    const goodExportRevenue = exported * marketPrice * 0.95

    goods[def.id] = {
      id: def.id,
      domesticSupply,
      imported,
      exported,
      supply,
      demand,
      effectiveDemand,
      coverage,
      domesticCoverage,
      shortage,
      marketPrice,
      price,
      localPrice,
      fiscal,
      importCost: goodImportCost,
      exportRevenue: goodExportRevenue,
    }

    weightTotal += weight
    basketWeighted += weight * (price / def.basePrice)
    availabilityWeighted += weight * Math.min(1, coverage)
    shortageWeighted += weight * Math.max(0, 1 - coverage)
    householdCost += def.demandPerMillion * price
    if (fiscal >= 0) taxRevenue += fiscal
    else subsidyCost += -fiscal
    importCost += goodImportCost
    exportRevenue += goodExportRevenue
    if (def.essential) {
      essentialsWeighted += weight * Math.min(1, coverage)
      essentialsWeightTotal += weight
    }
  }

  const safeWeight = Math.max(0.0001, weightTotal)
  const basketIndex = (basketWeighted / safeWeight) * 100
  const availability = availabilityWeighted / safeWeight
  const essentialsAvailability = essentialsWeighted / Math.max(0.0001, essentialsWeightTotal)
  const shortageShare = clamp(shortageWeighted / safeWeight, 0, 1)
  const gdpPerCapitaValue = country.stats.gdp / population
  const affordability = clamp((gdpPerCapitaValue * 0.4) / Math.max(1, householdCost), 0.1, 3)
  const inflation = country.stats.inflation ?? 0

  const commerceGrowth = clamp(
    (availability - 0.82) * 0.02 + (affordability - 1.2) * 0.004,
    -0.012,
    0.012,
  )
  const costOfLivingGrowth = -clamp((basketIndex - 100) / 100, -0.15, 0.35) * 0.04
  const inflationGrowth = -clamp((inflation - 4) / 100, 0, 0.4) * 0.05

  return {
    goods,
    basketIndex,
    availability,
    essentialsAvailability,
    shortageShare,
    householdCost,
    affordability,
    taxRevenue,
    subsidyCost,
    importCost,
    exportRevenue,
    fiscalNet: taxRevenue - subsidyCost,
    commerceGrowth,
    costOfLivingGrowth,
    inflationGrowth,
    approvalDelta: clamp(
      (availability - 0.82) * 8 +
        (affordability - 1.2) * 1.2 -
        Math.max(0, basketIndex - 100) * 0.025 -
        Math.max(0, inflation - 5) * 0.12 -
        shortageShare * 4.5,
      -10,
      6,
    ),
    depressionDelta:
      shortageShare * 14 + Math.max(0, inflation - 5) * 0.2 + Math.max(0, basketIndex - 100) * 0.03,
    hdiDelta:
      (availability - 0.8) * 0.06 +
      (affordability - 1.2) * 0.015 -
      shortageShare * 0.05 -
      Math.max(0, inflation - 8) * 0.0015,
  }
}

/**
 * Expected inflation from deficit monetisation, debt service, the sovereign
 * rate, shortages, basket pressure, output growth and FX pass-through.
 * Surpluses, negative rates, appreciation and demand collapse can all push the
 * target below zero into deflation.
 */
export function inflationTarget(
  country: Country,
  commerce: CommerceSnapshot,
  budget: BudgetBreakdown,
  growth = 0,
): number {
  const gdp = Math.max(1, country.stats.gdp)
  const deficitShare = Math.max(0, -budget.net / gdp)
  const surplusShare = Math.max(0, budget.net / gdp)
  const monetisation = country.stats.treasury <= 0 ? 1.8 : 0.6
  const financeLevel = BUDGET_MULTIPLIERS[country.ministries.finance.budget]
  const credibility =
    0.6 + country.stats.approval / 200 + country.stats.security / 200 + financeLevel * 0.06
  const fxChange = clamp(country.currency?.changePct ?? 0, -15, 15)
  const fxPassThrough = fxChange * 0.12
  const debtService = (country.stats.debt * country.stats.debtRate) / 100 / gdp
  const currentInflation = country.stats.inflation ?? 0
  const deflationExpectation = Math.min(0, currentInflation) * 0.25
  const demandDrag = Math.max(0, -growth) * 12
  const depressionDrag = Math.max(0, (country.stats.depression ?? 0) - 12) * 0.03
  const target =
    2.5 +
    deficitShare * 40 * monetisation -
    surplusShare * 35 +
    debtService * 22 +
    country.stats.debtRate * 0.12 +
    commerce.shortageShare * 14 +
    Math.max(0, commerce.basketIndex - 100) * 0.02 +
    growth * 20 +
    fxPassThrough +
    deflationExpectation -
    demandDrag -
    depressionDrag -
    credibility * 1.1 -
    Math.max(0, currentInflation - 8) * 0.3
  return roundTo(clamp(target, -12, 45), 2)
}

export function effectiveTaxCollection(country: Country): number {
  const modifiers = combinedModifiers(country)
  const finance = BUDGET_MULTIPLIERS[country.ministries.finance.budget] * 0.03
  const finHead = country.ministries.finance?.head
  const finLevel = country.ministries.finance?.level ?? 1
  const skillBonus = finHead ? (finHead.skill - 50) * 0.0016 : 0
  const corruptionPenalty = finHead ? (finHead.corruption / 100) * 0.05 : 0
  const levelBonus = (finLevel - 1) * 0.025
  return clamp(
    1 +
      modifiers.taxEfficiency +
      finance +
      skillBonus +
      levelBonus -
      corruptionPenalty -
      country.stats.corruption / 500,
    0.55,
    1.4,
  )
}

export function computeBudget(
  country: Country,
  deals: TradeDeal[],
  prices: Record<ResourceId, number>,
): BudgetBreakdown {
  const flows = resourceFlows(country, deals, prices)
  const commerce = computeCommerce(country, flows)
  const burden = taxBurden(country.taxes)
  const laffer = lafferAtBurden(burden)
  const collection = effectiveTaxCollection(country)
  const modifiers = combinedModifiers(country)
  const gdp = country.stats.gdp

  const corporate = gdp * 0.28 * (country.taxes.corporate / 100) * laffer * collection
  const income = gdp * 0.55 * (country.taxes.income / 100) * laffer * collection

  let importValue = 0
  let exportValue = 0
  let productionValue = 0
  for (const resourceId of RESOURCE_IDS) {
    productionValue += flows[resourceId].production * flows[resourceId].price
  }
  for (const deal of deals) {
    if (deal.remainingTurns <= 0) continue
    const value = deal.quantity * deal.unitPrice
    if (deal.buyerId === country.id) importValue += value
    if (deal.sellerId === country.id) exportValue += value
  }

  const tariffRevenue = Math.min(importValue * (country.taxes.tariff / 100), gdp * 0.18)
  const royaltyRevenue = Math.min(
    productionValue * (country.taxes.royalty / 100) * 0.35,
    gdp * 0.15,
  )

  const revenueLines = [
    {
      key: 'corporate',
      label: 'Corporate tax',
      amount: corporate,
      hint: `${country.taxes.corporate}% of taxable corporate income, after collection efficiency`,
    },
    {
      key: 'income',
      label: 'Income tax',
      amount: income,
      hint: `${country.taxes.income}% of household income, after collection efficiency`,
    },
    {
      key: 'tariff',
      label: 'Import tariffs',
      amount: tariffRevenue,
      hint: `${country.taxes.tariff}% tariff on ${exportValue > 0 ? 'imported' : 'received'} goods`,
    },
    {
      key: 'royalty',
      label: 'Resource royalties',
      amount: royaltyRevenue,
      hint: `${country.taxes.royalty}% royalty share on resource production`,
    },
    {
      key: 'commerce',
      label: 'Commerce levies',
      amount: commerce.taxRevenue,
      hint: 'Consumer taxes on the household checkout',
    },
    {
      key: 'exports',
      label: 'Trade exports',
      amount: exportValue,
      hint: 'Revenue from active export contracts',
    },
  ]

  const ministryLines = MINISTRIES.map((ministry) => ({
    key: ministry.id,
    label: ministry.name.replace('Ministry of ', ''),
    amount: gdp * (MINISTRY_COST_FACTORS[country.ministries[ministry.id].budget] ?? 0.005),
    hint: `${country.ministries[ministry.id].budget} budget · ${ministry.focus.toLowerCase()}`,
  }))

  const publicServices = gdp * 0.08
  const defenseFactor = 1 - BUDGET_MULTIPLIERS[country.ministries.defense.budget] * 0.04
  const upkeep =
    UNIT_IDS.reduce((total, id) => {
      const unit = UNIT_BY_ID[id]
      return total + (country.military[id] ?? 0) * unit.upkeep
    }, 0) *
    Math.max(0.2, 1 + modifiers.militaryUpkeep) *
    defenseFactor

  const interest = country.stats.debt * (country.stats.debtRate / 100)

  const expenseLines = [
    ...ministryLines,
    {
      key: 'military',
      label: 'Military upkeep',
      amount: upkeep,
      hint: 'Personnel, platforms, fuel and maintenance',
    },
    {
      key: 'services',
      label: 'Public services',
      amount: publicServices,
      hint: 'Pensions, transfers and statutory services',
    },
    {
      key: 'subsidies',
      label: 'Consumer subsidies',
      amount: commerce.subsidyCost,
      hint: 'Price supports paid through the household checkout',
    },
    {
      key: 'interest',
      label: country.stats.debtRate < 0 ? 'Debt carry income' : 'Debt interest',
      amount: interest,
      hint:
        country.stats.debtRate < 0
          ? `${country.stats.debtRate.toFixed(1)}% negative rate: lenders pay a carry charge`
          : `${country.stats.debtRate.toFixed(1)}% on outstanding debt`,
    },
    {
      key: 'imports',
      label: 'Trade imports',
      amount: importValue,
      hint: 'Cost of active import contracts',
    },
  ]

  const totalRevenue = revenueLines.reduce((total, line) => total + line.amount, 0)
  const totalExpenses = expenseLines.reduce((total, line) => total + line.amount, 0)
  const net = totalRevenue - totalExpenses
  const treasuryAfterTick = country.stats.treasury + net
  const debtAfterTick = country.stats.debt + (treasuryAfterTick < 0 ? -treasuryAfterTick : 0)

  return {
    revenue: revenueLines,
    expenses: expenseLines,
    totalRevenue,
    totalExpenses,
    net,
    laffer,
    taxBurden: burden,
    debtLimit: debtLimit(country),
    treasuryAfterTick,
    debtAfterTick,
    commerce,
  }
}

const normalize = (value: number, min: number, max: number): number => {
  if (max - min < 1e-9) return 0.5
  return clamp((value - min) / (max - min), 0, 1)
}

const metricValue = (country: Country, key: CompositeMetricKey): number => {
  switch (key) {
    case 'treasury':
      return Math.log10(Math.max(0, country.stats.treasury) + 1)
    case 'debt':
      return Math.log10(Math.max(0, country.stats.debt) + 1)
    case 'gdp':
      return Math.log10(Math.max(1, country.stats.gdp))
    case 'gdpPerCapita':
      return Math.log10(Math.max(1, country.stats.gdp / Math.max(0.1, country.stats.population)))
    case 'pppPerCapita':
      return Math.log10(
        Math.max(
          1,
          country.stats.pppPerCapita || country.stats.gdp / Math.max(0.1, country.stats.population),
        ),
      )
    case 'inflation':
      return Math.max(0, country.stats.inflation ?? 0)
    case 'currency':
      return currencyGap(country)
    case 'relations':
      return country.stats.averageRelations
    case 'externalApproval':
      return country.stats.worldApproval
    case 'population':
      return Math.log10(Math.max(0.1, country.stats.population))
    case 'militaryPower':
      return militaryPower(country)
    case 'approval':
      return country.stats.approval
    case 'hdi':
      return country.stats.hdi
    case 'gini':
      return country.stats.gini
    case 'violence':
      return country.stats.violence
    case 'depression':
      return country.stats.depression
  }
}

export interface CompositeResult {
  score: number
  parts: Record<CompositeMetricKey, number>
}

export interface RankingRow {
  country: Country
  composite: CompositeResult
  power: number
  gdpPerCapita: number
  debtRatio: number
}

export function computeComposites(countries: Country[]): Map<string, CompositeResult> {
  const living = countries.filter((country) => country.status === 'alive')
  const scores = new Map<string, CompositeResult>()
  if (living.length === 0) return scores

  const ranges = new Map<CompositeMetricKey, { min: number; max: number }>()
  for (const metric of COMPOSITE_METRICS) {
    let min = Infinity
    let max = -Infinity
    for (const country of living) {
      const value = metricValue(country, metric.key)
      min = Math.min(min, value)
      max = Math.max(max, value)
    }
    ranges.set(metric.key, { min, max })
  }

  for (const country of living) {
    const parts = {} as Record<CompositeMetricKey, number>
    let score = 0
    for (const metric of COMPOSITE_METRICS) {
      const value = metricValue(country, metric.key)
      const range = ranges.get(metric.key) ?? { min: 0, max: 0 }
      let normalized = normalize(value, range.min, range.max)
      if (metric.direction === 'low') normalized = 1 - normalized
      parts[metric.key] = normalized
      score += normalized * metric.weight
    }
    scores.set(country.id, { score: clamp(score / (COMPOSITE_WEIGHT_TOTAL / 100), 0, 100), parts })
  }

  return scores
}

export function countrySnapshot(
  country: Country,
  composite: number,
  power: number,
): CountrySnapshot {
  return {
    id: country.id,
    name: country.name,
    gdp: country.stats.gdp,
    population: country.stats.population,
    treasury: country.stats.treasury,
    debt: country.stats.debt,
    approval: country.stats.approval,
    hdi: country.stats.hdi,
    gini: country.stats.gini,
    violence: country.stats.violence,
    depression: country.stats.depression,
    militaryPower: power,
    relations: country.relations,
    externalApproval: country.externalApproval,
    inflation: country.stats.inflation,
    fxRate: country.currency?.rate ?? 1,
    gdpPerCapita: gdpPerCapita(country),
    pppPerCapita: country.stats.pppPerCapita || gdpPerCapita(country),
    currencyGap: currencyGap(country),
    averageRelations: country.stats.averageRelations,
    worldApproval: country.stats.worldApproval,
    composite,
  }
}

export function tradePrice(marketPrice: number, pricing: TradePricing): number {
  const multiplier = pricing === 'below' ? 0.8 : pricing === 'above' ? 1.25 : 1
  return marketPrice * multiplier
}

export function ministryLevel(country: Country, id: keyof Country['ministries']): BudgetLevel {
  return country.ministries[id].budget
}

export function budgetLevelNumber(level: BudgetLevel): number {
  return BUDGET_MULTIPLIERS[level]
}

export function averageCorruption(country: Country): number {
  const values = Object.values(country.ministries).map((ministry) => ministry.head.corruption)
  return values.reduce((total, value) => total + value, 0) / Math.max(1, values.length)
}

export function soldiersPer100k(country: Country): number {
  return country.stats.population > 0
    ? (country.military.soldiers / (country.stats.population * 1_000_000)) * 100_000
    : 0
}

export function resourceStatus(flow: ResourceFlow): 'surplus' | 'deficit' | 'balanced' {
  const threshold = Math.max(0.5, flow.consumption * 0.03)
  if (flow.finalBalance > threshold) return 'surplus'
  if (flow.finalBalance < -threshold) return 'deficit'
  return 'balanced'
}

export function populationInMillions(country: Country): number {
  return country.stats.population
}

export const totalUnitCount = (country: Country): number =>
  UNIT_IDS.reduce((total, id) => total + (country.military[id] ?? 0), 0)

export function taxLabel(key: keyof TaxRates): string {
  switch (key) {
    case 'corporate':
      return 'Corporate tax'
    case 'income':
      return 'Income tax'
    case 'tariff':
      return 'Import tariff'
    case 'royalty':
      return 'Resource royalty'
  }
}

export function powerShare(country: Country, countries: Country[]): number {
  const own = militaryPower(country)
  const total = countries
    .filter((entry) => entry.status === 'alive')
    .reduce((sum, entry) => sum + militaryPower(entry), 0)
  return total > 0 ? (own / total) * 100 : 0
}

export function totalMilitaryUnits(country: Country): Record<UnitId, number> {
  return { ...country.military }
}
