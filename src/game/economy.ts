import { COMMERCE_GOOD_IDS, MINISTRY_IDS, RESOURCE_IDS } from './constants'
import type {
  BudgetBreakdown,
  CommerceSnapshot,
  Country,
  EconomyBase,
  GdpComposition,
  ResourceFlow,
  ResourceId,
} from './types'
import { clamp, roundTo } from './rng'
import {
  combinedModifiers,
  corporateTaxCapacityEffect,
  debtToGdp,
  resourceValuation,
} from './selectors'

export interface GdpDriver {
  key: string
  label: string
  /** Level effect on civil capacity, as a fraction of potential output. */
  value: number
}

/** Household final consumption plus net consumer trade, at market prices. */
export function commerceOutput(commerce: CommerceSnapshot): number {
  let value = commerce.exportRevenue - commerce.importCost
  for (const id of COMMERCE_GOOD_IDS) {
    const good = commerce.goods[id]
    if (!good) continue
    value += Math.max(0, Math.min(good.supply, good.effectiveDemand)) * good.marketPrice
  }
  return Math.max(0, value)
}

/** Defense outlays: military upkeep plus the Defense ministry budget. */
export function militaryOutlay(budget: BudgetBreakdown): number {
  const defense = budget.expenses.find((line) => line.key === 'defense')?.amount ?? 0
  const upkeep = budget.expenses.find((line) => line.key === 'military')?.amount ?? 0
  return Math.max(0, defense + upkeep)
}

/**
 * Civil capacity is a level factor, not a per-turn growth rate. Debt, fiscal
 * pressure, shortages and social stress decide how much of the industrial and
 * commercial base can actually operate.
 */
export function gdpCapacityDrivers(
  country: Country,
  flows: Record<ResourceId, ResourceFlow>,
  budget: BudgetBreakdown,
  commerce?: CommerceSnapshot,
): GdpDriver[] {
  const market = commerce ?? budget.commerce
  const modifiers = combinedModifiers(country)
  const gdp = Math.max(1, country.stats.gdp)
  const debtRatio = debtToGdp(country)
  const treasuryRatio = country.stats.treasury / gdp
  const netRatio = budget.net / gdp
  const burden = budget.taxBurden
  const inflation = country.stats.inflation ?? 0
  const highBudgets = MINISTRY_IDS.filter((id) => country.ministries[id].budget === 'high').length
  const lowBudgets = MINISTRY_IDS.filter((id) => country.ministries[id].budget === 'low').length

  let surplusScore = 0
  let stockCover = 0
  let reserveStress = 0
  for (const id of RESOURCE_IDS) {
    const flow = flows[id]
    if (!flow) continue
    surplusScore += Math.min(1, Math.max(0, flow.finalBalance / Math.max(1, flow.consumption)))
    stockCover += clamp(flow.stock / Math.max(0.1, flow.consumption), 0, 6) / 6
    if (flow.reserveRunway != null) {
      reserveStress += clamp(1 - flow.reserveRunway / 20, 0, 1)
    }
  }
  surplusScore /= RESOURCE_IDS.length
  stockCover /= RESOURCE_IDS.length
  reserveStress /= RESOURCE_IDS.length

  const inflationDrag = inflation > 4 ? -clamp((inflation - 4) / 100, 0, 0.4) * 0.35 : 0
  const deflationDrag = inflation < -1 ? -clamp((-1 - inflation) / 100, 0, 0.3) * 0.5 : 0

  return [
    {
      key: 'fiscal',
      label: 'Fiscal balance',
      value: clamp(netRatio, -0.06, 0.06) * 0.5,
    },
    {
      key: 'debt',
      label: 'Debt burden',
      value:
        -(clamp((debtRatio - 60) / 100, 0, 4) * 0.06) - clamp((debtRatio - 120) / 100, 0, 4) * 0.08,
    },
    {
      key: 'treasury',
      label: 'Treasury reserve',
      value:
        country.stats.treasury <= 0
          ? -0.05
          : treasuryRatio < 0.01
            ? -0.02
            : treasuryRatio > 0.2
              ? 0.01
              : 0,
    },
    {
      key: 'tax',
      label: 'Tax burden',
      value: -Math.max(0, burden - 45) * 0.0015,
    },
    {
      key: 'corporateTax',
      label: 'Corporate tax competitiveness',
      value: corporateTaxCapacityEffect(country.taxes),
    },
    {
      key: 'commerce',
      label: 'Consumer availability',
      value: clamp(
        (market.availability - 0.82) * 0.15 + (market.affordability - 1.2) * 0.03,
        -0.06,
        0.06,
      ),
    },
    {
      key: 'costOfLiving',
      label: 'Cost of living',
      value: -clamp((market.basketIndex - 100) / 100, -0.15, 0.35) * 0.3,
    },
    { key: 'inflation', label: 'Inflation drag', value: inflationDrag },
    { key: 'deflation', label: 'Deflation drag', value: deflationDrag },
    {
      key: 'shortages',
      label: 'Shortages & deficits',
      value: -market.shortageShare * 0.2,
    },
    { key: 'depletion', label: 'Reserve depletion', value: -reserveStress * 0.03 },
    { key: 'surplus', label: 'Resource surplus', value: surplusScore * 0.02 },
    { key: 'stock', label: 'Stock buffers', value: stockCover * 0.005 },
    {
      key: 'corruption',
      label: 'Corruption drag',
      value: -(country.stats.corruption / 100) * 0.05,
    },
    {
      key: 'policy',
      label: 'Traits & cabinet',
      value: (modifiers.growth ?? 0) * 0.1 + highBudgets * 0.01 - lowBudgets * 0.01,
    },
  ]
}

