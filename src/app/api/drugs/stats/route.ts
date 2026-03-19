import { NextResponse } from 'next/server'
import { getInventoryStats } from '@/app/actions/drugs'

export async function GET() {
  try {
    const stats = await getInventoryStats()
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Failed to fetch stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
