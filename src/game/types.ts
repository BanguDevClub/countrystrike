/* ── Visual / shell ─────────────────────────────────────────────────────── */

export type ThemeId = 'dark' | 'light' | 'latte' | 'frappe' | 'macchiato' | 'mocha'

export type PageId =
  | 'map'
  | 'budget'
  | 'governance'
  | 'industry'
  | 'commerce'
  | 'military'
  | 'trade'
  | 'ranking'
  | 'logs'
  | 'methodology'

export type GameStatus = 'menu' | 'playing' | 'won'

export type Difficulty = 'easy' | 'normal' | 'hard'

/* ── Domain vocabulary ─────────────────────────────────────────────────── */

export type ResourceId =
  'water' | 'energy' | 'agriculture' | 'livestock' | 'oil' | 'metal' | 'rareEarth' | 'uranium'

export type ResourceCategory = 'commodity' | 'strategic'

export type CommerceCategory = 'food' | 'energy' | 'manufactured' | 'services'

export type CommerceGoodId =
  | 'rice'
  | 'eggs'
  | 'chicken'
  | 'beef'
  | 'fuel'
  | 'electricity'
  | 'car'
  | 'house'
  | 'healthcare'
  | 'education'
  | 'transport'
  | 'telecom'

export type CurrencyRegime = 'floating' | 'managed' | 'pegged'

export type GovernmentId =
  'democracy' | 'kingdom' | 'empire' | 'dictatorship' | 'communistAnarchy' | 'capitalistAnarchy'

export type MinistryId = 'finance' | 'foreign' | 'defense' | 'industry' | 'interior' | 'health'

export type BudgetLevel = 'low' | 'normal' | 'high'

export type UnitId = 'soldiers' | 'tanks' | 'jets' | 'warships' | 'missiles' | 'nukes'

export type TradePricing = 'below' | 'market' | 'above'

export type AutoDealMode = 'off' | TradePricing

export type IndustryAction = 'prospect' | 'extraction' | 'refinement' | 'research'

export type LogCategory =
  'economy' | 'industry' | 'diplomacy' | 'military' | 'governance' | 'event' | 'world'

export type CompositeMetricKey =
  | 'treasury'
  | 'debt'
  | 'gdp'
  | 'gdpPerCapita'
  | 'pppPerCapita'
  | 'inflation'
  | 'currency'
  | 'relations'
  | 'externalApproval'
  | 'population'
  | 'militaryPower'
  | 'approval'
  | 'hdi'
  | 'gini'
  | 'violence'
  | 'depression'

export interface GameSettings {
  sound: boolean
  music: boolean
  countries: number
  continents: number
  difficulty: Difficulty
  /** Global multiplier on every resource reference price. */
  resourcePrices: number
  /** Higher values shrink starting reserves and stockpiles, tightening supply. */
  resourceScarcity: number
  /** Turn-to-turn price noise and convergence speed. */
  marketVolatility: number
  /** Starting treasury as a multiple of the normal 6% GDP floor. */
  startingTreasury: number
  /** Starting sovereign debt multiplier. */
  startingDebt: number
  /** Starting extraction and refinement level multiplier. */
  startingIndustry: number
}

export interface TaxRates {
  corporate: number
  income: number
  tariff: number
  royalty: number
}

export interface ModifierBlock {
  extraction: number
  reserves: number
  consumption: number
  trade: number
  taxEfficiency: number
  militaryUpkeep: number
  research: number
  approval: number
  corruption: number
  security: number
  growth: number
  relation: number
  resource: Partial<
    Record<ResourceId, { extraction?: number; reserves?: number; consumption?: number }>
  >
}

export interface TraitDefinition {
  id: string
  name: string
  kind: 'culture' | 'biome' | 'weather' | 'bonus'
  description: string
  effectText: string
  modifiers: Partial<ModifierBlock>
  tone?: 'positive' | 'negative' | 'mixed'
}

export interface MinistryHead {
  name: string
  corruption: number
  loyalty: number
  skill: number
}

export interface Ministry {
  head: MinistryHead
  budget: BudgetLevel
  level: number
  upgrades?: string[]
}

export type MinistryEventCategory = 'corruption' | 'betrayal' | 'improvement' | 'upgrade'
export type EventRarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface ResourceState {
  reserves: number
  extractionLevel: number
  refinementLevel: number
  stock: number
  advances: number
  researchLevel: number
  researchBonus?: number
}

