import { NextResponse } from 'next/server'
import { getPrescriptions } from '@/app/actions/prescriptions'

// Helper to serialize prescription data (convert Decimal fields in drug)
function serializePrescription(prescription: any) {
  return {
    ...prescription,
    drug: prescription.drug ? {
      ...prescription.drug,
      price: Number(prescription.drug.price),
      cost: Number(prescription.drug.cost),
    } : prescription.drug,
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const prescriptions = await getPrescriptions(status as any)
    return NextResponse.json(prescriptions.map(serializePrescription))
  } catch (error) {
    console.error('Failed to fetch prescriptions:', error)
    return NextResponse.json({ error: 'Failed to fetch prescriptions' }, { status: 500 })
  }
}
