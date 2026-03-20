'use client'

type RouteHistoryItem = {
  origin: {
    id: number
    name: string
  }
  destination: {
    id: number
    name: string
  }
}

type Props = {
  items: RouteHistoryItem[]
  onSelect: (item: RouteHistoryItem) => void
}

export default function AtlasRecentRoutes({ items, onSelect }: Props) {
  if (items.length === 0) {
    return null
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="mb-3 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
        Recent routes
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={`${item.origin.id}-${item.destination.id}`}
            type="button"
            onClick={() => onSelect(item)}
            className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-2 text-sm text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-200"
          >
            {item.origin.name} to {item.destination.name}
          </button>
        ))}
      </div>
    </div>
  )
}
