import type {
  BudgetLevel,
  CompositeMetricKey,
  Difficulty,
  GameSettings,
  GovernmentId,
  MinistryId,
  ModifierBlock,
  PageId,
  ResourceCategory,
  ResourceId,
  ThemeId,
  TraitDefinition,
  UnitId,
} from './types'

/* ── Meta ──────────────────────────────────────────────────────────────── */

export const GAME_NAME = 'Country Strike'
export const GAME_TAGLINE = 'Ten actions. One country. A world to win.'
export const BASE_URL = '/countrystrike/'
export const GITHUB_URL = 'https://github.com/BanguDevClub/countrystrike'
export const ACTIONS_PER_TURN = 10
export const SAVE_KEY = 'countrystrike-save'
export const PREFS_KEY = 'countrystrike-prefs'
export const SAVE_VERSION = 1
export const HISTORY_LIMIT = 80

export const DEFAULT_SETTINGS: GameSettings = {
  sound: true,
  music: false,
  countries: 14,
  continents: 3,
  difficulty: 'normal',
}

export const THEMES: { id: ThemeId; name: string; family: string; swatch: string; bg: string }[] = [
  { id: 'dark', name: 'Midnight', family: 'Country Strike', swatch: '#7c9cff', bg: '#141925' },
  { id: 'light', name: 'Daylight', family: 'Country Strike', swatch: '#3e63dd', bg: '#ffffff' },
  { id: 'latte', name: 'Latte', family: 'Catppuccin', swatch: '#1e66f5', bg: '#eff1f5' },
  { id: 'frappe', name: 'Frappé', family: 'Catppuccin', swatch: '#8caaee', bg: '#303446' },
  { id: 'macchiato', name: 'Macchiato', family: 'Catppuccin', swatch: '#8aadf4', bg: '#24273a' },
  { id: 'mocha', name: 'Mocha', family: 'Catppuccin', swatch: '#89b4fa', bg: '#1e1e2e' },
]

/* ── Resources ─────────────────────────────────────────────────────────── */

export interface ResourceDefinition {
  id: ResourceId
  name: string
  category: ResourceCategory
  icon: string
  colorVar: string
  unit: string
  basePrice: number
  capacityPerLevel: number
  civilPerMillion: number
  blurb: string
}

export const RESOURCES: ResourceDefinition[] = [
  {
    id: 'water',
    name: 'Water',
    category: 'commodity',
    icon: 'Droplets',
    colorVar: '--res-water',
    unit: 'km³',
    basePrice: 2,
    capacityPerLevel: 32,
    civilPerMillion: 3,
    blurb: 'Fresh water for people, farms and industry. The quiet foundation of everything.',
  },
  {
    id: 'energy',
    name: 'Energy',
    category: 'commodity',
    icon: 'Zap',
    colorVar: '--res-energy',
    unit: 'TWh',
    basePrice: 18,
    capacityPerLevel: 60,
    civilPerMillion: 6,
    blurb: 'Grid capacity and fuel. Industry stalls without a reliable baseload.',
  },
  {
    id: 'agriculture',
    name: 'Agriculture',
    category: 'commodity',
    icon: 'Wheat',
    colorVar: '--res-agriculture',
    unit: 'Mt',
    basePrice: 12,
    capacityPerLevel: 38,
    civilPerMillion: 4,
    blurb: 'Staple crops and food security. Cheap to expand, dangerous to lose.',
  },
  {
    id: 'livestock',
    name: 'Livestock',
    category: 'commodity',
    icon: 'Beef',
    colorVar: '--res-livestock',
    unit: 'Mt',
    basePrice: 30,
    capacityPerLevel: 17,
    civilPerMillion: 1.8,
    blurb: 'Protein production and rural employment. Weather-sensitive and tradeable.',
  },
  {
    id: 'oil',
    name: 'Oil',
    category: 'strategic',
    icon: 'Fuel',
    colorVar: '--res-oil',
    unit: 'Mbbl',
    basePrice: 180,
    capacityPerLevel: 11,
    civilPerMillion: 1.2,
    blurb: 'The logistics resource. Armies, ships and aircraft burn through it.',
  },
  {
    id: 'metal',
    name: 'Metal',
    category: 'strategic',
    icon: 'Pickaxe',
    colorVar: '--res-metal',
    unit: 'kt',
    basePrice: 120,
    capacityPerLevel: 4.5,
    civilPerMillion: 0.5,
    blurb: 'Steel, alloys and shipyards. Tanks and infrastructure consume it.',
  },
  {
    id: 'rareEarth',
    name: 'Rare Earth',
    category: 'strategic',
    icon: 'Gem',
    colorVar: '--res-rareEarth',
    unit: 'kt',
    basePrice: 900,
    capacityPerLevel: 1.1,
    civilPerMillion: 0.1,
    blurb: 'Magnets, electronics and precision weapons. Scarce, pricey and strategic.',
  },
  {
    id: 'uranium',
    name: 'Uranium',
    category: 'strategic',
    icon: 'Atom',
    colorVar: '--res-uranium',
    unit: 't',
    basePrice: 700,
    capacityPerLevel: 0.35,
    civilPerMillion: 0.02,
    blurb: 'Reactor fuel and the core of a nuclear deterrent. Hard to find, harder to refine.',
  },
]

