import AddressHistoryClient from '~~/components/world/AddressHistoryClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AddressHistoryPage({
  params,
}: {
  params: Promise<{ address: string }>
}) {
  const { address } = await params

  return <AddressHistoryClient address={address} />
}
