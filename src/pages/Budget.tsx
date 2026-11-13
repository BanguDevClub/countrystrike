import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
} from 'recharts'
import { RESOURCES, RESOURCE_IDS } from '../game/constants'
import type { ResourceId } from '../game/types'
import { useGame, selectPlayer } from '../state/gameStore'
import { computeBudget, debtLimit, debtToGdp, resourceFlows } from '../game/selectors'
import {
  formatMoney,
  formatNumber,
  formatPercent,
  formatQuantity,
  formatReserveRunway,
  formatStockRunway,
} from '../game/format'
import { PageHeader, SectionCard, StatTile, Badge, ProgressBar, EmptyState } from '../components/ui'
import { Icon } from '../components/Icon'

const CURRENCY_TICK = (value: number) => formatMoney(value)
const QUANTITY_TICK = (value: number) => formatQuantity(value)

function RangeSelector({
  value,
  onChange,
  options,
}: {
  value: number
  onChange: (value: number) => void
  options: { value: number; label: string }[]
}) {
  return (
    <div className="segmented segmented-small" role="group" aria-label="History range">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? 'is-active' : ''}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Budget() {
  const game = useGame((state) => state.game)
  const player = useGame(selectPlayer)
  const setPage = useGame((state) => state.setPage)
  const setDebtRate = useGame((state) => state.setDebtRate)
  const adjustDebt = useGame((state) => state.adjustDebt)
  const [moneyMode, setMoneyMode] = useState<'flows' | 'balances'>('flows')
  const [range, setRange] = useState(12)
  const [resourceId, setResourceId] = useState<ResourceId>('energy')
  const [rate, setRate] = useState(player?.stats.debtRate ?? 5)
  const [debtAmount, setDebtAmount] = useState('1000')

  useEffect(() => {
    if (player) setRate(player.stats.debtRate)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only resync when the authoritative rate changes
  }, [player?.stats.debtRate])

  const budget = useMemo(
    () => (game && player ? computeBudget(player, game.deals, game.prices) : null),
    [game, player],
  )
  const flows = useMemo(
    () => (game && player ? resourceFlows(player, game.deals, game.prices) : null),
    [game, player],
  )
  const history = game?.history ?? []
  const visibleHistory = range === 0 ? history : history.slice(-range)
  const resourceDef = RESOURCES.find((resource) => resource.id === resourceId)!
  const resource = flows?.[resourceId]

  const moneyData = visibleHistory.map((point) => ({
    turn: point.turn,
    revenue: point.revenue,
    expenses: point.expenses,
    net: point.net,
    treasury: point.treasury,
    debt: point.debt,
  }))
  const resourceData = visibleHistory.map((point) => {
    const flow = point.resources[resourceId]
    return {
      turn: point.turn,
      production: flow.production,
      consumption: flow.consumption,
      stock: flow.stock,
      balance: flow.finalBalance,
      imports: flow.imports,
      exports: flow.exports,
    }
  })

  const rateChanged = player ? Math.abs(rate - player.stats.debtRate) > 0.01 : false

  if (!game || !player || !budget || !flows || !resource) return null

  const limit = debtLimit(player)
  const maxLedger = Math.max(budget.totalRevenue, budget.totalExpenses, 1)
  const currentResourceValue = resource.production * resource.price
  const selectedReserveRunway = formatReserveRunway(
    resource.reserves,
    resource.depletion ?? resource.production,
  )
  const selectedStockRunway = formatStockRunway(resource.stock, resource.finalBalance)
  return (
    <div className="page">
      <PageHeader page="budget">
        <button type="button" className="btn" onClick={() => setPage('governance')}>
          <Icon name="Landmark" size={16} /> Tax policy
        </button>
        <button type="button" className="btn" onClick={() => setPage('trade')}>
          <Icon name="HandCoins" size={16} /> Trade desk
        </button>
      </PageHeader>

      <div className="stat-grid stat-grid-4">
        <StatTile
          label="Treasury"
          value={formatMoney(player.stats.treasury)}
          hint={
            budget.net >= 0
              ? `${formatMoney(budget.net)} projected surplus`
              : `${formatMoney(budget.net)} projected deficit`
          }
          icon="Banknote"
          tone={player.stats.treasury > 0 ? 'positive' : 'negative'}
        />
        <StatTile
          label="Debt"
          value={formatMoney(player.stats.debt)}
          hint={`${formatPercent(debtToGdp(player))} of GDP · ${player.stats.debtRate.toFixed(1)}% rate`}
          icon="Wallet"
          tone="warning"
        />
        <StatTile
          label="Net this turn"
          value={formatMoney(budget.net)}
          hint={`${formatMoney(budget.totalRevenue)} in · ${formatMoney(budget.totalExpenses)} out`}
          icon={budget.net >= 0 ? 'TrendingUp' : 'TrendingDown'}
          tone={budget.net >= 0 ? 'positive' : 'negative'}
        />
        <StatTile
          label="GDP"
          value={formatMoney(player.stats.gdp)}
          hint={`Tax burden ${formatDecimal(budget.taxBurden)} · Laffer ${formatPercent(budget.laffer * 100)}`}
          icon="ChartLine"
          tone="accent"
        />
      </div>

      <div className="budget-main-grid">
        <SectionCard
          className="chart-card"
          title="Money over time"
          subtitle="Revenue, expenses and the balance of the state, turn by turn."
          action={
            <div className="chart-actions">
              <div className="segmented segmented-small" role="group" aria-label="Chart mode">
                <button
                  type="button"
                  className={moneyMode === 'flows' ? 'is-active' : ''}
                  onClick={() => setMoneyMode('flows')}
                  aria-pressed={moneyMode === 'flows'}
                >
                  Flows
                </button>
                <button
                  type="button"
                  className={moneyMode === 'balances' ? 'is-active' : ''}
                  onClick={() => setMoneyMode('balances')}
                  aria-pressed={moneyMode === 'balances'}
                >
                  Balances
                </button>
              </div>
              <RangeSelector
                value={range}
                onChange={setRange}
                options={[
                  { value: 8, label: '8' },
                  { value: 20, label: '20' },
                  { value: 0, label: 'All' },
                ]}
              />
            </div>
          }
        >
          {moneyData.length < 2 ? (
            <EmptyState
              icon="ChartLine"
              title="The ledger needs a second point"
              body="End a turn to chart the first fiscal year. The baseline is already recorded."
            />
          ) : (
            <div className="chart-frame">
              <ResponsiveContainer width="100%" height={286}>
                <ComposedChart data={moneyData} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
                  <defs>
                    <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.26" />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="expense-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--error)" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="var(--error)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="var(--chart-grid)"
                    strokeDasharray="3 6"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="turn"
                    tick={{ fill: 'var(--muted)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `T${value}`}
                  />
                  <YAxis
                    tick={{ fill: 'var(--muted)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={CURRENCY_TICK}
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
                    labelFormatter={(label) => `Turn ${label}`}
                    formatter={(value, name) => [formatMoney(Number(value)), String(name)]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted)' }} />
                  {moneyMode === 'flows' ? (
                    <>
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        name="Revenue"
                        stroke="var(--accent)"
                        fill="url(#revenue-fill)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="expenses"
                        name="Expenses"
                        stroke="var(--error)"
                        fill="url(#expense-fill)"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="net"
                        name="Net"
                        stroke="var(--accent-2)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </>
                  ) : (
                    <>
                      <Line
                        type="monotone"
                        dataKey="treasury"
                        name="Treasury"
                        stroke="var(--accent-2)"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="debt"
                        name="Debt"
                        stroke="var(--error)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="chart-footnote">
            <Icon name="Info" size={13} /> Money is shown in nominal USD. Hover any point for the
            exact values.
          </div>
        </SectionCard>

        <SectionCard
          className="ledger-card"
          title="Projected ledger"
          subtitle="The current policy mix, before the next turn closes."
          action={
            <Badge tone={budget.net >= 0 ? 'positive' : 'negative'}>
              {budget.net >= 0 ? 'Surplus' : 'Deficit'}
            </Badge>
          }
        >
          <div className="ledger-block">
            <div className="ledger-heading">
              <span>Revenue</span>
              <strong>{formatMoney(budget.totalRevenue)}</strong>
            </div>
            {budget.revenue.map((line) => (
              <div key={line.key} className="ledger-row">
                <div className="ledger-row-top">
                  <span>{line.label}</span>
                  <strong>{formatMoney(line.amount)}</strong>
                </div>
                <div className="ledger-bar">
                  <span style={{ width: `${Math.max(0, (line.amount / maxLedger) * 100)}%` }} />
                </div>
                {line.hint && <small>{line.hint}</small>}
              </div>
            ))}
          </div>
          <div className="ledger-block">
            <div className="ledger-heading">
              <span>Expenses</span>
              <strong>{formatMoney(budget.totalExpenses)}</strong>
            </div>
            {budget.expenses.map((line) => (
              <div key={line.key} className="ledger-row">
                <div className="ledger-row-top">
                  <span>{line.label}</span>
                  <strong>{formatMoney(line.amount)}</strong>
                </div>
                <div className="ledger-bar ledger-bar-expense">
                  <span style={{ width: `${Math.max(0, (line.amount / maxLedger) * 100)}%` }} />
                </div>
                {line.hint && <small>{line.hint}</small>}
              </div>
            ))}
          </div>
          <div className="ledger-net">
            <span>Net balance</span>
            <strong className={budget.net >= 0 ? 'text-positive' : 'text-negative'}>
              {formatMoney(budget.net)}
            </strong>
          </div>
        </SectionCard>
      </div>

      <div className="budget-middle-grid">
        <SectionCard
          title="Debt & lenders"
          subtitle="Borrow against the future, or buy some of it back. Changing the rate costs one action."
          className="debt-card"
        >
          <div className="debt-headline">
            <div>
              <span className="mini-kicker">Outstanding</span>
              <strong>{formatMoney(player.stats.debt)}</strong>
            </div>
            <Badge
              tone={
                debtToGdp(player) > 80
                  ? 'negative'
                  : debtToGdp(player) > 55
                    ? 'warning'
                    : 'positive'
              }
            >
              {formatPercent(debtToGdp(player))} of GDP
            </Badge>
          </div>
          <ProgressBar
            value={player.stats.debt}
            max={Math.max(1, limit)}
            tone={player.stats.debt / limit > 0.85 ? 'negative' : 'warning'}
            label="Credit limit"
            valueLabel={`${formatPercent((player.stats.debt / Math.max(1, limit)) * 100)} used`}
          />
          <div className="debt-terms">
            <span>
              Interest / turn{' '}
              <strong>{formatMoney(player.stats.debt * (player.stats.debtRate / 100))}</strong>
            </span>
            <span>
              Lender limit <strong>{formatMoney(limit)}</strong>
            </span>
          </div>
          <div className="field-grid">
            <label className="field">
              <span>Borrow / repay ($M)</span>
              <input
                className="input"
                type="number"
                min={1}
                step={100}
                value={debtAmount}
                onChange={(event) => setDebtAmount(event.target.value)}
              />
            </label>
            <div className="field-actions">
              <button
                type="button"
                className="btn"
                onClick={() => adjustDebt(Math.max(0, Number(debtAmount) || 0))}
                disabled={game.actionsLeft < 1}
              >
                <Icon name="Plus" size={15} /> Borrow
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => adjustDebt(-Math.max(0, Number(debtAmount) || 0))}
                disabled={game.actionsLeft < 1}
              >
                <Icon name="Minus" size={15} /> Repay
              </button>
            </div>
          </div>
          <div className="rate-control">
            <div className="field-label">
              <span>Debt rate</span>
              <strong>{rate.toFixed(1)}%</strong>
            </div>
            <input
              className="slider"
              type="range"
              min={1}
              max={20}
              step={0.5}
              value={rate}
              onChange={(event) => setRate(Number(event.target.value))}
              style={{ '--fill': `${((rate - 1) / 19) * 100}%` } as React.CSSProperties}
            />
            <div className="range-scale">
              <span>1%</span>
              <span>20%</span>
            </div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setDebtRate(rate)}
              disabled={!rateChanged || game.actionsLeft < 1}
            >
              <Icon name="Percent" size={14} /> Apply rate
            </button>
            <p className="helper-text">
              A higher rate widens the lender limit but makes every borrowed dollar more expensive
              next turn.
            </p>
          </div>
        </SectionCard>

        <SectionCard
          className="chart-card resource-chart-card"
          title="Resource history"
          subtitle="Extraction, consumption and stock for a single resource."
          action={
            <div className="chart-actions">
              <select
                className="select select-small"
                value={resourceId}
                onChange={(event) => setResourceId(event.target.value as ResourceId)}
              >
                {RESOURCES.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.name}
                  </option>
                ))}
              </select>
              <RangeSelector
                value={range}
                onChange={setRange}
                options={[
                  { value: 8, label: '8' },
                  { value: 20, label: '20' },
                  { value: 0, label: 'All' },
                ]}
              />
            </div>
          }
        >
          <div className="resource-chart-head">
            <span className="resource-icon-large" style={{ color: `var(${resourceDef.colorVar})` }}>
              <Icon name={resourceDef.icon} size={22} />
            </span>
            <div>
              <strong>{resourceDef.name}</strong>
              <span>
                {formatMoney(resource.price)} / {resourceDef.unit} ·{' '}
                {formatMoney(currentResourceValue)} produced
              </span>
            </div>
            <Badge tone={resource.finalBalance >= 0 ? 'positive' : 'negative'}>
              {resource.finalBalance >= 0 ? 'Surplus' : 'Deficit'}{' '}
              {formatQuantity(resource.finalBalance)}
            </Badge>
          </div>
          {resourceData.length < 2 ? (
            <EmptyState
              icon="Layers"
              title="No resource history"
              body="The first turn will record extraction, consumption and stock."
            />
          ) : (
            <div className="chart-frame">
              <ResponsiveContainer width="100%" height={252}>
                <ComposedChart
                  data={resourceData}
                  margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                >
                  <CartesianGrid
                    stroke="var(--chart-grid)"
                    strokeDasharray="3 6"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="turn"
                    tick={{ fill: 'var(--muted)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `T${value}`}
                  />
                  <YAxis
                    tick={{ fill: 'var(--muted)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={QUANTITY_TICK}
                    width={48}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      color: 'var(--fg)',
                      fontSize: 12,
                    }}
                    labelFormatter={(label) => `Turn ${label}`}
                    formatter={(value, name) => [formatQuantity(Number(value)), String(name)]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted)' }} />
                  <Bar
                    dataKey="production"
                    name="Production"
                    fill="var(--accent)"
                    radius={[4, 4, 0, 0]}
                    fillOpacity={0.75}
                  />
                  <Bar
                    dataKey="consumption"
                    name="Consumption"
                    fill="var(--warning)"
                    radius={[4, 4, 0, 0]}
                    fillOpacity={0.65}
                  />
                  <Line
                    type="monotone"
                    dataKey="stock"
                    name="Stock"
                    stroke="var(--accent-2)"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="resource-chart-stats">
            <span>
              <small>Production</small>
              <strong>{formatQuantity(resource.production)}</strong>
            </span>
            <span>
              <small>Consumption</small>
              <strong>{formatQuantity(resource.consumption)}</strong>
            </span>
            <span>
              <small>Imports</small>
              <strong>{formatQuantity(resource.imports)}</strong>
            </span>
            <span>
              <small>Exports</small>
              <strong>{formatQuantity(resource.exports)}</strong>
            </span>
            <span>
              <small>Stock</small>
              <strong>{formatQuantity(resource.stock)}</strong>
              <small
                className={`cell-sub ${selectedStockRunway.tone !== 'muted' ? `text-${selectedStockRunway.tone}` : ''}`}
              >
                {selectedStockRunway.text}
              </small>
            </span>
            <span>
              <small>Reserves</small>
              <strong>{formatQuantity(resource.reserves)}</strong>
              <small
                className={`cell-sub ${selectedReserveRunway.tone !== 'muted' ? `text-${selectedReserveRunway.tone}` : ''}`}
              >
                {selectedReserveRunway.text}
              </small>
            </span>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Resource ledger"
        subtitle="Extraction × refinement, consumption, trade and the resulting balance."
        action={
          <Badge tone="muted" icon="Layers">
            {RESOURCE_IDS.length} tracked resources
          </Badge>
        }
        className="table-card"
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Resource</th>
                <th
                  className="num"
                  title="Known reserves and estimated runway in turns at current depletion rate"
                >
                  Reserves
                  <small className="cell-sub">runway</small>
                </th>
                <th className="num">Extraction</th>
                <th className="num">Refinement</th>
                <th className="num">Production</th>
                <th className="num">Consumption</th>
                <th className="num">Imports</th>
                <th className="num">Exports</th>
                <th className="num">Balance</th>
                <th
                  className="num"
                  title="Stored stock and estimated runway in turns at current net balance"
                >
                  Stock
                  <small className="cell-sub">runway</small>
                </th>
              </tr>
            </thead>
            <tbody>
              {RESOURCE_IDS.map((id) => {
                const def = RESOURCES.find((entry) => entry.id === id)!
                const flow = flows[id]
                const reserveRunway = formatReserveRunway(
                  flow.reserves,
                  flow.depletion ?? flow.production,
                )
                const stockRunway = formatStockRunway(flow.stock, flow.finalBalance)
                return (
                  <tr key={id}>
                    <td>
                      <span className="resource-inline" style={{ color: `var(${def.colorVar})` }}>
                        <Icon name={def.icon} size={15} />
                        <span>{def.name}</span>
                        <Badge tone="muted">{def.category}</Badge>
                      </span>
                    </td>
                    <td
                      className="num"
                      title={`Reserves: ${formatQuantity(flow.reserves)} · Lasts ${reserveRunway.text} at current depletion (${formatQuantity(flow.depletion ?? flow.production)}/turn)`}
                    >
                      <span>{formatQuantity(flow.reserves)}</span>
                      <small
                        className={`cell-sub ${reserveRunway.tone !== 'muted' ? `text-${reserveRunway.tone}` : ''}`}
                      >
                        {reserveRunway.text}
                      </small>
                    </td>
                    <td className="num">{formatQuantity(flow.extractionCapacity)}</td>
                    <td className="num">{formatQuantity(flow.refinementCapacity)}</td>
                    <td className="num">{formatQuantity(flow.production)}</td>
                    <td className="num">{formatQuantity(flow.consumption)}</td>
                    <td className="num">{formatQuantity(flow.imports)}</td>
                    <td className="num">{formatQuantity(flow.exports)}</td>
                    <td
                      className={`num ${flow.finalBalance >= 0 ? 'text-positive' : 'text-negative'}`}
                    >
                      {flow.finalBalance > 0 ? '+' : ''}
                      {formatQuantity(flow.finalBalance)}
                    </td>
                    <td
                      className="num"
                      title={`Stock: ${formatQuantity(flow.stock)} · Lasts ${stockRunway.text} at current net balance (${flow.finalBalance >= 0 ? '+' : ''}${formatQuantity(flow.finalBalance)}/turn)`}
                    >
                      <span>{formatQuantity(flow.stock)}</span>
                      <small
                        className={`cell-sub ${stockRunway.tone !== 'muted' ? `text-${stockRunway.tone}` : ''}`}
                      >
                        {stockRunway.text}
                      </small>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="table-note">
          Production = MIN(extraction, refinement) × technology. Final balance = production +
          imports − consumption − exports. Known reserves fall by production each turn. Reserve and
          stock runways show how many turns remain under current production and net balance. The
          full methodology is in{' '}
          <button type="button" className="text-btn" onClick={() => setPage('methodology')}>
            Methodology
          </button>
          .
        </p>
      </SectionCard>

      <SectionCard title="Spending structure" subtitle="Where the projected money goes.">
        <div className="spending-chart">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={budget.expenses.map((line) => ({ name: line.label, amount: line.amount }))}
              layout="vertical"
              margin={{ left: 18, right: 16, top: 0, bottom: 0 }}
            >
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 6" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: 'var(--muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={CURRENCY_TICK}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: 'var(--muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={112}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  color: 'var(--fg)',
                  fontSize: 12,
                }}
                formatter={(value) => [formatMoney(Number(value)), 'Amount']}
              />
              <Bar dataKey="amount" fill="var(--accent)" radius={[0, 5, 5, 0]} fillOpacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>
    </div>
  )
}

function formatDecimal(value: number): string {
  return formatNumber(value, 1)
}