export const RESOURCE_IDS = RESOURCES.map((r) => r.id)
export const RESOURCE_BY_ID = Object.fromEntries(RESOURCES.map((r) => [r.id, r])) as Record<
  ResourceId,
  ResourceDefinition
>

/* ── Military ──────────────────────────────────────────────────────────── */

export interface UnitDefinition {
  id: UnitId
  name: string
  icon: string
  description: string
  recruitCost: number
  upkeep: number
  power: number
  step: number
  resourceCost: Partial<Record<ResourceId, number>>
  upkeepResources: Partial<Record<ResourceId, number>>
}

export const UNITS: UnitDefinition[] = [
  {
    id: 'soldiers',
    name: 'Soldiers',
    icon: 'Users',
    description: 'Personnel. The backbone of security and the first line of defence.',
    recruitCost: 0.15,
    upkeep: 0.08,
    power: 0.001,
    step: 1_000,
    resourceCost: {},
    upkeepResources: { water: 0.00002, energy: 0.0001, agriculture: 0.00003, oil: 0.00008 },
  },
  {
    id: 'tanks',
    name: 'Tanks',
    icon: 'Shield',
    description: 'Armoured ground forces. Metal-hungry, oil-thirsty, decisive in a land war.',
    recruitCost: 27,
    upkeep: 2,
    power: 0.05,
    step: 10,
    resourceCost: { metal: 0.08, oil: 0.03 },
    upkeepResources: { oil: 0.01, metal: 0.003 },
  },
  {
    id: 'jets',
    name: 'Fighter Jets',
    icon: 'Plane',
    description: 'Air superiority. High upfront cost and a constant appetite for rare earth.',
    recruitCost: 270,
    upkeep: 22,
    power: 2,
    step: 5,
    resourceCost: { rareEarth: 0.08, metal: 0.05 },
    upkeepResources: { oil: 0.4, rareEarth: 0.02 },
  },
  {
    id: 'warships',
    name: 'Warships',
    icon: 'Ship',
    description: 'Blue-water projection. Expensive to build, maintain and replace.',
    recruitCost: 4_800,
    upkeep: 350,
    power: 5,
    step: 1,
    resourceCost: { metal: 0.9, rareEarth: 0.05 },
    upkeepResources: { oil: 3, metal: 0.3, rareEarth: 0.01 },
  },
  {
    id: 'missiles',
    name: 'Missiles',
    icon: 'Rocket',
    description: 'Precision strike and deterrence. Rare earth guidance, metal airframes.',
    recruitCost: 90,
    upkeep: 4,
    power: 0.3,
    step: 10,
    resourceCost: { rareEarth: 0.04, metal: 0.03 },
    upkeepResources: { rareEarth: 0.01, metal: 0.02, oil: 0.02 },
  },
  {
    id: 'nukes',
    name: 'Nukes',
    icon: 'Radiation',
    description: 'The ultimate deterrent. Few in number, enormous in consequence.',
    recruitCost: 2_700,
    upkeep: 120,
    power: 10,
    step: 1,
    resourceCost: { uranium: 0.8, rareEarth: 0.005 },
    upkeepResources: { uranium: 0.2, rareEarth: 0.005 },
  },
]

export const UNIT_BY_ID = Object.fromEntries(UNITS.map((u) => [u.id, u])) as Record<
  UnitId,
  UnitDefinition
>
export const UNIT_IDS = UNITS.map((u) => u.id)

/* ── Government ────────────────────────────────────────────────────────── */

export interface GovernmentDefinition {
  id: GovernmentId
  name: string
  icon: string
  description: string
  buff: string
  debuff: string
  giniTarget: number
  modifiers: Partial<ModifierBlock>
}

