import { NextRequest, NextResponse } from 'next/server'
import { findRoute } from '~~/world/catalog'

export async function GET(request: NextRequest) {
  const originId = Number(request.nextUrl.searchParams.get('originId'))
  const destinationId = Number(request.nextUrl.searchParams.get('destinationId'))

  if (!Number.isFinite(originId) || !Number.isFinite(destinationId)) {
    return NextResponse.json(
      { error: 'originId and destinationId are required numbers' },
      { status: 400 }
    )
  }

  try {
    const route = await findRoute(originId, destinationId)

    return NextResponse.json(route)
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to find route',
      },
      { status: 500 }
    )
  }
}
