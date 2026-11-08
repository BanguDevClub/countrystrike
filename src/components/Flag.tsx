const COLORS = [
  '#e06c75',
  '#61afef',
  '#98c379',
  '#e5c07b',
  '#c678dd',
  '#56b6c2',
  '#d19a66',
  '#9da5b4',
  '#f44747',
  '#4ec9b0',
  '#d6a2e8',
  '#84a7ff',
]

function hash(seed: number): number {
  let value = seed >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d)
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b)
  return (value ^ (value >>> 16)) >>> 0
}

function color(seed: number, shift: number): string {
  return COLORS[(seed >>> shift) % COLORS.length] ?? COLORS[0]!
}

interface FlagProps {
  seed: number
  code?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Flag({ seed, code, size = 'md', className }: FlagProps) {
  const hashed = hash(seed + 17)
  const pattern = hashed % 5
  const first = color(hashed, 3)
  const second = color(hashed, 9)
  const third = color(hashed, 15)
  const id = `flag-${seed}`
  const sizeClass = size === 'sm' ? 'flag-sm' : size === 'lg' ? 'flag-lg' : 'flag-md'

  return (
    <svg
      viewBox="0 0 48 32"
      className={`flag ${sizeClass} ${className ?? ''}`}
      role="img"
      aria-label={code ? `${code} flag` : 'National flag'}
    >
      <defs>
        <clipPath id={id}>
          <rect width="48" height="32" rx="4" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        {pattern === 0 && (
          <>
            <rect width="48" height="32" fill={first} />
            <rect y="10.66" width="48" height="10.66" fill={second} />
            <rect y="21.33" width="48" height="10.66" fill={third} />
          </>
        )}
        {pattern === 1 && (
          <>
            <rect width="48" height="32" fill={first} />
            <rect x="16" width="16" height="32" fill={second} />
            <rect x="32" width="16" height="32" fill={third} />
          </>
        )}
        {pattern === 2 && (
          <>
            <rect width="48" height="32" fill={first} />
            <circle cx="24" cy="16" r="9" fill={second} />
            <circle cx="24" cy="16" r="4" fill={third} />
          </>
        )}
        {pattern === 3 && (
          <>
            <rect width="48" height="32" fill={first} />
            <path d="M0 32 L48 0 L48 32 Z" fill={second} />
            <path d="M0 32 L24 16 L48 32 Z" fill={third} opacity="0.8" />
          </>
        )}
        {pattern === 4 && (
          <>
            <rect width="48" height="32" fill={first} />
            <rect width="48" height="9" fill={second} />
            <rect y="23" width="48" height="9" fill={third} />
            <polygon
              points="24,7 27,14 35,14 29,19 31,26 24,22 17,26 19,19 13,14 21,14"
              fill={second}
            />
          </>
        )}
        <rect width="48" height="32" fill="url(#shine)" opacity="0.14" />
      </g>
      <defs>
        <linearGradient id="shine" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.6" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}
