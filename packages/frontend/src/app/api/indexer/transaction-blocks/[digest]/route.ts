import { getSqlClient } from '~~/server/db/client.mjs'
import { getTransactionBlockByDigest } from '~~/server/indexer/listing-repository.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function json(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set('Cache-Control', 'no-store, max-age=0')

  return Response.json(data, {
    ...init,
    headers,
  })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ digest: string }> }
) {
  const { digest } = await params
  const sql = getSqlClient()
  const transaction = await getTransactionBlockByDigest(sql, digest)

  if (!transaction) {
    return json({ error: 'Transaction block not found' }, { status: 404 })
  }

  return json({ item: transaction })
}
