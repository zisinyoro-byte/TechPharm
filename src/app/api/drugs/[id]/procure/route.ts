import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-api'
import { canWrite, isAdmin } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'
import { receiveInventoryLot } from '@/lib/fifo'

// POST - Procure/Receive stock for a drug (creates inventory lot for FIFO)
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
    const { quantity, supplier, lotNumber, expiryDate, costPerUnit, reference } = body
    
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
    const unitCost = costPerUnit || Number(drug.cost) // Use provided cost or drug's current cost

    // Create inventory lot and update stock in a transaction
    const result = await db.$transaction(async (tx) => {
      // Create inventory lot for FIFO tracking
      const lot = await receiveInventoryLot({
        drugId: id,
        lotNumber: lotNumber || undefined,
        quantity: quantity,
        unitCost: unitCost,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        receivedById: user.id,
        reference: reference || supplier,
        notes: `Received from ${supplier}`,
        tx,
      })

      // Create inventory log entry
      const inventoryLog = await tx.inventoryLog.create({
        data: {
          drugId: id,
          type: 'RECEIVE',
          quantity: quantity,
          previousStock: previousStock,
          newStock: previousStock + quantity,
          reason: `Received from ${supplier}${lotNumber ? ` (Lot: ${lotNumber})` : ''}`,
          reference: lotNumber || reference || undefined,
          userId: user.id,
        },
      })

      // Update drug movement stats
      await tx.drugMovementStats.upsert({
        where: { drugId: id },
        create: {
          drugId: id,
          lastRestockDate: new Date(),
        },
        update: {
          lastRestockDate: new Date(),
        },
      })

      // Get updated drug
      const updatedDrug = await tx.drug.findUnique({
        where: { id },
      })

      return { lot, inventoryLog, updatedDrug }
    })

    revalidatePath('/inventory')
    
    return NextResponse.json({
      success: true,
      drug: result.updatedDrug,
      lot: result.lot,
      inventoryLog: result.inventoryLog,
      message: `Successfully received ${quantity} units of ${drug.name} at $${unitCost.toFixed(2)}/unit. Stock updated from ${previousStock} to ${result.updatedDrug?.stock}.`
    })
  } catch (error) {
    console.error('Error procuring drug:', error)
    return NextResponse.json(
      { error: 'Failed to procure drug: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  }
}