/**
 * Baseline sector activity captured at world generation. GDP is rebuilt from
 * these anchors every turn, so the total moves only when industry, commerce or
 * military activity moves.
 */
export interface EconomyBase {
  /** Industrial gross output at baseline, in millions of credits. */
  industryOutput: number
  /** Household consumption plus net consumer trade at baseline, in millions. */
  commerceOutput: number
  /** Defense outlays (upkeep plus the Defense ministry) at baseline. */
  militaryOutput: number
  /** GDP attributed to each sector at baseline, in millions. */
  industryGdp: number
  commerceGdp: number
  militaryGdp: number
  /** Civil capacity factor at baseline; later capacity is measured against it. */
  capacity: number
}

export interface GdpComposition {
  industry: number
  commerce: number
  military: number
  civil: number
  total: number
  industryOutput: number
  commerceOutput: number
  militaryOutput: number
  industryActivity: number
  commerceActivity: number
  militaryActivity: number
  capacity: number
  capacityRatio: number
}

export interface CountryStats {
  population: number
  /** GDP = gdpIndustry + gdpCommerce + gdpMilitary. */
  gdp: number
  /** GDP produced by resource extraction and refinement. */
  gdpIndustry: number
  /** GDP produced by household consumption and consumer trade. */
  gdpCommerce: number
  /** GDP produced by defense outlays. */
  gdpMilitary: number
  treasury: number
  debt: number
  debtRate: number
  approval: number
  hdi: number
  gini: number
  violence: number
  depression: number
  security: number
  corruption: number
  /** Annualised consumer-price inflation, percent per turn. */
  inflation: number
  /** GDP per capita adjusted for the consumer price level. */
  pppPerCapita: number
  /** Average foreign relations with the living world, -100 to 100. */
  averageRelations: number
  /** External approval standing with the living world, 0 to 100. */
  worldApproval: number
}

export interface CurrencyState {
  code: string
  name: string
  symbol: string
  /** Local currency units per 1 credit. */
  rate: number
  /** Purchasing-power-parity fair value of the rate. */
  fairRate: number
  /** Last turn's move in the market rate, percent. */
  changePct: number
  regime: CurrencyRegime
}

export interface MapCell {
  seed: [number, number]
  centroid: [number, number]
  polygon: [number, number][]
  color: string
}

export interface Continent {
  id: string
  name: string
  polygon: [number, number][]
  center: [number, number]
  label: [number, number]
  color: string
}

export type CountryStatus = 'alive' | 'merged' | 'destroyed'

export interface Country {
  id: string
  name: string
  capital: string
  code: string
  continentId: string
  culture: string
  biome: string
  weather: string
  traits: string[]
  government: GovernmentId
  isPlayer: boolean
  status: CountryStatus
  mergedInto?: string
  map: MapCell
  flagSeed: number
  stats: CountryStats
  economyBase: EconomyBase
  taxes: TaxRates
  ministries: Record<MinistryId, Ministry>
  resources: Record<ResourceId, ResourceState>
  military: Record<UnitId, number>
  relations: number
  externalApproval: number
  autoDeal: Record<ResourceId, AutoDealMode>
  /** Tax (positive) or subsidy (negative) rate per consumer good, percent. */
  commercePolicy: Record<CommerceGoodId, number>
  currency: CurrencyState
}

export interface TradeDeal {
  id: string
  resource: ResourceId
  buyerId: string
  sellerId: string
  quantity: number
  unitPrice: number
  pricing: TradePricing
  remainingTurns: number
  auto: boolean
  createdAtTurn: number
}

export interface MarketSnapshot {
  resource: ResourceId
  price: number
  previousPrice: number
  changePct: number
  targetPrice: number
  supply: number
  demand: number
  surplus: number
  deficit: number
  exports: number
  coveredDeficit: number
  uncoveredDeficit: number
  stock: number
  reserves: number
  reserveTurns: number | null
  stockTurns: number
  pressure: number
  trend: 'rising' | 'falling' | 'stable'
}

export interface ResourceProduction {
  extractionCapacity: number
  refinementCapacity: number
  production: number
}