export const GOVERNMENTS: GovernmentDefinition[] = [
  {
    id: 'democracy',
    name: 'Democracy',
    icon: 'Landmark',
    description: 'Elected president and ministers. Legitimacy is renewed at the ballot box.',
    buff: 'Tax collection +6%, approval +8, corruption −8',
    debuff: 'Military upkeep +5%; slower crisis response',
    giniTarget: 36,
    modifiers: { taxEfficiency: 0.06, approval: 8, corruption: -8, militaryUpkeep: 0.05 },
  },
  {
    id: 'kingdom',
    name: 'Kingdom',
    icon: 'Crown',
    description: 'A hereditary crown governs with a council of ministers and old institutions.',
    buff: 'Approval +3, corruption +4, growth +3%',
    debuff: 'Tax collection +2%; reform costs more',
    giniTarget: 42,
    modifiers: { approval: 3, corruption: 4, growth: 0.03, taxEfficiency: 0.02 },
  },
  {
    id: 'empire',
    name: 'Empire',
    icon: 'Swords',
    description: 'A vast state built for expansion, with a professional military class.',
    buff: 'Military upkeep −10%, security +6',
    debuff: 'Approval −8, corruption +6',
    giniTarget: 48,
    modifiers: { militaryUpkeep: -0.1, security: 6, approval: -8, corruption: 6 },
  },
  {
    id: 'dictatorship',
    name: 'Dictatorship',
    icon: 'Eye',
    description: 'One ruler, a loyal apparatus, and very little patience for dissent.',
    buff: 'Security +10, corruption +12, military upkeep −5%',
    debuff: 'Approval −12, tax collection −5%',
    giniTarget: 47,
    modifiers: {
      security: 10,
      corruption: 12,
      militaryUpkeep: -0.05,
      approval: -12,
      taxEfficiency: -0.05,
    },
  },
  {
    id: 'communistAnarchy',
    name: 'Communist Anarchy',
    icon: 'Flag',
    description:
      'Workers’ councils and revolutionary committees replace the old machinery of state.',
    buff: 'Approval +5, corruption −10, Gini target lower',
    debuff: 'Tax collection −12%, growth −2%',
    giniTarget: 28,
    modifiers: { approval: 5, corruption: -10, taxEfficiency: -0.12, growth: -0.02 },
  },
  {
    id: 'capitalistAnarchy',
    name: 'Capitalist Anarchy',
    icon: 'Coins',
    description: 'Markets outrun the state. Trade booms; public services learn to improvise.',
    buff: 'Trade +12%, growth +4%, military upkeep +4%',
    debuff: 'Tax collection −10%, corruption +6, Gini target higher',
    giniTarget: 54,
    modifiers: {
      trade: 0.12,
      growth: 0.04,
      taxEfficiency: -0.1,
      corruption: 6,
      militaryUpkeep: 0.04,
    },
  },
]

export const GOVERNMENT_BY_ID = Object.fromEntries(GOVERNMENTS.map((g) => [g.id, g])) as Record<
  GovernmentId,
  GovernmentDefinition
>

/* ── Ministries ────────────────────────────────────────────────────────── */

export interface MinistryDefinition {
  id: MinistryId
  name: string
  icon: string
  description: string
  focus: string
  budgetCost: Record<BudgetLevel, number>
}

export const MINISTRIES: MinistryDefinition[] = [
  {
    id: 'finance',
    name: 'Ministry of Finance',
    icon: 'Calculator',
    description: 'Collects taxes, manages debt and keeps the books honest.',
    focus: 'Tax efficiency and credit',
    budgetCost: { low: 0.004, normal: 0.008, high: 0.016 },
  },
  {
    id: 'foreign',
    name: 'Ministry of Foreign Affairs',
    icon: 'Globe',
    description: 'Runs embassies, trade delegations and the slow work of diplomacy.',
    focus: 'Relations and trade',
    budgetCost: { low: 0.004, normal: 0.008, high: 0.016 },
  },
  {
    id: 'defense',
    name: 'Ministry of Defense',
    icon: 'Shield',
    description: 'Maintains the armed forces and the chain of command behind them.',
    focus: 'Military readiness and security',
    budgetCost: { low: 0.004, normal: 0.008, high: 0.016 },
  },
  {
    id: 'industry',
    name: 'Ministry of Industry',
    icon: 'Factory',
    description: 'Coordinates extraction, refining and strategic industrial policy.',
    focus: 'Resource production',
    budgetCost: { low: 0.004, normal: 0.008, high: 0.016 },
  },
  {
    id: 'interior',
    name: 'Ministry of the Interior',
    icon: 'Building',
    description: 'Police, civil order and the unglamorous machinery of the state.',
    focus: 'Security and corruption',
    budgetCost: { low: 0.004, normal: 0.008, high: 0.016 },
  },
  {
    id: 'health',
    name: 'Ministry of Health',
    icon: 'HeartPulse',
    description: 'Hospitals, public health and the human side of national strength.',
    focus: 'HDI and approval',
    budgetCost: { low: 0.004, normal: 0.008, high: 0.016 },
  },
]

export const MINISTRY_BY_ID = Object.fromEntries(MINISTRIES.map((m) => [m.id, m])) as Record<
  MinistryId,
  MinistryDefinition
>
export const MINISTRY_IDS = MINISTRIES.map((m) => m.id)

export const BUDGET_MULTIPLIERS: Record<BudgetLevel, number> = {
  low: -1,
  normal: 0,
  high: 1,
}

