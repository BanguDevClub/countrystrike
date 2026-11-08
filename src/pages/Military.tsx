import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { RESOURCES, UNITS } from '../game/constants'
import type { ResourceId, UnitId } from '../game/types'
import { useGame, selectPlayer } from '../state/gameStore'
import {
  militaryPower,
  militaryResourceConsumption,
  soldiersPer100k,
  unitUpkeep,
} from '../game/selectors'
import { unitPurchasePlan } from '../game/engine'
import {
  formatDecimal,
  formatMoney,
  formatNumber,
  formatPercent,
  formatQuantity,
} from '../game/format'
import { Badge, PageHeader, ProgressBar, SectionCard, StatTile } from '../components/ui'
import { Icon } from '../components/Icon'
import { playSfx } from '../game/audio'

const BAR_COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)']

export function Military() {
  const game = useGame((state) => state.game)
  const player = useGame(selectPlayer)
  const recruit = useGame((state) => state.recruit)
  const disband = useGame((state) => state.disband)
  const setPage = useGame((state) => state.setPage)
  const [quantities, setQuantities] = useState<Record<UnitId, string>>(() =>
    UNITS.reduce(
      (result, unit) => {
        result[unit.id] = String(unit.step)
        return result
      },
      {} as Record<UnitId, string>,
    ),
  )

  const upkeep = useMemo(() => (player ? unitUpkeep(player) : 0), [player])
  const power = useMemo(() => (player ? militaryPower(player) : 0), [player])
  const resourceDrain = useMemo(() => {
    if (!player) return [] as { id: ResourceId; amount: number }[]
    return RESOURCES.map((def) => ({
      id: def.id,
      amount: militaryResourceConsumption(player, def.id),
    })).filter((entry) => entry.amount > 0.0001)
  }, [player])
  const upkeepData = useMemo(() => {
    if (!player) return []
    return UNITS.map((unit, index) => ({
      name: unit.name,
      upkeep: player.military[unit.id] * unit.upkeep,
      power: player.military[unit.id] * unit.power,
      fill: BAR_COLORS[index % BAR_COLORS.length],
    })).filter((entry) => entry.upkeep > 0)
  }, [player])

  if (!game || !player) return null

  const soldierDensity = soldiersPer100k(player)
  const actionLocked = game.actionsLeft < 1

  const setQuantity = (id: UnitId, value: string) => {
    setQuantities((current) => ({ ...current, [id]: value.replace(/[^0-9]/g, '') }))
  }

  return (
    <div className="page">
      <PageHeader page="military">
        <button type="button" className="btn" onClick={() => setPage('industry')}>
          <Icon name="Factory" size={16} /> Supply base
        </button>
        <button type="button" className="btn" onClick={() => setPage('budget')}>
          <Icon name="Banknote" size={16} /> Upkeep in budget
        </button>
      </PageHeader>

      <div className="stat-grid stat-grid-4">
        <StatTile
          label="Military power"
          value={formatDecimal(power, 0)}
          hint="Composite of platforms and warheads"
          icon="Trophy"
          tone="accent"
        />
        <StatTile
          label="Upkeep"
          value={formatMoney(upkeep)}
          hint={`${formatPercent((upkeep / Math.max(1, player.stats.gdp)) * 100, 2)} of GDP per turn`}
          icon="Banknote"
          tone="warning"
        />
        <StatTile
          label="Security"
          value={formatPercent(player.stats.security)}
          hint={`${formatNumber(soldierDensity, 0)} soldiers / 100k people`}
          icon="Shield"
          tone={player.stats.security < 40 ? 'negative' : 'positive'}
        />
        <StatTile
          label="Corruption"
          value={formatPercent(player.stats.corruption)}
          hint="A better-paid, larger force can improve order"
          icon="Eye"
          tone={player.stats.corruption > 55 ? 'negative' : 'accent'}
        />
      </div>

      <div className="military-top-grid">
        <SectionCard
          className="chart-card"
          title="Upkeep by platform"
          subtitle="What the current order of battle costs every turn."
          action={<Badge tone="warning">{formatMoney(upkeep)} / turn</Badge>}
        >
          {upkeepData.length === 0 ? (
            <div className="chart-empty">No standing units. Recruit below to build a force.</div>
          ) : (
            <div className="chart-frame">
              <ResponsiveContainer width="100%" height={252}>
                <BarChart data={upkeepData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid
                    stroke="var(--chart-grid)"
                    strokeDasharray="3 6"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: 'var(--muted)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={-18}
                    textAnchor="end"
                    height={52}
                  />
                  <YAxis
                    tick={{ fill: 'var(--muted)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => formatMoney(value)}
                    width={62}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      color: 'var(--fg)',
                      fontSize: 12,
                    }}
                    formatter={(value, name) => [
                      name === 'upkeep'
                        ? formatMoney(Number(value))
                        : formatDecimal(Number(value), 0),
                      name === 'upkeep' ? 'Upkeep' : 'Power',
                    ]}
                  />
                  <Bar dataKey="upkeep" name="Upkeep" radius={[5, 5, 0, 0]}>
                    {upkeepData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard
          className="security-card"
          title="Security equation"
          subtitle="Soldiers influence both security and corruption."
        >
          <div className="security-metrics">
            <div>
              <span className="mini-kicker">Personnel density</span>
              <strong>{formatNumber(soldierDensity, 0)} / 100k</strong>
              <ProgressBar value={Math.min(100, soldierDensity / 5)} tone="accent" thin />
            </div>
            <div>
              <span className="mini-kicker">Civil security</span>
              <strong>{formatPercent(player.stats.security)}</strong>
              <ProgressBar
                value={player.stats.security}
                tone={player.stats.security > 55 ? 'positive' : 'warning'}
                thin
              />
            </div>
            <div>
              <span className="mini-kicker">Institutional corruption</span>
              <strong>{formatPercent(player.stats.corruption)}</strong>
              <ProgressBar value={player.stats.corruption} tone="negative" thin />
            </div>
          </div>
          <p className="helper-text">
            Security rises with soldiers per capita and the Interior budget, and falls with
            corruption. A large military can keep order, but it also consumes oil, metal and rare
            earth every turn.
          </p>
          <div className="resource-drain-list">
            <span className="mini-kicker">Military resource drain / turn</span>
            {resourceDrain.length === 0 ? (
              <span className="text-muted">No measurable resource consumption.</span>
            ) : (
              resourceDrain.map((entry) => {
                const def = RESOURCES.find((resource) => resource.id === entry.id)!
                return (
                  <span key={entry.id} className="resource-drain-row">
                    <span style={{ color: `var(${def.colorVar})` }}>
                      <Icon name={def.icon} size={14} /> {def.name}
                    </span>
                    <strong>{formatQuantity(entry.amount)}</strong>
                  </span>
                )
              })
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Order of battle"
        subtitle="Increase or decrease any platform. Each transaction costs one action."
        action={
          <Badge tone="accent" icon="Dices">
            {game.actionsLeft} actions left
          </Badge>
        }
      >
        <div className="unit-card-grid">
          {UNITS.map((unit) => {
            const quantity = Number(quantities[unit.id]) || 0
            const count = player.military[unit.id]
            const plan = unitPurchasePlan(player, unit.id, quantity)
            const moneyShort = player.stats.treasury < plan.money
            const resourcesShort = !plan.allowed
            const recruitDisabled = actionLocked || quantity <= 0 || moneyShort || resourcesShort
            const disbandDisabled = actionLocked || quantity <= 0 || count < quantity
            const upkeepCost = count * unit.upkeep
            const powerContribution = count * unit.power
            return (
              <article key={unit.id} className="unit-card">
                <header className="unit-head">
                  <span className="unit-icon">
                    <Icon name={unit.icon} size={22} />
                  </span>
                  <div className="unit-title">
                    <h3>{unit.name}</h3>
                    <span>{formatDecimal(unit.power, 3)} power / unit</span>
                  </div>
                  <Badge tone={count > 0 ? 'accent' : 'muted'}>{formatNumber(count, 0)}</Badge>
                </header>
                <p className="unit-description">{unit.description}</p>
                <div className="unit-stats">
                  <span>
                    <small>Power</small>
                    <strong>{formatDecimal(powerContribution, 0)}</strong>
                  </span>
                  <span>
                    <small>Upkeep</small>
                    <strong>{formatMoney(upkeepCost)}</strong>
                  </span>
                  <span>
                    <small>Recruit</small>
                    <strong>{formatMoney(unit.recruitCost)}</strong>
                  </span>
                  <span>
                    <small>Step</small>
                    <strong>{formatNumber(unit.step, 0)}</strong>
                  </span>
                </div>
                <div className="unit-resources">
                  {Object.entries(unit.resourceCost).length === 0 ? (
                    <span>
                      <Icon name="Banknote" size={13} /> Money only
                    </span>
                  ) : (
                    Object.entries(unit.resourceCost).map(([key, amount]) => {
                      const def = RESOURCES.find((resource) => resource.id === key)!
                      return (
                        <span key={key} style={{ color: `var(${def.colorVar})` }}>
                          <Icon name={def.icon} size={13} />
                          {formatQuantity((amount ?? 0) * Math.max(1, quantity))}
                        </span>
                      )
                    })
                  )}
                </div>
                <div className="unit-purchase">
                  <label className="unit-quantity">
                    <span>Amount</span>
                    <input
                      className="input input-small"
                      type="number"
                      min={0}
                      step={unit.step}
                      value={quantities[unit.id]}
                      onChange={(event) => setQuantity(unit.id, event.target.value)}
                      aria-label={`${unit.name} quantity`}
                    />
                  </label>
                  <div className="unit-purchase-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        playSfx('coin')
                        recruit(unit.id, quantity)
                      }}
                      disabled={recruitDisabled}
                      title={
                        actionLocked
                          ? 'No actions remaining'
                          : moneyShort
                            ? `Need ${formatMoney(plan.money)}`
                            : resourcesShort
                              ? 'Insufficient strategic resources'
                              : `Recruit ${quantity} for ${formatMoney(plan.money)}`
                      }
                    >
                      <Icon name="Plus" size={14} /> Recruit
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => disband(unit.id, quantity)}
                      disabled={disbandDisabled}
                      title={
                        count < quantity ? 'Not enough units' : 'Disband and recover 20% of value'
                      }
                    >
                      <Icon name="Minus" size={14} /> Disband
                    </button>
                  </div>
                </div>
                <footer className="unit-foot">
                  <span>
                    <Icon name="Info" size={12} /> {formatMoney(plan.money)} for{' '}
                    {formatNumber(quantity, 0)} units
                  </span>
                  <span>
                    {formatQuantity(quantity * (unit.upkeepResources.oil ?? 0))} oil drain
                  </span>
                </footer>
              </article>
            )
          })}
        </div>
        <div className="notice notice-neutral">
          <Icon name="Info" size={17} />
          <div>
            <strong>Procurement is an action.</strong>
            <span>
              Buying or decommissioning units consumes 1 of your 10 actions. Disbanding recovers 20%
              of the procurement price but not the strategic materials. Upkeep is charged every turn
              through the budget.
            </span>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
