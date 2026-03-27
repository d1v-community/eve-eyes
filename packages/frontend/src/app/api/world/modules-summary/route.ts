import {
  getWorldConfig,
  listConstellations,
  listMyJumps,
  listShips,
  listSolarSystems,
  listTribes,
  listTypes,
} from '~~/world/api'

export const runtime = 'nodejs'
export const revalidate = 60

type ModuleSummaryItem = {
  title: 'Atlas' | 'Verify' | 'Fleet' | 'Codex' | 'Tribes' | 'Jumps'
  href: string
  description: string
  metric: string
  supporting: string
  status: 'live' | 'attention' | 'locked'
}

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init)
}

export async function GET() {
  try {
    const [
      solarSystemsResult,
      constellationsResult,
      configResult,
      shipsResult,
      typesResult,
      tribesResult,
      jumpsResult,
    ] = await Promise.all([
      listSolarSystems(1),
      listConstellations(1),
      getWorldConfig(),
      listShips(1),
      listTypes(1),
      listTribes(6),
      listMyJumps(24),
    ])

    const podKey = configResult.data?.[0]?.podPublicSigningKey
    const jumpError = jumpsResult.error
    const jumpTotal = jumpsResult.data?.metadata.total ?? 0
    const visibleTribeCount = tribesResult.data?.data.length ?? 0

    const modules: ModuleSummaryItem[] = [
      {
        title: 'Atlas',
        href: '/atlas',
        description:
          'Search start and destination systems, then compute a gate route on the server.',
        metric: `${solarSystemsResult.data?.metadata.total ?? 0} systems`,
        supporting: constellationsResult.data?.metadata.total
          ? `${constellationsResult.data.metadata.total} constellations indexed for route planning.`
          : constellationsResult.error ?? 'Constellation index unavailable.',
        status:
          solarSystemsResult.error == null && constellationsResult.error == null
            ? 'live'
            : 'attention',
      },
      {
        title: 'Verify',
        href: '/verify',
        description:
          'Generate POD-backed cards and share them with a verification trail.',
        metric: podKey ? 'POD signing ready' : 'Verification unavailable',
        supporting: podKey
          ? `Signer key ${podKey.slice(0, 12)}... exposed for card verification.`
          : configResult.error ?? 'Missing POD signing configuration.',
        status: podKey ? 'live' : 'attention',
      },
      {
        title: 'Fleet',
        href: '/fleet',
        description:
          'Turn ship stats into a clean comparison surface for planning.',
        metric: `${shipsResult.data?.metadata.total ?? 0} hulls`,
        supporting:
          shipsResult.data?.data[0]?.name != null
            ? `Featured hull ${shipsResult.data.data[0].name} is available for detail inspection.`
            : shipsResult.error ?? 'Ship catalog unavailable.',
        status: shipsResult.error == null ? 'live' : 'attention',
      },
      {
        title: 'Codex',
        href: '/codex',
        description:
          'Browse item types with logistics-relevant metadata first.',
        metric: `${typesResult.data?.metadata.total ?? 0} types`,
        supporting:
          typesResult.data?.data[0] != null
            ? `${typesResult.data.data[0].categoryName} / ${typesResult.data.data[0].groupName} metadata is queryable.`
            : typesResult.error ?? 'Type catalog unavailable.',
        status: typesResult.error == null ? 'live' : 'attention',
      },
      {
        title: 'Tribes',
        href: '/tribes',
        description:
          'Keep a compact intel board for tribe tags, tax, and links.',
        metric: `${visibleTribeCount} tribes`,
        supporting:
          tribesResult.data?.data[0] != null
            ? `Sample tag ${tribesResult.data.data[0].nameShort} with tax rate ${Math.round(
                tribesResult.data.data[0].taxRate * 100
              )}%.`
            : tribesResult.error ?? 'Tribe intel unavailable.',
        status: tribesResult.error == null ? 'live' : 'attention',
      },
      {
        title: 'Jumps',
        href: '/jumps',
        description:
          'Gracefully unlock private travel history when the server token exists.',
        metric:
          jumpError === 'Missing WORLD_API_BEARER_TOKEN'
            ? 'Token required'
            : `${jumpTotal} jumps`,
        supporting:
          jumpError === 'Missing WORLD_API_BEARER_TOKEN'
            ? 'Set WORLD_API_BEARER_TOKEN to expose private travel history.'
            : jumpsResult.data?.data[0] != null
              ? `Latest route ${jumpsResult.data.data[0].origin.name} to ${jumpsResult.data.data[0].destination.name}.`
              : jumpError ?? 'No travel history available.',
        status:
          jumpError === 'Missing WORLD_API_BEARER_TOKEN'
            ? 'locked'
            : jumpError == null
              ? 'live'
              : 'attention',
      },
    ]

    return json({ modules })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to aggregate module data'

    return json({ error: message }, { status: 500 })
  }
}
