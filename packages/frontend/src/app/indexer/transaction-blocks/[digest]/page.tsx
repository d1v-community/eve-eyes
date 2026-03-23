import TransactionBlockDetailClient from '~~/components/world/TransactionBlockDetailClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function TransactionBlockDetailPage({
  params,
}: {
  params: Promise<{ digest: string }>
}) {
  const { digest } = await params

  return <TransactionBlockDetailClient digest={digest} />
}
