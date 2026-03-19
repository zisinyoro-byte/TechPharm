import { NextResponse } from 'next/server'
import { getTopDrugs } from '@/app/actions/dashboard'

export async function GET() {
  try {
    const drugs = await getTopDrugs(10)
    return NextResponse.json(drugs)
  } catch (error) {
    console.error('Failed to fetch top drugs:', error)
    return NextResponse.json({ error: 'Failed to fetch top drugs' }, { status: 500 })
  }
}
