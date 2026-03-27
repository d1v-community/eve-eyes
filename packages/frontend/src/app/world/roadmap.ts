export const productRoadmap = [
  {
    title: 'Atlas Navigator',
    status: 'Now',
    description:
      'Build a fast star map with constellation grouping, gate-link previews, and route-first exploration.',
  },
  {
    title: 'Fleet Scout',
    status: 'Now',
    description:
      'Turn ship and type data into a comparison surface for fitting research, logistics planning, and discovery.',
  },
  {
    title: 'Verified Intel',
    status: 'Next',
    description:
      'Package solar-system facts into POD-backed cards so players can share verifiable world data.',
  },
  {
    title: 'Personal Jump Log',
    status: 'Token',
    description:
      'Unlock timeline, heatmap, and travel replay when a World API bearer token is configured.',
  },
] as const

export const apiCoverageTodo = [
  'Health and config checks for first-load reliability and environment diagnostics.',
  'Solar systems and constellations combined into an atlas and route-discovery flow.',
  'Ships, types, and tribes surfaced as explorable intelligence panels.',
  'POD generation plus verification exposed as a trust layer, not just raw JSON.',
  'Authenticated jump history prepared behind a graceful empty state until token access is available.',
] as const

export const operationsNavigation = [
  { href: '/fleet', label: 'Fleet', description: 'Ships and fitting-oriented stats.' },
  { href: '/codex', label: 'Codex', description: 'Type metadata for logistics and discovery.' },
  { href: '/tribes', label: 'Tribes', description: 'Compact tribe intel and external links.' },
  { href: '/verify', label: 'Verify', description: 'POD-backed cards and signature checks.' },
  { href: '/jumps', label: 'Jumps', description: 'Personal travel history and heat.' },
  { href: '/todo', label: 'TODO', description: 'Roadmap and delivery checklist.' },
] as const

export const headerNavigation = [
  { href: '/', label: 'Overview' },
  { href: '/activity', label: 'Activity' },
  { href: '/atlas', label: 'Atlas' },
  { href: '/fleet', label: 'Operations' },
] as const