export interface ResourceFlow {
  production: number
  depletion: number
  extractionCapacity: number
  refinementCapacity: number
  civilConsumption: number
  militaryConsumption: number
  consumption: number
  imports: number
  exports: number
  finalBalance: number
  stock: number
  reserves: number
  shortage: number
  price: number
  reserveRunway?: number | null
  stockRunway?: number | null
}

export interface CommerceGoodSnapshot {
  id: CommerceGoodId
  /** Domestic units produced from available industry input. */
  domesticSupply: number
  /** Units bought on the world consumer market to cover a domestic gap. */
  imported: number
  /** Domestic surplus sold abroad. */
  exported: number
  /** Units supplied to households, domestic plus imports. */
  supply: number
  /** Baseline household need at current population. */
  demand: number
  /** Household need after the tax or subsidy changes consumption. */
  effectiveDemand: number
  coverage: number
  domesticCoverage: number
  shortage: number
  /** Market price before taxes or subsidies, in credits. */
  marketPrice: number
  /** Consumer price after taxes or subsidies, in credits. */
  price: number
  /** Consumer price in local currency. */
  localPrice: number
  /** Positive tax collected or negative subsidy paid, in millions of credits. */
  fiscal: number
  /** Amount paid for consumer imports, in millions of credits. */
  importCost: number
  /** Revenue from consumer exports, in millions of credits. */
  exportRevenue: number
}

export interface CommerceSnapshot {
  goods: Record<CommerceGoodId, CommerceGoodSnapshot>
  /** Weighted consumer price index, 100 = base prices with no levy. */
  basketIndex: number
  /** Weighted share of demand met by supply, 0–1. */
  availability: number
  /** Food, energy, shelter and health availability, 0–1. */
  essentialsAvailability: number
  /** Weighted share of demand left unmet, 0–1. */
  shortageShare: number
  /** Cost of the household basket per million citizens, in millions of credits. */
  householdCost: number
  /** Household consumption capacity divided by basket cost. */
  affordability: number
  taxRevenue: number
  subsidyCost: number
  importCost: number
  exportRevenue: number
  /** Levies + exports − subsidies − imports. */
  fiscalNet: number
  /** Growth contributions consumed by the GDP engine. */
  commerceGrowth: number
  costOfLivingGrowth: number
  inflationGrowth: number
  /** Social pressures consumed by the turn settlement. */
  approvalDelta: number
  depressionDelta: number
  hdiDelta: number
}

export interface BudgetLine {
  key: string
  label: string
  amount: number
  hint?: string
}

export interface BudgetBreakdown {
  revenue: BudgetLine[]
  expenses: BudgetLine[]
  totalRevenue: number
  totalExpenses: number
  net: number
  laffer: number
  taxBurden: number
  debtLimit: number
  treasuryAfterTick: number
  debtAfterTick: number
  commerce: CommerceSnapshot
}

export interface CountrySnapshot {
  id: string
  name: string
  gdp: number
  population: number
  treasury: number
  debt: number
  approval: number
  hdi: number
  gini: number
  violence: number
  depression: number
  militaryPower: number
  relations: number
  externalApproval: number
  inflation: number
  fxRate: number
  gdpPerCapita: number
  pppPerCapita: number
  currencyGap: number
  averageRelations: number
  worldApproval: number
  composite: number
}

export interface HistoryPoint {
  turn: number
  revenue: number
  expenses: number
  net: number
  treasury: number
  debt: number
  gdp: number
  approval: number
  hdi: number
  gini: number
  violence: number
  depression: number
  prices: Record<ResourceId, number>
  resources: Record<ResourceId, ResourceFlow>
  countries: Record<string, CountrySnapshot>
  inflation: number
  fxRate: number
  /** GDP composition introduced with the sector engine; optional for old saves. */
  gdpIndustry?: number
  gdpCommerce?: number
  gdpMilitary?: number
  /** Sovereign rate at the close of the turn. */
  debtRate?: number
  /** PPP fair value of the player's currency at the close of the turn. */
  fxFairRate?: number
  /** Average inflation across living states. */
  worldInflation?: number
}

export interface LogEntry {
  id: string
  turn: number
  category: LogCategory
  message: string
  countryId?: string
  countryName?: string
  tone?: 'positive' | 'negative' | 'neutral'
}

/* ── Events ────────────────────────────────────────────────────────────── */

