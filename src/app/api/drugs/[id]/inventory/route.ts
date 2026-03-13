import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-api'
import { canWrite, isAdmin } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'

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
    const quantity = body.quantity // Can be positive (receive) or negative (dispense)
    
    if (!quantity || typeof quantity !== 'number') {
      return NextResponse.json(
        { error: 'Quantity is required and must be a number' },
        { status: 400 }
      )
    }

    const newStock = previousStock + quantity

    if (newStock < 0) {
      return NextResponse.json(
        { error: 'Insufficient stock' },
        { status: 400 }
      )
    }

    // Determine the action type based on quantity
    const actionType = quantity > 0 ? 'RECEIVE' : body.type || 'ADJUSTMENT'

    // Update drug stock
    const updatedDrug = await db.drug.update({
      where: { id },
      data: {
        stock: newStock,
      },
    })

    // Create inventory log
    await db.inventoryLog.create({
      data: {
        drugId: id,
        type: actionType,
        quantity: Math.abs(quantity),
        previousStock: previousStock,
        newStock: newStock,
        reason: body.reason || (quantity > 0 ? `Received from ${body.supplier || 'supplier'}` : 'Stock adjustment'),
        reference: body.reference || body.lotNumber,
        userId: user.id,
      },
    })

    revalidatePath('/inventory')
    
    return NextResponse.json({
      success: true,
      drug: updatedDrug,
      message: quantity > 0 
        ? `Successfully received ${quantity} units. Stock updated from ${previousStock} to ${newStock}.`
        : `Stock adjusted by ${quantity} units. New stock: ${newStock}.`
    })
  } catch (error) {
    console.error('Error adjusting inventory:', error)
    return NextResponse.json(
      { error: 'Failed to adjust inventory: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  }
}
