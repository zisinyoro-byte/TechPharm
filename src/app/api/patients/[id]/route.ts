import { NextResponse } from 'next/server'
import { getPatient } from '@/app/actions/patients'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const patient = await getPatient(id)
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }
    return NextResponse.json(patient)
  } catch (error) {
    console.error('Failed to fetch patient:', error)
    return NextResponse.json({ error: 'Failed to fetch patient' }, { status: 500 })
  }
}
