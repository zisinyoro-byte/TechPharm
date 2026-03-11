import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Get a single drug
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const drug = await db.drug.findUnique({
      where: { id },
      include: {
        inventoryLogs: {
          include: {
            user: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        prescriptions: {
          include: {
            patient: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!drug) {
      return NextResponse.json(
        { error: 'Drug not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(drug);
  } catch (error) {
    console.error('Error fetching drug:', error);
    return NextResponse.json(
      { error: 'Failed to fetch drug' },
      { status: 500 }
    );
  }
}

// PUT - Update a drug
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const drug = await db.drug.update({
      where: { id },
      data: {
        ndc: body.ndc,
        name: body.name,
        genericName: body.genericName,
        strength: body.strength,
        form: body.form,
        manufacturer: body.manufacturer,
        price: body.price,
        cost: body.cost,
        stockQuantity: body.stockQuantity,
        reorderLevel: body.reorderLevel,
        maxStock: body.maxStock,
        controlled: body.controlled,
        schedule: body.schedule,
        deaClass: body.deaClass,
        requiresRefrigeration: body.requiresRefrigeration,
        barcode: body.barcode,
        active: body.active,
      },
    });

    return NextResponse.json(drug);
  } catch (error) {
    console.error('Error updating drug:', error);
    return NextResponse.json(
      { error: 'Failed to update drug' },
      { status: 500 }
    );
  }
}

// DELETE - Deactivate a drug (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Soft delete by setting active to false
    const drug = await db.drug.update({
      where: { id },
      data: { active: false },
    });

    return NextResponse.json(drug);
  } catch (error) {
    console.error('Error deleting drug:', error);
    return NextResponse.json(
      { error: 'Failed to delete drug' },
      { status: 500 }
    );
  }
}
