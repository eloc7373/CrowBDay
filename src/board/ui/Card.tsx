import { GripVertical } from 'lucide-react'
import type { ReactNode } from 'react'
import { ErrorBoundary } from '../../app/ErrorBoundary'

/** Board card: the header is the drag handle; the body scrolls. Crashes stay inside the card. */
export function Card({
  title,
  actions,
  children,
  testId,
}: {
  title: string
  actions?: ReactNode
  children: ReactNode
  testId?: string
}) {
  return (
    <section
      aria-label={title}
      data-testid={testId}
      className="flex h-full flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <header className="card-handle flex cursor-move items-center gap-1 border-b border-zinc-200 px-2 py-1.5 dark:border-zinc-800">
        <GripVertical size={14} className="text-zinc-400" aria-hidden />
        <h2 className="flex-1 truncate text-sm font-semibold">{title}</h2>
        {/* Buttons inside the handle must not start a drag. */}
        <div
          className="flex items-center gap-1"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <ErrorBoundary name={title}>{children}</ErrorBoundary>
      </div>
    </section>
  )
}
