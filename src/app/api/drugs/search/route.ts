import { NextResponse } from 'next/server'
import { searchDrugsForPOS } from '@/app/actions/drugs'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    
    if (query.length < 2) {
      return NextResponse.json([])
    }
    
    const drugs = await searchDrugsForPOS(query)
    return NextResponse.json(drugs)
  } catch (error) {
    console.error('Search failed:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
