// Small shared UI primitives (Tailwind-styled).

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export const inputClass =
  'w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 focus:outline-2 focus:outline-amber-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100'

export function Button({
  variant = 'default',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'ghost' }) {
  const styles = {
    default:
      'border border-zinc-300 bg-white hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700',
    primary:
      'bg-amber-600 text-white hover:bg-amber-500 dark:bg-amber-500 dark:text-zinc-950 dark:hover:bg-amber-400',
    ghost: 'hover:bg-zinc-200 dark:hover:bg-zinc-800',
  }[variant]
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium focus-visible:outline-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
      {...rest}
    />
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
      {label}
      {children}
    </label>
  )
}

export function NumberInput({
  value,
  onValue,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number
  onValue: (n: number) => void
}) {
  return (
    <input
      type="number"
      className={inputClass}
      value={Number.isFinite(value) ? value : ''}
      onChange={(e) => onValue(e.target.valueAsNumber)}
      {...rest}
    />
  )
}

export function Panel({
  title,
  children,
  actions,
}: {
  title: string
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <section className="border-b border-zinc-200 px-3 py-3 dark:border-zinc-800" aria-label={title}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          {title}
        </h3>
        {actions}
      </div>
      {children}
    </section>
  )
}
