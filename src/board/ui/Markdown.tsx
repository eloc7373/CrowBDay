// Safe markdown rendering (react-markdown never renders raw HTML). Links of the
// form dmtk-room:<mapId>/<noteId> become buttons that jump to a map room marker.

import { MapPin } from 'lucide-react'
import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown'
import { useNavigate } from 'react-router-dom'
import remarkGfm from 'remark-gfm'
import { parseRoomHref } from './uiStore'

function RoomLink({ href, children }: { href: string; children: React.ReactNode }) {
  const navigate = useNavigate()
  const room = parseRoomHref(href)!
  return (
    <button
      type="button"
      onClick={() =>
        navigate(
          `/map?map=${encodeURIComponent(room.mapId)}&focus=${encodeURIComponent(room.noteId)}`,
        )
      }
      className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1 text-red-800 hover:underline dark:bg-red-950 dark:text-red-200"
      title="Show this room on the map"
    >
      <MapPin size={12} aria-hidden />
      {children}
    </button>
  )
}

const components: Components = {
  h1: (p) => <h3 className="mt-3 mb-1 text-base font-bold" {...p} />,
  h2: (p) => <h4 className="mt-3 mb-1 font-bold" {...p} />,
  h3: (p) => <h5 className="mt-2 mb-1 font-semibold" {...p} />,
  p: (p) => <p className="my-1.5" {...p} />,
  ul: (p) => <ul className="my-1.5 list-disc space-y-0.5 pl-5" {...p} />,
  ol: (p) => <ol className="my-1.5 list-decimal space-y-0.5 pl-5" {...p} />,
  table: (p) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs" {...p} />
    </div>
  ),
  th: (p) => (
    <th
      className="border border-zinc-300 bg-zinc-100 px-2 py-1 text-left dark:border-zinc-700 dark:bg-zinc-800"
      {...p}
    />
  ),
  td: (p) => <td className="border border-zinc-300 px-2 py-1 dark:border-zinc-700" {...p} />,
  code: (p) => (
    <code className="rounded bg-zinc-100 px-1 font-mono text-[0.9em] dark:bg-zinc-800" {...p} />
  ),
  blockquote: (p) => <blockquote className="my-2 border-l-4 border-amber-500 pl-3 italic" {...p} />,
  a: ({ href, children }) =>
    href && parseRoomHref(href) ? (
      <RoomLink href={href}>{children}</RoomLink>
    ) : (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="text-amber-700 underline dark:text-amber-400"
      >
        {children}
      </a>
    ),
}

const urlTransform = (url: string) =>
  url.startsWith('dmtk-room:') ? url : defaultUrlTransform(url)

export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
        urlTransform={urlTransform}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
