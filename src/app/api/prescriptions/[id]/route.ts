import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Helper to serialize prescription data (convert Decimal fields in drug)
function serializePrescription(prescription: any) {
  return {
    ...prescription,
    drug: prescription.drug ? {
      ...prescription.drug,
      price: Number(prescription.drug.price),
      cost: Number(prescription.drug.cost),
    } : prescription.drug,
  };
}

// GET - Get a single prescription
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const prescription = await db.prescription.findUnique({
      where: { id },
      include: {
        patient: true,
        drug: true,
        prescriber: true,
        verifier: true,
      },
    });

    if (!prescription) {
      return NextResponse.json(
        { error: 'Prescription not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(serializePrescription(prescription));
  } catch (error) {
    console.error('Error fetching prescription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prescription' },
      { status: 500 }
    );
  }
}

// PUT - Update prescription (status, etc.)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const updateData: Record<string, unknown> = {};
    
    if (body.status) {
      updateData.status = body.status;
      
      // Handle status-specific updates
      if (body.status === 'FILL') {
        updateData.filledDate = new Date();
        updateData.dispensedQuantity = body.dispensedQuantity || body.quantity;
      }
      
      if (body.status === 'COMPLETE') {
        updateData.verifiedDate = new Date();
        updateData.verifiedBy = body.verifiedBy;
        
        // Update inventory when prescription is completed
        const prescription = await db.prescription.findUnique({
          where: { id },
          include: { drug: true },
        });
        
        if (prescription) {
          const dispensedQty = prescription.dispensedQuantity || prescription.quantity;
          await db.drug.update({
            where: { id: prescription.drugId },
            data: {
              stockQuantity: {
                decrement: dispensedQty,
              },
            },
          });
          
          // Create inventory log
          await db.inventoryLog.create({
            data: {
              drugId: prescription.drugId,
              changeType: 'DISPENSE',
              quantity: -dispensedQty,
              previousQty: prescription.drug.stockQuantity,
              newQty: prescription.drug.stockQuantity - dispensedQty,
              reference: prescription.rxNumber,
              performedBy: body.verifiedBy || 'system',
              prescriptionId: id,
            },
          });
        }
      }
    }
    
    if (body.directions !== undefined) updateData.directions = body.directions;
    if (body.quantity !== undefined) updateData.quantity = body.quantity;
    if (body.daysSupply !== undefined) updateData.daysSupply = body.daysSupply;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.dursPassed !== undefined) updateData.dursPassed = body.dursPassed;
    if (body.durNotes !== undefined) updateData.durNotes = body.durNotes;
    
    const prescription = await db.prescription.update({
      where: { id },
      data: updateData,
      include: {
        patient: true,
        drug: true,
        prescriber: true,
      },
    });

    return NextResponse.json(serializePrescription(prescription));
  } catch (error) {
    console.error('Error updating prescription:', error);
    return NextResponse.json(
      { error: 'Failed to update prescription' },
      { status: 500 }
    );
  }
}

// DELETE - Cancel a prescription
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const prescription = await db.prescription.findUnique({
      where: { id },
    });

    if (!prescription) {
      return NextResponse.json(
        { error: 'Prescription not found' },
        { status: 404 }
      );
    }

    // Only allow cancelling prescriptions that haven't been completed
    if (prescription.status === 'COMPLETE') {
      return NextResponse.json(
        { error: 'Cannot delete completed prescriptions' },
        { status: 400 }
      );
    }

    await db.prescription.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting prescription:', error);
    return NextResponse.json(
      { error: 'Failed to delete prescription' },
      { status: 500 }
    );
  }
}
