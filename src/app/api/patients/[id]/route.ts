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

    const formData = await request.formData()
    const allergiesStr = formData.get('allergies') as string | null
    const allergies = allergiesStr ? allergiesStr.split(',').map(a => a.trim()).filter(Boolean) : []

    const patient = await db.patient.update({
      where: { id },
      data: {
        firstName: formData.get('firstName') as string,
        lastName: formData.get('lastName') as string,
        dob: new Date(formData.get('dob') as string),
        phone: formData.get('phone') as string | null,
        email: formData.get('email') as string | null,
        address: formData.get('address') as string | null,
        city: formData.get('city') as string | null,
        state: formData.get('state') as string | null,
        zip: formData.get('zip') as string | null,
        gender: formData.get('gender') as string | null,
        allergies,
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
    return NextResponse.json({ error: 'Failed to update patient' }, { status: 500 })
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
