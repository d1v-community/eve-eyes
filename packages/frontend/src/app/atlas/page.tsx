import AtlasExplorer from '../components/world/AtlasExplorer'
import { getSolarSystem, listConstellations, listSolarSystems } from '../world/api'

export default async function AtlasPage() {
  const [solarSystemsResult, constellationsResult] = await Promise.all([
    listSolarSystems(72),
    listConstellations(18),
  ])

  const sampleSystems = solarSystemsResult.data?.data ?? []
  const sampleConstellations = constellationsResult.data?.data ?? []
  const detailResults = await Promise.all(
    sampleSystems.slice(0, 20).map((system) => getSolarSystem(system.id))
  )

  const gateLinks = detailResults.flatMap((result, index) => {
    const sourceSystem = sampleSystems[index]

    if (result.data == null || sourceSystem == null) return []

    return result.data.gateLinks.map((gate) => ({
      fromId: sourceSystem.id,
      toId: gate.destination.id,
      toConstellationId: gate.destination.constellationId,
    }))
  })

  const systemsForMap = new Map(sampleSystems.map((system) => [system.id, system]))

  for (const result of detailResults) {
    if (result.data == null) continue

    systemsForMap.set(result.data.id, result.data)

    for (const gate of result.data.gateLinks) {
      systemsForMap.set(gate.destination.id, gate.destination)
    }
  }

  const constellationsForMap = new Map(
    sampleConstellations.map((constellation) => [constellation.id, constellation])
  )

  for (const system of systemsForMap.values()) {
    if (constellationsForMap.has(system.constellationId)) continue

    constellationsForMap.set(system.constellationId, {
      id: system.constellationId,
      name: `Constellation ${system.constellationId}`,
      regionId: system.regionId,
      location: system.location,
    })
  }

  return (
    <div className="flex w-full max-w-[96rem] flex-col gap-6 px-3">
      <AtlasExplorer
        systems={[...systemsForMap.values()]}
        constellations={[...constellationsForMap.values()]}
        gateLinks={gateLinks}
      />
    </div>
  )
}
