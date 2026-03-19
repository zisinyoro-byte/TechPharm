import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-api'
import { canWrite, isAdmin } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'

// Helper to serialize drug data (convert Decimal to number)
function serializeDrug(drug: any) {
  return {
    ...drug,
    price: Number(drug.price),
    cost: Number(drug.cost),
  }
}

// POST - Adjust inventory (add/remove stock)
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
    
    // Check write permission for drugs (Admin or Pharmacist can adjust inventory)
    if (!canWrite(user, 'drug') && !isAdmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to adjust inventory' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    
    // Validate quantity
    const quantity = Number(body.quantity)
    if (isNaN(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: 'Quantity is required and must be a positive number' },
        { status: 400 }
      )
    }

    // Validate supplier for receiving stock
    if (!body.supplier || typeof body.supplier !== 'string' || body.supplier.trim() === '') {
      return NextResponse.json(
        { error: 'Supplier name is required' },
        { status: 400 }
      )
    }

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
        { error: 'Cannot adjust inactive drug' },
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

      // Create inventory log
      const inventoryLog = await tx.inventoryLog.create({
        data: {
          drugId: id,
          type: 'RECEIVE',
          quantity: quantity,
          previousStock: previousStock,
          newStock: newStock,
          reason: `Received from ${body.supplier}${body.lotNumber ? ` (Lot: ${body.lotNumber})` : ''}`,
          reference: body.lotNumber || body.reference || undefined,
          userId: user.id,
        },
      })

      return { updatedDrug, inventoryLog }
    })

    revalidatePath('/inventory')
    
    return NextResponse.json({
      success: true,
      drug: serializeDrug(result.updatedDrug),
      inventoryLog: result.inventoryLog,
      message: `Successfully received ${quantity} units. Stock updated from ${previousStock} to ${newStock}.`
    })
  } catch (error) {
    console.error('Error adjusting inventory:', error)
    return NextResponse.json(
      { error: 'Failed to adjust inventory: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  }
}
