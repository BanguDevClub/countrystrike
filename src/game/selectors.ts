import {
  BUDGET_MULTIPLIERS,
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
  CompositeMetricKey,
  Country,
  CountrySnapshot,
  Difficulty,
  GameSettings,
  ModifierBlock,
  ResourceFlow,
  ResourceId,
  ResourceProduction,
  TaxRates,
  TradeDeal,
  TradePricing,
  UnitId,
} from './types'
import { clamp } from './rng'

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
  return UNIT_IDS.reduce((total, id) => {
    const unit = UNIT_BY_ID[id]
    return total + (country.military[id] ?? 0) * unit.power
  }, 0)
}

export function unitUpkeep(country: Country): number {
  const modifiers = combinedModifiers(country)
  const defenseBudget = BUDGET_MULTIPLIERS[country.ministries.defense.budget]
  const budgetFactor = 1 - defenseBudget * 0.04
  return (
    UNIT_IDS.reduce((total, id) => {
      const unit = UNIT_BY_ID[id]
      return total + (country.military[id] ?? 0) * unit.upkeep
    }, 0) *
    Math.max(0.2, 1 + modifiers.militaryUpkeep) *
    budgetFactor
  )
}

export function taxBurden(taxes: TaxRates): number {
  return taxes.corporate * 0.35 + taxes.income * 0.35 + taxes.tariff * 0.05 + taxes.royalty * 0.25
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
  const budgetFactor = 1 + industryBudget * 0.04
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

export function militaryResourceConsumption(country: Country, resourceId: ResourceId): number {
  return UNIT_IDS.reduce((total, id) => {
    const unit = UNIT_BY_ID[id]
    return total + (country.military[id] ?? 0) * (unit.upkeepResources[resourceId] ?? 0)
  }, 0)
}

/**
 * Number of turns remaining until known reserves are exhausted by current production.
 * Returns null if production is 0 or negative (reserves do not deplete).
 * Returns 0 if reserves are already 0 or negative.
 */
export function reserveRunway(reserves: number, production: number): number | null {
  if (reserves <= 0) return 0
  if (production <= 0) return null
  return reserves / production
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
    const resourceMods = resourceModifier(modifiers, resourceId)
    const civilConsumption =
      country.stats.population * def.civilPerMillion * Math.max(0.1, 1 + resourceMods.consumption)
    const militaryConsumption = militaryResourceConsumption(country, resourceId)
    const consumption = civilConsumption + militaryConsumption

    let imports = 0
    let exports = 0
    for (const deal of deals) {
      if (deal.resource !== resourceId || deal.remainingTurns <= 0) continue
      if (country.isPlayer) {
        if (deal.direction === 'import') imports += deal.quantity
        else exports += deal.quantity
      } else if (deal.countryId === country.id) {
        if (deal.direction === 'import') exports += deal.quantity
        else imports += deal.quantity
      }
    }

    const finalBalance = production + imports - consumption - exports
    const shortage = Math.max(0, -(state.stock + finalBalance))

    entries[resourceId] = {
      production,
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
      reserveRunway: reserveRunway(state.reserves, production),
      stockRunway: stockRunway(state.stock, finalBalance),
    }
  }

  return entries
}

export function laborForce(country: Country): number {
  return country.stats.population * 0.0005
}

export function effectiveTaxCollection(country: Country): number {
  const modifiers = combinedModifiers(country)
  const finance = BUDGET_MULTIPLIERS[country.ministries.finance.budget] * 0.03
  return clamp(1 + modifiers.taxEfficiency + finance - country.stats.corruption / 500, 0.55, 1.3)
}

export function computeBudget(
  country: Country,
  deals: TradeDeal[],
  prices: Record<ResourceId, number>,
): BudgetBreakdown {
  const flows = resourceFlows(country, deals, prices)
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
    if (country.isPlayer) {
      if (deal.direction === 'import') importValue += value
      else exportValue += value
    } else if (deal.countryId === country.id) {
      if (deal.direction === 'import') exportValue += value
      else importValue += value
    }
  }

  const tariffRevenue = Math.min(importValue * (country.taxes.tariff / 100), gdp * 0.18)
  const royaltyRevenue = productionValue * (country.taxes.royalty / 100) * 0.35

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
      key: 'interest',
      label: 'Debt interest',
      amount: interest,
      hint: `${country.stats.debtRate.toFixed(1)}% on outstanding debt`,
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
  }
}

const normalize = (value: number, min: number, max: number): number => {
  if (max - min < 1e-9) return 0.5
  return clamp((value - min) / (max - min), 0, 1)
}

const metricValue = (
  country: Pick<Country, 'stats' | 'military'> & { militaryPower?: number },
  key: CompositeMetricKey,
): number => {
  switch (key) {
    case 'treasury':
      return Math.log10(Math.max(0, country.stats.treasury) + 1)
    case 'debt':
      return Math.log10(Math.max(0, country.stats.debt) + 1)
    case 'gdp':
      return Math.log10(Math.max(1, country.stats.gdp))
    case 'population':
      return Math.log10(Math.max(0.1, country.stats.population))
    case 'militaryPower':
      return country.militaryPower ?? militaryPower(country as Country)
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
