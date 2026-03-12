import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Get a single prescriber
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    const { id } = await params;
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
        practiceName: body.practiceName,
        address: body.address,
        city: body.city,
        state: body.state,
        zipCode: body.zipCode,
        specialty: body.specialty,
        active: body.active,
      },
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
    const { id } = await params;
    
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
