import { NextResponse } from 'next/server'
import { getPrescriptions } from '@/app/actions/prescriptions'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const prescriptions = await getPrescriptions(status as any)
    return NextResponse.json(prescriptions)
  } catch (error) {
    console.error('Failed to fetch prescriptions:', error)
    return NextResponse.json({ error: 'Failed to fetch prescriptions' }, { status: 500 })
  }
}
