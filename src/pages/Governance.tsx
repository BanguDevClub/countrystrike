import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { GOVERNMENT_BY_ID, MINISTRIES, MINISTRY_COST_FACTORS } from '../game/constants'
import type { BudgetBreakdown, BudgetLevel, TaxRates } from '../game/types'
import { useGame, selectPlayer } from '../state/gameStore'
import {
  averageCorruption,
  combinedModifiers,
  computeBudget,
  lafferAtBurden,
  taxBurden,
} from '../game/selectors'
import { formatDecimal, formatMoney, formatPercent } from '../game/format'
import { Badge, PageHeader, ProgressBar, SectionCard, StatTile } from '../components/ui'
import { Icon } from '../components/Icon'

interface TaxField {
  key: keyof TaxRates
  label: string
  min: number
  max: number
  step: number
  description: string
  icon: string
}

const TAX_FIELDS: TaxField[] = [
  {
    key: 'corporate',
    label: 'Corporate tax',
    min: 0,
    max: 100,
    step: 1,
    description:
      'Taxes business profit. High rates push capital offshore; very low rates invite a haven boom.',
    icon: 'Factory',
  },
  {
    key: 'income',
    label: 'Income tax',
    min: 0,
    max: 100,
    step: 1,
    description:
      'Taxes household income. Broad and politically sensitive; drives approval and inequality.',
    icon: 'Users',
  },
  {
    key: 'tariff',
    label: 'Import tariff',
    min: 0,
    max: 500,
    step: 5,
    description:
      'A border tax on imports. Raises revenue and protects industry, but damages relations.',
    icon: 'Ship',
  },
  {
    key: 'royalty',
    label: 'Natural resource royalty',
    min: 0,
    max: 100,
    step: 1,
    description:
      'The state share of resource production. Captures commodity rents at the cost of investor appetite.',
    icon: 'Pickaxe',
  },
]

const BUDGET_LEVELS: { id: BudgetLevel; label: string; hint: string }[] = [
  { id: 'low', label: 'Low', hint: 'Cheap; raises bad-event risk' },
  { id: 'normal', label: 'Normal', hint: 'Balanced' },
  { id: 'high', label: 'High', hint: 'Costly; raises good-event chance' },
]

function revenueFor(key: keyof TaxRates, budget: BudgetBreakdown): number {
  const line = budget.revenue.find((entry) => entry.key === key)
  return line?.amount ?? 0
}

