import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  ACTIONS_PER_TURN,
  COMMERCE_GOOD_IDS,
  CURRENCY_DENOMINATIONS,
  DEAL_DURATION,
  FIRST_NAMES,
  GOVERNMENT_BY_ID,
  LAST_NAMES,
  RESOURCE_BY_ID,
  RESOURCE_IDS,
  SAVE_KEY,
  SAVE_VERSION,
  TRADE_PRICING,
  UNIT_BY_ID,
  normalizeSettings,
} from '../game/constants'
import type {
  AutoDealMode,
  CommerceGoodId,
  Country,
  EventChoice,
  EventHistoryRecord,
  EventOutcome,
  EventStatSnapshot,
  GameSettings,
  GameState,
  IndustryAction,
  MinistryId,
  ModalState,
  PageId,
  ResourceId,
  Toast,
  TradeDeal,
  TradePricing,
  UnitId,
  BudgetLevel,
} from '../game/types'
import { RNG, clamp, roundTo } from '../game/rng'
import { generateWorld } from '../game/worldgen'
import {
  advanceTurn,
  approvalCampaignCost,
  diplomaticMissionCost,
  getPlayer,
  industryActionCost,
  INDUSTRY_ACTION_LABELS,
  mergerCost,
  ministryActionCost,
  seedHistory,
  pushLog,
  unitPurchasePlan,
  warMobilizationCost,
} from '../game/engine'
import {
  combinedModifiers,
  computeBudget,
  computeMarket,
  debtLimit,
  militaryPower,
  resourceFlows,
} from '../game/selectors'
import { EVENT_BY_ID, applyEventEffects, resolveEventForGame } from '../game/events'
import { formatMoney, formatQuantity, titleCase } from '../game/format'

interface GameStore {
  game: GameState | null
  page: PageId
  modal: ModalState
  toast: Toast | null

  startGame: (settings: GameSettings) => void
  chooseCountry: (countryId: string) => void
  openNewGame: () => void
  abandonGame: () => void
  setPage: (page: PageId) => void
  openCountry: (countryId: string) => void
  closeModal: () => void
  openTurnBriefing: () => void
  clearToast: () => void
  endTurn: () => void

  setTax: (key: keyof Country['taxes'], value: number) => void
  setCommercePolicy: (id: CommerceGoodId, value: number) => void
  setDebtRate: (value: number) => void
  adjustDebt: (delta: number) => void
  setMinistryBudget: (id: MinistryId, budget: BudgetLevel) => void
  replaceMinister: (id: MinistryId) => void
  auditMinister: (id: MinistryId) => void
  upgradeMinistry: (id: MinistryId) => void
  trainMinister: (id: MinistryId) => void
  beginIndustry: (resourceId: ResourceId, action: IndustryAction) => void
  rollCheck: () => void
  rollBreakthrough: () => void

  recruit: (unitId: UnitId, quantity: number) => void
  disband: (unitId: UnitId, quantity: number) => void

  signDeal: (
    countryId: string,
    resourceId: ResourceId,
    direction: 'import' | 'export',
    pricing: TradePricing,
    quantity: number,
  ) => void
  cancelDeal: (dealId: string) => void
  setAutoDeal: (resourceId: ResourceId, mode: AutoDealMode) => void

  beginDiplomacy: (countryId: string) => void
  beginApproval: (countryId: string) => void
  mergeCountry: (countryId: string) => void
  beginWar: (countryId: string) => void

  resolveEvent: (choiceId: string, targetEventId?: string, showResultModal?: boolean) => void
}

const makeId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const toToast = (message: string, tone: Toast['tone'] = 'neutral'): Toast => ({
  id: Date.now() + Math.random(),
  message,
  tone,
})

const cloneGame = (game: GameState): GameState => structuredClone(game)

function migrateTradeDeals(game: GameState): void {
  const rawDeals = game.deals as unknown as Array<Record<string, unknown>>
  if (!Array.isArray(rawDeals) || rawDeals.length === 0) return
  const playerId = game.playerId || game.countries.find((country) => country.isPlayer)?.id || ''
  game.deals = rawDeals.map((raw, index) => {
    if (typeof raw.buyerId === 'string' && typeof raw.sellerId === 'string') {
      return raw as unknown as TradeDeal
    }
    const countryId = typeof raw.countryId === 'string' ? raw.countryId : ''
    const imports = raw.direction !== 'export'
    return {
      id: typeof raw.id === 'string' ? raw.id : `deal-migrated-${index}`,
      resource: raw.resource as ResourceId,
      buyerId: imports ? playerId : countryId,
      sellerId: imports ? countryId : playerId,
      quantity: Number(raw.quantity ?? 0),
      unitPrice: Number(raw.unitPrice ?? 0),
      pricing: (raw.pricing as TradePricing) ?? 'market',
      remainingTurns: Number(raw.remainingTurns ?? 0),
      auto: Boolean(raw.auto),
      createdAtTurn: Number(raw.createdAtTurn ?? 0),
    }
  })
}

function normalizeGameState(game: GameState): GameState {
  game.settings = normalizeSettings(game.settings)
  migrateTradeDeals(game)
  for (const country of game.countries) {
    const perCapita =
      country.stats.population > 0 ? country.stats.gdp / country.stats.population : 10_000
    if (typeof country.stats.inflation !== 'number') {
      country.stats.inflation = 4
    }
    if (typeof country.stats.pppPerCapita !== 'number') {
      country.stats.pppPerCapita = roundTo(perCapita, 0)
    }
    if (!country.commercePolicy) {
      country.commercePolicy = COMMERCE_GOOD_IDS.reduce(
        (policy, id) => {
          policy[id] = 0
          return policy
        },
        {} as Record<CommerceGoodId, number>,
      )
    }
    if (!country.currency) {
      const rate = roundTo(clamp(24_000 / Math.max(4_000, perCapita), 0.15, 80), 3)
      const seed =
        [...(country.code || country.name)].reduce(
          (total, character) => total + character.charCodeAt(0),
          0,
        ) + country.name.length
      const denomination =
        CURRENCY_DENOMINATIONS[seed % CURRENCY_DENOMINATIONS.length] ?? CURRENCY_DENOMINATIONS[0]!
      const regime = seed % 7 === 0 ? 'pegged' : seed % 3 === 0 ? 'managed' : 'floating'
      country.currency = {
        code: country.code || 'CRD',
        name: `${country.name} ${denomination.name.toLowerCase()}`,
        symbol: denomination.symbol,
        rate,
        fairRate: rate,
        changePct: 0,
        regime,
      }
    }
  }
  if (
    !game.market ||
    RESOURCE_IDS.some((resourceId) => !game.market[resourceId]) ||
    game.market.water?.price === undefined
  ) {
    const living = game.countries.filter((country) => country.status === 'alive')
    const flows = new Map(
      living.map((country) => [country.id, resourceFlows(country, game.deals, game.prices)]),
    )
    game.market = computeMarket(
      living,
      flows,
      game.deals,
      game.prices,
      game.settings.resourcePrices,
    )
  }
  return game
}

const announce = (
  set: (partial: Partial<GameStore>) => void,
  message: string,
  tone: Toast['tone'] = 'neutral',
) => set({ toast: toToast(message, tone) })

function mergeUnitLosses(country: Country, fraction: number, rng: RNG): string[] {
  const lines: string[] = []
  for (const [key, unit] of Object.entries(UNIT_BY_ID)) {
    const id = key as UnitId
    const current = country.military[id]
    const loss = Math.round(current * fraction * rng.float(0.7, 1.3))
    if (loss <= 0) continue
    country.military[id] = Math.max(0, current - loss)
    lines.push(`${unit.name} −${loss.toLocaleString('en-US')}`)
  }
  return lines
}

function transferResources(from: Country, to: Country, fraction: number): void {
  for (const id of Object.keys(from.resources) as ResourceId[]) {
    to.resources[id].stock += from.resources[id].stock * fraction
    to.resources[id].reserves += from.resources[id].reserves * fraction * 0.25
  }
}