export interface EventEffects {
  money?: number
  moneyPctGdp?: number
  debt?: number
  debtPctGdp?: number
  clearDebt?: boolean
  approval?: number
  corruption?: number
  security?: number
  gdpPct?: number
  allRelations?: number
  resourceStock?: Partial<Record<ResourceId, number>>
  reserves?: Partial<Record<ResourceId, number>>
  units?: Partial<Record<UnitId, number>>
  tax?: Partial<TaxRates>
  taxDelta?: Partial<TaxRates>
  replaceCorruptMinister?: boolean
  budgetBoost?: boolean
  ministryId?: MinistryId
  ministerLoyaltyDelta?: number
  ministerCorruptionDelta?: number
  ministerSkillDelta?: number
  ministryLevelDelta?: number
  replaceSpecificMinister?: MinistryId
  targetCountryId?: string
  targetCountryMoney?: number
  targetCountryDebt?: number
  targetCountryRelations?: number
  log?: string
}

export interface EventCheck {
  die: 6 | 10 | 100
  dc: number
  label: string
}

export interface EventChoice {
  id: string
  label: string
  description: string
  tone?: 'default' | 'danger' | 'positive'
  check?: EventCheck
  success?: EventEffects
  failure?: EventEffects
  effects?: EventEffects
}

export interface GameEventDefinition {
  id: string
  title: string
  body: string
  category: LogCategory
  ministryId?: MinistryId
  ministryCategory?: MinistryEventCategory
  rarity?: EventRarity
  choices: EventChoice[]
  weight: number
  once?: boolean
  condition?: (state: GameState, player: Country) => boolean
}

export interface EventOutcome {
  eventId: string
  choiceId: string
  title: string
  lines: string[]
  roll?: number
  success?: boolean
  tone: 'positive' | 'negative' | 'neutral'
}

export interface EventStatSnapshot {
  treasury: number
  debt: number
  gdp: number
  approval: number
  hdi: number
  security: number
  corruption: number
}

export interface EventHistoryRecord {
  id: string
  turn: number
  eventId: string
  title: string
  body: string
  choiceId: string
  choiceLabel: string
  ministryId?: MinistryId
  ministryCategory?: MinistryEventCategory
  rarity?: EventRarity
  lines: string[]
  roll?: number
  success?: boolean
  tone: 'positive' | 'negative' | 'neutral'
  timestamp: number
  before: EventStatSnapshot
  after: EventStatSnapshot
}

/* ── Player checks / modals ────────────────────────────────────────────── */

export type CheckKind = 'industry' | 'diplomacy' | 'approval' | 'war'

export interface PendingCheck {
  kind: CheckKind
  title: string
  description: string
  die: 6 | 10 | 100
  dc: number
  modifier: number
  actionCost: number
  costMoney: number
  resource?: ResourceId
  operation?: IndustryAction
  countryId?: string
  stage: 'ready' | 'rolled'
  roll?: number
  success?: boolean
  outcomeLines?: string[]
  canBreakthrough?: boolean
  breakthroughRoll?: number
  breakthrough?: boolean
  winChance?: number
  hasAllAdvancements?: boolean
}

export type ModalState =
  | { kind: 'country'; countryId: string }
  | { kind: 'check'; check: PendingCheck }
  | {
      kind: 'result'
      title: string
      subtitle?: string
      lines: string[]
      tone: 'positive' | 'negative' | 'neutral'
    }
  | { kind: 'new-game' }
  | { kind: 'turn-briefing'; eventId?: string }
  | null

export interface Toast {
  id: number
  message: string
  tone: 'positive' | 'negative' | 'neutral'
}

/* ── Root game state ───────────────────────────────────────────────────── */

export interface GameState {
  version: number
  seed: number
  rngState: number
  createdAt: number
  status: GameStatus
  settings: GameSettings
  turn: number
  actionsLeft: number
  playerId: string
  countries: Country[]
  continents: Continent[]
  prices: Record<ResourceId, number>
  market: Record<ResourceId, MarketSnapshot>
  deals: TradeDeal[]
  logs: LogEntry[]
  history: HistoryPoint[]
  eventQueue: string[]
  seenEvents: string[]
  lastOutcome: EventOutcome | null
  eventHistory: EventHistoryRecord[]
}