export function Governance() {
  const game = useGame((state) => state.game)
  const player = useGame(selectPlayer)
  const setTax = useGame((state) => state.setTax)
  const setMinistryBudget = useGame((state) => state.setMinistryBudget)
  const replaceMinister = useGame((state) => state.replaceMinister)
  const setPage = useGame((state) => state.setPage)
  const [draft, setDraft] = useState<TaxRates>(
    player?.taxes ?? { corporate: 20, income: 20, tariff: 0, royalty: 20 },
  )

  useEffect(() => {
    if (player) setDraft({ ...player.taxes })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only resync when an applied tax rate changes
  }, [player?.taxes.corporate, player?.taxes.income, player?.taxes.tariff, player?.taxes.royalty])

  const budget = useMemo(
    () => (game && player ? computeBudget(player, game.deals, game.prices) : null),
    [game, player],
  )

  if (!game || !player || !budget) return null
  const government = GOVERNMENT_BY_ID[player.government]
  const burden = taxBurden(player.taxes)
  const draftBurden = taxBurden(draft)
  const currentLaffer = lafferAtBurden(burden)
  const draftLaffer = lafferAtBurden(draftBurden)
  const curveData = Array.from({ length: 61 }, (_, index) => {
    const value = index * 2
    return { burden: value, multiplier: lafferAtBurden(value) * 100 }
  })
  const modifiers = combinedModifiers(player)
  const averageCorruptionValue = averageCorruption(player)

  const handleBudget = (id: keyof typeof player.ministries, level: BudgetLevel) => {
    setMinistryBudget(id, level)
  }

  return (
    <div className="page">
      <PageHeader page="governance">
        <button type="button" className="btn" onClick={() => setPage('budget')}>
          <Icon name="ChartLine" size={16} /> Budget
        </button>
        <button type="button" className="btn" onClick={() => setPage('methodology')}>
          <Icon name="Sigma" size={16} /> Methodology
        </button>
      </PageHeader>

      <div className="stat-grid stat-grid-4">
        <StatTile
          label="Tax burden"
          value={formatDecimal(burden, 1)}
          hint={burden > 40 ? 'Past the Laffer peak' : 'Below the Laffer peak'}
          icon="Percent"
          tone={burden > 40 ? 'warning' : 'positive'}
        />
        <StatTile
          label="Collection efficiency"
          value={formatPercent(currentLaffer * 100)}
          hint="Share of the nominal rate actually collected"
          icon="Gauge"
          tone={currentLaffer > 0.8 ? 'positive' : 'warning'}
        />
        <StatTile
          label="Tax revenue"
          value={formatMoney(revenueFor('corporate', budget) + revenueFor('income', budget))}
          hint="Corporate + income, projected this turn"
          icon="Banknote"
        />
        <StatTile
          label="Average corruption"
          value={formatPercent(averageCorruptionValue)}
          hint="Across all cabinet ministries"
          icon="Eye"
          tone={averageCorruptionValue > 50 ? 'negative' : 'accent'}
        />
      </div>

      <div className="governance-top-grid">
        <SectionCard
          className="government-card"
          title="Form of state"
          subtitle="A founding condition, not a toggle. Its buff and debuff are permanent."
        >
          <div className="government-hero">
            <span className="government-hero-icon">
              <Icon name={government?.icon ?? 'Landmark'} size={30} />
            </span>
            <div>
              <span className="mini-kicker">Government</span>
              <h2>{government?.name}</h2>
              <p>{government?.description}</p>
            </div>
          </div>
          <div className="government-effects government-effects-large">
            <Badge tone="positive" icon="TrendingUp">
              {government?.buff}
            </Badge>
            <Badge tone="negative" icon="TrendingDown">
              {government?.debuff}
            </Badge>
          </div>
          <div className="government-modifier-grid">
            <span>
              <small>Trade orientation</small>
              <strong>{formatPercent((modifiers.trade ?? 0) * 100, 0)}</strong>
            </span>
            <span>
              <small>Tax efficiency</small>
              <strong>{formatPercent((modifiers.taxEfficiency ?? 0) * 100, 0)}</strong>
            </span>
            <span>
              <small>Military upkeep</small>
              <strong>{formatPercent((modifiers.militaryUpkeep ?? 0) * 100, 0)}</strong>
            </span>
            <span>
              <small>Security</small>
              <strong>{formatDecimal(modifiers.security ?? 0, 0)}</strong>
            </span>
          </div>
        </SectionCard>

        <SectionCard
          className="chart-card laffer-card"
          title="The Laffer curve"
          subtitle="Revenue is not linear in tax rates. Past the peak, higher rates collect less and hurt approval."
          action={
            <Badge
              tone={burden > 40 ? 'warning' : 'positive'}
              icon={burden > 40 ? 'TrendingDown' : 'TrendingUp'}
            >
              {burden > 40 ? 'Past peak' : 'Before peak'}
            </Badge>
          }
        >
          <div className="chart-frame">
            <ResponsiveContainer width="100%" height={248}>
              <AreaChart data={curveData} margin={{ top: 12, right: 18, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="laffer-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-2)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="var(--accent-2)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 6" vertical={false} />
                <XAxis
                  dataKey="burden"
                  tick={{ fill: 'var(--muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `${value}`}
                  label={{
                    value: 'Tax burden index',
                    position: 'insideBottomRight',
                    offset: -2,
                    fill: 'var(--faint)',
                    fontSize: 10,
                  }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: 'var(--muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `${value}%`}
                  width={42}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    color: 'var(--fg)',
                    fontSize: 12,
                  }}
                  labelFormatter={(label) => `Burden ${label}`}
                  formatter={(value) => [`${Number(value).toFixed(0)}%`, 'Collection multiplier']}
                />
                <Area
                  type="monotone"
                  dataKey="multiplier"
                  stroke="var(--accent-2)"
                  strokeWidth={2.5}
                  fill="url(#laffer-fill)"
                />
                <ReferenceLine
                  x={40}
                  stroke="var(--warning)"
                  strokeDasharray="4 4"
                  label={{
                    value: 'peak',
                    fill: 'var(--warning)',
                    fontSize: 10,
                    position: 'insideTop',
                  }}
                />
                <ReferenceLine x={burden} stroke="var(--accent)" strokeDasharray="3 4" />
                <ReferenceDot
                  x={burden}
                  y={currentLaffer * 100}
                  r={5}
                  fill="var(--accent)"
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="laffer-stats">
            <span>
              <small>Current burden</small>
              <strong>{formatDecimal(burden, 1)}</strong>
            </span>
            <span>
              <small>Current multiplier</small>
              <strong>{formatPercent(currentLaffer * 100)}</strong>
            </span>
            <span>
              <small>Draft burden</small>
              <strong
                className={
                  draftBurden > burden
                    ? 'text-negative'
                    : draftBurden < burden
                      ? 'text-positive'
                      : ''
                }
              >
                {formatDecimal(draftBurden, 1)}
              </strong>
            </span>
            <span>
              <small>Draft multiplier</small>
              <strong>{formatPercent(draftLaffer * 100)}</strong>
            </span>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Tax policy"
        subtitle="Each applied change costs one action. The Laffer curve responds immediately; events may follow."
        action={
          <Badge tone="accent" icon="Dices">
            {game.actionsLeft} actions left
          </Badge>
        }
      >
        <div className="tax-grid">
          {TAX_FIELDS.map((field) => {
            const value = draft[field.key]
            const changed = value !== player.taxes[field.key]
            const max = field.max
            const percent = ((value - field.min) / (max - field.min)) * 100
            return (
              <div key={field.key} className={`tax-card ${changed ? 'is-changed' : ''}`}>
                <div className="tax-card-head">
                  <span className="tax-icon">
                    <Icon name={field.icon} size={18} />
                  </span>
                  <div>
                    <h3>{field.label}</h3>
                    <span>{formatMoney(revenueFor(field.key, budget))} projected</span>
                  </div>
                  <strong className="tax-value">{value}%</strong>
                </div>
                <input
                  className="slider"
                  type="range"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={value}
                  onChange={(event) =>
                    setDraft((previous) => ({
                      ...previous,
                      [field.key]: Number(event.target.value),
                    }))
                  }
                  style={{ '--fill': `${percent}%` } as React.CSSProperties}
                  aria-label={field.label}
                />
                <div className="range-scale">
                  <span>{field.min}%</span>
                  <span>{max}%</span>
                </div>
                <p>{field.description}</p>
                <div className="tax-card-actions">
                  <span className={changed ? 'text-warning' : 'text-muted'}>
                    {changed
                      ? `Draft ${value}% · current ${player.taxes[field.key]}%`
                      : 'No pending change'}
                  </span>
                  <button
                    type="button"
                    className={`btn btn-sm ${changed ? 'btn-primary' : ''}`}
                    disabled={!changed || game.actionsLeft < 1}
                    onClick={() => setTax(field.key, value)}
                  >
                    <Icon name="Check" size={14} /> Apply
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        <div className="tax-signals">
          <Badge
            tone={
              player.taxes.corporate > 45
                ? 'warning'
                : player.taxes.corporate < 8
                  ? 'accent'
                  : 'muted'
            }
            icon="Factory"
          >
            {player.taxes.corporate > 45
              ? 'Capital flight risk'
              : player.taxes.corporate < 8
                ? 'Tax haven dynamic'
                : 'Corporate rate within norms'}
          </Badge>
          <Badge
            tone={
              player.taxes.tariff > 120
                ? 'negative'
                : player.taxes.tariff > 30
                  ? 'warning'
                  : 'muted'
            }
            icon="Ship"
          >
            {player.taxes.tariff > 120
              ? 'Trade war pressure'
              : player.taxes.tariff > 30
                ? 'Protectionist tilt'
                : 'Open border posture'}
          </Badge>
          <Badge
            tone={burden > 58 ? 'negative' : burden > 48 ? 'warning' : 'positive'}
            icon="Percent"
          >
            {burden > 58
              ? 'Revenue on the wrong side of the curve'
              : burden > 48
                ? 'Burden visibly rising'
                : 'Burden within a sustainable band'}
          </Badge>
          <span className="tax-signals-note">
            <Icon name="Info" size={13} /> High tax burdens and low ministry budgets can trigger
            damaging events.
          </span>
        </div>
      </SectionCard>

      <SectionCard
        title="Cabinet & ministries"
        subtitle="Competent heads and resourced ministries buy stability. Corruption and disloyalty buy trouble."
        action={
          <Badge tone="muted" icon="Users">
            {MINISTRIES.length} ministries
          </Badge>
        }
      >
        <div className="ministry-grid">
          {MINISTRIES.map((ministry) => {
            const entry = player.ministries[ministry.id]
            const cost = player.stats.gdp * MINISTRY_COST_FACTORS[entry.budget]
            const replaceCost = Math.max(25, player.stats.gdp * 0.0015)
            return (
              <div
                key={ministry.id}
                className={`ministry-card ${entry.budget === 'low' ? 'is-underfunded' : ''} ${entry.head.corruption > 55 ? 'is-corrupt' : ''}`}
              >
                <div className="ministry-head">
                  <span className="ministry-icon">
                    <Icon name={ministry.icon} size={19} />
                  </span>
                  <div className="ministry-title">
                    <h3>{ministry.name.replace('Ministry of ', '')}</h3>
                    <span>{ministry.focus}</span>
                  </div>
                  <Badge
                    tone={
                      entry.budget === 'high'
                        ? 'positive'
                        : entry.budget === 'low'
                          ? 'negative'
                          : 'muted'
                    }
                  >
                    {entry.budget}
                  </Badge>
                </div>
                <div className="minister-row">
                  <div className="minister-avatar">{entry.head.name.slice(0, 2).toUpperCase()}</div>
                  <div className="minister-copy">
                    <strong>{entry.head.name}</strong>
                    <span>
                      Skill {entry.head.skill} · Loyalty {entry.head.loyalty}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-tiny"
                    onClick={() => replaceMinister(ministry.id)}
                    disabled={game.actionsLeft < 1 || player.stats.treasury < replaceCost}
                    title={`Replace minister · ${formatMoney(replaceCost)}`}
                  >
                    Replace
                  </button>
                </div>
                <div className="minister-bars">
                  <ProgressBar
                    label="Corruption"
                    value={entry.head.corruption}
                    tone={entry.head.corruption > 55 ? 'negative' : 'warning'}
                    thin
                    valueLabel={`${entry.head.corruption}`}
                  />
                  <ProgressBar
                    label="Loyalty"
                    value={entry.head.loyalty}
                    tone={entry.head.loyalty < 35 ? 'negative' : 'positive'}
                    thin
                    valueLabel={`${entry.head.loyalty}`}
                  />
                </div>
                <div className="ministry-budget">
                  <div className="field-label">
                    <span>Budget</span>
                    <strong>{formatMoney(cost)} / turn</strong>
                  </div>
                  <div className="segmented segmented-small budget-segmented">
                    {BUDGET_LEVELS.map((level) => (
                      <button
                        key={level.id}
                        type="button"
                        className={entry.budget === level.id ? 'is-active' : ''}
                        onClick={() => handleBudget(ministry.id, level.id)}
                        disabled={game.actionsLeft < 1}
                        title={level.hint}
                        aria-pressed={entry.budget === level.id}
                      >
                        {level.label}
                      </button>
                    ))}
                  </div>
                  <span className="ministry-budget-hint">
                    {entry.budget === 'low'
                      ? 'Bad events more likely'
                      : entry.budget === 'high'
                        ? 'Good events more likely'
                        : 'Standard service levels'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
        <div className="notice notice-neutral governance-notice">
          <Icon name="Info" size={17} />
          <div>
            <strong>Ministry budgets are political choices, not just accounting.</strong>
            <span>
              Low budgets save money but raise the chance of damaging events. High budgets cost more
              and tilt the event deck toward good outcomes. Heads with high corruption cost
              efficiency; low loyalty can become a security problem.
            </span>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
