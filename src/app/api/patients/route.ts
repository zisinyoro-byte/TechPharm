import { NextResponse } from 'next/server'
import { getPatients, createPatient } from '@/app/actions/patients'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || undefined
    const patients = await getPatients(search)
    return NextResponse.json(patients)
  } catch (error) {
    console.error('Failed to fetch patients:', error)
    return NextResponse.json({ error: 'Failed to fetch patients' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const patient = await createPatient(formData)
    return NextResponse.json(patient)
  } catch (error) {
    console.error('Failed to create patient:', error)
    return NextResponse.json({ error: 'Failed to create patient' }, { status: 500 })
  }
}