export const MINISTRY_COST_FACTORS: Record<BudgetLevel, number> = {
  low: 0.004,
  normal: 0.008,
  high: 0.016,
}

/* ── Traits ────────────────────────────────────────────────────────────── */

export const CULTURES: TraitDefinition[] = [
  {
    id: 'mercantile',
    name: 'Mercantile',
    kind: 'culture',
    description: 'Ports, ledgers and a long memory for a good deal.',
    effectText: 'Trade +10%, tax efficiency +3%',
    modifiers: { trade: 0.1, taxEfficiency: 0.03 },
    tone: 'positive',
  },
  {
    id: 'martial',
    name: 'Martial',
    kind: 'culture',
    description: 'Service is honoured, and the officer corps is a career for the ambitious.',
    effectText: 'Military upkeep −8%, security +8, approval −2',
    modifiers: { militaryUpkeep: -0.08, security: 8, approval: -2 },
    tone: 'mixed',
  },
  {
    id: 'scholarly',
    name: 'Scholarly',
    kind: 'culture',
    description: 'Universities, laboratories and a healthy disrespect for received wisdom.',
    effectText: 'Research +15%, economic growth +2%',
    modifiers: { research: 0.15, growth: 0.02 },
    tone: 'positive',
  },
  {
    id: 'agrarian',
    name: 'Agrarian',
    kind: 'culture',
    description: 'The countryside feeds the nation and the nation remembers its debt.',
    effectText: 'Water, agriculture and livestock extraction +8%; growth +3%',
    modifiers: {
      growth: 0.03,
      resource: {
        water: { extraction: 0.08 },
        agriculture: { extraction: 0.08 },
        livestock: { extraction: 0.08 },
      },
    },
    tone: 'positive',
  },
  {
    id: 'industrial',
    name: 'Industrial',
    kind: 'culture',
    description: 'Smokestacks and supply chains are civic monuments.',
    effectText: 'Extraction +10%, resource consumption +4%',
    modifiers: { extraction: 0.1, consumption: 0.04 },
    tone: 'mixed',
  },
  {
    id: 'seafaring',
    name: 'Seafaring',
    kind: 'culture',
    description: 'The horizon is a road, not a border.',
    effectText: 'Trade +8%; water and oil reserves +10%',
    modifiers: {
      trade: 0.08,
      resource: { water: { reserves: 0.1 }, oil: { reserves: 0.1 } },
    },
    tone: 'positive',
  },
  {
    id: 'devout',
    name: 'Devout',
    kind: 'culture',
    description: 'Shared faith steadies the nation through lean years.',
    effectText: 'Approval +4, corruption −3, research −5%',
    modifiers: { approval: 4, corruption: -3, research: -0.05 },
    tone: 'mixed',
  },
  {
    id: 'collectivist',
    name: 'Collectivist',
    kind: 'culture',
    description: 'The collective is expected to carry what the individual cannot.',
    effectText: 'Corruption −7, tax efficiency +4%, trade −4%',
    modifiers: { corruption: -7, taxEfficiency: 0.04, trade: -0.04 },
    tone: 'mixed',
  },
]

export const BIOMES: TraitDefinition[] = [
  {
    id: 'temperate',
    name: 'Temperate',
    kind: 'biome',
    description: 'Mild seasons and dependable rainfall.',
    effectText: 'Growth +4%, approval +2',
    modifiers: { growth: 0.04, approval: 2 },
    tone: 'positive',
  },
  {
    id: 'desert',
    name: 'Desert',
    kind: 'biome',
    description: 'Sun, sand and aquifers that do not refill quickly.',
    effectText: 'Energy extraction +20%; water reserves −25%; agriculture extraction −20%',
    modifiers: {
      resource: {
        energy: { extraction: 0.2 },
        water: { reserves: -0.25 },
        agriculture: { extraction: -0.2 },
      },
    },
    tone: 'mixed',
  },
  {
    id: 'tropical',
    name: 'Tropical',
    kind: 'biome',
    description: 'Heat, rain and relentless biological productivity.',
    effectText: 'Agriculture and livestock extraction +15%; water +10%; energy consumption +5%',
    modifiers: {
      resource: {
        agriculture: { extraction: 0.15 },
        livestock: { extraction: 0.15 },
        water: { extraction: 0.1 },
        energy: { consumption: 0.05 },
      },
    },
    tone: 'positive',
  },
  {
    id: 'tundra',
    name: 'Tundra',
    kind: 'biome',
    description: 'Frozen ground, short summers and buried mineral wealth.',
    effectText: 'Energy consumption +12%; agriculture −15%; metal and uranium reserves +10%',
    modifiers: {
      resource: {
        energy: { consumption: 0.12 },
        agriculture: { extraction: -0.15 },
        metal: { reserves: 0.1 },
        uranium: { reserves: 0.1 },
      },
    },
    tone: 'mixed',
  },
  {
    id: 'alpine',
    name: 'Alpine',
    kind: 'biome',
    description: 'High passes, hard rock and hydroelectric potential.',
    effectText: 'Metal and uranium reserves +20%; energy extraction +8%; agriculture −10%',
    modifiers: {
      resource: {
        metal: { reserves: 0.2 },
        uranium: { reserves: 0.2 },
        energy: { extraction: 0.08 },
        agriculture: { extraction: -0.1 },
      },
    },
    tone: 'mixed',
  },
  {
    id: 'coastal',
    name: 'Coastal',
    kind: 'biome',
    description: 'A long shoreline and a culture pointed at the sea.',
    effectText: 'Trade +6%; water extraction +15%; energy consumption −3%',
    modifiers: {
      trade: 0.06,
      resource: { water: { extraction: 0.15 }, energy: { consumption: -0.03 } },
    },
    tone: 'positive',
  },
  {
    id: 'steppe',
    name: 'Steppe',
    kind: 'biome',
    description: 'Open grassland, grazing herds and a wind that never stops.',
    effectText: 'Livestock extraction +20%; agriculture +5%; water reserves −10%',
    modifiers: {
      resource: {
        livestock: { extraction: 0.2 },
        agriculture: { extraction: 0.05 },
        water: { reserves: -0.1 },
      },
    },
    tone: 'positive',
  },
]

