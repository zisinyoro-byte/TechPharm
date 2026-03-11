import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST - Adjust inventory (add/remove stock)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const drug = await db.drug.findUnique({
      where: { id },
    });

    if (!drug) {
      return NextResponse.json(
        { error: 'Drug not found' },
        { status: 404 }
      );
    }

    const previousQty = drug.stockQuantity;
    const changeQuantity = body.quantity; // Can be positive or negative
    const newQty = previousQty + changeQuantity;

    if (newQty < 0) {
      return NextResponse.json(
        { error: 'Insufficient stock' },
        { status: 400 }
      );
    }

    // Update drug stock
    const updatedDrug = await db.drug.update({
      where: { id },
      data: {
        stockQuantity: newQty,
      },
    });

    // Create inventory log
    await db.inventoryLog.create({
      data: {
        drugId: id,
        changeType: body.changeType || 'ADJUSTMENT',
        quantity: changeQuantity,
        previousQty,
        newQty,
        reason: body.reason,
        reference: body.reference,
        cost: body.cost,
        performedBy: body.performedBy || 'system',
      },
    });

    return NextResponse.json(updatedDrug);
  } catch (error) {
    console.error('Error adjusting inventory:', error);
    return NextResponse.json(
      { error: 'Failed to adjust inventory' },
      { status: 500 }
    );
  }
}
