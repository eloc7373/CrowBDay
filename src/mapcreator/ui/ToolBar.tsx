import { selectTool } from '../actions'
import { useEditorStore } from '../store/editorStore'
import { TOOLS } from './toolList'

export function ToolBar() {
  const tool = useEditorStore((s) => s.tool)
  return (
    <nav
      aria-label="Map tools"
      className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-zinc-200 bg-zinc-50 py-2 dark:border-zinc-800 dark:bg-zinc-900"
    >
      {TOOLS.map((t) => {
        const Icon = t.icon
        const active = tool === t.id
        return (
          <button
            key={t.id}
            type="button"
            data-tool={t.id}
            aria-label={`${t.name} (${t.key})`}
            aria-pressed={active}
            title={`${t.name} (${t.key})`}
            onClick={() => selectTool(t.id)}
            className={`relative flex h-9 w-9 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-amber-500 ${
              active
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
          >
            <Icon size={18} aria-hidden />
            <span
              className="absolute right-0.5 bottom-0 text-[9px] font-semibold opacity-70"
              aria-hidden
            >
              {t.key}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
