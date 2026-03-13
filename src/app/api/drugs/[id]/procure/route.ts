import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-api'
import { canWrite, isAdmin } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'

// POST - Procure/Receive stock for a drug
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    // Check write permission for drugs (Admin or Pharmacist can procure)
    if (!canWrite(user, 'drug') && !isAdmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to procure drugs. Only Admins and Pharmacists can receive stock.' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    
    // Validate required fields
    const { quantity, supplier, lotNumber, expiryDate, costPerUnit } = body
    
    if (!quantity || quantity <= 0) {
      return NextResponse.json(
        { error: 'Invalid quantity: must be a positive number' },
        { status: 400 }
      )
    }

    if (!supplier || supplier.trim() === '') {
      return NextResponse.json(
        { error: 'Supplier name is required' },
        { status: 400 }
      )
    }

    // Find the drug
    const drug = await db.drug.findUnique({
      where: { id },
    })

    if (!drug) {
      return NextResponse.json(
        { error: 'Drug not found' },
        { status: 404 }
      )
    }

    if (!drug.isActive) {
      return NextResponse.json(
        { error: 'Cannot procure inactive drug' },
        { status: 400 }
      )
    }

    const previousStock = drug.stock
    const newStock = previousStock + quantity

    // Update drug stock and create inventory log in a transaction
    const result = await db.$transaction(async (tx) => {
      // Update drug stock
      const updatedDrug = await tx.drug.update({
        where: { id },
        data: {
          stock: newStock,
        },
      })

      // Create inventory log entry
      const inventoryLog = await tx.inventoryLog.create({
        data: {
          drugId: id,
          type: 'RECEIVE',
          quantity: quantity,
          previousStock: previousStock,
          newStock: newStock,
          reason: `Received from ${supplier}${lotNumber ? ` (Lot: ${lotNumber})` : ''}`,
          reference: lotNumber || undefined,
          userId: user.id,
        },
      })

      return { updatedDrug, inventoryLog }
    })

    revalidatePath('/inventory')
    
    return NextResponse.json({
      success: true,
      drug: result.updatedDrug,
      inventoryLog: result.inventoryLog,
      message: `Successfully received ${quantity} units of ${drug.name}. Stock updated from ${previousStock} to ${newStock}.`
    })
  } catch (error) {
    console.error('Error procuring drug:', error)
    return NextResponse.json(
      { error: 'Failed to procure drug: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  }
}
