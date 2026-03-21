import AtlasExplorerSkeleton from '../components/world/AtlasExplorerSkeleton'

export default function Loading() {
  return (
    <div className="flex w-full max-w-[108rem] flex-col gap-6 px-3 lg:px-4">
      <AtlasExplorerSkeleton />
    </div>
  )
}
