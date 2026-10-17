import { Modal } from '../../app/Modal'
import { useEditorStore } from '../store/editorStore'
import { SHORTCUTS, type Shortcut } from './shortcuts'

const GROUPS: Shortcut['group'][] = ['Tools', 'Editing', 'Layers', 'View']

export function HelpDialog() {
  const open = useEditorStore((s) => s.helpOpen)
  const set = useEditorStore((s) => s.set)
  return (
    <Modal open={open} title="Keyboard shortcuts" onClose={() => set({ helpOpen: false })} wide>
      <div className="grid gap-6 md:grid-cols-2">
        {GROUPS.map((g) => (
          <div key={g}>
            <h3 className="mb-2 text-sm font-semibold text-amber-700 dark:text-amber-400">{g}</h3>
            <table className="w-full text-sm">
              <tbody>
                {SHORTCUTS.filter((s) => s.group === g).map((s) => (
                  <tr key={s.keys} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="py-1 pr-3 align-top whitespace-nowrap">
                      <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-800">
                        {s.keys}
                      </kbd>
                    </td>
                    <td className="py-1 text-zinc-700 dark:text-zinc-300">{s.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </Modal>
  )
}
