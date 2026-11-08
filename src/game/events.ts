import { FIRST_NAMES, LAST_NAMES, MINISTRY_IDS, RESOURCE_IDS, UNIT_BY_ID } from './constants'
import type {
  Country,
  EventEffects,
  GameEventDefinition,
  GameState,
  ResourceId,
  UnitId,
} from './types'
import { clamp } from './rng'
import type { RNG } from './rng'
import { debtLimit, isHostile, resourceFlows, taxBurden } from './selectors'
import { formatMoney, formatSignedNumber, formatSignedPercent, titleCase } from './format'

function makeHeadName(rng: RNG): string {
  return `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`
}

/** Applies an event effect block to a country and returns human-readable outcomes. */
export function applyEventEffects(
  game: GameState,
  country: Country,
  effects: EventEffects,
  rng: RNG,
): string[] {
  const lines: string[] = []
  const gdp = country.stats.gdp

  if (effects.money !== undefined) {
    country.stats.treasury += effects.money
    lines.push(`Treasury ${formatMoney(effects.money)}`)
  }
  if (effects.moneyPctGdp !== undefined) {
    const amount = gdp * effects.moneyPctGdp
    country.stats.treasury += amount
    lines.push(`Treasury ${amount >= 0 ? '+' : ''}${formatMoney(amount)}`)
  }
  if (effects.debt !== undefined) {
    country.stats.debt = Math.max(0, country.stats.debt + effects.debt)
    lines.push(`Debt ${effects.debt >= 0 ? '+' : ''}${formatMoney(effects.debt)}`)
  }
  if (effects.debtPctGdp !== undefined) {
    const amount = gdp * effects.debtPctGdp
    country.stats.debt = Math.max(0, country.stats.debt + amount)
    lines.push(`Debt ${amount >= 0 ? '+' : ''}${formatMoney(amount)}`)
  }
  if (effects.approval !== undefined) {
    country.stats.approval = clamp(country.stats.approval + effects.approval, 0, 100)
    lines.push(`Approval ${formatSignedNumber(effects.approval)}`)
  }
  if (effects.corruption !== undefined) {
    country.stats.corruption = clamp(country.stats.corruption + effects.corruption, 0, 100)
    lines.push(`Corruption ${formatSignedNumber(effects.corruption)}`)
  }
  if (effects.security !== undefined) {
    country.stats.security = clamp(country.stats.security + effects.security, 0, 100)
    lines.push(`Security ${formatSignedNumber(effects.security)}`)
  }
  if (effects.gdpPct !== undefined) {
    country.stats.gdp = Math.max(1, country.stats.gdp * (1 + effects.gdpPct))
    lines.push(`GDP ${formatSignedPercent(effects.gdpPct * 100)}`)
  }
  if (effects.tax) {
    for (const [key, value] of Object.entries(effects.tax)) {
      if (value === undefined) continue
      const taxKey = key as keyof Country['taxes']
      country.taxes[taxKey] = clamp(Math.round(value), 0, taxKey === 'tariff' ? 500 : 100)
      lines.push(`${titleCase(taxKey)} tax set to ${country.taxes[taxKey]}%`)
    }
  }
  if (effects.taxDelta) {
    for (const [key, value] of Object.entries(effects.taxDelta)) {
      if (value === undefined) continue
      const taxKey = key as keyof Country['taxes']
      country.taxes[taxKey] = clamp(
        Math.round(country.taxes[taxKey] + value),
        0,
        taxKey === 'tariff' ? 500 : 100,
      )
      lines.push(`${titleCase(taxKey)} tax → ${country.taxes[taxKey]}%`)
    }
  }
  if (effects.allRelations !== undefined) {
    for (const other of game.countries) {
      if (other.id === country.id || other.status !== 'alive') continue
      other.relations = clamp(other.relations + effects.allRelations, -100, 100)
    }
    lines.push(`Relations with all nations ${formatSignedNumber(effects.allRelations)}`)
  }
  if (effects.resourceStock) {
    for (const [key, amount] of Object.entries(effects.resourceStock)) {
      if (!amount) continue
      const id = key as ResourceId
      country.resources[id].stock = Math.max(0, country.resources[id].stock + amount)
      lines.push(`${titleCase(id)} stock ${formatSignedNumber(amount, 1)} units`)
    }
  }
  if (effects.reserves) {
    for (const [key, amount] of Object.entries(effects.reserves)) {
      if (!amount) continue
      const id = key as ResourceId
      country.resources[id].reserves = Math.max(0, country.resources[id].reserves + amount)
      lines.push(`${titleCase(id)} reserves ${formatSignedNumber(amount, 1)} units`)
    }
  }
  if (effects.units) {
    for (const [key, amount] of Object.entries(effects.units)) {
      if (!amount) continue
      const id = key as UnitId
      const unit = UNIT_BY_ID[id]
      country.military[id] = Math.max(0, Math.round(country.military[id] + amount))
      lines.push(`${unit.name} ${formatSignedNumber(amount, 0)}`)
    }
  }
  if (effects.replaceCorruptMinister) {
    const worst = MINISTRY_IDS.reduce((selected, id) =>
      country.ministries[id].head.corruption > country.ministries[selected].head.corruption
        ? id
        : selected,
    )
    const ministry = country.ministries[worst]
    const oldName = ministry.head.name
    ministry.head = {
      name: makeHeadName(rng),
      corruption: rng.int(3, 18),
      loyalty: rng.int(64, 96),
      skill: rng.int(46, 92),
    }
    lines.push(`${oldName} replaced at ${titleCase(worst)} by ${ministry.head.name}`)
  }
  if (effects.budgetBoost) {
    let raised = 0
    for (const id of MINISTRY_IDS) {
      if (raised >= 2) break
      if (country.ministries[id].budget === 'low') {
        country.ministries[id].budget = 'normal'
        raised += 1
      }
    }
    if (raised > 0)
      lines.push(
        `${raised} underfunded ${raised === 1 ? 'ministry' : 'ministries'} raised to normal`,
      )
  }
  if (effects.log) lines.push(effects.log)
  return lines
}

