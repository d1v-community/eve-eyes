import MoveCallDetailClient from '~~/components/world/MoveCallDetailClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MoveCallDetailPage({
  params,
}: {
  params: Promise<{ txDigest: string; callIndex: string }>
}) {
  const { txDigest, callIndex } = await params

  return <MoveCallDetailClient txDigest={txDigest} callIndex={callIndex} />
}
