import { NextResponse } from 'next/server'
import { updatePrescriptionStatus } from '@/app/actions/prescriptions'
import { RxStatus } from '@prisma/client'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { rxNumber, newStatus } = body

    if (!rxNumber || !newStatus) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!Object.values(RxStatus).includes(newStatus as RxStatus)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const prescription = await updatePrescriptionStatus(rxNumber, newStatus as RxStatus)
    return NextResponse.json(prescription)
  } catch (error) {
    console.error('Failed to update status:', error)
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }
}
