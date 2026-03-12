import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-api'
import { canRead, canWrite } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'

export async function GET(request: Request) {
  try {
    const user = await getAuthUser()
    
    // Check read permission
    if (!canRead(user, 'patient')) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to view patients' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || undefined
    
    const where = search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search } },
          ],
        }
      : {}

    const patients = await db.patient.findMany({
      where,
      include: {
        prescriptions: {
          include: { drug: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        createdBy: {
          select: { id: true, name: true, role: true }
        }
      },
      orderBy: { lastName: 'asc' },
    })
    
    return NextResponse.json(patients)
  } catch (error) {
    console.error('Failed to fetch patients:', error)
    return NextResponse.json({ error: 'Failed to fetch patients' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser()
    
    // Check write permission
    if (!canWrite(user, 'patient')) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to create patients' }, { status: 403 })
    }

    const formData = await request.formData()
    const firstName = formData.get('firstName') as string
    const lastName = formData.get('lastName') as string
    const dob = new Date(formData.get('dob') as string)
    const phone = formData.get('phone') as string | null
    const email = formData.get('email') as string | null
    const address = formData.get('address') as string | null
    const city = formData.get('city') as string | null
    const state = formData.get('state') as string | null
    const zip = formData.get('zip') as string | null
    const gender = formData.get('gender') as string | null
    const allergiesStr = formData.get('allergies') as string | null
    const allergies = allergiesStr ? allergiesStr.split(',').map(a => a.trim()).filter(Boolean) : []

    const patient = await db.patient.create({
      data: {
        firstName,
        lastName,
        dob,
        phone,
        email,
        address,
        city,
        state,
        zip,
        gender,
        allergies,
        createdById: user?.id, // Track who created this record
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
    console.error('Failed to create patient:', error)
    return NextResponse.json({ error: 'Failed to create patient' }, { status: 500 })
  }
}