export function gdpCapacityTotal(drivers: GdpDriver[]): number {
  return drivers.reduce((total, driver) => total + driver.value, 0)
}

export function civilCapacity(
  country: Country,
  flows: Record<ResourceId, ResourceFlow>,
  budget: BudgetBreakdown,
  commerce?: CommerceSnapshot,
): number {
  return clamp(
    1 + gdpCapacityTotal(gdpCapacityDrivers(country, flows, budget, commerce)),
    0.35,
    1.3,
  )
}

/** Anchors each sector at its observed output while preserving the starting GDP. */
export function initializeEconomyBase(
  country: Country,
  flows: Record<ResourceId, ResourceFlow>,
  budget: BudgetBreakdown,
  commerce: CommerceSnapshot,
): EconomyBase {
  const gdp = Math.max(100, country.stats.gdp)
  const industryOutput = resourceValuation(flows).productionValue
  const commerceValue = commerceOutput(commerce)
  const militaryValue = militaryOutlay(budget)
  const capacity = civilCapacity(country, flows, budget, commerce)

  const militaryShare = militaryValue > 0 ? clamp(militaryValue / gdp, 0.005, 0.08) : 0
  const militaryGdp = gdp * militaryShare
  const civilGdp = Math.max(0, gdp - militaryGdp)
  const totalOutput = industryOutput + commerceValue
  const industryShare = totalOutput > 0 ? clamp(industryOutput / totalOutput, 0.2, 0.8) : 0.6

  const base: EconomyBase = {
    industryOutput,
    commerceOutput: commerceValue,
    militaryOutput: militaryValue,
    industryGdp: civilGdp * industryShare,
    commerceGdp: civilGdp * (1 - industryShare),
    militaryGdp,
    capacity,
  }
  country.economyBase = base
  country.stats.gdpIndustry = roundTo(base.industryGdp, 1)
  country.stats.gdpCommerce = roundTo(base.commerceGdp, 1)
  country.stats.gdpMilitary = roundTo(base.militaryGdp, 1)
  country.stats.gdp = roundTo(
    country.stats.gdpIndustry + country.stats.gdpCommerce + country.stats.gdpMilitary,
    1,
  )
  return base
}

