import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth-api';
import { canRead, canEdit, canDeleteRecord } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';

// GET - Get a single drug
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    
    // Check read permission
    if (!canRead(user, 'drug')) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to view drugs' },
        { status: 403 }
      );
    }

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
        createdBy: {
          select: { id: true, name: true, role: true }
        }
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
    const user = await getAuthUser();
    const { id } = await params;
    
    // Check edit permission (must be admin or owner with write access)
    const hasEditPermission = await canEdit(user, 'drug', id);
    if (!hasEditPermission) {
      return NextResponse.json(
        { error: 'Forbidden: You can only edit drugs you created, or you need admin privileges' },
        { status: 403 }
      );
    }

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
        stock: body.stockQuantity ?? body.stock,
        reorderLevel: body.reorderLevel,
        maxStock: body.maxStock,
        controlled: body.controlled,
        schedule: body.schedule,
        barcode: body.barcode,
        isActive: body.active ?? body.isActive,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, role: true }
        }
      }
    });

    revalidatePath('/inventory');
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
    const user = await getAuthUser();
    const { id } = await params;
    
    // Check delete permission (must be admin or owner with delete access)
    const hasDeletePermission = await canDeleteRecord(user, 'drug', id);
    if (!hasDeletePermission) {
      return NextResponse.json(
        { error: 'Forbidden: You can only delete drugs you created, or you need admin privileges' },
        { status: 403 }
      );
    }

    // Soft delete by setting active to false
    const drug = await db.drug.update({
      where: { id },
      data: { isActive: false },
    });

    revalidatePath('/inventory');
    return NextResponse.json(drug);
  } catch (error) {
    console.error('Error deleting drug:', error);
    return NextResponse.json(
      { error: 'Failed to delete drug' },
      { status: 500 }
    );
  }
}
