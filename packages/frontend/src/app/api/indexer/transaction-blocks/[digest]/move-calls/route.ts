import { getSqlClient } from '~~/server/db/client.mjs'
import { listMoveCallsByTxDigest } from '~~/server/indexer/listing-repository.mjs'

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
  request: Request,
  { params }: { params: Promise<{ digest: string }> }
) {
  const { digest } = await params
  const url = new URL(request.url)
  const includeActionSummary =
    url.searchParams.get('includeActionSummary') === '1' ||
    url.searchParams.get('includeActionSummary') === 'true'

  const sql = getSqlClient()
  const items = await listMoveCallsByTxDigest(sql, digest, {
    includeActionSummary,
  })

  return json({ items })
}