export const WEATHERS: TraitDefinition[] = [
  {
    id: 'mild',
    name: 'Mild Seasons',
    kind: 'weather',
    description: 'Predictable weather keeps harvests and construction on schedule.',
    effectText: 'Growth +3%, approval +1',
    modifiers: { growth: 0.03, approval: 1 },
    tone: 'positive',
  },
  {
    id: 'monsoon',
    name: 'Monsoon',
    kind: 'weather',
    description: 'A seasonal deluge that fills reservoirs and floods the roads.',
    effectText: 'Water reserves +20%, agriculture extraction +10%, energy consumption +4%',
    modifiers: {
      resource: {
        water: { reserves: 0.2 },
        agriculture: { extraction: 0.1 },
        energy: { consumption: 0.04 },
      },
    },
    tone: 'mixed',
  },
  {
    id: 'drought',
    name: 'Drought Belt',
    kind: 'weather',
    description: 'Rivers shrink, reservoirs crack and the cities count the days.',
    effectText: 'Water reserves −20%, agriculture extraction −10%, approval −2',
    modifiers: {
      approval: -2,
      resource: { water: { reserves: -0.2 }, agriculture: { extraction: -0.1 } },
    },
    tone: 'negative',
  },
  {
    id: 'storm',
    name: 'Storm Belt',
    kind: 'weather',
    description: 'Frequent gales batter the coast and test every transmission line.',
    effectText: 'Energy extraction +15%, trade −3%, military upkeep +3%',
    modifiers: {
      militaryUpkeep: 0.03,
      trade: -0.03,
      resource: { energy: { extraction: 0.15 } },
    },
    tone: 'mixed',
  },
  {
    id: 'frozen',
    name: 'Long Winter',
    kind: 'weather',
    description: 'Heating bills arrive before autumn ends.',
    effectText: 'Energy consumption +10%, growth −2%, approval −1',
    modifiers: {
      growth: -0.02,
      approval: -1,
      resource: { energy: { consumption: 0.1 } },
    },
    tone: 'negative',
  },
  {
    id: 'sunbelt',
    name: 'Sun Belt',
    kind: 'weather',
    description: 'Clear skies, solar farms and a permanent outdoor season.',
    effectText: 'Energy extraction +20%, approval +2, water reserves −10%',
    modifiers: {
      approval: 2,
      resource: { energy: { extraction: 0.2 }, water: { reserves: -0.1 } },
    },
    tone: 'positive',
  },
]