const allShortage = (game: GameState, player: Country): boolean => {
  const flows = resourceFlows(player, game.deals, game.prices)
  return RESOURCE_IDS.some((id) => flows[id].shortage > 0)
}

const anyHostile = (game: GameState, _player: Country): boolean =>
  game.countries.some((country) => isHostile(country, game.settings))

const lowestMinistry = (player: Country): boolean =>
  MINISTRY_IDS.some((id) => player.ministries[id].budget === 'low')

const worstHead = (player: Country): number =>
  Math.max(...MINISTRY_IDS.map((id) => player.ministries[id].head.corruption))

const worstLoyalty = (player: Country): number =>
  Math.min(...MINISTRY_IDS.map((id) => player.ministries[id].head.loyalty))

const averageRelations = (game: GameState, player: Country): number => {
  const others = game.countries.filter(
    (country) => country.status === 'alive' && country.id !== player.id,
  )
  if (others.length === 0) return 100
  return others.reduce((sum, country) => sum + country.relations, 0) / others.length
}

const shortageResources = (game: GameState, player: Country): ResourceId[] => {
  const flows = resourceFlows(player, game.deals, game.prices)
  return RESOURCE_IDS.filter((id) => flows[id].shortage > 0)
}

export const EVENTS: GameEventDefinition[] = [
  {
    id: 'inauguration',
    title: 'The First Morning',
    body: 'The residence is yours. Outside the gates, the capital is still deciding what kind of country this will be. Your cabinet waits for a first signal: spend, cut, or reassure.',
    category: 'governance',
    once: true,
    weight: 100,
    choices: [
      {
        id: 'fund',
        label: 'Fund the institutions',
        description: 'Spend 1% of GDP on ministries and public services. Approval +4.',
        tone: 'positive',
        effects: { moneyPctGdp: -0.01, approval: 4, budgetBoost: true },
      },
      {
        id: 'cut',
        label: 'Cut taxes immediately',
        description: 'Corporate tax −5, income tax −3, approval +6.',
        tone: 'positive',
        effects: { taxDelta: { corporate: -5, income: -3 }, approval: 6 },
      },
      {
        id: 'markets',
        label: 'Reassure the markets',
        description: 'Treasury +0.5% of GDP, relations with all nations +3.',
        effects: { moneyPctGdp: 0.005, allRelations: 3 },
      },
    ],
  },
  {
    id: 'tax_revolt',
    title: 'The Tax Revolt',
    body: 'Crowds have gathered outside the finance ministry. The burden has become visible in every household budget, and the opposition has found its issue.',
    category: 'governance',
    weight: 20,
    condition: (_state, player) => taxBurden(player.taxes) > 48,
    choices: [
      {
        id: 'relief',
        label: 'Announce a relief package',
        description: 'Spend 1.5% of GDP, cut income and corporate tax by 3, approval +6.',
        tone: 'positive',
        effects: { moneyPctGdp: -0.015, taxDelta: { corporate: -3, income: -3 }, approval: 6 },
      },
      {
        id: 'police',
        label: 'Police the protests',
        description: 'Security +6, approval −7, corruption +2.',
        tone: 'danger',
        effects: { security: 6, approval: -7, corruption: 2 },
      },
      {
        id: 'negotiate',
        label: 'Negotiate with the unions',
        description: 'Roll d6 > 3. Success: approval +8 and modest cost. Failure: approval −5.',
        effects: { moneyPctGdp: -0.005 },
        check: { die: 6, dc: 3, label: 'Union talks' },
        success: { approval: 8 },
        failure: { approval: -5, moneyPctGdp: -0.01 },
      },
    ],
  },
  {
    id: 'capital_flight',
    title: 'Capital Takes Flight',
    body: 'A major industrial group has moved its headquarters offshore. Other boardrooms are watching. The corporate tax rate has become a headline.',
    category: 'economy',
    weight: 16,
    condition: (_state, player) => player.taxes.corporate > 45,
    choices: [
      {
        id: 'cut',
        label: 'Cut the corporate rate',
        description: 'Corporate tax −6, approval +2, relations +2.',
        tone: 'positive',
        effects: { taxDelta: { corporate: -6 }, approval: 2, allRelations: 2 },
      },
      {
        id: 'incentives',
        label: 'Offer investment incentives',
        description: 'Spend 1.2% of GDP; GDP +1%, approval +3.',
        effects: { moneyPctGdp: -0.012, gdpPct: 0.01, approval: 3 },
      },
      {
        id: 'leave',
        label: 'Let them leave',
        description: 'Treasury +0.5% of GDP, GDP −1.5%, approval −2.',
        tone: 'danger',
        effects: { moneyPctGdp: 0.005, gdpPct: -0.015, approval: -2 },
      },
    ],
  },
  {
    id: 'tax_haven',
    title: 'The Low-Tax Miracle',
    body: 'Your corporate rate is among the lowest in the world. Capital is arriving faster than the regulators can count it. The neighbours are not amused.',
    category: 'economy',
    weight: 12,
    condition: (_state, player) => player.taxes.corporate < 8,
    choices: [
      {
        id: 'celebrate',
        label: 'Celebrate the boom',
        description: 'Approval +3, relations +2, treasury +0.4% of GDP.',
        effects: { approval: 3, allRelations: 2, moneyPctGdp: 0.004 },
      },
      {
        id: 'minimum',
        label: 'Introduce a minimum rate',
        description: 'Corporate tax set to 12, treasury +1% of GDP, approval −2.',
        effects: { tax: { corporate: 12 }, moneyPctGdp: 0.01, approval: -2 },
      },
      {
        id: 'summit',
        label: 'Negotiate a global minimum',
        description: 'Roll d6 > 3. Success: relations +6. Failure: relations −3.',
        check: { die: 6, dc: 3, label: 'Tax summit' },
        success: { allRelations: 6 },
        failure: { allRelations: -3 },
      },
    ],
  },
  {
    id: 'ministry_scandal',
    title: 'The Ministry Scandal',
    body: 'A procurement audit has found a web of shell companies attached to a senior minister. The press has the documents. The minister says they are a forgery.',
    category: 'governance',
    weight: 18,
    condition: (_state, player) => worstHead(player) > 55,
    choices: [
      {
        id: 'sack',
        label: 'Sack the minister',
        description:
          'Replace the most corrupt minister, spend 0.6% of GDP, corruption −5, approval +3.',
        tone: 'positive',
        effects: {
          replaceCorruptMinister: true,
          moneyPctGdp: -0.006,
          corruption: -5,
          approval: 3,
        },
      },
      {
        id: 'settle',
        label: 'Quiet settlement',
        description: 'Spend 1.2% of GDP, corruption +3, approval −3.',
        tone: 'danger',
        effects: { moneyPctGdp: -0.012, corruption: 3, approval: -3 },
      },
      {
        id: 'inquiry',
        label: 'Open a public inquiry',
        description: 'Roll d6 > 3. Success: corruption −10, approval +4. Failure: approval −6.',
        check: { die: 6, dc: 3, label: 'Public inquiry' },
        success: { corruption: -10, approval: 4 },
        failure: { approval: -6, corruption: 3 },
      },
    ],
  },
  {
    id: 'traitor',
    title: 'A Loyalty Problem',
    body: 'A minister with access to the security cabinet has been meeting a foreign attaché. Nothing is proven. Everyone knows.',
    category: 'governance',
    weight: 14,
    condition: (_state, player) => worstLoyalty(player) < 32,
    choices: [
      {
        id: 'purge',
        label: 'Purge the apparatus',
        description: 'Security +5, corruption +5, approval −4.',
        tone: 'danger',
        effects: { security: 5, corruption: 5, approval: -4 },
      },
      {
        id: 'promote',
        label: 'Give them a post abroad',
        description: 'Spend 0.3% of GDP, corruption +4, approval −1.',
        effects: { moneyPctGdp: -0.003, corruption: 4, approval: -1 },
      },
      {
        id: 'investigate',
        label: 'Investigate quietly',
        description:
          'Roll d6 > 3. Success: security +4, corruption −4. Failure: security −4, approval −4.',
        check: { die: 6, dc: 3, label: 'Counter-intelligence' },
        success: { security: 4, corruption: -4 },
        failure: { security: -4, approval: -4 },
      },
    ],
  },
  {
    id: 'resource_squeeze',
    title: 'The Squeeze',
    body: 'Warehouses are running thin. Industry has begun bidding against households for the same scarce inputs, and the price board is climbing.',
    category: 'economy',
    weight: 20,
    condition: allShortage,
    choices: [
      {
        id: 'imports',
        label: 'Emergency imports',
        description: 'Spend 1.5% of GDP and replenish strategic stockpiles.',
        tone: 'positive',
        effects: {
          moneyPctGdp: -0.015,
          resourceStock: {
            water: 40,
            energy: 60,
            agriculture: 25,
            livestock: 10,
            oil: 20,
            metal: 10,
            rareEarth: 2,
            uranium: 1,
          },
        },
      },
      {
        id: 'ration',
        label: 'Ration consumption',
        description: 'Approval −4, security −1. The stock lasts longer.',
        tone: 'danger',
        effects: { approval: -4, security: -1 },
      },
      {
        id: 'controls',
        label: 'Introduce price controls',
        description: 'Approval −2, corruption +3. The queue becomes the allocation mechanism.',
        tone: 'danger',
        effects: { approval: -2, corruption: 3 },
      },
    ],
  },
  {
    id: 'foreign_investment',
    title: 'A Foreign Delegation',
    body: 'A sovereign fund wants to build in your country. The terms are generous. The strategic implications are not entirely clear.',
    category: 'diplomacy',
    weight: 12,
    choices: [
      {
        id: 'accept',
        label: 'Accept the investment',
        description: 'Treasury +1.5% of GDP, GDP +0.8%, corruption +2, relations +2.',
        effects: { moneyPctGdp: 0.015, gdpPct: 0.008, corruption: 2, allRelations: 2 },
      },
      {
        id: 'fund',
        label: 'Create a sovereign fund',
        description: 'Treasury +0.8% of GDP, approval +1.',
        effects: { moneyPctGdp: 0.008, approval: 1 },
      },
      {
        id: 'screen',
        label: 'Screen the investors',
        description: 'Corruption −3, approval +2, treasury +0.3% of GDP.',
        tone: 'positive',
        effects: { corruption: -3, approval: 2, moneyPctGdp: 0.003 },
      },
    ],
  },
  {
    id: 'hostile_threat',
    title: 'A Threat at the Border',
    body: 'A hostile neighbour has moved units toward the frontier and recalled its ambassador. The foreign ministry asks for instructions.',
    category: 'diplomacy',
    weight: 22,
    condition: anyHostile,
    choices: [
      {
        id: 'mobilize',
        label: 'Mobilize the reserves',
        description: 'Security +4, approval −2, spend 1% of GDP.',
        effects: { security: 4, approval: -2, moneyPctGdp: -0.01 },
      },
      {
        id: 'summit',
        label: 'Offer a summit',
        description: 'Spend 0.6% of GDP, relations with all nations +5.',
        tone: 'positive',
        effects: { moneyPctGdp: -0.006, allRelations: 5 },
      },
      {
        id: 'ignore',
        label: 'Ignore the provocation',
        description: 'Approval −4, security −2.',
        tone: 'danger',
        effects: { approval: -4, security: -2 },
      },
    ],
  },
  {
    id: 'laffer_warning',
    title: 'The Wrong Side of the Curve',
    body: 'Revenue is falling even though rates are rising. The finance ministry’s own model says the country is past the peak of the Laffer curve. The political cost of admitting it is steep.',
    category: 'economy',
    weight: 18,
    condition: (_state, player) => taxBurden(player.taxes) > 58,
    choices: [
      {
        id: 'lower',
        label: 'Lower headline rates',
        description: 'Corporate −5, income −5, tariff −10, royalty −5, approval +7.',
        tone: 'positive',
        effects: {
          taxDelta: { corporate: -5, income: -5, tariff: -10, royalty: -5 },
          approval: 7,
        },
      },
      {
        id: 'soak',
        label: 'Soak the wealthy',
        description: 'Income tax +5, treasury +1.2% of GDP, approval −5.',
        tone: 'danger',
        effects: { taxDelta: { income: 5 }, moneyPctGdp: 0.012, approval: -5 },
      },
      {
        id: 'sell',
        label: 'Sell the reform publicly',
        description: 'Roll d6 > 3. Success: approval +4. Failure: approval −4, relations −2.',
        check: { die: 6, dc: 3, label: 'Public campaign' },
        success: { approval: 4 },
        failure: { approval: -4, allRelations: -2 },
      },
    ],
  },
  {
    id: 'low_budget',
    title: 'The Underfunded State',
    body: 'A ministry has been running on a low budget for too long. The buildings are cold, the queues are long, and the staff are quietly leaving.',
    category: 'governance',
    weight: 14,
    condition: (_state, player) => lowestMinistry(player),
    choices: [
      {
        id: 'raise',
        label: 'Raise the budgets',
        description: 'Spend 1.2% of GDP, raise up to two low budgets to normal, approval +4.',
        tone: 'positive',
        effects: { moneyPctGdp: -0.012, budgetBoost: true, approval: 4 },
      },
      {
        id: 'volunteers',
        label: 'Ask for volunteers',
        description: 'Treasury +0.4% of GDP, approval −3.',
        effects: { moneyPctGdp: 0.004, approval: -3 },
      },
      {
        id: 'audit',
        label: 'Run an efficiency audit',
        description:
          'Roll d6 > 2. Success: treasury +0.8% of GDP, corruption −3. Failure: approval −5.',
        check: { die: 6, dc: 2, label: 'Efficiency audit' },
        success: { moneyPctGdp: 0.008, corruption: -3 },
        failure: { approval: -5 },
      },
    ],
  },
  {
    id: 'high_budget_success',
    title: 'The Well-Oiled Ministry',
    body: 'A well-funded ministry has begun to deliver. The buildings are open, the queues are moving, and the staff are no longer leaving for the private sector. The press wants to know how long it can last.',
    category: 'governance',
    weight: 13,
    condition: (_state, player) =>
      MINISTRY_IDS.some((id) => player.ministries[id].budget === 'high'),
    choices: [
      {
        id: 'expand',
        label: 'Expand the programme',
        description: 'Spend 0.5% of GDP, approval +4, GDP +0.2%.',
        tone: 'positive',
        effects: { moneyPctGdp: -0.005, approval: 4, gdpPct: 0.002 },
      },
      {
        id: 'publish',
        label: 'Publish the results',
        description: 'Approval +3, relations with all nations +2.',
        tone: 'positive',
        effects: { approval: 3, allRelations: 2 },
      },
      {
        id: 'return',
        label: 'Demand a return on investment',
        description:
          'Roll d6 > 2. Success: treasury +0.4% of GDP, corruption −2. Failure: approval −3.',
        check: { die: 6, dc: 2, label: 'Efficiency review' },
        success: { moneyPctGdp: 0.004, corruption: -2 },
        failure: { approval: -3 },
      },
    ],
  },
  {
    id: 'veterans',
    title: 'The Veterans’ Petition',
    body: 'A delegation of veterans has arrived with a list of unmet promises. They are polite, organised, and have friends in the barracks.',
    category: 'military',
    weight: 11,
    condition: (_state, player) => player.military.soldiers > 40_000,
    choices: [
      {
        id: 'pensions',
        label: 'Raise the pensions',
        description: 'Spend 1% of GDP, approval +4, security +2.',
        tone: 'positive',
        effects: { moneyPctGdp: -0.01, approval: 4, security: 2 },
      },
      {
        id: 'land',
        label: 'Offer land grants',
        description: 'Spend 0.4% of GDP, approval +2, GDP −0.2%.',
        effects: { moneyPctGdp: -0.004, approval: 2, gdpPct: -0.002 },
      },
      {
        id: 'dismiss',
        label: 'Dismiss the demands',
        description: 'Approval −5, security −3.',
        tone: 'danger',
        effects: { approval: -5, security: -3 },
      },
    ],
  },
  {
    id: 'natural_disaster',
    title: 'The Storm',
    body: 'A severe storm has hit the coast. Roads are cut, the grid is down in three provinces, and the cameras are already arriving.',
    category: 'world',
    weight: 10,
    choices: [
      {
        id: 'relief',
        label: 'Fund emergency relief',
        description: 'Spend 1.5% of GDP, approval +3, security +1.',
        tone: 'positive',
        effects: { moneyPctGdp: -0.015, approval: 3, security: 1 },
      },
      {
        id: 'austerity',
        label: 'Keep the budget on track',
        description: 'Treasury +0.3% of GDP, approval −5, security −2.',
        tone: 'danger',
        effects: { moneyPctGdp: 0.003, approval: -5, security: -2 },
      },
      {
        id: 'appeal',
        label: 'Launch an international appeal',
        description: 'Treasury +0.8% of GDP, relations +3, approval +1.',
        effects: { moneyPctGdp: 0.008, allRelations: 3, approval: 1 },
      },
    ],
  },
  {
    id: 'debt_panic',
    title: 'The Bond Market Wakes',
    body: 'Yields are moving. A rating agency has changed its outlook to negative. The debt stock is now larger than the finance ministry’s comfort threshold.',
    category: 'economy',
    weight: 16,
    condition: (_state, player) => player.stats.debt > debtLimit(player) * 0.92,
    choices: [
      {
        id: 'austerity',
        label: 'Announce an austerity budget',
        description: 'Treasury +1% of GDP, approval −6.',
        tone: 'danger',
        effects: { moneyPctGdp: 0.01, approval: -6 },
      },
      {
        id: 'support',
        label: 'Seek external support',
        description: 'Treasury +3% of GDP, debt +5% of GDP, relations −3, approval −3.',
        effects: { moneyPctGdp: 0.03, debtPctGdp: 0.05, allRelations: -3, approval: -3 },
      },
      {
        id: 'reassure',
        label: 'Reassure bondholders',
        description: 'Spend 0.6% of GDP, approval +2.',
        effects: { moneyPctGdp: -0.006, approval: 2 },
      },
    ],
  },
  {
    id: 'blackout',
    title: 'Lights Out',
    body: 'The energy deficit has become physical. Factories are on rotating shutdowns and the evening news is broadcasting by candlelight.',
    category: 'industry',
    weight: 20,
    condition: (state, player) => shortageResources(state, player).includes('energy'),
    choices: [
      {
        id: 'imports',
        label: 'Buy emergency energy',
        description: 'Spend 1.2% of GDP, add 60 energy units.',
        tone: 'positive',
        effects: { moneyPctGdp: -0.012, resourceStock: { energy: 60 } },
      },
      {
        id: 'ration',
        label: 'Ration the grid',
        description: 'Approval −5, GDP −1%.',
        tone: 'danger',
        effects: { approval: -5, gdpPct: -0.01 },
      },
      {
        id: 'crash',
        label: 'Fund a crash programme',
        description: 'Spend 2% of GDP, approval +1, 40 energy units delivered.',
        effects: { moneyPctGdp: -0.02, approval: 1, resourceStock: { energy: 40 } },
      },
    ],
  },
  {
    id: 'corruption_ring',
    title: 'The Network',
    body: 'Investigators have mapped a procurement network that reaches several ministries. It has been operating for years, and it is still operating now.',
    category: 'governance',
    weight: 14,
    condition: (_state, player) => player.stats.corruption > 62,
    choices: [
      {
        id: 'commission',
        label: 'Create an anti-corruption commission',
        description: 'Spend 0.8% of GDP, corruption −8, approval +4.',
        tone: 'positive',
        effects: { moneyPctGdp: -0.008, corruption: -8, approval: 4 },
      },
      {
        id: 'protect',
        label: 'Protect the network',
        description: 'Treasury +1% of GDP, corruption +4, approval −4.',
        tone: 'danger',
        effects: { moneyPctGdp: 0.01, corruption: 4, approval: -4 },
      },
      {
        id: 'publish',
        label: 'Publish the files',
        description:
          'Roll d6 > 4. Success: corruption −12, approval +6. Failure: approval −6, security −4.',
        check: { die: 6, dc: 4, label: 'Transparency gamble' },
        success: { corruption: -12, approval: 6 },
        failure: { approval: -6, security: -4 },
      },
    ],
  },
  {
    id: 'diplomatic_breakthrough',
    title: 'A Window Opens',
    body: 'Several governments have quietly signalled that they would welcome a broader settlement. The diplomatic corps wants a mandate before the window closes.',
    category: 'diplomacy',
    weight: 10,
    condition: (state, player) => averageRelations(state, player) > 48,
    choices: [
      {
        id: 'visit',
        label: 'Make a state visit',
        description: 'Spend 0.4% of GDP, relations +5, approval +2.',
        tone: 'positive',
        effects: { moneyPctGdp: -0.004, allRelations: 5, approval: 2 },
      },
      {
        id: 'summit',
        label: 'Host a trade summit',
        description: 'Treasury +0.4% of GDP, relations +3.',
        effects: { moneyPctGdp: 0.004, allRelations: 3 },
      },
      {
        id: 'quiet',
        label: 'Work quietly through envoys',
        description: 'Roll d6 > 2. Success: relations +8. Failure: relations −3.',
        check: { die: 6, dc: 2, label: 'Quiet diplomacy' },
        success: { allRelations: 8 },
        failure: { allRelations: -3 },
      },
    ],
  },
  {
    id: 'science_breakthrough',
    title: 'The Laboratory Door',
    body: 'A national laboratory has produced a result that its directors describe, carefully, as “commercially interesting.” The world is already calling.',
    category: 'industry',
    weight: 9,
    choices: [
      {
        id: 'fund',
        label: 'Fund the next stage',
        description: 'Spend 1% of GDP, GDP +0.5%, approval +2.',
        tone: 'positive',
        effects: { moneyPctGdp: -0.01, gdpPct: 0.005, approval: 2 },
      },
      {
        id: 'license',
        label: 'Commercialise the patent',
        description: 'Treasury +1% of GDP, relations +1.',
        effects: { moneyPctGdp: 0.01, allRelations: 1 },
      },
      {
        id: 'open',
        label: 'Publish it openly',
        description: 'Treasury +0.4% of GDP, approval +3, relations +2.',
        tone: 'positive',
        effects: { moneyPctGdp: 0.004, approval: 3, allRelations: 2 },
      },
    ],
  },
]

export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((event) => [event.id, event])) as Record<
  string,
  GameEventDefinition
>

export function eventCandidates(state: GameState, player: Country): GameEventDefinition[] {
  return EVENTS.filter((event) => {
    if (state.seenEvents.includes(event.id) && event.once) return false
    return event.condition ? event.condition(state, player) : true
  })
}

export function rollEventCheck(event: GameEventDefinition, choiceId: string, rng: RNG) {
  const choice = event.choices.find((entry) => entry.id === choiceId)
  if (!choice) return null
  if (!choice.check) return { choice, roll: undefined, success: undefined }
  const roll = rng.dice(choice.check.die)
  return { choice, roll, success: roll > choice.check.dc }
}

export function effectSummary(lines: string[]): string {
  return lines.length > 0 ? lines.join(' · ') : 'No immediate effect.'
}

export function resourceListForDisplay(ids: ResourceId[]): string {
  return ids.map((id) => titleCase(id)).join(', ')
}