function checkActionBudget(game: GameState, cost: number): string | null {
  if (game.actionsLeft < cost) {
    return `Not enough actions. ${cost} required, ${game.actionsLeft} left this turn.`
  }
  return null
}

export const useGame = create<GameStore>()(
  persist(
    (set, get) => ({
      game: null,
      page: 'map',
      modal: null,
      toast: null,

      startGame: (settings) => {
        const game = generateWorld(settings)
        set({ game, page: 'map', modal: null })
        announce(set, 'World generated. Choose the nation you want to lead.', 'positive')
      },

      chooseCountry: (countryId) => {
        const current = get().game
        if (!current || current.status !== 'menu') return
        const chosen = current.countries.find((country) => country.id === countryId)
        if (!chosen) return
        const game = cloneGame(current)
        const country = game.countries.find((entry) => entry.id === countryId)!
        for (const entry of game.countries) entry.isPlayer = false
        country.isPlayer = true
        country.relations = 100
        country.externalApproval = 0
        country.stats.treasury = Math.max(
          country.stats.treasury,
          country.stats.gdp * 0.06 * game.settings.startingTreasury,
        )
        country.military.soldiers = Math.max(country.military.soldiers, 24_000)
        country.military.tanks = Math.max(country.military.tanks, 40)
        country.military.jets = Math.max(country.military.jets, 4)
        for (const entry of game.countries) {
          if (entry.id !== country.id) entry.relations = clamp(entry.relations, -100, 100)
        }
        game.playerId = country.id
        game.status = 'playing'
        game.turn = 1
        game.actionsLeft = ACTIONS_PER_TURN
        game.eventQueue = ['inauguration']
        seedHistory(game)
        pushLog(
          game,
          'governance',
          `${country.name} enters a new political era under a ${
            GOVERNMENT_BY_ID[country.government]?.name ?? 'new government'
          }.`,
          country,
          'positive',
        )
        set({ game, page: 'map', modal: null })
        announce(
          set,
          `${country.name} is yours. Ten actions per turn. Choose carefully.`,
          'positive',
        )
      },

      openNewGame: () => set({ modal: { kind: 'new-game' } }),

      abandonGame: () => {
        set({ game: null, modal: null, toast: null, page: 'map' })
      },

      setPage: (page) => set({ page, modal: null }),

      openCountry: (countryId) => {
        const game = get().game
        if (!game) return
        const country = game.countries.find((entry) => entry.id === countryId)
        if (!country) return
        set({ modal: { kind: 'country', countryId } })
      },

      closeModal: () => set({ modal: null }),

      openTurnBriefing: () => {
        const game = get().game
        if (!game) return
        set({ modal: { kind: 'turn-briefing', eventId: game.eventQueue[0] } })
      },
      clearToast: () => set({ toast: null }),

      endTurn: () => {
        const current = get().game
        if (!current) return
        if (current.status === 'won') {
          announce(set, 'The world is already united.')
          return
        }
        if (get().modal) {
          announce(set, 'Close the open brief before ending the turn.')
          return
        }
        if (current.eventQueue.length > 0) {
          announce(set, 'Resolve the current event first.')
          return
        }
        const game = cloneGame(current)
        const next = advanceTurn(game)
        set({ game: next, modal: null })
        if (next.eventQueue.length === 0) {
          announce(set, `Turn ${next.turn}. ${ACTIONS_PER_TURN} actions available.`, 'neutral')
        }
      },

      setTax: (key, value) => {
        const current = get().game
        if (!current) return
        const game = cloneGame(current)
        const player = getPlayer(game)
        const error = checkActionBudget(game, 1)
        if (error) {
          announce(set, error, 'negative')
          return
        }
        const max = key === 'tariff' ? 500 : 100
        const nextValue = clamp(Math.round(value), 0, max)
        if (player.taxes[key] === nextValue) return
        player.taxes[key] = nextValue
        game.actionsLeft -= 1
        pushLog(
          game,
          'governance',
          `${titleCase(key)} tax set to ${nextValue}%.`,
          player,
          'neutral',
        )
        set({ game })
        announce(set, `${titleCase(key)} tax set to ${nextValue}%.`, 'positive')
      },

      setCommercePolicy: (id, value) => {
        const current = get().game
        if (!current) return
        const game = cloneGame(current)
        const player = getPlayer(game)
        const error = checkActionBudget(game, 1)
        if (error) {
          announce(set, error, 'negative')
          return
        }
        const next = clamp(Math.round(value), -60, 120)
        if ((player.commercePolicy[id] ?? 0) === next) return
        player.commercePolicy[id] = next
        game.actionsLeft -= 1
        pushLog(
          game,
          'economy',
          next >= 0
            ? `${titleCase(id)} consumer tax set to ${next}%.`
            : `${titleCase(id)} consumer subsidy set to ${Math.abs(next)}%.`,
          player,
          next > 0 ? 'negative' : 'positive',
        )
        set({ game })
        announce(
          set,
          next >= 0
            ? `${titleCase(id)} taxed at ${next}%.`
            : `${titleCase(id)} subsidised at ${Math.abs(next)}%.`,
          next >= 0 ? 'neutral' : 'positive',
        )
      },

      setDebtRate: (value) => {
        const current = get().game
        if (!current) return
        const game = cloneGame(current)
        const player = getPlayer(game)
        const error = checkActionBudget(game, 1)
        if (error) {
          announce(set, error, 'negative')
          return
        }
        const next = clamp(roundTo(value, 1), 1, 20)
        if (next === player.stats.debtRate) return
        player.stats.debtRate = next
        game.actionsLeft -= 1
        pushLog(game, 'economy', `Debt rate adjusted to ${next}%.`, player)
        set({ game })
        announce(set, `Debt rate adjusted to ${next}%.`, 'positive')
      },

      adjustDebt: (delta) => {
        const current = get().game
        if (!current) return
        if (!Number.isFinite(delta) || delta === 0) return
        const game = cloneGame(current)
        const player = getPlayer(game)
        const error = checkActionBudget(game, 1)
        if (error) {
          announce(set, error, 'negative')
          return
        }
        if (delta > 0) {
          const limit = debtLimit(player)
          if (player.stats.debt + delta > limit) {
            const room = Math.max(0, limit - player.stats.debt)
            announce(
              set,
              `Lenders will only extend ${formatMoney(room)} more at the current rate.`,
              'negative',
            )
            return
          }
          player.stats.debt += delta
          player.stats.treasury += delta
          game.actionsLeft -= 1
          pushLog(game, 'economy', `Treasury borrows ${formatMoney(delta)}.`, player, 'negative')
          set({ game })
          announce(
            set,
            `Borrowed ${formatMoney(delta)}. Debt is now ${formatMoney(player.stats.debt)}.`,
            'neutral',
          )
        } else {
          const payment = Math.min(-delta, player.stats.debt, player.stats.treasury)
          if (payment <= 0.01) {
            announce(set, 'No funds available to repay debt.', 'negative')
            return
          }
          player.stats.debt -= payment
          player.stats.treasury -= payment
          game.actionsLeft -= 1
          pushLog(game, 'economy', `Repaid ${formatMoney(payment)} of debt.`, player, 'positive')
          set({ game })
          announce(
            set,
            `Repaid ${formatMoney(payment)}. Debt is now ${formatMoney(player.stats.debt)}.`,
            'positive',
          )
        }
      },

      setMinistryBudget: (id, budget) => {
        const current = get().game
        if (!current) return
        const game = cloneGame(current)
        const player = getPlayer(game)
        if (player.ministries[id].budget === budget) return
        const error = checkActionBudget(game, 1)
        if (error) {
          announce(set, error, 'negative')
          return
        }
        player.ministries[id].budget = budget
        game.actionsLeft -= 1
        pushLog(
          game,
          'governance',
          `${id === 'finance' ? 'Finance' : titleCase(id)} ministry budget set to ${budget}.`,
          player,
        )
        set({ game })
        announce(set, `${titleCase(id)} budget set to ${budget}.`, 'positive')
      },

      replaceMinister: (id) => {
        const current = get().game
        if (!current) return
        const game = cloneGame(current)
        const player = getPlayer(game)
        const error = checkActionBudget(game, 1)
        if (error) {
          announce(set, error, 'negative')
          return
        }
        const cost = ministryActionCost(player, id, 'replace')
        if (player.stats.treasury < cost) {
          announce(set, `Need ${formatMoney(cost)} to install a new minister.`, 'negative')
          return
        }
        const rng = new RNG(game.rngState)
        const oldName = player.ministries[id].head.name
        player.ministries[id].head = {
          name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
          corruption: rng.int(4, 20),
          loyalty: rng.int(58, 96),
          skill: rng.int(42, 92),
        }
        player.stats.treasury -= cost
        game.actionsLeft -= 1
        game.rngState = rng.value
        pushLog(
          game,
          'governance',
          `New leadership at the ${titleCase(id)} ministry. ${oldName} steps down.`,
          player,
          'positive',
        )
        set({ game })
        announce(
          set,
          `New ${titleCase(id)} minister installed for ${formatMoney(cost)}.`,
          'positive',
        )
      },

      auditMinister: (id) => {
        const current = get().game
        if (!current) return
        const game = cloneGame(current)
        const player = getPlayer(game)
        const error = checkActionBudget(game, 1)
        if (error) {
          announce(set, error, 'negative')
          return
        }
        const cost = ministryActionCost(player, id, 'audit')
        if (player.stats.treasury < cost) {
          announce(
            set,
            `Need ${formatMoney(cost)} for an official anti-corruption audit.`,
            'negative',
          )
          return
        }
        const min = player.ministries[id]
        const prevCorr = min.head.corruption
        min.head.corruption = Math.max(0, min.head.corruption - 20)
        if (prevCorr > 50) {
          min.head.loyalty = clamp(min.head.loyalty - 5, 0, 100)
        } else {
          min.head.loyalty = clamp(min.head.loyalty + 4, 0, 100)
        }
        player.stats.corruption = clamp(player.stats.corruption - 1.5, 0, 100)
        player.stats.treasury -= cost
        game.actionsLeft -= 1
        pushLog(
          game,
          'governance',
          `Anti-corruption audit completed at the ${titleCase(id)} ministry. Minister corruption dropped from ${prevCorr} to ${min.head.corruption}.`,
          player,
          'positive',
        )
        set({ game })
        announce(set, `${titleCase(id)} audit completed: corruption −20.`, 'positive')
      },

      upgradeMinistry: (id) => {
        const current = get().game
        if (!current) return
        const game = cloneGame(current)
        const player = getPlayer(game)
        const error = checkActionBudget(game, 1)
        if (error) {
          announce(set, error, 'negative')
          return
        }
        const min = player.ministries[id]
        const currentLevel = min.level ?? 1
        if (currentLevel >= 5) {
          announce(set, `${titleCase(id)} ministry is already at maximum Tier 5.`, 'neutral')
          return
        }
        const cost = ministryActionCost(player, id, 'upgrade')
        if (player.stats.treasury < cost) {
          announce(
            set,
            `Need ${formatMoney(cost)} to upgrade ${titleCase(id)} ministry to Tier ${currentLevel + 1}.`,
            'negative',
          )
          return
        }
        min.level = currentLevel + 1
        min.head.skill = clamp(min.head.skill + 6, 0, 100)
        player.stats.gdp = Math.max(100, roundTo(player.stats.gdp * 1.003, 1))
        player.stats.treasury -= cost
        game.actionsLeft -= 1
        pushLog(
          game,
          'governance',
          `${titleCase(id)} ministry upgraded to Tier ${min.level}. Institutional capacity expanded; GDP +0.3%.`,
          player,
          'positive',
        )
        set({ game })
        announce(set, `${titleCase(id)} upgraded to Tier ${min.level}!`, 'positive')
      },

      trainMinister: (id) => {
        const current = get().game
        if (!current) return
        const game = cloneGame(current)
        const player = getPlayer(game)
        const error = checkActionBudget(game, 1)
        if (error) {
          announce(set, error, 'negative')
          return
        }
        const cost = ministryActionCost(player, id, 'train')
        if (player.stats.treasury < cost) {
          announce(set, `Need ${formatMoney(cost)} for executive leadership training.`, 'negative')
          return
        }
        const min = player.ministries[id]
        min.head.skill = clamp(min.head.skill + 12, 0, 100)
        min.head.loyalty = clamp(min.head.loyalty + 10, 0, 100)
        player.stats.treasury -= cost
        game.actionsLeft -= 1
        pushLog(
          game,
          'governance',
          `Leadership training completed for ${min.head.name} at ${titleCase(id)}: skill +12, loyalty +10.`,
          player,
          'positive',
        )
        set({ game })
        announce(set, `${min.head.name} completed executive training.`, 'positive')
      },
      beginIndustry: (resourceId, action) => {
        const current = get().game
        if (!current) return
        const player = getPlayer(current)
        const error = checkActionBudget(current, 1)
        if (error) {
          announce(set, error, 'negative')
          return
        }
        const cost = industryActionCost(player, resourceId, action)
        if (player.stats.treasury < cost) {
          announce(
            set,
            `Cannot afford ${INDUSTRY_ACTION_LABELS[action].toLowerCase()}: Need ${formatMoney(cost)} (Treasury has ${formatMoney(player.stats.treasury)}).`,
            'negative',
          )
          return
        }
        const die = action === 'research' ? 10 : 6
        const dc = 1
        const resource = RESOURCE_BY_ID[resourceId]
        const allAdvancementsUnlocked = RESOURCE_IDS.every(
          (id) => (player.resources[id]?.advances ?? 0) >= 5,
        )
        const state = player.resources[resourceId]
        const hasAllAdvancements = (state?.advances ?? 0) >= 5 || allAdvancementsUnlocked
        const descriptions: Record<IndustryAction, string> = hasAllAdvancements
          ? {
              prospect: `Survey new fields for ${resource.name.toLowerCase()} with Advancement Mastery: 1 fail, 2 modest boost (+stock), 3 solid boost (+stock), 4–5 rich boost (+stock), 6 master discovery (+massive reserves & stock).`,
              extraction: `Upgrade ${resource.name.toLowerCase()} extraction with Advancement Mastery: 1 fail, 2 (+2 Lv), 3 (+4 Lv), 4–5 (+5 Lv), 6 (+6 Lv & master reward).`,
              refinement: `Upgrade ${resource.name.toLowerCase()} refining with Advancement Mastery: 1 fail, 2 (+2 Lv), 3 (+4 Lv), 4–5 (+5 Lv), 6 (+6 Lv & master reward).`,
              research: `Fund research stimulus with Advancement Mastery: 1 fail, 2–4 (+10% bonus), 5–9 (+20% bonus), 10 (+35% bonus & master grant).`,
            }
          : {
              prospect: `Survey new fields for ${resource.name.toLowerCase()} reserves on a d6: 1 is failure, 2 small, 3 average, 4–5 good discovery, 6 discovery with an advancement.`,
              extraction: `Upgrade ${resource.name.toLowerCase()} extraction facility on a d6: 1 is failure, 2 small (+1 Lv), 3 average (+2 Lv), 4–5 good (+3 Lv), 6 upgrade with an advancement.`,
              refinement: `Upgrade ${resource.name.toLowerCase()} refining facility on a d6: 1 is failure, 2 small (+1 Lv), 3 average (+2 Lv), 4–5 good (+3 Lv), 6 upgrade with an advancement.`,
              research: `Fund a research stimulus for ${resource.name.toLowerCase()} on a single d10: 1 is failure, 2–4 grants +5% bonus on extraction and refinement, 5–9 grants +10% bonus, 10 grants +20% bonus with an advancement.`,
            }
        set({
          modal: {
            kind: 'check',
            check: {
              kind: 'industry',
              title: `${INDUSTRY_ACTION_LABELS[action]} · ${resource.name}`,
              description: descriptions[action],
              die,
              dc,
              modifier: 0,
              actionCost: 1,
              costMoney: cost,
              resource: resourceId,
              operation: action,
              stage: 'ready',
              hasAllAdvancements,
            },
          },
        })
      },

      rollCheck: () => {
        const current = get().game
        const modal = get().modal
        if (!current || !modal || modal.kind !== 'check') return
        const check = { ...modal.check }
        if (check.stage !== 'ready') return
        const game = cloneGame(current)
        const player = getPlayer(game)
        const error = checkActionBudget(game, check.actionCost)
        if (error) {
          announce(set, error, 'negative')
          return
        }
        if (player.stats.treasury < check.costMoney) {
          announce(set, `The treasury cannot cover ${formatMoney(check.costMoney)}.`, 'negative')
          return
        }
        const rng = new RNG(game.rngState)
        const roll = rng.dice(check.die)
        let success =
          check.kind === 'war'
            ? roll <= (check.winChance ?? 50)
            : check.kind === 'industry'
              ? roll > 1
              : roll + check.modifier > check.dc
        const outcomeLines: string[] = []

        player.stats.treasury -= check.costMoney
        game.actionsLeft -= check.actionCost

        if (check.kind === 'industry' && check.resource && check.operation) {
          const resource = player.resources[check.resource]
          const def = RESOURCE_BY_ID[check.resource]
          const allAdvancementsUnlocked = RESOURCE_IDS.every(
            (id) => (player.resources[id]?.advances ?? 0) >= 5,
          )
          const hasAllAdvancements =
            check.hasAllAdvancements || (resource.advances ?? 0) >= 5 || allAdvancementsUnlocked

          const awardAdvancement = () => {
            player.stats.gdp = Math.max(100, roundTo(player.stats.gdp * 1.008, 1))
            outcomeLines.push('Breakthrough advancement: National GDP expanded by +0.8%!')
            if (resource.advances < 5) {
              resource.advances += 1
              resource.stock += def.capacityPerLevel * 3
              resource.reserves += def.capacityPerLevel * 20
              outcomeLines.push(
                `Major breakthrough advancement unlocked (${resource.advances}/5): +15% permanent production capacity!`,
              )
              pushLog(
                game,
                'industry',
                `${def.name} breakthrough advancement ${resource.advances}/5 in ${player.name}.`,
                player,
                'positive',
              )
            } else {
              const bonusReserves = roundTo(def.capacityPerLevel * 50, 1)
              const bonusStock = roundTo(def.capacityPerLevel * 15, 1)
              resource.reserves += bonusReserves
              resource.stock += bonusStock
              outcomeLines.push(
                `Master breakthrough reward (all advancements unlocked): +${formatQuantity(bonusReserves)} ${def.unit} reserves and +${formatQuantity(bonusStock)} ${def.unit} stockpile!`,
              )
              pushLog(
                game,
                'industry',
                `Master breakthrough on ${def.name} in ${player.name}: +${formatQuantity(bonusReserves)} reserves and +${formatQuantity(bonusStock)} stock.`,
                player,
                'positive',
              )
            }
          }

          if (check.operation === 'prospect') {
            const reservesMod = combinedModifiers(player).reserves ?? 0
            if (roll === 1) {
              success = false
              outcomeLines.push(
                'Survey failed (d6 rolled 1). No commercially viable deposits were found.',
              )
            } else if (roll === 2) {
              success = true
              const found = roundTo(
                def.capacityPerLevel *
                  (hasAllAdvancements ? rng.float(50, 90) : rng.float(25, 45)) *
                  (1 + reservesMod),
                1,
              )
              resource.reserves += found
              if (hasAllAdvancements) {
                const bonusStock = roundTo(def.capacityPerLevel * 2, 1)
                resource.stock += bonusStock
                outcomeLines.push(
                  `Small improvement with Mastery (d6 rolled 2): Discovered modest reserves (+${formatQuantity(found)} ${def.unit}) and strategic stockpile (+${formatQuantity(bonusStock)} ${def.unit}).`,
                )
              } else {
                outcomeLines.push(
                  `Small improvement (d6 rolled 2): Discovered modest reserves (+${formatQuantity(found)} ${def.unit}).`,
                )
              }
            } else if (roll === 3) {
              success = true
              const found = roundTo(
                def.capacityPerLevel *
                  (hasAllAdvancements ? rng.float(110, 160) : rng.float(55, 80)) *
                  (1 + reservesMod),
                1,
              )
              resource.reserves += found
              if (hasAllAdvancements) {
                const bonusStock = roundTo(def.capacityPerLevel * 4, 1)
                resource.stock += bonusStock
                outcomeLines.push(
                  `Average improvement with Mastery (d6 rolled 3): Discovered solid reserves (+${formatQuantity(found)} ${def.unit}) and strategic stockpile (+${formatQuantity(bonusStock)} ${def.unit}).`,
                )
              } else {
                outcomeLines.push(
                  `Average improvement (d6 rolled 3): Discovered solid reserves (+${formatQuantity(found)} ${def.unit}).`,
                )
              }
            } else if (roll === 4 || roll === 5) {
              success = true
              const found = roundTo(
                def.capacityPerLevel *
                  (hasAllAdvancements ? rng.float(190, 280) : rng.float(95, 140)) *
                  (1 + reservesMod),
                1,
              )
              resource.reserves += found
              if (hasAllAdvancements) {
                const bonusStock = roundTo(def.capacityPerLevel * 8, 1)
                resource.stock += bonusStock
                outcomeLines.push(
                  `Good improvement with Mastery (d6 rolled ${roll}): Discovered rich reserves (+${formatQuantity(found)} ${def.unit}) and strategic stockpile (+${formatQuantity(bonusStock)} ${def.unit}).`,
                )
              } else {
                outcomeLines.push(
                  `Good improvement (d6 rolled ${roll}): Discovered rich reserves (+${formatQuantity(found)} ${def.unit}).`,
                )
              }
            } else if (roll === 6) {
              success = true
              const found = roundTo(
                def.capacityPerLevel *
                  (hasAllAdvancements ? rng.float(220, 320) : rng.float(95, 140)) *
                  (1 + reservesMod),
                1,
              )
              resource.reserves += found
              if (hasAllAdvancements) {
                const bonusStock = roundTo(def.capacityPerLevel * 12, 1)
                resource.stock += bonusStock
                outcomeLines.push(
                  `Master discovery (d6 rolled 6): Discovered abundant reserves (+${formatQuantity(found)} ${def.unit}) and strategic stockpile (+${formatQuantity(bonusStock)} ${def.unit})!`,
                )
              } else {
                outcomeLines.push(
                  `Improvement with an advancement (d6 rolled 6): Discovered abundant reserves (+${formatQuantity(found)} ${def.unit})!`,
                )
              }
              awardAdvancement()
            }
          } else if (check.operation === 'extraction') {
            if (roll === 1) {
              success = false
              outcomeLines.push('Extraction upgrade failed (d6 rolled 1). No capacity was added.')
            } else if (roll === 2) {
              success = true
              const levelGain = hasAllAdvancements ? 2 : 1
              resource.extractionLevel += levelGain
              if (hasAllAdvancements) {
                const bonusStock = roundTo(def.capacityPerLevel * 2, 1)
                resource.stock += bonusStock
                outcomeLines.push(
                  `Small improvement with Mastery (d6 rolled 2): Extraction upgraded by +${levelGain} levels (now Lv ${resource.extractionLevel}) plus +${formatQuantity(bonusStock)} ${def.unit} stockpile.`,
                )
              } else {
                outcomeLines.push(
                  `Small improvement (d6 rolled 2): Extraction upgraded by +1 level (now Lv ${resource.extractionLevel}).`,
                )
              }
            } else if (roll === 3) {
              success = true
              const levelGain = hasAllAdvancements ? 4 : 2
              resource.extractionLevel += levelGain
              if (hasAllAdvancements) {
                const bonusStock = roundTo(def.capacityPerLevel * 4, 1)
                resource.stock += bonusStock
                outcomeLines.push(
                  `Average improvement with Mastery (d6 rolled 3): Extraction upgraded by +${levelGain} levels (now Lv ${resource.extractionLevel}) plus +${formatQuantity(bonusStock)} ${def.unit} stockpile.`,
                )
              } else {
                outcomeLines.push(
                  `Average improvement (d6 rolled 3): Extraction upgraded by +2 levels (now Lv ${resource.extractionLevel}).`,
                )
              }
            } else if (roll === 4 || roll === 5) {
              success = true
              const levelGain = hasAllAdvancements ? 5 : 3
              resource.extractionLevel += levelGain
              if (hasAllAdvancements) {
                const bonusStock = roundTo(def.capacityPerLevel * 6, 1)
                resource.stock += bonusStock
                outcomeLines.push(
                  `Good improvement with Mastery (d6 rolled ${roll}): Extraction upgraded by +${levelGain} levels (now Lv ${resource.extractionLevel}) plus +${formatQuantity(bonusStock)} ${def.unit} stockpile.`,
                )
              } else {
                outcomeLines.push(
                  `Good improvement (d6 rolled ${roll}): Extraction upgraded by +3 levels (now Lv ${resource.extractionLevel}).`,
                )
              }
            } else if (roll === 6) {
              success = true
              const levelGain = hasAllAdvancements ? 6 : 3
              resource.extractionLevel += levelGain
              if (hasAllAdvancements) {
                const bonusStock = roundTo(def.capacityPerLevel * 8, 1)
                resource.stock += bonusStock
                outcomeLines.push(
                  `Master improvement (d6 rolled 6): Extraction upgraded by +${levelGain} levels (now Lv ${resource.extractionLevel}) plus +${formatQuantity(bonusStock)} ${def.unit} stockpile!`,
                )
              } else {
                outcomeLines.push(
                  `Improvement with an advancement (d6 rolled 6): Extraction upgraded by +3 levels (now Lv ${resource.extractionLevel})!`,
                )
              }
              awardAdvancement()
            }
          } else if (check.operation === 'refinement') {
            if (roll === 1) {
              success = false
              outcomeLines.push('Refinement upgrade failed (d6 rolled 1). No capacity was added.')
            } else if (roll === 2) {
              success = true
              const levelGain = hasAllAdvancements ? 2 : 1
              resource.refinementLevel += levelGain
              if (hasAllAdvancements) {
                const bonusStock = roundTo(def.capacityPerLevel * 2, 1)
                resource.stock += bonusStock
                outcomeLines.push(
                  `Small improvement with Mastery (d6 rolled 2): Refinement upgraded by +${levelGain} levels (now Lv ${resource.refinementLevel}) plus +${formatQuantity(bonusStock)} ${def.unit} stockpile.`,
                )
              } else {
                outcomeLines.push(
                  `Small improvement (d6 rolled 2): Refinement upgraded by +1 level (now Lv ${resource.refinementLevel}).`,
                )
              }
            } else if (roll === 3) {
              success = true
              const levelGain = hasAllAdvancements ? 4 : 2
              resource.refinementLevel += levelGain
              if (hasAllAdvancements) {
                const bonusStock = roundTo(def.capacityPerLevel * 4, 1)
                resource.stock += bonusStock
                outcomeLines.push(
                  `Average improvement with Mastery (d6 rolled 3): Refinement upgraded by +${levelGain} levels (now Lv ${resource.refinementLevel}) plus +${formatQuantity(bonusStock)} ${def.unit} stockpile.`,
                )
              } else {
                outcomeLines.push(
                  `Average improvement (d6 rolled 3): Refinement upgraded by +2 levels (now Lv ${resource.refinementLevel}).`,
                )
              }
            } else if (roll === 4 || roll === 5) {
              success = true
              const levelGain = hasAllAdvancements ? 5 : 3
              resource.refinementLevel += levelGain
              if (hasAllAdvancements) {
                const bonusStock = roundTo(def.capacityPerLevel * 6, 1)
                resource.stock += bonusStock
                outcomeLines.push(
                  `Good improvement with Mastery (d6 rolled ${roll}): Refinement upgraded by +${levelGain} levels (now Lv ${resource.refinementLevel}) plus +${formatQuantity(bonusStock)} ${def.unit} stockpile.`,
                )
              } else {
                outcomeLines.push(
                  `Good improvement (d6 rolled ${roll}): Refinement upgraded by +3 levels (now Lv ${resource.refinementLevel}).`,
                )
              }
            } else if (roll === 6) {
              success = true
              const levelGain = hasAllAdvancements ? 6 : 3
              resource.refinementLevel += levelGain
              if (hasAllAdvancements) {
                const bonusStock = roundTo(def.capacityPerLevel * 8, 1)
                resource.stock += bonusStock
                outcomeLines.push(
                  `Master improvement (d6 rolled 6): Refinement upgraded by +${levelGain} levels (now Lv ${resource.refinementLevel}) plus +${formatQuantity(bonusStock)} ${def.unit} stockpile!`,
                )
              } else {
                outcomeLines.push(
                  `Improvement with an advancement (d6 rolled 6): Refinement upgraded by +3 levels (now Lv ${resource.refinementLevel})!`,
                )
              }
              awardAdvancement()
            }
          } else if (check.operation === 'research') {
            const currentBonus = resource.researchBonus ?? resource.researchLevel * 0.05
            if (roll === 1) {
              success = false
              outcomeLines.push(
                'Research stimulus failed (d10 rolled 1). No research bonus or advancement gained.',
              )
            } else if (roll >= 2 && roll <= 4) {
              success = true
              const bonusGain = hasAllAdvancements ? 0.1 : 0.05
              const levelGain = hasAllAdvancements ? 2 : 1
              resource.researchBonus = roundTo(currentBonus + bonusGain, 2)
              resource.researchLevel += levelGain
              if (hasAllAdvancements) {
                const bonusStock = roundTo(def.capacityPerLevel * 3, 1)
                resource.stock += bonusStock
                outcomeLines.push(
                  `Research bonus with Mastery (d10 rolled ${roll}): +10% bonus on ${def.name.toLowerCase()} extraction and refinement (total bonus: +${Math.round(resource.researchBonus * 100)}%) plus +${formatQuantity(bonusStock)} ${def.unit} stockpile.`,
                )
              } else {
                outcomeLines.push(
                  `Research bonus (d10 rolled ${roll}): +5% bonus on ${def.name.toLowerCase()} extraction and refinement (total bonus: +${Math.round(resource.researchBonus * 100)}%).`,
                )
              }
            } else if (roll >= 5 && roll <= 9) {
              success = true
              const bonusGain = hasAllAdvancements ? 0.2 : 0.1
              const levelGain = hasAllAdvancements ? 2 : 1
              resource.researchBonus = roundTo(currentBonus + bonusGain, 2)
              resource.researchLevel += levelGain
              if (hasAllAdvancements) {
                const bonusStock = roundTo(def.capacityPerLevel * 6, 1)
                resource.stock += bonusStock
                outcomeLines.push(
                  `Research bonus with Mastery (d10 rolled ${roll}): +20% bonus on ${def.name.toLowerCase()} extraction and refinement (total bonus: +${Math.round(resource.researchBonus * 100)}%) plus +${formatQuantity(bonusStock)} ${def.unit} stockpile.`,
                )
              } else {
                outcomeLines.push(
                  `Research bonus (d10 rolled ${roll}): +10% bonus on ${def.name.toLowerCase()} extraction and refinement (total bonus: +${Math.round(resource.researchBonus * 100)}%).`,
                )
              }
            } else if (roll === 10) {
              success = true
              const bonusGain = hasAllAdvancements ? 0.35 : 0.2
              const levelGain = hasAllAdvancements ? 3 : 1
              resource.researchBonus = roundTo(currentBonus + bonusGain, 2)
              resource.researchLevel += levelGain
              if (hasAllAdvancements) {
                const bonusStock = roundTo(def.capacityPerLevel * 10, 1)
                resource.stock += bonusStock
                outcomeLines.push(
                  `Master research breakthrough (d10 rolled 10): +35% bonus on ${def.name.toLowerCase()} extraction and refinement (total bonus: +${Math.round(resource.researchBonus * 100)}%) plus +${formatQuantity(bonusStock)} ${def.unit} stockpile!`,
                )
              } else {
                outcomeLines.push(
                  `Breakthrough research (d10 rolled 10): +20% bonus on ${def.name.toLowerCase()} extraction and refinement (total bonus: +${Math.round(resource.researchBonus * 100)}%) with an advancement!`,
                )
              }
              awardAdvancement()
            }
          }
          pushLog(
            game,
            'industry',
            `${INDUSTRY_ACTION_LABELS[check.operation]} on ${def.name}: ${success ? 'success' : 'failure'} (${check.die === 10 ? 'd10' : 'd6'} rolled ${roll}).`,
            player,
            success ? 'positive' : 'negative',
          )
        } else if (check.kind === 'diplomacy' && check.countryId) {
          const partner = game.countries.find((country) => country.id === check.countryId)
          if (partner) {
            const gain = success ? rng.int(8, 12) : 3
            partner.relations = clamp(partner.relations + gain, -100, 100)
            outcomeLines.push(
              success
                ? `Diplomatic mission lands. Relations with ${partner.name} +${gain}.`
                : `The visit is cordial but forgettable. Relations with ${partner.name} +${gain}.`,
            )
            pushLog(
              game,
              'diplomacy',
              `Diplomatic mission to ${partner.name}: relations now ${partner.relations}.`,
              partner,
              success ? 'positive' : 'neutral',
            )
          }
        } else if (check.kind === 'approval' && check.countryId) {
          const partner = game.countries.find((country) => country.id === check.countryId)
          if (partner) {
            const gain = success ? rng.int(9, 13) : 5
            partner.externalApproval = clamp(partner.externalApproval + gain, 0, 100)
            outcomeLines.push(
              success
                ? `The approval campaign resonates. External approval +${gain} (${partner.externalApproval}/100).`
                : `The campaign is heard but not embraced. External approval +${gain} (${partner.externalApproval}/100).`,
            )
            pushLog(
              game,
              'diplomacy',
              `External approval campaign in ${partner.name}: now ${partner.externalApproval}/100.`,
              partner,
              success ? 'positive' : 'neutral',
            )
          }
        } else if (check.kind === 'war' && check.countryId) {
          const partner = game.countries.find((country) => country.id === check.countryId)
          if (partner) {
            if (success) {
              const seized = partner.stats.treasury * 0.3
              player.stats.treasury += seized
              transferResources(partner, player, 0.15)
              const losses = mergeUnitLosses(player, 0.08, rng)
              partner.status = 'destroyed'
              player.stats.approval = clamp(player.stats.approval + 2, 0, 100)
              for (const other of game.countries) {
                if (other.status !== 'alive' || other.id === player.id) continue
                other.relations = clamp(other.relations - 8, -100, 100)
              }
              outcomeLines.push(
                `The war is won. ${partner.name} is destroyed and ${formatMoney(seized)} is seized.`,
                ...losses,
              )
              pushLog(
                game,
                'military',
                `${player.name} destroys ${partner.name}. The world takes note.`,
                partner,
                'positive',
              )
              if (
                game.countries.every((country) => country.isPlayer || country.status !== 'alive')
              ) {
                game.status = 'won'
                game.eventQueue = []
              }
            } else {
              const losses = mergeUnitLosses(player, 0.16, rng)
              const stolen = Math.min(
                player.stats.treasury,
                player.stats.gdp * rng.float(0.006, 0.015),
              )
              player.stats.treasury -= stolen
              partner.stats.treasury += stolen
              player.stats.approval = clamp(player.stats.approval - 6, 0, 100)
              partner.relations = -100
              outcomeLines.push(
                `The offensive collapses. ${formatMoney(stolen)} is lost and the government is blamed.`,
                ...losses,
              )
              pushLog(
                game,
                'military',
                `The war against ${partner.name} fails. ${player.name} loses ground and prestige.`,
                partner,
                'negative',
              )
            }
          }
        }

        check.stage = 'rolled'
        check.roll = roll
        check.success = success
        check.outcomeLines = outcomeLines
        check.canBreakthrough = false
        game.rngState = rng.value
        set({ game, modal: { kind: 'check', check } })
      },

      rollBreakthrough: () => {},

      recruit: (unitId, quantity) => {
        const current = get().game
        if (!current) return
        const game = cloneGame(current)
        const player = getPlayer(game)
        const qty = Math.max(0, Math.floor(quantity))
        if (qty <= 0) return
        const error = checkActionBudget(game, 1)
        if (error) {
          announce(set, error, 'negative')
          return
        }
        const plan = unitPurchasePlan(player, unitId, qty)
        if (player.stats.treasury < plan.money) {
          announce(
            set,
            `Need ${formatMoney(plan.money)} to recruit ${qty.toLocaleString('en-US')} ${UNIT_BY_ID[unitId].name.toLowerCase()}.`,
            'negative',
          )
          return
        }
        if (!plan.allowed) {
          const missing = Object.entries(plan.resources)
            .filter(
              ([id, amount]) => (player.resources[id as ResourceId]?.stock ?? 0) < (amount ?? 0),
            )
            .map(([id, amount]) => `${titleCase(id)} ${formatQuantity(amount ?? 0)}`)
          announce(set, `Insufficient stockpiles: ${missing.join(', ')}.`, 'negative')
          return
        }
        player.stats.treasury -= plan.money
        for (const [id, amount] of Object.entries(plan.resources)) {
          if (!amount) continue
          player.resources[id as ResourceId].stock = Math.max(
            0,
            player.resources[id as ResourceId].stock - amount,
          )
        }
        player.military[unitId] += qty
        player.stats.gdp = Math.max(
          100,
          roundTo(player.stats.gdp * (1 + 0.0003 * Math.min(25, qty)), 1),
        )
        game.actionsLeft -= 1
        pushLog(
          game,
          'military',
          `${qty.toLocaleString('en-US')} ${UNIT_BY_ID[unitId].name.toLowerCase()} added to the order of battle.`,
          player,
          'positive',
        )
        set({ game })
        announce(
          set,
          `Recruited ${qty.toLocaleString('en-US')} ${UNIT_BY_ID[unitId].name.toLowerCase()}.`,
          'positive',
        )
      },

      disband: (unitId, quantity) => {
        const current = get().game
        if (!current) return
        const game = cloneGame(current)
        const player = getPlayer(game)
        const qty = Math.max(0, Math.floor(quantity))
        if (qty <= 0) return
        if (player.military[unitId] < qty) {
          announce(
            set,
            `Only ${player.military[unitId].toLocaleString('en-US')} available.`,
            'negative',
          )
          return
        }
        const error = checkActionBudget(game, 1)
        if (error) {
          announce(set, error, 'negative')
          return
        }
        player.military[unitId] -= qty
        const refund = qty * UNIT_BY_ID[unitId].recruitCost * 0.2
        player.stats.treasury += refund
        game.actionsLeft -= 1
        pushLog(
          game,
          'military',
          `${qty.toLocaleString('en-US')} ${UNIT_BY_ID[unitId].name.toLowerCase()} decommissioned. ${formatMoney(refund)} recovered.`,
          player,
        )
        set({ game })
        announce(
          set,
          `Disbanded ${qty.toLocaleString('en-US')} ${UNIT_BY_ID[unitId].name.toLowerCase()} for ${formatMoney(refund)}.`,
          'neutral',
        )
      },

      signDeal: (countryId, resourceId, direction, pricing, quantity) => {
        const current = get().game
        if (!current) return
        const game = cloneGame(current)
        const player = getPlayer(game)
        const partner = game.countries.find((country) => country.id === countryId)
        if (!partner || partner.status !== 'alive' || partner.isPlayer) return
        const error = checkActionBudget(game, 1)
        if (error) {
          announce(set, error, 'negative')
          return
        }
        const qty = Math.max(1, Math.round(quantity))
        const price = game.prices[resourceId] * TRADE_PRICING[pricing].multiplier
        const playerFlows = resourceFlows(player, game.deals, game.prices)
        const partnerFlows = resourceFlows(partner, game.deals, game.prices)
        if (direction === 'import') {
          if (partnerFlows[resourceId].finalBalance < 0.5) {
            announce(
              set,
              `${partner.name} has no export surplus in ${RESOURCE_BY_ID[resourceId].name.toLowerCase()}.`,
              'negative',
            )
            return
          }
          const available = Math.max(
            0,
            Math.floor(
              partnerFlows[resourceId].finalBalance + partnerFlows[resourceId].stock * 0.2,
            ),
          )
          if (qty > available) {
            announce(
              set,
              `${partner.name} can only commit ${formatQuantity(available)} units of ${RESOURCE_BY_ID[resourceId].name.toLowerCase()}.`,
              'negative',
            )
            return
          }
        }
        if (direction === 'export') {
          if (partnerFlows[resourceId].finalBalance > -0.5) {
            announce(
              set,
              `${partner.name} does not need to import ${RESOURCE_BY_ID[resourceId].name.toLowerCase()}.`,
              'negative',
            )
            return
          }
          const available =
            Math.max(0, playerFlows[resourceId].finalBalance) +
            Math.max(0, playerFlows[resourceId].stock * 0.2)
          if (available < qty) {
            announce(
              set,
              `Only ${formatQuantity(Math.max(0, available))} units of ${RESOURCE_BY_ID[resourceId].name.toLowerCase()} are available for export.`,
              'negative',
            )
            return
          }
        }
        if (direction === 'import' && player.stats.treasury < price * qty) {
          announce(
            set,
            `The first payment of ${formatMoney(price * qty)} is not available.`,
            'negative',
          )
          return
        }
        game.deals.push({
          id: makeId('deal'),
          resource: resourceId,
          buyerId: direction === 'import' ? player.id : countryId,
          sellerId: direction === 'import' ? countryId : player.id,
          quantity: qty,
          unitPrice: roundTo(price, 2),
          pricing,
          remainingTurns: DEAL_DURATION,
          auto: false,
          createdAtTurn: game.turn,
        })
        partner.relations = clamp(partner.relations + TRADE_PRICING[pricing].relation, -100, 100)
        game.actionsLeft -= 1
        pushLog(
          game,
          'diplomacy',
          `${direction === 'import' ? 'Import' : 'Export'} deal with ${partner.name}: ${qty} ${RESOURCE_BY_ID[resourceId].unit} of ${RESOURCE_BY_ID[resourceId].name.toLowerCase()} at ${pricing} prices.`,
          partner,
          'positive',
        )
        set({ game })
        announce(
          set,
          `${direction === 'import' ? 'Bought from' : 'Sold to'} ${partner.name} at ${pricing} market price. ${direction === 'import' ? 'Cost' : 'Revenue'}: ${formatMoney(price * qty)}/turn.`,
          'positive',
        )
      },

      cancelDeal: (dealId) => {
        const current = get().game
        if (!current) return
        const game = cloneGame(current)
        const deal = game.deals.find((entry) => entry.id === dealId)
        if (!deal) return
        game.deals = game.deals.filter((entry) => entry.id !== dealId)
        const playerId = getPlayer(game).id
        const partnerId = deal.buyerId === playerId ? deal.sellerId : deal.buyerId
        const partner = game.countries.find((country) => country.id === partnerId)
        pushLog(
          game,
          'economy',
          `Trade contract with ${partner?.name ?? 'a partner'} cancelled.`,
          getPlayer(game),
        )
        set({ game })
        announce(set, 'Trade contract cancelled.', 'neutral')
      },

      setAutoDeal: (resourceId, mode) => {
        const current = get().game
        if (!current) return
        const game = cloneGame(current)
        getPlayer(game).autoDeal[resourceId] = mode
        set({ game })
        announce(
          set,
          mode === 'off'
            ? `Auto-deal disabled for ${RESOURCE_BY_ID[resourceId].name.toLowerCase()}.`
            : `Auto-deal set to accept ${mode} market prices for ${RESOURCE_BY_ID[resourceId].name.toLowerCase()}.`,
          'neutral',
        )
      },

      beginDiplomacy: (countryId) => {
        const current = get().game
        if (!current) return
        const player = getPlayer(current)
        const partner = current.countries.find((country) => country.id === countryId)
        if (!partner || partner.status !== 'alive' || partner.isPlayer) return
        const error = checkActionBudget(current, 1)
        if (error) {
          announce(set, error, 'negative')
          return
        }
        if (partner.relations >= 100) {
          announce(set, `${partner.name} is already fully aligned. Fund external approval instead.`)
          return
        }
        const cost = diplomaticMissionCost(player)
        if (player.stats.treasury < cost) {
          announce(set, `Need ${formatMoney(cost)} for a diplomatic mission.`, 'negative')
          return
        }
        set({
          modal: {
            kind: 'check',
            check: {
              kind: 'diplomacy',
              title: `Diplomatic mission · ${partner.name}`,
              description:
                'Send envoys and a cultural delegation. A d6 above 3 improves relations substantially; even a weak mission builds a little trust.',
              die: 6,
              dc: 3,
              modifier: 0,
              actionCost: 1,
              costMoney: cost,
              countryId,
              stage: 'ready',
            },
          },
        })
      },

      beginApproval: (countryId) => {
        const current = get().game
        if (!current) return
        const player = getPlayer(current)
        const partner = current.countries.find((country) => country.id === countryId)
        if (!partner || partner.status !== 'alive' || partner.isPlayer) return
        if (partner.relations < 100) {
          announce(
            set,
            `Relations with ${partner.name} must reach 100 before an approval campaign.`,
            'negative',
          )
          return
        }
        if (partner.externalApproval >= 100) {
          announce(set, `${partner.name} already approves integration. You may merge.`)
          return
        }
        const error = checkActionBudget(current, 1)
        if (error) {
          announce(set, error, 'negative')
          return
        }
        const cost = approvalCampaignCost(player)
        if (player.stats.treasury < cost) {
          announce(set, `Need ${formatMoney(cost)} for an approval campaign.`, 'negative')
          return
        }
        set({
          modal: {
            kind: 'check',
            check: {
              kind: 'approval',
              title: `External approval campaign · ${partner.name}`,
              description:
                'Fund civil-society partners, media and integration programmes. A d6 above 2 converts goodwill into formal approval.',
              die: 6,
              dc: 2,
              modifier: 0,
              actionCost: 1,
              costMoney: cost,
              countryId,
              stage: 'ready',
            },
          },
        })
      },

      mergeCountry: (countryId) => {
        const current = get().game
        if (!current) return
        const game = cloneGame(current)
        const player = getPlayer(game)
        const partner = game.countries.find((country) => country.id === countryId)
        if (!partner || partner.status !== 'alive' || partner.isPlayer) return
        if (partner.relations < 100 || partner.externalApproval < 100) {
          announce(
            set,
            'Both full diplomatic alignment and 100 external approval are required to merge.',
            'negative',
          )
          return
        }
        const error = checkActionBudget(game, 2)
        if (error) {
          announce(set, error, 'negative')
          return
        }
        const cost = mergerCost(player)
        if (player.stats.treasury < cost) {
          announce(set, `Need ${formatMoney(cost)} to administer the merger.`, 'negative')
          return
        }
        player.stats.treasury -= cost
        player.stats.treasury += partner.stats.treasury * 0.4
        player.stats.debt += partner.stats.debt * 0.4
        player.stats.population += partner.stats.population
        player.stats.gdp += partner.stats.gdp * 0.65
        player.stats.approval = clamp(player.stats.approval + 1, 0, 100)
        player.stats.corruption = clamp(player.stats.corruption + 2, 0, 100)
        transferResources(partner, player, 0.25)
        for (const [key, unit] of Object.entries(partner.military)) {
          const id = key as UnitId
          player.military[id] += Math.round(unit * 0.25)
        }
        partner.status = 'merged'
        partner.mergedInto = player.id
        for (const other of game.countries) {
          if (other.status !== 'alive' || other.id === player.id) continue
          other.relations = clamp(other.relations - 5, -100, 100)
        }
        game.actionsLeft -= 2
        pushLog(
          game,
          'diplomacy',
          `${partner.name} merges into ${player.name}. Population ${partner.stats.population.toFixed(1)}M and 65% of its GDP are absorbed.`,
          partner,
          'positive',
        )
        const won = game.countries.every(
          (country) => country.isPlayer || country.status !== 'alive',
        )
        if (won) {
          game.status = 'won'
          game.eventQueue = []
        }
        set({
          game,
          modal: {
            kind: 'result',
            title: won ? 'The World Is Yours' : 'A Nation Joins the Union',
            subtitle: won
              ? `${player.name} stands alone as the united world government.`
              : `${partner.name} has merged into ${player.name}.`,
            lines: [
              `${partner.name} is now integrated territory.`,
              `Treasury received: ${formatMoney(partner.stats.treasury * 0.4)}.`,
              `Absorbed population: ${partner.stats.population.toFixed(1)}M.`,
              `Absorbed GDP: ${formatMoney(partner.stats.gdp * 0.65)}.`,
              ...(won
                ? [
                    'Every rival nation is now merged or destroyed.',
                    'Final score is available in the Global Ranking.',
                  ]
                : []),
            ],
            tone: 'positive',
          },
        })
      },

      beginWar: (countryId) => {
        const current = get().game
        if (!current) return
        const player = getPlayer(current)
        const partner = current.countries.find((country) => country.id === countryId)
        if (!partner || partner.status !== 'alive' || partner.isPlayer) return
        const error = checkActionBudget(current, 1)
        if (error) {
          announce(set, error, 'negative')
          return
        }
        const cost = warMobilizationCost(player)
        if (player.stats.treasury < cost) {
          announce(set, `Need ${formatMoney(cost)} to mobilise for war.`, 'negative')
          return
        }
        const ownPower = militaryPower(player)
        const enemyPower = militaryPower(partner)
        const winChance = clamp(
          Math.round((0.15 + 0.7 * (ownPower / Math.max(1, ownPower + enemyPower))) * 100),
          10,
          92,
        )
        set({
          modal: {
            kind: 'check',
            check: {
              kind: 'war',
              title: `War against ${partner.name}`,
              description: `Military power ${ownPower.toFixed(0)} against ${enemyPower.toFixed(0)}. Victory destroys the country and seizes its treasury. Failure costs units, money and approval. The rest of the world will not forget.`,
              die: 100,
              dc: 0,
              modifier: 0,
              actionCost: 1,
              costMoney: cost,
              countryId,
              stage: 'ready',
              winChance,
            },
          },
        })
      },

      resolveEvent: (choiceId, targetEventId, showResultModal = false) => {
        const current = get().game
        if (!current) return
        const eventId = targetEventId ?? current.eventQueue[0]
        if (!eventId) return
        const baseKey = eventId.split(':')[0] ?? eventId
        const event = resolveEventForGame(current, eventId) ?? EVENT_BY_ID[baseKey]
        const choice = event?.choices.find((entry: EventChoice) => entry.id === choiceId)
        if (!event || !choice) return
        const game = cloneGame(current)
        const player = getPlayer(game)
        const beforeStats: EventStatSnapshot = {
          treasury: player.stats.treasury,
          debt: player.stats.debt,
          gdp: player.stats.gdp,
          approval: player.stats.approval,
          hdi: player.stats.hdi,
          security: player.stats.security,
          corruption: player.stats.corruption,
        }
        const rng = new RNG(game.rngState)
        const roll = choice.check ? rng.dice(choice.check.die) : undefined
        const success = choice.check ? (roll as number) > choice.check.dc : undefined
        const lines: string[] = []
        if (choice.check) {
          lines.push(
            `${choice.check.label}: d${choice.check.die} rolled ${roll}. ${success ? 'Success.' : 'Failure.'}`,
          )
        }
        lines.push(...applyEventEffects(game, player, choice.effects ?? {}, rng))
        if (success !== undefined) {
          lines.push(
            ...applyEventEffects(
              game,
              player,
              (success ? choice.success : choice.failure) ?? {},
              rng,
            ),
          )
        }
        game.eventQueue = game.eventQueue.filter((id) => id !== eventId)
        if (!game.seenEvents.includes(eventId)) game.seenEvents.push(eventId)
        game.lastOutcome = {
          eventId,
          choiceId,
          title: event.title,
          lines,
          roll,
          success,
          tone: success === false ? 'negative' : choice.tone === 'danger' ? 'negative' : 'positive',
        } satisfies EventOutcome

        const afterStats: EventStatSnapshot = {
          treasury: player.stats.treasury,
          debt: player.stats.debt,
          gdp: player.stats.gdp,
          approval: player.stats.approval,
          hdi: player.stats.hdi,
          security: player.stats.security,
          corruption: player.stats.corruption,
        }

        const historyRecord: EventHistoryRecord = {
          id: makeId('eh'),
          turn: game.turn,
          eventId,
          title: event.title,
          body: event.body,
          choiceId,
          choiceLabel: choice.label,
          ministryId: event.ministryId,
          ministryCategory: event.ministryCategory,
          rarity: event.rarity,
          lines,
          roll,
          success,
          tone: game.lastOutcome.tone,
          timestamp: Date.now(),
          before: beforeStats,
          after: afterStats,
        }
        game.eventHistory = [...(game.eventHistory ?? []), historyRecord]

        game.rngState = rng.value
        pushLog(
          game,
          'event',
          `${event.title}: ${choice.label}. ${lines.filter((line) => !line.startsWith(`${choice.check?.label ?? ''}:`)).join(' · ')}`,
          player,
          success === false || choice.tone === 'danger' ? 'negative' : 'positive',
        )
        set({
          game,
          modal: showResultModal
            ? {
                kind: 'result',
                title: event.title,
                subtitle: choice.label,
                lines,
                tone: success === false || choice.tone === 'danger' ? 'negative' : 'neutral',
              }
            : // Keep the briefing mounted after the last event resolves so its
              // outcome stays visible until the player closes it explicitly.
              (get().modal ?? { kind: 'turn-briefing', eventId }),
        })
      },
    }),
    {
      name: SAVE_KEY,
      version: SAVE_VERSION,
      partialize: (state) => ({ game: state.game, page: state.page }),
      migrate: (persistedState: unknown) => {
        const persisted = persistedState as { game?: GameState | null; page?: PageId }
        if (persisted.game) normalizeGameState(persisted.game)
        return { game: persisted.game ?? null, page: persisted.page ?? 'map' }
      },
    },
  ),
)

/* ── Derived helpers for components ────────────────────────────────────── */

export const selectPlayer = (state: GameStore): Country | null =>
  state.game ? getPlayer(state.game) : null

export const selectPlayerBudget = (state: GameStore) =>
  state.game ? computeBudget(getPlayer(state.game), state.game.deals, state.game.prices) : null

export const selectPlayerFlows = (state: GameStore) =>
  state.game ? resourceFlows(getPlayer(state.game), state.game.deals, state.game.prices) : null

export const selectCurrentEventId = (state: GameStore): string | null =>
  state.game?.eventQueue[0] ?? null

export const selectEventDefinition = (state: GameStore) =>
  state.game?.eventQueue[0] ? (EVENT_BY_ID[state.game.eventQueue[0]] ?? null) : null

export const selectCanAct = (state: GameStore): boolean =>
  Boolean(state.game && state.game.status === 'playing' && state.game.actionsLeft > 0)

export const selectTreasury = (state: GameStore): number =>
  state.game ? getPlayer(state.game).stats.treasury : 0

export const selectDebtRoom = (state: GameStore): number => {
  if (!state.game) return 0
  const player = getPlayer(state.game)
  return Math.max(0, debtLimit(player) - player.stats.debt)
}
