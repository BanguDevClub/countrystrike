import { useMemo } from 'react'
import { RESOURCES, RESOURCE_IDS } from '../game/constants'
import type { IndustryAction, ResourceId, ResourceProduction } from '../game/types'
import { useGame, selectPlayer } from '../state/gameStore'
import { industryActionCost, INDUSTRY_ACTION_LABELS } from '../game/engine'
import { resourceFlows, resourceProduction } from '../game/selectors'
import { formatMoney, formatPercent, formatQuantity } from '../game/format'
import { Badge, PageHeader, SectionCard, StatTile } from '../components/ui'
import { Icon } from '../components/Icon'
import { playSfx } from '../game/audio'

const ACTION_META: Record<IndustryAction, { icon: string; threshold: string; hint: string }> = {
  prospect: {
    icon: 'Search',
    threshold: 'd6 > 3',
    hint: 'Cheap. Finds new reserves; the deposit size depends on the resource and your survey modifiers.',
  },
  extraction: {
    icon: 'Pickaxe',
    threshold: 'd6 > 2',
    hint: 'Raises extraction capacity by one level. A failed upgrade wastes the money.',
  },
  refinement: {
    icon: 'Layers',
    threshold: 'd6 > 2',
    hint: 'Raises refining capacity by one level. Expensive, and required to turn extraction into production.',
  },
  research: {
    icon: 'Sparkles',
    threshold: 'd6 > 1 + d10 > 9',
    hint: 'Small permanent research bonus on success, with a rare chance at one of five major advancements.',
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
        subtitle="Each operation costs one action and money. Research is expensive; prospecting is cheap; capacity only matters if extraction and refinement meet."
        action={
          <Badge tone="accent" icon="Dices">
            {game.actionsLeft} actions left
          </Badge>
        }
      >
        <div className="industry-formula-strip">
          <span>
            <Icon name="ArrowRight" size={14} /> Production = MIN(extraction, refinement) ×
            technology
          </span>
          <span>
            <Icon name="ArrowRight" size={14} /> Consumption = civil + military
          </span>
          <span>
            <Icon name="ArrowRight" size={14} /> Balance = production + imports − consumption −
            exports
          </span>
          <span>
            <Icon name="ArrowRight" size={14} /> Reserves fall by production each turn
          </span>
        </div>
      </SectionCard>

      <div className="resource-card-grid">
        {RESOURCES.map((def) => {
          const state = player.resources[def.id]
          const flow = flows[def.id]
          const production = productions[def.id]
          const actions: IndustryAction[] = ['prospect', 'extraction', 'refinement', 'research']
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
                  <strong>{formatQuantity(state.reserves)}</strong>
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
                  <strong>{formatQuantity(flow.stock)}</strong>
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
                <span className="resource-research-line">
                  Research Lv {state.researchLevel} ·{' '}
                  {formatPercent(state.researchLevel * 2 + state.advances * 15, 0)} tech bonus
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
                  return (
                    <button
                      key={action}
                      type="button"
                      className={`industry-action ${action === 'research' ? 'is-research' : ''}`}
                      onClick={() => handleAction(def.id, action)}
                      disabled={!affordable}
                      title={`${INDUSTRY_ACTION_LABELS[action]} · ${meta.threshold} · ${meta.hint}`}
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