export const BONUS_TRAITS: TraitDefinition[] = [
  {
    id: 'resourceRich',
    name: 'Resource Rich',
    kind: 'bonus',
    description: 'Generous geology and a long history of extraction.',
    effectText: 'All reserves +15%',
    modifiers: { reserves: 0.15 },
    tone: 'positive',
  },
  {
    id: 'fertileLands',
    name: 'Fertile Lands',
    kind: 'bonus',
    description: 'Deep soils and reliable growing seasons.',
    effectText: 'Agriculture and livestock extraction +15%',
    modifiers: {
      resource: {
        agriculture: { extraction: 0.15 },
        livestock: { extraction: 0.15 },
      },
    },
    tone: 'positive',
  },
  {
    id: 'tradeHub',
    name: 'Trade Hub',
    kind: 'bonus',
    description: 'A crossroads of routes, warehouses and clearing houses.',
    effectText: 'Trade +10%, growth +2%',
    modifiers: { trade: 0.1, growth: 0.02 },
    tone: 'positive',
  },
  {
    id: 'militarized',
    name: 'Militarized Society',
    kind: 'bonus',
    description: 'The barracks is a civic institution.',
    effectText: 'Military upkeep −10%, security +6, approval −2',
    modifiers: { militaryUpkeep: -0.1, security: 6, approval: -2 },
    tone: 'mixed',
  },
  {
    id: 'techCluster',
    name: 'Tech Cluster',
    kind: 'bonus',
    description: 'Research parks, patents and a deep pool of engineers.',
    effectText: 'Research +18%, growth +3%',
    modifiers: { research: 0.18, growth: 0.03 },
    tone: 'positive',
  },
  {
    id: 'corruptElite',
    name: 'Corrupt Elite',
    kind: 'bonus',
    description: 'A small network controls most of the economy.',
    effectText: 'Corruption +12, tax efficiency −5%',
    modifiers: { corruption: 12, taxEfficiency: -0.05 },
    tone: 'negative',
  },
  {
    id: 'youngNation',
    name: 'Young Nation',
    kind: 'bonus',
    description: 'A demographic bulge and an appetite for the future.',
    effectText: 'Growth +5%, approval +1',
    modifiers: { growth: 0.05, approval: 1 },
    tone: 'positive',
  },
  {
    id: 'agedSociety',
    name: 'Aged Society',
    kind: 'bonus',
    description: 'Experienced institutions and a shrinking labour force.',
    effectText: 'Research +8%, growth −3%',
    modifiers: { research: 0.08, growth: -0.03 },
    tone: 'mixed',
  },
  {
    id: 'stormyCoasts',
    name: 'Stormy Coasts',
    kind: 'bonus',
    description: 'A hazardous shoreline where the grid is always being rebuilt.',
    effectText: 'Energy extraction +10%, trade −4%',
    modifiers: {
      trade: -0.04,
      resource: { energy: { extraction: 0.1 } },
    },
    tone: 'mixed',
  },
  {
    id: 'diplomaticCorps',
    name: 'Diplomatic Corps',
    kind: 'bonus',
    description: 'A professional foreign service with friends in useful places.',
    effectText: 'Starting relations +8, approval +2',
    modifiers: { relation: 8, approval: 2 },
    tone: 'positive',
  },
]

export const ALL_TRAITS = [...CULTURES, ...BIOMES, ...WEATHERS, ...BONUS_TRAITS]
export const TRAIT_BY_ID = Object.fromEntries(ALL_TRAITS.map((t) => [t.id, t])) as Record<
  string,
  TraitDefinition
>

/* ── Difficulty ────────────────────────────────────────────────────────── */

export interface DifficultyDefinition {
  id: Difficulty
  name: string
  tagline: string
  description: string
  aiActions: number
  hostileAt: number | null
  aggression: number
  icon: string
}

export const DIFFICULTIES: DifficultyDefinition[] = [
  {
    id: 'easy',
    name: 'Easy',
    tagline: 'Build in peace',
    description:
      'No hostile countries. Rival governments take no actions. The world is yours to learn.',
    aiActions: 0,
    hostileAt: null,
    aggression: 0,
    icon: 'Sprout',
  },
  {
    id: 'normal',
    name: 'Normal',
    tagline: 'A living world',
    description: 'Rivals act three times per turn and turn hostile at −100 relations.',
    aiActions: 3,
    hostileAt: -100,
    aggression: 0.4,
    icon: 'Scale',
  },
  {
    id: 'hard',
    name: 'Hard',
    tagline: 'Every mistake costs',
    description: 'Rivals optimize five actions per turn and turn hostile at −50 relations.',
    aiActions: 5,
    hostileAt: -50,
    aggression: 0.75,
    icon: 'Flame',
  },
]

export const DIFFICULTY_BY_ID = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d])) as Record<
  Difficulty,
  DifficultyDefinition
>

/* ── Scoring ───────────────────────────────────────────────────────────── */

export interface CompositeMetric {
  key: CompositeMetricKey
  label: string
  weight: number
  direction: 'high' | 'low'
  formula: string
}

