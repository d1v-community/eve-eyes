import {
  Activity,
  ArrowRightLeft,
  Binary,
  Boxes,
  Orbit,
  Radar,
  Route,
  ShieldCheck,
  ShipWheel,
  Sparkles,
} from 'lucide-react'
import {
  getConstellation,
  getMyJump,
  getShip,
  getSolarSystem,
  getSolarSystemPod,
  getTribe,
  getType,
  getWorldConfig,
  getWorldHealth,
  listConstellations,
  listMyJumps,
  listShips,
  listSolarSystems,
  listTribes,
  listTypes,
  verifyPod,
} from '~~/world/api'
import { apiCoverageTodo, productRoadmap } from '~~/world/roadmap'

const numberFormatter = new Intl.NumberFormat('en-US')

const StatCard = ({
  eyebrow,
  title,
  detail,
  icon,
}: {
  eyebrow: string
  title: string
  detail: string
  icon: React.ReactNode
}) => (
  <article className="rounded-3xl border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/75">
    <div className="mb-4 flex items-center justify-between gap-3">
      <span className="text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
        {eyebrow}
      </span>
      <div className="rounded-2xl border border-slate-200/70 p-2 text-slate-700 dark:border-slate-800 dark:text-slate-100">
        {icon}
      </div>
    </div>
    <div className="text-3xl font-semibold text-slate-950 dark:text-white">
      {title}
    </div>
    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
      {detail}
    </p>
  </article>
)

const Section = ({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description: string
  children: React.ReactNode
}) => (
  <section
    id={id}
    className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/75 md:p-7"
  >
    <div className="mb-5 flex flex-col gap-2">
      <span className="text-xs uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
        {title}
      </span>
      <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
        {description}
      </p>
    </div>
    {children}
  </section>
)

