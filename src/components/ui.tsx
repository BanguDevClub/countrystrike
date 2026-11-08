import type { ReactNode } from 'react'
import { PAGES } from '../game/constants'
import type { PageId } from '../game/types'
import { Icon, type IconName } from './Icon'

export function PageHeader({ page, children }: { page: PageId; children?: ReactNode }) {
  const definition = PAGES.find((entry) => entry.id === page)
  return (
    <header className="page-header">
      <div className="page-header-copy">
        <div className="page-kicker">
          <span className="page-kicker-icon">
            <Icon name={definition?.icon ?? 'Globe'} size={15} />
          </span>
          <span>{definition?.label ?? 'Country Strike'}</span>
        </div>
        <h1>{definition?.title ?? 'Country Strike'}</h1>
        <p>{definition?.subtitle}</p>
      </div>
      {children && <div className="page-header-actions">{children}</div>}
    </header>
  )
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`card ${className ?? ''}`}>
      {(title || subtitle || action) && (
        <div className="card-head">
          <div>
            {title && <h2 className="card-title">{title}</h2>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {action && <div className="card-action">{action}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  compact = false,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: string
  tone?: 'default' | 'positive' | 'negative' | 'warning' | 'accent'
  compact?: boolean
}) {
  return (
    <div className={`stat-tile tone-${tone} ${compact ? 'stat-compact' : ''}`}>
      <div className="stat-tile-top">
        <span className="stat-label">{label}</span>
        {icon && (
          <span className="stat-icon">
            <Icon name={icon} size={16} />
          </span>
        )}
      </div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  )
}

export function Badge({
  children,
  tone = 'neutral',
  icon,
}: {
  children: ReactNode
  tone?: 'neutral' | 'positive' | 'negative' | 'warning' | 'accent' | 'muted'
  icon?: string
}) {
  return (
    <span className={`badge badge-${tone}`}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  )
}

export function ProgressBar({
  value,
  max = 100,
  tone = 'accent',
  label,
  valueLabel,
  thin = false,
}: {
  value: number
  max?: number
  tone?: 'accent' | 'positive' | 'negative' | 'warning' | 'muted'
  label?: ReactNode
  valueLabel?: ReactNode
  thin?: boolean
}) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className={`progress-wrap ${thin ? 'progress-thin' : ''}`}>
      {(label || valueLabel) && (
        <div className="progress-labels">
          <span>{label}</span>
          <span>{valueLabel}</span>
        </div>
      )}
      <div
        className={`progress-track progress-${tone}`}
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <span className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

export function EmptyState({
  icon = 'Sparkles',
  title,
  body,
}: {
  icon?: string
  title: string
  body: string
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={22} />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}) {
  return (
    <div className={`toggle-row ${disabled ? 'is-disabled' : ''}`}>
      <div className="toggle-copy">
        <span>{label}</span>
        {description && <small>{description}</small>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`switch ${checked ? 'is-on' : ''}`}
        onClick={() => onChange(!checked)}
        disabled={disabled}
      >
        <span className="switch-thumb" />
      </button>
    </div>
  )
}

export function MeterRow({
  label,
  value,
  max,
  formatted,
  tone = 'accent',
  icon,
}: {
  label: string
  value: number
  max: number
  formatted: string
  tone?: 'accent' | 'positive' | 'negative' | 'warning' | 'muted'
  icon?: IconName
}) {
  return (
    <div className="meter-row">
      <div className="meter-label">
        {icon && <Icon name={icon} size={14} />}
        <span>{label}</span>
        <strong>{formatted}</strong>
      </div>
      <ProgressBar value={value} max={max} tone={tone} thin />
    </div>
  )
}
