// Build timestamp: 2026-03-13T06:30:00Z - Trigger deployment
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-api'
import { canRead, canEdit, canDeleteRecord, isAdmin } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    
    // Check read permission
    if (!canRead(user, 'patient')) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to view patients' }, { status: 403 })
    }

    const { id } = await params
    const patient = await db.patient.findUnique({
      where: { id },
      include: {
        prescriptions: {
          include: { drug: true, prescriber: true },
          orderBy: { createdAt: 'desc' },
        },
        createdBy: {
          select: { id: true, name: true, role: true }
        }
      },
    })
    
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }
    return NextResponse.json(patient)
  } catch (error) {
    console.error('Failed to fetch patient:', error)
    return NextResponse.json({ error: 'Failed to fetch patient' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    const { id } = await params
    
    // Check edit permission (must be admin or owner with write access)
    const hasEditPermission = await canEdit(user, 'patient', id)
    if (!hasEditPermission) {
      return NextResponse.json({ 
        error: 'Forbidden: You can only edit patients you created, or you need admin privileges' 
      }, { status: 403 })
    }

    // Get existing patient first
    const existingPatient = await db.patient.findUnique({ where: { id } })
    if (!existingPatient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Accept JSON body
    const body = await request.json()
    const allergies = body.allergies 
      ? (Array.isArray(body.allergies) ? body.allergies : body.allergies.split(',').map((a: string) => a.trim()).filter(Boolean))
      : existingPatient.allergies

    // Handle DOB - keep existing if not provided or invalid
    let dob = existingPatient.dob
    if (body.dob) {
      const parsedDate = new Date(body.dob)
      if (!isNaN(parsedDate.getTime())) {
        dob = parsedDate
      }
    }

    const patient = await db.patient.update({
      where: { id },
      data: {
        firstName: body.firstName ?? existingPatient.firstName,
        lastName: body.lastName ?? existingPatient.lastName,
        dob,
        phone: body.phone ?? existingPatient.phone,
        email: body.email ?? existingPatient.email,
        address: body.address ?? existingPatient.address,
        city: body.city ?? existingPatient.city,
        state: body.state ?? existingPatient.state,
        zip: body.zip ?? existingPatient.zip,
        gender: body.gender ?? existingPatient.gender,
        allergies,
        insuranceId: body.insuranceId ?? existingPatient.insuranceId,
        insuranceName: body.insuranceName ?? existingPatient.insuranceName,
        notes: body.notes ?? existingPatient.notes,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, role: true }
        }
      }
    })

    revalidatePath('/patients')
    return NextResponse.json(patient)
  } catch (error) {
    console.error('Failed to update patient:', error)
    return NextResponse.json({ error: 'Failed to update patient: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    const { id } = await params
    
    // Check delete permission (must be admin or owner with delete access)
    const hasDeletePermission = await canDeleteRecord(user, 'patient', id)
    if (!hasDeletePermission) {
      return NextResponse.json({ 
        error: 'Forbidden: You can only delete patients you created, or you need admin privileges' 
      }, { status: 403 })
    }

    await db.patient.delete({ where: { id } })
    revalidatePath('/patients')
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete patient:', error)
    return NextResponse.json({ error: 'Failed to delete patient' }, { status: 500 })
  }
}
