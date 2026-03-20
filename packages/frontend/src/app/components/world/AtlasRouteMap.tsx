'use client'

type RouteNode = {
  id: number
  name: string
  constellationId: number
  regionId: number
}

type Props = {
  path: RouteNode[]
  selectedSystemId: number | null
  onSelect: (system: RouteNode) => void
}

export default function AtlasRouteMap({
  path,
  selectedSystemId,
  onSelect,
}: Props) {
  if (path.length === 0) {
    return null
  }

  const width = 760
  const height = 180
  const padding = 56
  const step =
    path.length === 1 ? 0 : (width - padding * 2) / Math.max(path.length - 1, 1)

  const points = path.map((system, index) => {
    const x = padding + step * index
    const direction = index % 2 === 0 ? -1 : 1
    const y = height / 2 + direction * 28

    return { ...system, x, y }
  })

  const polyline = points.map((point) => `${point.x},${point.y}`).join(' ')

  return (
    <div className="rounded-[1.75rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.82))] p-4 dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(2,6,23,0.86))]">
      <div className="mb-3 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
        Path map
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[180px] min-w-[640px] w-full"
          role="img"
          aria-label="Route map"
        >
          <defs>
            <linearGradient id="route-line" x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0ea5e9" />
            </linearGradient>
          </defs>
          <polyline
            fill="none"
            points={polyline}
            stroke="url(#route-line)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
          {points.map((point, index) => {
            const isSelected = selectedSystemId === point.id

            return (
              <g key={point.id}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isSelected ? 14 : 11}
                  fill={isSelected ? '#0f172a' : '#ffffff'}
                  stroke={isSelected ? '#38bdf8' : '#94a3b8'}
                  strokeWidth="3"
                  className="cursor-pointer transition"
                  onClick={() => onSelect(point)}
                />
                <text
                  x={point.x}
                  y={point.y - 20}
                  textAnchor="middle"
                  className="fill-slate-700 text-[10px] font-semibold dark:fill-slate-200"
                >
                  {index + 1}
                </text>
                <text
                  x={point.x}
                  y={point.y + 34}
                  textAnchor="middle"
                  className="fill-slate-700 text-[11px] font-medium dark:fill-slate-200"
                >
                  {point.name}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