export const COMPOSITE_METRICS: CompositeMetric[] = [
  {
    key: 'treasury',
    label: 'Treasure',
    weight: 20,
    direction: 'high',
    formula: 'normalize(log10(max(treasury, 0) + 1))',
  },
  {
    key: 'debt',
    label: 'Debt',
    weight: 17,
    direction: 'low',
    formula: '1 − normalize(debt)',
  },
  {
    key: 'gdp',
    label: 'GDP',
    weight: 15,
    direction: 'high',
    formula: 'normalize(log10(GDP))',
  },
  {
    key: 'population',
    label: 'Population',
    weight: 12,
    direction: 'high',
    formula: 'normalize(log10(population))',
  },
  {
    key: 'militaryPower',
    label: 'Military Power',
    weight: 10,
    direction: 'high',
    formula: 'normalize(Σ units × power weight)',
  },
  {
    key: 'approval',
    label: 'Approval',
    weight: 8,
    direction: 'high',
    formula: 'normalize(approval)',
  },
  {
    key: 'hdi',
    label: 'HDI',
    weight: 7,
    direction: 'high',
    formula: 'normalize(HDI)',
  },
  {
    key: 'gini',
    label: 'Gini',
    weight: 5,
    direction: 'low',
    formula: '1 − normalize(Gini)',
  },
  {
    key: 'violence',
    label: 'Violence Rate',
    weight: 3,
    direction: 'low',
    formula: '1 − normalize(violence)',
  },
  {
    key: 'depression',
    label: 'Depression Rate',
    weight: 3,
    direction: 'low',
    formula: '1 − normalize(depression)',
  },
]

export const COMPOSITE_WEIGHT_TOTAL = COMPOSITE_METRICS.reduce((sum, m) => sum + m.weight, 0)

/* ── Trade / prices ────────────────────────────────────────────────────── */

export const TRADE_PRICING: Record<
  TradePricingLabel,
  { label: string; multiplier: number; relation: number; hint: string; tone: string }
> = {
  below: {
    label: 'Below market',
    multiplier: 0.8,
    relation: 10,
    hint: 'You pay 80% of market value. The partner gains less money but a lot of goodwill.',
    tone: 'positive',
  },
  market: {
    label: 'At market',
    multiplier: 1,
    relation: 3,
    hint: 'A fair deal at the reference price. A modest diplomatic gain.',
    tone: 'neutral',
  },
  above: {
    label: 'Above market',
    multiplier: 1.25,
    relation: 0,
    hint: 'You pay 125% of market value. Financially generous, diplomatically neutral.',
    tone: 'negative',
  },
}

type TradePricingLabel = 'below' | 'market' | 'above'

export const DEAL_QUANTITIES = [5, 10, 15, 20]
export const DEAL_DURATION = 5
export const AUTO_DEAL_DURATION = 3
export const AUTO_DEAL_MIN_QUANTITY = 1
export const AUTO_DEAL_MODES = ['off', 'below', 'market', 'above'] as const

/* ── Map layout ────────────────────────────────────────────────────────── */

export const MAP_WIDTH = 1000
export const MAP_HEIGHT = 560

export interface ContinentSlot {
  cx: number
  cy: number
  rx: number
  ry: number
  rot: number
}

export const CONTINENT_LAYOUTS: Record<number, ContinentSlot[]> = {
  1: [{ cx: 500, cy: 280, rx: 360, ry: 205, rot: 0 }],
  2: [
    { cx: 285, cy: 285, rx: 225, ry: 185, rot: -8 },
    { cx: 735, cy: 275, rx: 230, ry: 175, rot: 7 },
  ],
  3: [
    { cx: 255, cy: 315, rx: 205, ry: 165, rot: -6 },
    { cx: 755, cy: 325, rx: 195, ry: 155, rot: 8 },
    { cx: 500, cy: 145, rx: 245, ry: 105, rot: 2 },
  ],
  4: [
    { cx: 245, cy: 180, rx: 185, ry: 120, rot: -7 },
    { cx: 760, cy: 175, rx: 185, ry: 120, rot: 7 },
    { cx: 255, cy: 400, rx: 170, ry: 115, rot: 5 },
    { cx: 750, cy: 400, rx: 180, ry: 120, rot: -5 },
  ],
  5: [
    { cx: 190, cy: 190, rx: 155, ry: 108, rot: -8 },
    { cx: 455, cy: 145, rx: 170, ry: 95, rot: 3 },
    { cx: 785, cy: 195, rx: 155, ry: 105, rot: 8 },
    { cx: 300, cy: 415, rx: 165, ry: 100, rot: 4 },
    { cx: 700, cy: 415, rx: 165, ry: 105, rot: -4 },
  ],
}

export const CELL_COLORS = [
  '#6f8f6a',
  '#8b7b58',
  '#5f877f',
  '#7f6f94',
  '#7a8a5b',
  '#94725f',
  '#5f7f96',
  '#8a746b',
  '#657f8f',
  '#847d53',
  '#6f7d68',
  '#8c6f87',
]

/* ── Names ─────────────────────────────────────────────────────────────── */

export const COUNTRY_ROOTS = [
  'Aur',
  'Bel',
  'Cor',
  'Drav',
  'Ely',
  'Fen',
  'Gal',
  'Hel',
  'Ith',
  'Jor',
  'Kae',
  'Lum',
  'Mor',
  'Nes',
  'Or',
  'Pyr',
  'Quel',
  'Rho',
  'Sar',
  'Tyr',
  'Ura',
  'Val',
  'Wyn',
  'Xan',
  'Yor',
  'Zel',
]

