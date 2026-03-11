import { NextResponse } from 'next/server'
import { getWeeklyStats } from '@/app/actions/dashboard'

export async function GET() {
  try {
    const stats = await getWeeklyStats()
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Failed to fetch weekly stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
