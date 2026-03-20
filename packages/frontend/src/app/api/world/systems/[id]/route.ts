import { NextRequest, NextResponse } from 'next/server'
import { getSolarSystem } from '~~/world/api'

type Context = {
  params: Promise<{
    id: string
  }>
}

export async function GET(_request: NextRequest, context: Context) {
  const params = await context.params
  const id = Number(params.id)

  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid system id' }, { status: 400 })
  }

  const result = await getSolarSystem(id)

  if (result.data == null) {
    return NextResponse.json(
      { error: result.error ?? 'Failed to load solar system' },
      { status: 500 }
    )
  }

  return NextResponse.json(result.data)
}
