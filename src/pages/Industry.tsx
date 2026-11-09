import { useMemo } from 'react'
import { RESOURCES, RESOURCE_IDS } from '../game/constants'
import type { IndustryAction, ResourceId, ResourceProduction } from '../game/types'
import { useGame, selectPlayer } from '../state/gameStore'
import { industryActionCost, INDUSTRY_ACTION_LABELS } from '../game/engine'
import { resourceFlows, resourceProduction } from '../game/selectors'
import {
  formatMoney,
  formatPercent,
  formatQuantity,
  formatReserveRunway,
  formatStockRunway,
} from '../game/format'
import { Badge, PageHeader, SectionCard, StatTile } from '../components/ui'
import { Icon } from '../components/Icon'
import { playSfx } from '../game/audio'

const ACTION_META: Record<IndustryAction, { icon: string; threshold: string; hint: string }> = {
  prospect: {
    icon: 'Search',
    threshold: 'd6: 1 fail / 2–5 boost / 6 advance',
    hint: 'd6: 1 is failure, 2 small, 3 average, 4–5 good discovery, 6 discovery with an advancement.',
  },
  extraction: {
    icon: 'Pickaxe',
    threshold: 'd6: 1 fail / 2–5 upgrade / 6 advance',
    hint: 'd6: 1 is failure, 2 small (+1 Lv), 3 average (+2 Lv), 4–5 good (+3 Lv), 6 upgrade with an advancement.',
  },
  refinement: {
    icon: 'Layers',
    threshold: 'd6: 1 fail / 2–5 upgrade / 6 advance',
    hint: 'd6: 1 is failure, 2 small (+1 Lv), 3 average (+2 Lv), 4–5 good (+3 Lv), 6 upgrade with an advancement.',
  },
  research: {
    icon: 'Sparkles',
    threshold: 'd10: 1 fail / 2–9 bonus / 10 advance',
    hint: 'Single d10: 1 failure, 2–4 +5% bonus on extraction and refinement, 5–9 +10% bonus, 10 +20% bonus with an advancement.',
  },
}

