import { getSqlClient } from '~~/server/db/client.mjs'
import { getMoveCallByTxDigestAndCallIndex } from '~~/server/indexer/listing-repository.mjs'

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
  { params }: { params: Promise<{ txDigest: string; callIndex: string }> }
) {
  const { txDigest, callIndex } = await params
  const parsedCallIndex = Number.parseInt(callIndex, 10)

  if (Number.isNaN(parsedCallIndex)) {
    return json({ error: 'callIndex must be a non-negative integer' }, { status: 400 })
  }

  const sql = getSqlClient()
  const item = await getMoveCallByTxDigestAndCallIndex(sql, txDigest, parsedCallIndex)

  if (!item) {
    return json({ error: 'Move call not found' }, { status: 404 })
  }

  return json({ item })
}