const activity = (current: number, baseline: number): number => {
  if (baseline <= 0) return current > 0 ? 1 : 0
  return clamp(current / baseline, 0, 6)
}

/**
 * GDP = civil (industry + commerce) + military. Industry and commerce are
 * activity ratios against their world-generation anchors, scaled by the civil
 * capacity factor relative to its own anchor. No autonomous base expansion.
 */
export function computeGdp(
  country: Country,
  flows: Record<ResourceId, ResourceFlow>,
  budget: BudgetBreakdown,
  commerce?: CommerceSnapshot,
): GdpComposition {
  const market = commerce ?? budget.commerce
  const base = country.economyBase
  const industryOutput = resourceValuation(flows).productionValue
  const commerceValue = commerceOutput(market)
  const militaryValue = militaryOutlay(budget)
  const capacity = civilCapacity(country, flows, budget, market)

  if (!base) {
    const industry = Math.max(0, country.stats.gdpIndustry ?? 0)
    const commerceGdp = Math.max(0, country.stats.gdpCommerce ?? 0)
    const military = Math.max(0, country.stats.gdpMilitary ?? 0)
    const total = Math.max(100, industry + commerceGdp + military)
    return {
      industry,
      commerce: commerceGdp,
      military,
      civil: industry + commerceGdp,
      total,
      industryOutput,
      commerceOutput: commerceValue,
      militaryOutput: militaryValue,
      industryActivity: 1,
      commerceActivity: 1,
      militaryActivity: 1,
      capacity,
      capacityRatio: 1,
    }
  }

  const capacityRatio = base.capacity > 0 ? clamp(capacity / base.capacity, 0.35, 2.5) : 1
  const industryActivity = activity(industryOutput, base.industryOutput)
  const commerceActivity = activity(commerceValue, base.commerceOutput)
  const militaryActivity = activity(militaryValue, base.militaryOutput)
  let industry = base.industryGdp * industryActivity * capacityRatio
  let commerceGdp = base.commerceGdp * commerceActivity * capacityRatio
  let military = base.militaryGdp * militaryActivity
  let total = industry + commerceGdp + military
  if (total < 100) {
    if (total <= 0) {
      commerceGdp = 100
    } else {
      const scale = 100 / total
      industry *= scale
      commerceGdp *= scale
      military *= scale
    }
    total = 100
  }

  return {
    industry,
    commerce: commerceGdp,
    military,
    civil: industry + commerceGdp,
    total,
    industryOutput,
    commerceOutput: commerceValue,
    militaryOutput: militaryValue,
    industryActivity,
    commerceActivity,
    militaryActivity,
    capacity,
    capacityRatio,
  }
}

/**
 * Permanent GDP shocks (events, institutional upgrades, mergers) scale every
 * sector anchor by the same factor so the next turn's composition keeps the
 * shock without introducing autonomous growth.
 */
export function applyGdpShock(country: Country, pct: number): void {
  if (!Number.isFinite(pct) || pct === 0) return
  const factor = clamp(1 + pct, 0.05, 5)
  if (country.economyBase) {
    country.economyBase.industryGdp *= factor
    country.economyBase.commerceGdp *= factor
    country.economyBase.militaryGdp *= factor
  }
  country.stats.gdpIndustry = roundTo(Math.max(0, (country.stats.gdpIndustry ?? 0) * factor), 1)
  country.stats.gdpCommerce = roundTo(Math.max(0, (country.stats.gdpCommerce ?? 0) * factor), 1)
  country.stats.gdpMilitary = roundTo(Math.max(0, (country.stats.gdpMilitary ?? 0) * factor), 1)
  let total = country.stats.gdpIndustry + country.stats.gdpCommerce + country.stats.gdpMilitary
  if (total < 100) {
    country.stats.gdpCommerce += 100 - total
    total = 100
  }
  country.stats.gdp = roundTo(total, 1)
}
