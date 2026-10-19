import { Modal } from '../../app/Modal'
import { useRulesStore } from '../rules/store'
import { Markdown } from './Markdown'
import { useBoardUi } from './uiStore'

const KIND_LABEL = { rule: 'Rule', spell: 'Spell', condition: 'Condition' } as const

export function EntryViewer() {
  const id = useBoardUi((s) => s.viewerId)
  const close = useBoardUi((s) => s.closeEntry)
  const open = useBoardUi((s) => s.openEntry)
  const doc = useRulesStore((s) => (id ? s.docs.find((d) => d.id === id) : undefined))
  const docs = useRulesStore((s) => s.docs)

  return (
    <Modal open={!!id} title={doc?.title ?? 'Entry not found'} onClose={close} wide>
      {doc ? (
        <article aria-label={doc.title} data-testid="entry-viewer">
          <p className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded bg-amber-500 px-1.5 py-0.5 font-semibold text-zinc-950">
              {KIND_LABEL[doc.kind]}
            </span>
            <span className="text-zinc-500 capitalize">{doc.category}</span>
            {doc.tags
              .filter((t) => t !== 'condition' && t !== 'spell')
              .map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-zinc-300 px-1.5 dark:border-zinc-600"
                >
                  #{t}
                </span>
              ))}
          </p>
          <p className="mb-2 font-medium">{doc.summary}</p>
          <Markdown>{doc.body}</Markdown>
          {doc.related.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1 text-sm">
              <span className="text-zinc-500">Related:</span>
              {doc.related.map((r) => {
                const rel = docs.find((d) => d.id === r)
                return rel ? (
                  <button
                    key={r}
                    type="button"
                    className="text-amber-700 underline dark:text-amber-400"
                    onClick={() => open(r)}
                  >
                    {rel.title}
                  </button>
                ) : null
              })}
            </div>
          )}
          <footer className="mt-4 border-t border-zinc-200 pt-2 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            Source: {doc.source.book}
            {doc.source.page !== undefined ? `, p. ${doc.source.page}` : ''} · {doc.source.license}
          </footer>
        </article>
      ) : (
        <p className="text-sm">
          This entry is no longer available (its rules pack may have been removed).
        </p>
      )}
    </Modal>
  )
}
