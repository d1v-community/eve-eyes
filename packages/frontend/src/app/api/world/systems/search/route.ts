import { NextRequest, NextResponse } from 'next/server'
import { searchSystems } from '~~/world/catalog'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') ?? ''

  try {
    const systems = await searchSystems(query)

    return NextResponse.json({ data: systems })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to search systems',
      },
      { status: 500 }
    )
  }
}
