// Single source of truth for Map Creator keyboard shortcuts: the key handler
// dispatches from this table and the help dialog (?) renders it.

import {
  changeBrushSize,
  deleteSelected,
  duplicateSelected,
  fitToScreen,
  mirror,
  nudgeSelected,
  redo,
  rotateOrRectangle,
  selectTool,
  toggleGrid,
  toggleLayerVisibility,
  undo,
} from '../actions'
import { cancelOperation } from '../canvas/controller'
import { useEditorStore } from '../store/editorStore'

export interface Shortcut {
  keys: string
  description: string
  group: 'Tools' | 'Editing' | 'View' | 'Layers'
  /** Returns true if the event matches. */
  match: (e: KeyboardEvent) => boolean
  run: (e: KeyboardEvent) => void
}

const mod = (e: KeyboardEvent) => e.ctrlKey || e.metaKey
const plain = (key: string) => (e: KeyboardEvent) =>
  !mod(e) && !e.altKey && e.key.toLowerCase() === key
const ctrl =
  (key: string, shift = false) =>
  (e: KeyboardEvent) =>
    mod(e) && !e.altKey && e.shiftKey === shift && e.key.toLowerCase() === key

const tool = (key: string, id: Parameters<typeof selectTool>[0], name: string): Shortcut => ({
  keys: key.toUpperCase(),
  description: `${name} tool`,
  group: 'Tools',
  match: (e) => plain(key)(e) && !e.shiftKey,
  run: () => selectTool(id),
})

export const SHORTCUTS: Shortcut[] = [
  tool('b', 'brush', 'Brush'),
  tool('g', 'fill', 'Fill (bucket)'),
  tool('e', 'eraser', 'Eraser'),
  {
    keys: 'R',
    description:
      'Rectangle tool — or rotate 90° when the Stamp tool is active or props are selected (Shift+R: rotate the other way)',
    group: 'Tools',
    match: plain('r'),
    run: (e) => rotateOrRectangle(e.shiftKey),
  },
  tool('o', 'ellipse', 'Ellipse'),
  tool('s', 'stamp', 'Stamp'),
  tool('w', 'wall', 'Wall / door'),
  tool('v', 'select', 'Select & move'),
  tool('m', 'measure', 'Measure'),
  tool('h', 'pan', 'Pan'),
  tool('t', 'label', 'Label / room marker'),
  {
    keys: 'F',
    description: 'Mirror the stamp or selected props',
    group: 'Editing',
    match: plain('f'),
    run: () => mirror(),
  },
  {
    keys: '[',
    description: 'Decrease brush size',
    group: 'Editing',
    match: (e) => !mod(e) && e.key === '[',
    run: () => changeBrushSize(-1),
  },
  {
    keys: ']',
    description: 'Increase brush size',
    group: 'Editing',
    match: (e) => !mod(e) && e.key === ']',
    run: () => changeBrushSize(1),
  },
  { keys: 'Ctrl+Z', description: 'Undo', group: 'Editing', match: ctrl('z'), run: () => undo() },
  {
    keys: 'Ctrl+Shift+Z / Ctrl+Y',
    description: 'Redo',
    group: 'Editing',
    match: (e) => ctrl('z', true)(e) || ctrl('y')(e),
    run: () => redo(),
  },
  {
    keys: 'Ctrl+D',
    description: 'Duplicate selection',
    group: 'Editing',
    match: ctrl('d'),
    run: () => duplicateSelected(),
  },
  {
    keys: 'Delete',
    description: 'Delete selection',
    group: 'Editing',
    match: (e) => !mod(e) && (e.key === 'Delete' || e.key === 'Backspace'),
    run: () => deleteSelected(),
  },
  {
    keys: 'Arrow keys',
    description: 'Nudge selection by one cell',
    group: 'Editing',
    match: (e) =>
      !mod(e) && e.key.startsWith('Arrow') && useEditorStore.getState().selection.ids.length > 0,
    run: (e) => {
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
        e.key
      ]
      if (d) nudgeSelected(d[0], d[1])
    },
  },
  {
    keys: 'Escape',
    description: 'Cancel current operation / clear selection',
    group: 'Editing',
    match: (e) => e.key === 'Escape',
    run: () => cancelOperation(),
  },
  {
    keys: 'Shift (Brush)',
    description: 'Straight line from the last brush point',
    group: 'Editing',
    match: () => false,
    run: () => {},
  },
  {
    keys: 'Alt+click',
    description: 'Eyedropper: sample tile or prop under the cursor',
    group: 'Editing',
    match: () => false,
    run: () => {},
  },
  {
    keys: 'Shift+click (Select)',
    description: 'Add/remove from selection',
    group: 'Editing',
    match: () => false,
    run: () => {},
  },
  {
    keys: 'Right-drag (Wall)',
    description: 'Remove walls',
    group: 'Editing',
    match: () => false,
    run: () => {},
  },
  ...[1, 2, 3, 4, 5].map((n): Shortcut => ({
    keys: String(n),
    description: `Toggle ${['Terrain', 'Walls & Doors', 'Objects', 'Tokens', 'Notes'][n - 1]} layer visibility`,
    group: 'Layers',
    match: (e) => !mod(e) && !e.altKey && e.key === String(n),
    run: () => toggleLayerVisibility(n - 1),
  })),
  {
    keys: 'Ctrl+G',
    description: 'Toggle grid',
    group: 'View',
    match: ctrl('g'),
    run: () => toggleGrid(),
  },
  {
    keys: 'Space+drag',
    description: 'Pan (also middle mouse or two-finger trackpad)',
    group: 'View',
    match: () => false,
    run: () => {},
  },
  {
    keys: 'Mouse wheel',
    description: 'Zoom at cursor (pinch on trackpads)',
    group: 'View',
    match: () => false,
    run: () => {},
  },
  {
    keys: '0',
    description: 'Fit map to screen',
    group: 'View',
    match: (e) => !mod(e) && e.key === '0',
    run: () => fitToScreen(),
  },
  {
    keys: '?',
    description: 'Show this help',
    group: 'View',
    match: (e) => e.key === '?',
    run: () => useEditorStore.getState().set({ helpOpen: true }),
  },
]

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))

/** Global keydown handler for the Map Creator. */
export function handleKeyDown(e: KeyboardEvent) {
  if (isTyping(e.target) || document.querySelector('dialog[open]')) return
  if (e.key === ' ') {
    e.preventDefault()
    if (!e.repeat) useEditorStore.getState().set({ spaceHeld: true })
    return
  }
  // Stop Alt from focusing the browser menu so Alt+click works as the eyedropper.
  if (e.key === 'Alt') {
    e.preventDefault()
    return
  }
  const sc = SHORTCUTS.find((s) => s.match(e))
  if (!sc) return
  e.preventDefault()
  sc.run(e)
}

export function handleKeyUp(e: KeyboardEvent) {
  if (e.key === ' ') useEditorStore.getState().set({ spaceHeld: false })
}
