import {
  BUDGET_MULTIPLIERS,
  COMPOSITE_METRICS,
  COMPOSITE_WEIGHT_TOTAL,
  DIFFICULTY_BY_ID,
  GOVERNMENT_BY_ID,
  MINISTRIES,
  MINISTRY_COST_FACTORS,
  MINISTRY_IDS,
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

/** Corporate tax competitiveness: 20% is neutral, lower rates lift GDP growth, higher rates drag it. */
export function corporateTaxGrowthEffect(taxes: TaxRates): number {
  return clamp((20 - taxes.corporate) * 0.0008, -0.01, 0.01)
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

export interface GdpDriver {
  key: string
  label: string
  value: number
}

/**
 * Turn growth decomposed into the forces the player can actually influence.
 * The engine adds a small random term on top; everything else is auditable.
 */
export function gdpGrowthDrivers(
  country: Country,
  flows: Record<ResourceId, ResourceFlow>,
  budget: BudgetBreakdown,
): GdpDriver[] {
  const modifiers = combinedModifiers(country)
  const gdp = Math.max(1, country.stats.gdp)
  const highBudgets = MINISTRY_IDS.filter((id) => country.ministries[id].budget === 'high').length
  const lowBudgets = MINISTRY_IDS.filter((id) => country.ministries[id].budget === 'low').length
  const totalIndustryLevel = RESOURCE_IDS.reduce(
    (total, id) =>
      total +
      (country.resources[id]?.extractionLevel ?? 0) +
      (country.resources[id]?.refinementLevel ?? 0),
    0,
  )
  const totalAdvances = RESOURCE_IDS.reduce(
    (total, id) =>
      total +
      (country.resources[id]?.advances ?? 0) * 2 +
      (country.resources[id]?.researchLevel ?? 0),
    0,
  )
  const resourceValue = resourceValuation(flows).productionValue
  const resourceShare = clamp(resourceValue / gdp, 0, 0.8)

  let surplusScore = 0
  let stockCover = 0
  let reserveStress = 0
  let shortageCount = 0
  for (const id of RESOURCE_IDS) {
    const flow = flows[id]
    surplusScore += Math.min(1, Math.max(0, flow.finalBalance / Math.max(1, flow.consumption)))
    stockCover += clamp(flow.stock / Math.max(0.1, flow.consumption), 0, 6) / 6
    if (flow.reserveRunway != null) {
      reserveStress += clamp(1 - flow.reserveRunway / 20, 0, 1)
    }
    if (flow.shortage > 0 || (flow.finalBalance < 0 && (flow.stockRunway ?? 99) < 4)) {
      shortageCount += 1
    }
  }
  surplusScore /= RESOURCE_IDS.length
  stockCover /= RESOURCE_IDS.length
  reserveStress /= RESOURCE_IDS.length

  const debtRatio = debtToGdp(country)
  const treasuryRatio = country.stats.treasury / gdp
  const netRatio = budget.net / gdp
  const burden = budget.taxBurden
  const debtBurden =
    -(Math.max(0, debtRatio - 60) / 100) * 0.008 - (Math.max(0, debtRatio - 120) / 100) * 0.012
  const treasuryStress =
    country.stats.treasury <= 0
      ? -0.005
      : treasuryRatio < 0.01
        ? -0.002
        : treasuryRatio > 0.2
          ? 0.001
          : 0

  return [
    { key: 'base', label: 'Base expansion', value: 0.006 },
    {
      key: 'industry',
      label: 'Industrial scale',
      value: Math.min(0.015, totalIndustryLevel * 0.00015),
    },
    { key: 'advances', label: 'Technology advances', value: totalAdvances * 0.0008 },
    {
      key: 'military',
      label: 'Military demand',
      value: Math.min(0.015, Math.log10(Math.max(1, militaryPower(country))) * 0.0015),
    },
    { key: 'resourceSector', label: 'Resource sector', value: resourceShare * 0.03 },
    { key: 'surplus', label: 'Resource surplus', value: surplusScore * 0.02 },
    { key: 'stock', label: 'Stock buffers', value: stockCover * 0.003 },
    {
      key: 'shortages',
      label: 'Shortages & deficits',
      value: -(shortageCount / RESOURCE_IDS.length) * 0.009,
    },
    { key: 'depletion', label: 'Reserve depletion', value: -reserveStress * 0.005 },
    {
      key: 'fiscal',
      label: 'Fiscal balance',
      value: clamp(netRatio, -0.06, 0.06) * 0.12,
    },
    { key: 'debt', label: 'Debt burden', value: debtBurden },
    { key: 'treasury', label: 'Treasury reserve', value: treasuryStress },
    {
      key: 'tax',
      label: 'Tax burden',
      value: -Math.max(0, burden - 45) * 0.00022,
    },
    {
      key: 'corporateTax',
      label: 'Corporate tax competitiveness',
      value: corporateTaxGrowthEffect(country.taxes),
    },
    {
      key: 'corruption',
      label: 'Corruption drag',
      value: -(country.stats.corruption / 100) * 0.004,
    },
    {
      key: 'policy',
      label: 'Traits & cabinet',
      value: (modifiers.growth ?? 0) * 0.25 + highBudgets * 0.0008 - lowBudgets * 0.0008,
    },
  ]
}

export function gdpGrowthTotal(drivers: GdpDriver[]): number {
  return drivers.reduce((total, driver) => total + driver.value, 0)
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
