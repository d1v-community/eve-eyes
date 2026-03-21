import AtlasExplorer from '../components/world/AtlasExplorer'
import OverviewMapLab from '../components/world/OverviewMapLab'
import { getAtlasViewData } from '../world/atlas'

export default async function AtlasPage() {
  const { systems, constellations, gateLinks, status } = await getAtlasViewData()
  const isPartial = status.messages.length > 0 || status.detailFailures > 0

  return (
    <div className="flex w-full max-w-[108rem] flex-col gap-6 px-3 lg:px-4">
      <section
        className={`rounded-[1.35rem] border px-4 py-3 text-sm shadow-sm ${
          isPartial
            ? 'border-amber-300/70 bg-amber-50/80 text-amber-950'
            : 'border-emerald-300/70 bg-emerald-50/80 text-emerald-950'
        }`}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-[10px] uppercase tracking-[0.3em]">
            Atlas dataset
          </span>
          <span>{systems.length} systems</span>
          <span>{constellations.length} constellations</span>
          <span>{gateLinks.length} gate links</span>
          <span>
            {isPartial
              ? `Partial data${status.detailFailures > 0 ? ` · ${status.detailFailures} detail fetches failed` : ''}`
              : 'All sampled sources loaded'}
          </span>
        </div>
        {status.messages.length > 0 ? (
          <div className="mt-2 text-xs leading-5 opacity-80">
            {status.messages.join(' · ')}
          </div>
        ) : null}
      </section>
      <AtlasExplorer systems={systems} constellations={constellations} gateLinks={gateLinks} />
      <OverviewMapLab systems={systems} constellations={constellations} gateLinks={gateLinks} />
    </div>
  )
}