export default async function WorldDashboard() {
  const [
    healthResult,
    configResult,
    solarSystemsResult,
    constellationsResult,
    shipsResult,
    typesResult,
    tribesResult,
    jumpsResult,
  ] = await Promise.all([
    getWorldHealth(),
    getWorldConfig(),
    listSolarSystems(),
    listConstellations(),
    listShips(),
    listTypes(),
    listTribes(),
    listMyJumps(),
  ])

  const firstSolarSystem = solarSystemsResult.data?.data[0] ?? null
  const firstConstellation = constellationsResult.data?.data[0] ?? null
  const firstShip = shipsResult.data?.data[0] ?? null
  const firstType = typesResult.data?.data[0] ?? null
  const firstTribe = tribesResult.data?.data[0] ?? null
  const firstJump = jumpsResult.data?.data[0] ?? null

  const [
    solarSystemDetailResult,
    constellationDetailResult,
    shipDetailResult,
    typeDetailResult,
    tribeDetailResult,
    solarSystemPodResult,
    jumpDetailResult,
  ] = await Promise.all([
    firstSolarSystem ? getSolarSystem(firstSolarSystem.id) : Promise.resolve(null),
    firstConstellation
      ? getConstellation(firstConstellation.id)
      : Promise.resolve(null),
    firstShip ? getShip(firstShip.id) : Promise.resolve(null),
    firstType ? getType(firstType.id) : Promise.resolve(null),
    firstTribe ? getTribe(firstTribe.id) : Promise.resolve(null),
    firstSolarSystem ? getSolarSystemPod(firstSolarSystem.id) : Promise.resolve(null),
    firstJump ? getMyJump(firstJump.id) : Promise.resolve(null),
  ])

  const podVerificationResult =
    solarSystemPodResult?.data != null
      ? await verifyPod(solarSystemPodResult.data)
      : null

  const healthText =
    healthResult.error == null ? 'World API reachable' : healthResult.error
  const configSigningKey =
    configResult.data?.[0]?.podPublicSigningKey?.slice(0, 12) ?? 'Unavailable'
  const jumpsStatus =
    jumpsResult.error == null
      ? `${jumpsResult.data?.data.length ?? 0} recent jumps loaded`
      : jumpsResult.error === 'Missing WORLD_API_BEARER_TOKEN'
        ? 'Configure WORLD_API_BEARER_TOKEN to unlock private character history'
        : jumpsResult.error

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-3">
      <section
        id="overview"
        className="grid w-full gap-4 rounded-[2rem] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(77,162,255,0.18),_transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.9))] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.1)] backdrop-blur dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.2),_transparent_32%),linear-gradient(180deg,rgba(2,6,23,0.88),rgba(15,23,42,0.82))] md:grid-cols-[1.2fr_0.8fr] md:p-8"
      >
        <div className="flex flex-col gap-5">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/80 px-3 py-1 text-xs uppercase tracking-[0.3em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/50 dark:text-sky-200">
            <Sparkles className="h-3.5 w-3.5" />
            World API Product Surface
          </div>
          <div className="space-y-3">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 dark:text-white md:text-5xl">
              Turn the World API into an atlas, codex, and verified player intel
              layer.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
              The header now routes users to real product surfaces instead of
              empty chrome. The homepage uses the public universe, ship, type,
              tribe, verification, and private jump endpoints with graceful
              fallbacks.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {productRoadmap.map((item) => (
              <article
                key={item.title}
                className="rounded-3xl border border-slate-200/70 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/50"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h2 className="text-base font-medium text-slate-900 dark:text-slate-100">
                    {item.title}
                  </h2>
                  <span className="rounded-full border border-slate-200/80 px-2.5 py-1 text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:border-slate-700 dark:text-slate-300">
                    {item.status}
                  </span>
                </div>
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <StatCard
            eyebrow="Health"
            title={healthResult.error == null ? 'Healthy' : 'Attention'}
            detail={healthText}
            icon={<Activity className="h-5 w-5" />}
          />
          <StatCard
            eyebrow="Universe"
            title={
              solarSystemsResult.data?.metadata.total != null
                ? `${numberFormatter.format(solarSystemsResult.data.metadata.total)} systems`
                : 'No systems'
            }
            detail={
              constellationsResult.data?.metadata.total != null
                ? `${numberFormatter.format(constellationsResult.data.metadata.total)} constellations indexed for atlas navigation`
                : constellationsResult.error ?? 'Constellation data unavailable'
            }
            icon={<Orbit className="h-5 w-5" />}
          />
          <StatCard
            eyebrow="Catalog"
            title={
              shipsResult.data?.metadata.total != null &&
              typesResult.data?.metadata.total != null
                ? `${shipsResult.data.metadata.total} ships / ${typesResult.data.metadata.total} types`
                : 'Catalog unavailable'
            }
            detail="Ship classes, type metadata, and side panels can load independently without blocking the rest of the dashboard."
            icon={<Boxes className="h-5 w-5" />}
          />
          <StatCard
            eyebrow="Trust Layer"
            title={configSigningKey}
            detail="POD signing key is surfaced early so product diagnostics and verified-data flows are visible on first load."
            icon={<ShieldCheck className="h-5 w-5" />}
          />
        </div>
      </section>

      <Section
        id="atlas"
        title="Atlas"
        description="Solar systems and constellations are fetched in parallel, then a detail query expands the first system into gate links for route discovery."
      >
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-3xl border border-slate-200/70 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="mb-4 flex items-center gap-3">
              <Route className="h-5 w-5 text-sky-600 dark:text-sky-300" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                Route-ready system preview
              </h3>
            </div>
            {solarSystemDetailResult?.data ? (
              <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
                <div>
                  <div className="text-2xl font-semibold text-slate-950 dark:text-white">
                    {solarSystemDetailResult.data.name}
                  </div>
                  <div className="mt-1">
                    System #{solarSystemDetailResult.data.id} in constellation{' '}
                    {solarSystemDetailResult.data.constellationId}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-950/50">
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                      Gate Links
                    </div>
                    <div className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
                      {solarSystemDetailResult.data.gateLinks.length}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-950/50">
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                      Region
                    </div>
                    <div className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
                      {solarSystemDetailResult.data.regionId}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-950/50">
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                      Coordinates
                    </div>
                    <div className="mt-2 text-sm font-medium text-slate-950 dark:text-white">
                      {Math.round(solarSystemDetailResult.data.location.x / 1e12)}
                      k / {Math.round(solarSystemDetailResult.data.location.y / 1e12)}
                      k / {Math.round(solarSystemDetailResult.data.location.z / 1e12)}
                      k
                    </div>
                  </div>
                </div>
                <div className="grid gap-3">
                  {solarSystemDetailResult.data.gateLinks.length > 0 ? (
                    solarSystemDetailResult.data.gateLinks.map((gate) => (
                      <div
                        key={gate.id}
                        className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50"
                      >
                        <div>
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {gate.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Destination constellation {gate.destination.constellationId}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                          {gate.destination.name}
                          <ArrowRightLeft className="h-4 w-4" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm dark:border-slate-700">
                      This sample system currently has no outbound gate links.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {solarSystemDetailResult?.error ?? solarSystemsResult.error}
              </p>
            )}
          </article>

          <article className="rounded-3xl border border-slate-200/70 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="mb-4 flex items-center gap-3">
              <Radar className="h-5 w-5 text-sky-600 dark:text-sky-300" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                Constellation sample
              </h3>
            </div>
            {constellationDetailResult?.data ? (
              <div className="space-y-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
                <div className="text-2xl font-semibold text-slate-950 dark:text-white">
                  {constellationDetailResult.data.name}
                </div>
                <div>
                  Region {constellationDetailResult.data.regionId} ·{' '}
                  {constellationDetailResult.data.solarSystems?.length ?? 0} listed
                  systems in detail payload
                </div>
                <div className="grid gap-2">
                  {(constellationDetailResult.data.solarSystems ?? [])
                    .slice(0, 3)
                    .map((system) => (
                      <div
                        key={system.id}
                        className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50"
                      >
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {system.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          #{system.id}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {constellationDetailResult?.error ?? constellationsResult.error}
              </p>
            )}
          </article>
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          id="fleet"
          title="Fleet"
          description="Ships are rendered as a comparison surface, using detail stats that matter for fit planning and travel decisions."
        >
          {shipDetailResult?.data ? (
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-2xl font-semibold text-slate-950 dark:text-white">
                    {shipDetailResult.data.name}
                  </div>
                  <div>{shipDetailResult.data.className}</div>
                </div>
                <ShipWheel className="h-8 w-8 text-sky-600 dark:text-sky-300" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                  Speed {shipDetailResult.data.physics.maximumVelocity}
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                  Fuel {shipDetailResult.data.fuelCapacity}
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                  Slots {shipDetailResult.data.slots.high}/
                  {shipDetailResult.data.slots.medium}/
                  {shipDetailResult.data.slots.low}
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                  Mass {numberFormatter.format(shipDetailResult.data.physics.mass)}
                </div>
              </div>
              <p>{shipDetailResult.data.description}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {shipDetailResult?.error ?? shipsResult.error}
            </p>
          )}
        </Section>

        <Section
          id="codex"
          title="Codex"
          description="Types provide the searchable item layer. The UI keeps the payload compact and highlights logistics-relevant fields first."
        >
          {typeDetailResult?.data ? (
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-2xl font-semibold text-slate-950 dark:text-white">
                    {typeDetailResult.data.name}
                  </div>
                  <div>
                    {typeDetailResult.data.categoryName} /{' '}
                    {typeDetailResult.data.groupName}
                  </div>
                </div>
                <Binary className="h-8 w-8 text-sky-600 dark:text-sky-300" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                  Volume {typeDetailResult.data.volume}
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                  Mass {typeDetailResult.data.mass}
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                  Radius {typeDetailResult.data.radius}
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                  Portion {typeDetailResult.data.portionSize}
                </div>
              </div>
              <div className="grid gap-2">
                {typesResult.data?.data.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50"
                  >
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {item.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {item.categoryName} / {item.groupName}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {typeDetailResult?.error ?? typesResult.error}
            </p>
          )}
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Section
          id="tribes"
          title="Tribes"
          description="Tribe metadata is lightweight, so it is ideal for a fast intel strip that can be expanded later with community overlays."
        >
          {tribesResult.data?.data.length ? (
            <div className="space-y-3">
              {tribesResult.data.data.map((tribe) => (
                <div
                  key={tribe.id}
                  className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {tribe.name}
                      </div>
                      <div className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                        {tribe.nameShort}
                      </div>
                    </div>
                    <div className="rounded-full border border-slate-200/80 px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                      Tax {Math.round(tribe.taxRate * 100)}%
                    </div>
                  </div>
                  {tribe.tribeUrl ? (
                    <a
                      className="mt-3 block truncate text-sm text-sky-700 underline-offset-4 hover:underline dark:text-sky-300"
                      href={tribe.tribeUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {tribe.tribeUrl}
                    </a>
                  ) : null}
                </div>
              ))}
              {tribeDetailResult?.data ? (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  Highlighted profile: {tribeDetailResult.data.name} with short tag{' '}
                  {tribeDetailResult.data.nameShort}.
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {tribeDetailResult?.error ?? tribesResult.error}
            </p>
          )}
        </Section>

        <Section
          id="verify"
          title="Verify"
          description="The product should make POD verification visible and understandable. Here the first solar system is fetched as POD and immediately validated."
        >
          <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
            <div className="rounded-3xl border border-slate-200/70 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="mb-2 flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                <div className="text-lg font-medium text-slate-900 dark:text-slate-100">
                  POD verification result
                </div>
              </div>
              <div className="text-3xl font-semibold text-slate-950 dark:text-white">
                {podVerificationResult?.data?.isValid ? 'Valid' : 'Pending'}
              </div>
              <p className="mt-2">
                {podVerificationResult?.error ??
                  podVerificationResult?.data?.error ??
                  'The response can be independently verified against the published signing key.'}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  POD Signer
                </div>
                <div className="mt-2 break-all font-medium text-slate-900 dark:text-slate-100">
                  {solarSystemPodResult?.data?.signerPublicKey ?? 'Unavailable'}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  Signature
                </div>
                <div className="mt-2 break-all font-medium text-slate-900 dark:text-slate-100">
                  {solarSystemPodResult?.data?.signature?.slice(0, 48) ?? 'Unavailable'}
                  {solarSystemPodResult?.data?.signature ? '...' : ''}
                </div>
              </div>
            </div>
          </div>
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Section
          id="jumps"
          title="Jumps"
          description="Authenticated history should never block the rest of the product. If token access is missing, the surface remains useful and explicit."
        >
          <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
            <div className="rounded-3xl border border-slate-200/70 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="mb-2 flex items-center gap-3">
                <ArrowRightLeft className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                <div className="text-lg font-medium text-slate-900 dark:text-slate-100">
                  Personal route signal
                </div>
              </div>
              <p>{jumpsStatus}</p>
            </div>
            {jumpDetailResult?.data ? (
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="text-base font-medium text-slate-900 dark:text-slate-100">
                  {jumpDetailResult.data.origin.name} to{' '}
                  {jumpDetailResult.data.destination.name}
                </div>
                <div className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  {jumpDetailResult.data.time}
                </div>
                <div className="mt-3">
                  Ship {jumpDetailResult.data.ship?.name ?? 'Unknown'} ·{' '}
                  {jumpDetailResult.data.ship?.className ?? 'Unknown class'}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-3 dark:border-slate-700">
                Add `WORLD_API_BEARER_TOKEN` on the server to turn this section
                into a jump timeline, replay, and travel heatmap surface.
              </div>
            )}
          </div>
        </Section>

        <Section
          id="todo"
          title="TODO"
          description="Product planning is visible in the interface so the next iteration remains grounded in user value, not just endpoint coverage."
        >
          <div className="space-y-3">
            {apiCoverageTodo.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 text-sm leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200"
              >
                {item}
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  )
}
