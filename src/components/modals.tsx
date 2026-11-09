import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import {
  GOVERNMENT_BY_ID,
  MINISTRIES,
  RESOURCES,
  RESOURCE_IDS,
  TRAIT_BY_ID,
  UNITS,
} from '../game/constants'
import type { PendingCheck } from '../game/types'
import { useGame } from '../state/gameStore'
import { playSfx } from '../game/audio'
import {
  averageCorruption,
  combinedModifiers,
  computeBudget,
  computeComposites,
  debtToGdp,
  gdpPerCapita,
  militaryPower,
  relationLabel,
  resourceFlows,
  soldiersPer100k,
} from '../game/selectors'
import {
  formatDecimal,
  formatMoney,
  formatUsd,
  formatNumber,
  formatPercent,
  formatQuantity,
} from '../game/format'
import { EVENT_BY_ID } from '../game/events'
import type { ModalState } from '../game/types'
import { Icon } from './Icon'
import { Flag } from './Flag'
import { Badge, ProgressBar, StatTile } from './ui'

/* ── Shell ─────────────────────────────────────────────────────────────── */

export function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  wide,
  icon,
  eyebrow,
  tone,
  footer,
}: {
  title: string
  subtitle?: ReactNode
  onClose?: () => void
  children: ReactNode
  wide?: boolean
  icon?: string
  eyebrow?: ReactNode
  tone?: 'positive' | 'negative' | 'neutral'
  footer?: ReactNode
}) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onClose) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && onClose) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className={`modal ${wide ? 'modal-wide' : ''} ${tone ? `modal-tone-${tone}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-head">
          <div className="modal-title-wrap">
            {eyebrow && <div className="modal-eyebrow">{eyebrow}</div>}
            <div className="modal-title-row">
              {icon && (
                <span className="modal-icon">
                  <Icon name={icon} size={20} />
                </span>
              )}
              <h2 id={titleId}>{title}</h2>
            </div>
            {subtitle && <div className="modal-subtitle">{subtitle}</div>}
          </div>
          {onClose && (
            <button
              type="button"
              className="icon-btn modal-close"
              onClick={onClose}
              aria-label="Close"
            >
              <Icon name="X" size={18} />
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

/* ── Event ─────────────────────────────────────────────────────────────── */

function EventModal({ eventId }: { eventId: string }) {
  const game = useGame((state) => state.game)
  const resolveEvent = useGame((state) => state.resolveEvent)
  const event = EVENT_BY_ID[eventId]
  if (!game || !event) return null

  return (
    <ModalShell
      eyebrow={
        <>
          <Badge tone="accent" icon="Sparkles">
            Event
          </Badge>
          <span>Turn {game.turn}</span>
        </>
      }
      title={event.title}
      icon="Dice5"
      subtitle={event.body}
      footer={
        <span className="modal-footnote">
          Events do not cost actions. Every choice applies immediately.
        </span>
      }
    >
      <div className="event-choices">
        {event.choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            className={`event-choice choice-${choice.tone ?? 'default'}`}
            onClick={() => {
              playSfx('click')
              resolveEvent(choice.id)
            }}
          >
            <span className="event-choice-main">
              <span className="event-choice-label">{choice.label}</span>
              <span className="event-choice-description">{choice.description}</span>
            </span>
            {choice.check ? (
              <span className="event-choice-check">
                <Icon name="Dices" size={14} />d{choice.check.die} &gt; {choice.check.dc}
              </span>
            ) : (
              <Icon name="ChevronRight" size={18} className="choice-arrow" />
            )}
          </button>
        ))}
      </div>
    </ModalShell>
  )
}

/* ── Country dossier ───────────────────────────────────────────────────── */

function CountryModal({ countryId }: { countryId: string }) {
  const game = useGame((state) => state.game)
  const closeModal = useGame((state) => state.closeModal)
  const setPage = useGame((state) => state.setPage)
  const beginDiplomacy = useGame((state) => state.beginDiplomacy)
  const beginApproval = useGame((state) => state.beginApproval)
  const mergeCountry = useGame((state) => state.mergeCountry)
  const beginWar = useGame((state) => state.beginWar)
  if (!game) return null
  const country = game.countries.find((entry) => entry.id === countryId)
  if (!country) return null
  const player = game.countries.find((entry) => entry.isPlayer) ?? game.countries[0]!
  const flows = resourceFlows(country, game.deals, game.prices)
  const budget = computeBudget(country, game.deals, game.prices)
  const power = militaryPower(country)
  const composite = computeComposites(game.countries).get(country.id)
  const government = GOVERNMENT_BY_ID[country.government]
  const traits = [country.culture, country.biome, country.weather, ...country.traits]
    .map((id) => TRAIT_BY_ID[id])
    .filter(Boolean)
  const continent = game.continents.find((entry) => entry.id === country.continentId)
  const relations = country.relations
  const integrationReady = relations >= 100 && country.externalApproval >= 100
  const missionCost = Math.max(20, player.stats.gdp * 0.0005)
  const approvalCost = Math.max(35, player.stats.gdp * 0.0008)
  const mergeCost = Math.max(100, player.stats.gdp * 0.01)
  const warCost = Math.max(50, player.stats.gdp * 0.004)
  const canAct = game.actionsLeft > 0 && game.status === 'playing'
  const playerOwn = country.isPlayer
  const statusLabel =
    country.status === 'merged'
      ? `Integrated into ${game.countries.find((entry) => entry.id === country.mergedInto)?.name ?? player.name}`
      : country.status === 'destroyed'
        ? 'No longer exists'
        : null

  return (
    <ModalShell
      wide
      onClose={closeModal}
      eyebrow={
        <>
          <Badge tone={country.status === 'alive' ? 'accent' : 'muted'} icon="Globe">
            {statusLabel ?? (playerOwn ? 'Your country' : 'Foreign power')}
          </Badge>
          <span>{continent?.name}</span>
        </>
      }
      title={country.name}
      subtitle={
        <span className="country-subtitle">
          <Flag seed={country.flagSeed} code={country.code} size="sm" />
          <span>
            {country.capital} · {government?.name} · {country.code}
          </span>
        </span>
      }
      footer={
        <div className="country-footer-actions">
          {!playerOwn && country.status === 'alive' && (
            <span className="modal-footnote country-footer-note">
              Mission 1 action · Campaign 1 action · Merge 2 actions · War 1 action
            </span>
          )}
          {playerOwn ? (
            <>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  closeModal()
                  setPage('governance')
                }}
              >
                <Icon name="Landmark" size={16} /> Govern
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  closeModal()
                  setPage('industry')
                }}
              >
                <Icon name="Factory" size={16} /> Manage industry
              </button>
            </>
          ) : (
            <>
              {country.status === 'alive' && (
                <>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => beginDiplomacy(country.id)}
                    disabled={!canAct || relations >= 100}
                    title={`Cost: 1 action · ${formatMoney(missionCost)}`}
                  >
                    <Icon name="Handshake" size={16} /> Diplomatic mission
                  </button>
                  {relations >= 100 && country.externalApproval < 100 && (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => beginApproval(country.id)}
                      disabled={!canAct}
                      title={`Cost: 1 action · ${formatMoney(approvalCost)}`}
                    >
                      <Icon name="Users" size={16} /> Approval campaign
                    </button>
                  )}
                  {integrationReady && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => mergeCountry(country.id)}
                      disabled={game.actionsLeft < 2 || player.stats.treasury < mergeCost}
                      title={`Cost: 2 actions · ${formatMoney(mergeCost)}`}
                    >
                      <Icon name="Flag" size={16} /> Merge country
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => beginWar(country.id)}
                    disabled={!canAct || player.stats.treasury < warCost}
                    title={`Cost: 1 action · ${formatMoney(warCost)}`}
                  >
                    <Icon name="Swords" size={16} /> Declare war
                  </button>
                </>
              )}
            </>
          )}
        </div>
      }
    >
      {statusLabel && (
        <div className={`notice notice-${country.status === 'merged' ? 'positive' : 'negative'}`}>
          <Icon name={country.status === 'merged' ? 'Handshake' : 'Swords'} size={17} />
          <div>
            <strong>{statusLabel}</strong>
            <span>
              {country.status === 'merged'
                ? 'This territory is now part of the union. Its people and output flow into the integrating state.'
                : 'This state was destroyed in war. Its territory is no longer a sovereign actor.'}
            </span>
          </div>
        </div>
      )}

      <div className="stat-grid stat-grid-4">
        <StatTile
          label="Population"
          value={`${formatNumber(country.stats.population, 1)}M`}
          hint={`${formatNumber(soldiersPer100k(country), 0)} soldiers / 100k`}
          icon="Users"
          compact
        />
        <StatTile
          label="GDP"
          value={formatMoney(country.stats.gdp)}
          hint={`${formatUsd(gdpPerCapita(country))} per capita`}
          icon="ChartLine"
          compact
        />
        <StatTile
          label="Treasury"
          value={formatMoney(country.stats.treasury)}
          hint={`Debt ${formatMoney(country.stats.debt)} (${debtToGdp(country).toFixed(0)}% GDP)`}
          icon="Banknote"
          tone={country.stats.treasury > 0 ? 'positive' : 'negative'}
          compact
        />
        <StatTile
          label="Composite score"
          value={composite ? formatDecimal(composite.score, 1) : '—'}
          hint={`${formatDecimal(power, 0)} military power`}
          icon="Trophy"
          compact
        />
      </div>

      <div className="modal-columns">
        <div className="modal-column">
          <section className="modal-section">
            <div className="modal-section-head">
              <h3>National character</h3>
              <span>{traits.length} traits</span>
            </div>
            <div className="trait-grid">
              {traits.map((trait) => (
                <div key={trait!.id} className={`trait-row trait-${trait!.tone ?? 'mixed'}`}>
                  <span className="trait-kind">{trait!.kind}</span>
                  <div>
                    <strong>{trait!.name}</strong>
                    <p>{trait!.effectText}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="modal-section">
            <div className="modal-section-head">
              <h3>Society</h3>
              <span>Current indicators</span>
            </div>
            <div className="metric-list">
              <div className="metric-line">
                <span>Approval</span>
                <ProgressBar
                  value={country.stats.approval}
                  tone="positive"
                  thin
                  valueLabel={formatPercent(country.stats.approval)}
                />
              </div>
              <div className="metric-line">
                <span>Security</span>
                <ProgressBar
                  value={country.stats.security}
                  tone="accent"
                  thin
                  valueLabel={formatDecimal(country.stats.security, 0)}
                />
              </div>
              <div className="metric-line">
                <span>Corruption</span>
                <ProgressBar
                  value={country.stats.corruption}
                  tone="negative"
                  thin
                  valueLabel={formatPercent(country.stats.corruption)}
                />
              </div>
              <div className="metric-line">
                <span>HDI</span>
                <ProgressBar
                  value={country.stats.hdi * 100}
                  tone="positive"
                  thin
                  valueLabel={formatDecimal(country.stats.hdi, 3)}
                />
              </div>
              <div className="metric-line">
                <span>Gini</span>
                <ProgressBar
                  value={country.stats.gini}
                  tone="warning"
                  thin
                  valueLabel={formatDecimal(country.stats.gini, 1)}
                />
              </div>
              <div className="metric-line">
                <span>Violence / 100k</span>
                <ProgressBar
                  value={country.stats.violence}
                  max={40}
                  tone="negative"
                  thin
                  valueLabel={formatDecimal(country.stats.violence, 1)}
                />
              </div>
              <div className="metric-line">
                <span>Depression</span>
                <ProgressBar
                  value={country.stats.depression}
                  max={45}
                  tone="warning"
                  thin
                  valueLabel={formatPercent(country.stats.depression)}
                />
              </div>
            </div>
          </section>

          <section className="modal-section">
            <div className="modal-section-head">
              <h3>Resource balance</h3>
              <span>Per turn</span>
            </div>
            <div className="table-wrap compact-table">
              <table>
                <thead>
                  <tr>
                    <th>Resource</th>
                    <th className="num">Production</th>
                    <th className="num">Consumption</th>
                    <th className="num">Balance</th>
                    <th className="num">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {RESOURCE_IDS.map((id) => {
                    const flow = flows[id]
                    return (
                      <tr key={id}>
                        <td>
                          <span
                            className="resource-inline"
                            style={{
                              color: `var(${RESOURCES.find((resource) => resource.id === id)?.colorVar})`,
                            }}
                          >
                            <Icon
                              name={
                                RESOURCES.find((resource) => resource.id === id)?.icon ?? 'Circle'
                              }
                              size={14}
                            />
                            {RESOURCES.find((resource) => resource.id === id)?.name}
                          </span>
                        </td>
                        <td className="num">{formatQuantity(flow.production)}</td>
                        <td className="num">{formatQuantity(flow.consumption)}</td>
                        <td
                          className={`num ${flow.finalBalance >= 0 ? 'text-positive' : 'text-negative'}`}
                        >
                          {flow.finalBalance > 0 ? '+' : ''}
                          {formatQuantity(flow.finalBalance)}
                        </td>
                        <td className="num">{formatQuantity(flow.stock)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="modal-section">
            <div className="modal-section-head">
              <h3>Order of battle</h3>
              <span>{formatDecimal(power, 0)} power</span>
            </div>
            <div className="unit-mini-grid">
              {UNITS.map((unit) => (
                <div key={unit.id} className="unit-mini">
                  <span>
                    <Icon name={unit.icon} size={14} /> {unit.name}
                  </span>
                  <strong>{formatNumber(country.military[unit.id], 0)}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="modal-column">
          {!playerOwn && country.status === 'alive' && (
            <section className="modal-section relations-section">
              <div className="modal-section-head">
                <h3>Relations with {player.name}</h3>
                <span>{relationLabel(relations)}</span>
              </div>
              <div className="relation-showcase">
                <div className="relation-number">
                  <strong>{Math.round(relations)}</strong>
                  <span>/ 100</span>
                </div>
                <div className="relation-bars">
                  <ProgressBar
                    value={relations}
                    tone={relations >= 0 ? 'positive' : 'negative'}
                    thin
                  />
                  <ProgressBar
                    value={country.externalApproval}
                    tone="accent"
                    thin
                    label="External approval"
                    valueLabel={`${Math.round(country.externalApproval)}/100`}
                  />
                </div>
              </div>
              <p className="helper-text">
                {relations < 100
                  ? 'Reach 100 relations to unlock external approval, then campaign to 100 approval to merge this country.'
                  : country.externalApproval < 100
                    ? 'Full alignment achieved. Fund an external approval campaign to prepare a merger.'
                    : 'This country is ready to merge. Integration requires 2 actions.'}
              </p>
              <div className="action-cost-grid">
                <span>
                  <Icon name="Handshake" size={14} /> Mission {formatMoney(missionCost)}
                </span>
                <span>
                  <Icon name="Users" size={14} /> Campaign {formatMoney(approvalCost)}
                </span>
                <span>
                  <Icon name="Flag" size={14} /> Merge {formatMoney(mergeCost)} + 2 actions
                </span>
                <span>
                  <Icon name="Swords" size={14} /> War {formatMoney(warCost)} + 1 action
                </span>
              </div>
            </section>
          )}

          <section className="modal-section">
            <div className="modal-section-head">
              <h3>Government</h3>
              <span>{government?.name}</span>
            </div>
            <div className="government-summary">
              <span className="government-icon">
                <Icon name={government?.icon ?? 'Landmark'} size={24} />
              </span>
              <div>
                <p>{government?.description}</p>
                <div className="government-effects">
                  <Badge tone="positive" icon="TrendingUp">
                    {government?.buff}
                  </Badge>
                  <Badge tone="negative" icon="TrendingDown">
                    {government?.debuff}
                  </Badge>
                </div>
              </div>
            </div>
          </section>

          <section className="modal-section">
            <div className="modal-section-head">
              <h3>Cabinet</h3>
              <span>Avg. corruption {formatPercent(averageCorruption(country))}</span>
            </div>
            <div className="cabinet-list">
              {MINISTRIES.map((ministry) => {
                const entry = country.ministries[ministry.id]
                return (
                  <div key={ministry.id} className="cabinet-row">
                    <span className="cabinet-icon">
                      <Icon name={ministry.icon} size={15} />
                    </span>
                    <div className="cabinet-copy">
                      <strong>{entry.head.name}</strong>
                      <span>
                        {ministry.name.replace('Ministry of ', '')} · {entry.budget} budget
                      </span>
                    </div>
                    <div className="cabinet-tags">
                      <span className={entry.head.corruption > 55 ? 'text-negative' : 'text-muted'}>
                        Corr. {entry.head.corruption}
                      </span>
                      <span className={entry.head.loyalty < 35 ? 'text-negative' : 'text-muted'}>
                        Loyalty {entry.head.loyalty}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="modal-section">
            <div className="modal-section-head">
              <h3>Fiscal position</h3>
              <span>{budget.net >= 0 ? 'Surplus' : 'Deficit'}</span>
            </div>
            <div className="mini-ledger">
              <div>
                <span>Revenue</span>
                <strong>{formatMoney(budget.totalRevenue)}</strong>
              </div>
              <div>
                <span>Expenses</span>
                <strong>{formatMoney(budget.totalExpenses)}</strong>
              </div>
              <div>
                <span>Net per turn</span>
                <strong className={budget.net >= 0 ? 'text-positive' : 'text-negative'}>
                  {formatMoney(budget.net)}
                </strong>
              </div>
              <div>
                <span>Debt rate</span>
                <strong>{formatDecimal(country.stats.debtRate, 1)}%</strong>
              </div>
              <div>
                <span>Tax burden</span>
                <strong>{formatDecimal(budget.taxBurden, 0)}</strong>
              </div>
            </div>
            <div className="combined-modifier-note">
              <Icon name="Info" size={13} />
              {combinedModifiers(country).trade >= 0 ? 'Trade orientation: ' : 'Trade penalty: '}
              {formatPercent(combinedModifiers(country).trade * 100, 0)}
            </div>
          </section>
        </div>
      </div>
    </ModalShell>
  )
}

/* ── Checks ────────────────────────────────────────────────────────────── */

function CheckModal({ check }: { check: PendingCheck }) {
  const closeModal = useGame((state) => state.closeModal)
  const rollCheck = useGame((state) => state.rollCheck)
  const [rolling, setRolling] = useState(false)
  const playedRoll = useRef<number | null>(null)

  useEffect(() => {
    if (check.stage === 'rolled' && check.roll !== undefined && playedRoll.current !== check.roll) {
      playedRoll.current = check.roll
      playSfx(check.success ? 'success' : 'fail')
    }
  }, [check])

  const doRoll = () => {
    if (rolling) return
    setRolling(true)
    playSfx('roll')
    window.setTimeout(() => {
      setRolling(false)
      rollCheck()
    }, 700)
  }

  const dieLabel = `d${check.die}`
  const successLine =
    check.kind === 'war'
      ? `Victory chance ${check.winChance ?? 50}% on a d100`
      : check.operation === 'research'
        ? 'Single d10: 1 fail · 2–4 +5% bonus · 5–9 +10% bonus · 10 +20% & advancement'
        : check.kind === 'industry'
          ? 'd6: 1 fail · 2 small · 3 avg · 4–5 good · 6 advancement'
          : `${dieLabel} > ${check.dc}${check.modifier !== 0 ? ` + ${check.modifier}` : ''}`

  return (
    <ModalShell
      onClose={closeModal}
      eyebrow={
        <Badge tone="accent" icon="Dices">
          {check.kind === 'war' ? 'Military gamble' : 'Check'}
        </Badge>
      }
      title={check.title}
      icon={check.kind === 'war' ? 'Swords' : check.kind === 'diplomacy' ? 'Handshake' : 'Dices'}
      subtitle={check.description}
      footer={
        check.stage === 'ready' ? (
          <button type="button" className="btn btn-primary" onClick={doRoll} disabled={rolling}>
            <Icon name="Dices" size={17} />
            {rolling ? 'Rolling…' : `Roll ${dieLabel}`}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={closeModal}>
            Continue
            <Icon name="ArrowRight" size={16} />
          </button>
        )
      }
    >
      <div className="check-meta">
        <span className="check-meta-item">
          <Icon name="Dices" size={15} /> {successLine}
        </span>
        <span className="check-meta-item">
          <Icon name="ChevronRight" size={15} /> {check.actionCost} action
          {check.actionCost > 1 ? 's' : ''}
        </span>
        <span className="check-meta-item">
          <Icon name="Banknote" size={15} /> {formatMoney(check.costMoney)}
        </span>
      </div>

      <div className={`dice-stage ${rolling ? 'is-rolling' : ''}`}>
        <div className="die" aria-hidden="true">
          <span className="die-number">
            {rolling ? '··' : check.roll !== undefined ? check.roll : '?'}
          </span>
          <span className="die-caption">{dieLabel}</span>
        </div>
        {check.stage === 'rolled' ? (
          <div className={`check-result ${check.success ? 'is-success' : 'is-failure'}`}>
            <span className="check-result-icon">
              <Icon name={check.success ? 'Check' : 'X'} size={18} />
            </span>
            <div>
              <strong>
                {check.kind === 'war'
                  ? check.success
                    ? 'Victory'
                    : 'Defeat'
                  : check.operation === 'research'
                    ? check.roll === 10
                      ? 'Breakthrough advancement (+20%)'
                      : check.success
                        ? 'Research bonus'
                        : 'Failure'
                    : check.kind === 'industry'
                      ? check.roll === 6
                        ? 'Breakthrough advancement'
                        : check.roll === 4 || check.roll === 5
                          ? 'Good improvement'
                          : check.roll === 3
                            ? 'Average improvement'
                            : check.roll === 2
                              ? 'Small improvement'
                              : 'Failure'
                      : check.success
                        ? 'Success'
                        : 'Failure'}
              </strong>
              <span>
                {check.kind === 'war'
                  ? check.success
                    ? 'The campaign achieves its objectives.'
                    : 'The campaign fails to achieve its objectives.'
                  : `You rolled ${check.roll} on a ${dieLabel}.`}
              </span>
            </div>
          </div>
        ) : (
          <div className="check-waiting">
            <strong>Ready when you are.</strong>
            <span>The die only rolls once. The action and cost are spent on the roll.</span>
          </div>
        )}
      </div>

      {check.outcomeLines && check.outcomeLines.length > 0 && (
        <div className="check-outcomes">
          {check.outcomeLines.map((line, index) => (
            <p key={`${line}-${index}`}>
              <Icon name="ChevronRight" size={13} /> {line}
            </p>
          ))}
        </div>
      )}
    </ModalShell>
  )
}

/* ── Result ────────────────────────────────────────────────────────────── */

function ResultModal({
  modal,
  onClose,
}: {
  modal: Extract<NonNullable<ModalState>, { kind: 'result' }>
  onClose: () => void
}) {
  return (
    <ModalShell
      onClose={onClose}
      title={modal.title}
      subtitle={modal.subtitle}
      icon={modal.tone === 'positive' ? 'Sparkles' : modal.tone === 'negative' ? 'Info' : 'Info'}
      tone={modal.tone}
      footer={
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Continue <Icon name="ArrowRight" size={16} />
        </button>
      }
    >
      <div className={`result-panel result-${modal.tone}`}>
        <ul>
          {modal.lines.map((line, index) => (
            <li key={`${line}-${index}`}>{line}</li>
          ))}
        </ul>
      </div>
    </ModalShell>
  )
}

/* ── New game ──────────────────────────────────────────────────────────── */

function NewGameModal() {
  const closeModal = useGame((state) => state.closeModal)
  const abandonGame = useGame((state) => state.abandonGame)
  return (
    <ModalShell
      title="Start over?"
      subtitle="This will discard the current world. There is no undo, only a new draw."
      icon="RotateCcw"
      onClose={closeModal}
      footer={
        <>
          <button type="button" className="btn" onClick={closeModal}>
            Keep playing
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              playSfx('click')
              abandonGame()
            }}
          >
            Abandon world
          </button>
        </>
      }
    >
      <div className="new-game-panel">
        <p>The map, every treaty, every loan and every factory will be lost.</p>
        <p className="text-muted">A new world can be configured from the setup screen.</p>
      </div>
    </ModalShell>
  )
}

/* ── Host ──────────────────────────────────────────────────────────────── */

export function ModalHost() {
  const modal = useGame((state) => state.modal)
  const eventId = useGame((state) => state.game?.eventQueue[0] ?? null)
  const closeModal = useGame((state) => state.closeModal)

  if (modal) {
    if (modal.kind === 'country') return <CountryModal countryId={modal.countryId} />
    if (modal.kind === 'check') return <CheckModal check={modal.check} />
    if (modal.kind === 'result') return <ResultModal modal={modal} onClose={closeModal} />
    if (modal.kind === 'new-game') return <NewGameModal />
  }
  if (eventId) return <EventModal eventId={eventId} />
  return null
}

export function Toaster() {
  const toast = useGame((state) => state.toast)
  const clearToast = useGame((state) => state.clearToast)

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(clearToast, 4_000)
    return () => window.clearTimeout(timeout)
  }, [toast, clearToast])

  if (!toast) return null
  return (
    <div className={`toast toast-${toast.tone}`} role="status">
      <span className="toast-icon">
        <Icon
          name={toast.tone === 'positive' ? 'Check' : toast.tone === 'negative' ? 'Info' : 'Info'}
          size={16}
        />
      </span>
      <span className="toast-message">{toast.message}</span>
      <button type="button" className="toast-close" onClick={clearToast} aria-label="Dismiss">
        <Icon name="X" size={14} />
      </button>
    </div>
  )
}
