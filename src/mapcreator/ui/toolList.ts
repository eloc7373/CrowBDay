import {
  BrickWall,
  Circle,
  Eraser,
  Hand,
  MousePointer2,
  PaintBucket,
  Paintbrush,
  Radius,
  Ruler,
  Square,
  Stamp,
  Type,
  type LucideIcon,
} from 'lucide-react'
import type { ToolId } from '../store/editorStore'

export const TOOLS: { id: ToolId; name: string; key: string; icon: LucideIcon }[] = [
  { id: 'brush', name: 'Brush', key: 'B', icon: Paintbrush },
  { id: 'fill', name: 'Fill', key: 'G', icon: PaintBucket },
  { id: 'eraser', name: 'Eraser', key: 'E', icon: Eraser },
  { id: 'rect', name: 'Rectangle', key: 'R', icon: Square },
  { id: 'ellipse', name: 'Ellipse', key: 'O', icon: Circle },
  { id: 'stamp', name: 'Stamp', key: 'S', icon: Stamp },
  { id: 'wall', name: 'Wall / door', key: 'W', icon: BrickWall },
  { id: 'select', name: 'Select & move', key: 'V', icon: MousePointer2 },
  { id: 'measure', name: 'Measure', key: 'M', icon: Ruler },
  { id: 'label', name: 'Label / room marker', key: 'T', icon: Type },
  { id: 'template', name: 'Area template', key: 'A', icon: Radius },
  { id: 'pan', name: 'Pan', key: 'H', icon: Hand },
]
