/* ── Visual / shell ─────────────────────────────────────────────────────── */

export type ThemeId = 'dark' | 'light' | 'latte' | 'frappe' | 'macchiato' | 'mocha'

export type PageId =
  | 'map'
  | 'budget'
  | 'governance'
  | 'industry'
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
}

export interface ResourceState {
  reserves: number
  extractionLevel: number
  refinementLevel: number
  stock: number
  advances: number
  researchLevel: number
  researchBonus?: number
}

export interface CountryStats {
  population: number
  gdp: number
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
  taxes: TaxRates
  ministries: Record<MinistryId, Ministry>
  resources: Record<ResourceId, ResourceState>
  military: Record<UnitId, number>
  relations: number
  externalApproval: number
  autoDeal: Record<ResourceId, AutoDealMode>
}

export interface TradeDeal {
  id: string
  countryId: string
  resource: ResourceId
  direction: 'import' | 'export'
  quantity: number
  unitPrice: number
  pricing: TradePricing
  remainingTurns: number
  auto: boolean
  createdAtTurn: number
}

export interface ResourceProduction {
  extractionCapacity: number
  refinementCapacity: number
  production: number
}

export interface ResourceFlow {
  production: number
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
  deals: TradeDeal[]
  logs: LogEntry[]
  history: HistoryPoint[]
  eventQueue: string[]
  seenEvents: string[]
  lastOutcome: EventOutcome | null
}
