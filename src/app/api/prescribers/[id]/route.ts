import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth-api';
import { canRead, canEdit, canDeleteRecord } from '@/lib/permissions';

// GET - Get a single prescriber
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    
    // Check read permission
    if (!canRead(user, 'prescriber')) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to view prescribers' },
        { status: 403 }
      );
    }

    const { id } = await params;
    
    const prescriber = await db.prescriber.findUnique({
      where: { id },
      include: {
        prescriptions: {
          include: {
            patient: true,
            drug: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        createdBy: {
          select: { id: true, name: true, role: true }
        }
      },
    });

    if (!prescriber) {
      return NextResponse.json(
        { error: 'Prescriber not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(prescriber);
  } catch (error) {
    console.error('Error fetching prescriber:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prescriber' },
      { status: 500 }
    );
  }
}

// PUT - Update a prescriber
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    const { id } = await params;
    
    // Check edit permission (must be admin or owner with write access)
    const hasEditPermission = await canEdit(user, 'prescriber', id);
    if (!hasEditPermission) {
      return NextResponse.json(
        { error: 'Forbidden: You can only edit prescribers you created, or you need admin privileges' },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    const prescriber = await db.prescriber.update({
      where: { id },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        npi: body.npi,
        deaNumber: body.deaNumber,
        phone: body.phone,
        fax: body.fax,
        email: body.email,
        specialty: body.specialty,
        degree: body.degree,
        address: body.address,
        city: body.city,
        state: body.state,
        zip: body.zipCode || body.zip,
        active: body.active,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, role: true }
        }
      }
    });

    return NextResponse.json(prescriber);
  } catch (error) {
    console.error('Error updating prescriber:', error);
    return NextResponse.json(
      { error: 'Failed to update prescriber' },
      { status: 500 }
    );
  }
}

// DELETE - Deactivate a prescriber (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    const { id } = await params;
    
    // Check delete permission (must be admin or owner with delete access)
    const hasDeletePermission = await canDeleteRecord(user, 'prescriber', id);
    if (!hasDeletePermission) {
      return NextResponse.json(
        { error: 'Forbidden: You can only delete prescribers you created, or you need admin privileges' },
        { status: 403 }
      );
    }

    const prescriber = await db.prescriber.update({
      where: { id },
      data: { active: false },
    });

    return NextResponse.json(prescriber);
  } catch (error) {
    console.error('Error deleting prescriber:', error);
    return NextResponse.json(
      { error: 'Failed to delete prescriber' },
      { status: 500 }
    );
  }
}