export function Industry() {
  const game = useGame((state) => state.game)
  const player = useGame(selectPlayer)
  const beginIndustry = useGame((state) => state.beginIndustry)
  const setPage = useGame((state) => state.setPage)

  const flows = useMemo(
    () => (game && player ? resourceFlows(player, game.deals, game.prices) : null),
    [game, player],
  )
  const productions = useMemo(() => {
    if (!game || !player) return null
    return RESOURCE_IDS.reduce(
      (result, id) => {
        result[id] = resourceProduction(player, id)
        return result
      },
      {} as Record<ResourceId, ResourceProduction>,
    )
  }, [game, player])

  if (!game || !player || !flows || !productions) return null

  const totalProductionValue = RESOURCE_IDS.reduce(
    (total, id) => total + flows[id].production * flows[id].price,
    0,
  )
  const totalStockValue = RESOURCE_IDS.reduce(
    (total, id) => total + flows[id].stock * flows[id].price,
    0,
  )
  const totalAdvances = RESOURCE_IDS.reduce((total, id) => total + player.resources[id].advances, 0)
  const industryBudget = player.ministries.industry.budget
  const canAct = game.actionsLeft > 0

  const handleAction = (resourceId: ResourceId, action: IndustryAction) => {
    playSfx('click')
    beginIndustry(resourceId, action)
  }

  return (
    <div className="page">
      <PageHeader page="industry">
        <button type="button" className="btn" onClick={() => setPage('budget')}>
          <Icon name="ChartLine" size={16} /> Resource ledger
        </button>
        <button type="button" className="btn" onClick={() => setPage('military')}>
          <Icon name="Shield" size={16} /> Military inputs
        </button>
      </PageHeader>

      <div className="stat-grid stat-grid-4">
        <StatTile
          label="Gross production"
          value={formatMoney(totalProductionValue)}
          hint="At current market prices, per turn"
          icon="Factory"
          tone="positive"
        />
        <StatTile
          label="Resource stock"
          value={formatMoney(totalStockValue)}
          hint="Value of all stored material"
          icon="Layers"
        />
        <StatTile
          label="Breakthroughs"
          value={`${totalAdvances} / 40`}
          hint="Major advancements across all resources"
          icon="Sparkles"
          tone="accent"
        />
        <StatTile
          label="Industry budget"
          value={industryBudget}
          hint={`${formatPercent((industryBudget === 'high' ? 0.01 : industryBudget === 'low' ? 0.0025 : 0.005) * 100, 1)} of GDP`}
          icon="Banknote"
          tone={industryBudget === 'low' ? 'warning' : 'positive'}
        />
      </div>

      <SectionCard
        className="industry-intro"
        title="Resource industries"
        subtitle="Each operation costs one action and money. Upgrades roll a d6 (1 fail, 2–5 improvements, 6 advancement). Research stimulus rolls a single d10 (1 fail, 2–9 bonuses, 10 +20% & advancement)."
        action={
          <Badge tone="accent" icon="Dices">
            {game.actionsLeft} actions left
          </Badge>
        }
      >
        <div className="industry-formula-strip">
          <span>
            <Icon name="ArrowRight" size={14} /> Production = MIN(extraction, refinement) ×
            advancements
          </span>
          <span>
            <Icon name="ArrowRight" size={14} /> Research = permanent bonus on extraction and
            refinement
          </span>
          <span>
            <Icon name="ArrowRight" size={14} /> d6: 1 fail · 2 small (+1) · 3 avg (+2) · 4–5 good
            (+3) · 6 advance
          </span>
          <span>
            <Icon name="ArrowRight" size={14} /> Single d10: 1 fail · 2–4 +5% · 5–9 +10% · 10 +20% &
            advance
          </span>
        </div>
      </SectionCard>

      <div className="resource-card-grid">
        {RESOURCES.map((def) => {
          const state = player.resources[def.id]
          const flow = flows[def.id]
          const production = productions[def.id]
          const actions: IndustryAction[] = ['prospect', 'extraction', 'refinement', 'research']
          const reserveRunway = formatReserveRunway(state.reserves, flow.production)
          const stockRunway = formatStockRunway(flow.stock, flow.finalBalance)
          return (
            <article
              key={def.id}
              className={`resource-card ${def.category === 'strategic' ? 'is-strategic' : ''}`}
            >
              <header className="resource-card-head">
                <span className="resource-emblem" style={{ color: `var(${def.colorVar})` }}>
                  <Icon name={def.icon} size={24} />
                </span>
                <div className="resource-card-title">
                  <h2>{def.name}</h2>
                  <span>{def.blurb}</span>
                </div>
                <div className="resource-card-badges">
                  <Badge tone={def.category === 'strategic' ? 'warning' : 'muted'}>
                    {def.category}
                  </Badge>
                  <Badge tone="neutral">
                    {formatMoney(flow.price)} / {def.unit}
                  </Badge>
                </div>
              </header>

              <div className="resource-metrics">
                <span>
                  <small>Reserves</small>
                  <strong
                    title={`Reserves: ${formatQuantity(state.reserves)} · Lasts ${reserveRunway.text} at current production (${formatQuantity(flow.production)}/turn)`}
                  >
                    {formatQuantity(state.reserves)}{' '}
                    <em
                      className={reserveRunway.tone !== 'muted' ? `text-${reserveRunway.tone}` : ''}
                    >
                      {reserveRunway.text}
                    </em>
                  </strong>
                </span>
                <span>
                  <small>Extraction</small>
                  <strong>
                    Lv {state.extractionLevel}{' '}
                    <em>{formatQuantity(production.extractionCapacity)}</em>
                  </strong>
                </span>
                <span>
                  <small>Refinement</small>
                  <strong>
                    Lv {state.refinementLevel}{' '}
                    <em>{formatQuantity(production.refinementCapacity)}</em>
                  </strong>
                </span>
                <span>
                  <small>Production</small>
                  <strong>{formatQuantity(flow.production)}</strong>
                </span>
                <span>
                  <small>Consumption</small>
                  <strong>{formatQuantity(flow.consumption)}</strong>
                </span>
                <span>
                  <small>Stock</small>
                  <strong
                    title={`Stock: ${formatQuantity(flow.stock)} · Lasts ${stockRunway.text} at current net balance (${flow.finalBalance >= 0 ? '+' : ''}${formatQuantity(flow.finalBalance)}/turn)`}
                  >
                    {formatQuantity(flow.stock)}{' '}
                    <em className={stockRunway.tone !== 'muted' ? `text-${stockRunway.tone}` : ''}>
                      {stockRunway.text}
                    </em>
                  </strong>
                </span>
              </div>

              <div className="resource-balance-line">
                <span
                  className={`balance-chip ${flow.finalBalance >= 0 ? 'is-positive' : 'is-negative'}`}
                >
                  <Icon name={flow.finalBalance >= 0 ? 'TrendingUp' : 'TrendingDown'} size={14} />
                  {flow.finalBalance >= 0 ? 'Surplus' : 'Deficit'}{' '}
                  {formatQuantity(flow.finalBalance)}
                </span>
                {flow.finalBalance < 0 && (
                  <Badge
                    tone={stockRunway.tone === 'negative' ? 'negative' : 'warning'}
                    icon="Clock"
                  >
                    Stock lasts {stockRunway.text}
                  </Badge>
                )}
                {production.extractionCapacity < production.refinementCapacity && (
                  <Badge tone="warning" icon="Pickaxe">
                    Extraction caps output ({formatQuantity(production.extractionCapacity)})
                  </Badge>
                )}
                {production.refinementCapacity < production.extractionCapacity && (
                  <Badge tone="warning" icon="Layers">
                    Refinement caps output ({formatQuantity(production.refinementCapacity)})
                  </Badge>
                )}
                <span className="resource-research-line">
                  Research bonus +
                  {Math.round((state.researchBonus ?? state.researchLevel * 0.05) * 100)}% on ext &
                  ref · {state.advances}/5 advances (+{state.advances * 15}%)
                </span>
              </div>

              <div className="advancement-row">
                <span className="advancement-label">Major advancements</span>
                <div
                  className="advancement-pips"
                  aria-label={`${state.advances} of 5 major advancements`}
                >
                  {Array.from({ length: 5 }).map((_, index) => (
                    <span key={index} className={index < state.advances ? 'is-filled' : ''} />
                  ))}
                </div>
                <span className="advancement-count">{state.advances}/5</span>
              </div>

              <div className="industry-actions">
                {actions.map((action) => {
                  const cost = industryActionCost(player, def.id, action)
                  const affordable = player.stats.treasury >= cost && canAct
                  const meta = ACTION_META[action]
                  const tooltip = !canAct
                    ? 'No actions remaining this turn (0/10). End the turn to refresh actions.'
                    : player.stats.treasury < cost
                      ? `Cannot afford: Need ${formatMoney(cost)} (Treasury has ${formatMoney(player.stats.treasury)})`
                      : `${INDUSTRY_ACTION_LABELS[action]} · ${meta.threshold} · ${meta.hint}`
                  return (
                    <button
                      key={action}
                      type="button"
                      className={`industry-action ${action === 'research' ? 'is-research' : ''} ${!affordable ? 'is-unaffordable' : ''}`}
                      onClick={() => handleAction(def.id, action)}
                      title={tooltip}
                    >
                      <span className="industry-action-top">
                        <Icon name={meta.icon} size={16} />
                        <span>{INDUSTRY_ACTION_LABELS[action]}</span>
                      </span>
                      <span className="industry-action-meta">
                        <span>{meta.threshold}</span>
                        <strong>{formatMoney(cost)}</strong>
                      </span>
                    </button>
                  )
                })}
              </div>

              <footer className="resource-card-foot">
                <span>
                  <Icon name="Info" size={12} /> {ACTION_META.research.hint}
                </span>
                <strong>{formatMoney(flow.production * flow.price)} produced</strong>
              </footer>
            </article>
          )
        })}
      </div>

      <SectionCard
        title="How capacity becomes output"
        subtitle="A compact view of every resource's constraint."
      >
        <div className="capacity-table-wrap">
          <table className="capacity-table">
            <thead>
              <tr>
                <th>Resource</th>
                <th className="num">Extraction cap.</th>
                <th className="num">Refinement cap.</th>
                <th className="num">Actual production</th>
                <th className="num">Civil use</th>
                <th className="num">Military use</th>
                <th className="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {RESOURCES.map((def) => {
                const flow = flows[def.id]
                return (
                  <tr key={def.id}>
                    <td>
                      <span className="resource-inline" style={{ color: `var(${def.colorVar})` }}>
                        <Icon name={def.icon} size={14} /> {def.name}
                      </span>
                    </td>
                    <td className="num">{formatQuantity(flow.extractionCapacity)}</td>
                    <td className="num">{formatQuantity(flow.refinementCapacity)}</td>
                    <td className="num">{formatQuantity(flow.production)}</td>
                    <td className="num">{formatQuantity(flow.civilConsumption)}</td>
                    <td className="num">{formatQuantity(flow.militaryConsumption)}</td>
                    <td
                      className={`num ${flow.finalBalance >= 0 ? 'text-positive' : 'text-negative'}`}
                    >
                      {flow.finalBalance > 0 ? '+' : ''}
                      {formatQuantity(flow.finalBalance)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="table-note">
          The binding constraint is whichever is lower: extraction or refinement. A stockpile can
          cover a deficit temporarily; it does not create new supply. Prices are set by world demand
          and supply in Global Trading.
        </p>
      </SectionCard>
    </div>
  )
}
