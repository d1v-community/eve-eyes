import CharacterUserDetailClient from '~~/components/world/CharacterUserDetailClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CharacterUserDetailPage({
  searchParams,
}: {
  searchParams: Promise<{
    walletAddress?: string
    username?: string
    userId?: string
    tenant?: string
  }>
}) {
  const { walletAddress, username, userId, tenant } = await searchParams

  return (
    <CharacterUserDetailClient
      walletAddress={walletAddress ?? null}
      username={username ?? null}
      userId={userId ?? null}
      tenant={tenant ?? null}
    />
  )
}