export const COUNTRY_SUFFIXES = [
  'ia',
  'ora',
  'esh',
  'vale',
  'gard',
  'stan',
  'mark',
  'avia',
  'land',
  'burg',
  'nesia',
  'tania',
  'dor',
  'mir',
  'fell',
  'reach',
]

export const CAPITAL_ROOTS = [
  'Ald',
  'Brem',
  'Cald',
  'Dun',
  'Eld',
  'Fen',
  'Glen',
  'Hav',
  'Inn',
  'Jar',
  'Kars',
  'Lark',
  'Mor',
  'Nor',
  'Ost',
  'Pell',
  'Quar',
  'Rav',
  'Sel',
  'Tor',
  'Ulm',
  'Ves',
  'Wen',
  'Yar',
]

export const CAPITAL_SUFFIXES = [
  'burg',
  'ford',
  'haven',
  'gate',
  'vale',
  'hold',
  'cross',
  'reach',
  'fall',
  'stone',
  'port',
  'field',
]

export const CONTINENT_NAMES = [
  'Aurelia',
  'Vespera',
  'Neridia',
  'Kharis',
  'Solace',
  'Oceana',
  'Tessara',
  'Myrrha',
  'Elvara',
  'Brindle',
  'Camorra',
  'Sundara',
]

export const FIRST_NAMES = [
  'Adela',
  'Boris',
  'Camille',
  'Dmitri',
  'Elena',
  'Farid',
  'Greta',
  'Hugo',
  'Ines',
  'Jonas',
  'Keiko',
  'Lars',
  'Maya',
  'Nadia',
  'Omar',
  'Priya',
  'Quinn',
  'Rosa',
  'Sven',
  'Tomas',
  'Ula',
  'Viktor',
  'Wren',
  'Yara',
  'Zane',
  'Amara',
  'Benedikt',
  'Celeste',
  'Dario',
  'Esme',
]

export const LAST_NAMES = [
  'Adeyemi',
  'Bauer',
  'Costa',
  'Duarte',
  'Eriksen',
  'Ferreira',
  'Gallo',
  'Haas',
  'Ibrahim',
  'Jansen',
  'Kovac',
  'Lund',
  'Moreau',
  'Novak',
  'Okafor',
  'Pereira',
  'Quintero',
  'Rossi',
  'Sato',
  'Tavares',
  'Ueda',
  'Varga',
  'Weber',
  'Yilmaz',
  'Zhang',
  'Bianchi',
  'Dahl',
  'Fontaine',
  'Guerra',
  'Holm',
]

/* ── Navigation ────────────────────────────────────────────────────────── */

export interface PageDefinition {
  id: PageId
  label: string
  short: string
  title: string
  subtitle: string
  icon: string
}

export const PAGES: PageDefinition[] = [
  {
    id: 'map',
    label: 'World Map',
    short: 'Map',
    title: 'The World',
    subtitle: 'Your nation among the powers. Click any country to open its dossier.',
    icon: 'Globe',
  },
  {
    id: 'budget',
    label: 'Budget',
    short: 'Budget',
    title: 'Budget & Resources',
    subtitle: 'Every coin and every tonne. Balance the books before the world balances you.',
    icon: 'ChartNoAxesCombined',
  },
  {
    id: 'governance',
    label: 'Governance',
    short: 'Govern',
    title: 'Governance',
    subtitle: 'Taxes, ministries and the delicate art of keeping a country together.',
    icon: 'Landmark',
  },
  {
    id: 'industry',
    label: 'Industry',
    short: 'Industry',
    title: 'Industry',
    subtitle: 'Prospect, extract, refine and research the resources underneath your feet.',
    icon: 'Factory',
  },
  {
    id: 'military',
    label: 'Military',
    short: 'Military',
    title: 'Military',
    subtitle: 'Deterrence has a price. Pay it in money, metal and rare earth.',
    icon: 'Shield',
  },
  {
    id: 'trade',
    label: 'Global Trading',
    short: 'Trade',
    title: 'Global Trading',
    subtitle: 'Buy low, sell high, and turn a surplus into goodwill.',
    icon: 'HandCoins',
  },
  {
    id: 'ranking',
    label: 'Global Ranking',
    short: 'Ranking',
    title: 'Global Ranking',
    subtitle: 'The composite score weighs treasure, power and human outcomes. Climb it.',
    icon: 'Trophy',
  },
  {
    id: 'logs',
    label: 'Global Logs',
    short: 'Logs',
    title: 'Global Logs',
    subtitle: 'Every action, every turn, every consequence. Filter the record.',
    icon: 'ScrollText',
  },
  {
    id: 'methodology',
    label: 'Methodology',
    short: 'Method',
    title: 'Methodology',
    subtitle: 'The equations behind the world. No mystery, no hidden multipliers.',
    icon: 'Sigma',
  },
]
