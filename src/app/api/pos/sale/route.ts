import { NextResponse } from 'next/server'
import { createSale } from '@/app/actions/pos'
import { getCurrentUser } from '@/app/actions/auth'

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    const sale = await createSale({
      patientId: body.patientId,
      items: body.items,
      paymentMethod: body.paymentMethod,
      amountPaid: body.amountPaid,
      notes: body.notes,
      cashierId: user.id,
    })
    
    return NextResponse.json(sale)
  } catch (error: any) {
    console.error('Sale failed:', error)
    return NextResponse.json({ error: error.message || 'Sale failed' }, { status: 500 })
  }
}
