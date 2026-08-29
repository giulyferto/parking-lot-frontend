import type { ReactNode } from 'react'

/* Small presentational components shared across pages. Class-string constants
 * (btn, field) live in ./styles.ts so this file only exports components. */

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={`font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500 ${className}`}
    >
      {children}
    </p>
  )
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 block text-sm font-medium text-slate-700">{children}</label>
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03] ${className}`}
    >
      {children}
    </div>
  )
}

/** The stencilled parking-bay glyph reused for the brand mark and status chips. */
export function BayMark({
  className = 'h-8 w-8',
  tone = 'brand',
}: {
  className?: string
  tone?: 'brand' | 'light'
}) {
  const outline = tone === 'light' ? 'rgb(255 255 255 / 0.5)' : '#93c5fd'
  const fill = tone === 'light' ? '#fff' : '#2563eb'
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <rect
        x="3"
        y="3"
        width="42"
        height="42"
        rx="9"
        fill={tone === 'light' ? 'rgb(255 255 255 / 0.12)' : '#eff6ff'}
      />
      <rect
        x="6.5"
        y="6.5"
        width="35"
        height="35"
        rx="6"
        fill="none"
        stroke={outline}
        strokeWidth="2"
        strokeDasharray="5 4"
      />
      <path
        d="M17 35V13h9.2c4.4 0 7.3 2.7 7.3 7s-2.9 7-7.3 7H23v8h-6Zm6-13h2.6c1.4 0 2.3-.8 2.3-2s-.9-2-2.3-2H23v4Z"
        fill={fill}
      />
    </svg>
  )
}
