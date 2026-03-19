import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-api'
import { canRead, canWrite } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'

// Helper to serialize drug data (convert Decimal to number)
function serializeDrug(drug: any) {
  return {
    ...drug,
    price: Number(drug.price),
    cost: Number(drug.cost),
  }
}

export async function GET(request: Request) {
  try {
    const user = await getAuthUser()
    
    // Check read permission
    if (!canRead(user, 'drug')) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to view drugs' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || undefined
    const lowStock = searchParams.get('lowStock') === 'true'
    
    const where: Record<string, unknown> = { isActive: true }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { genericName: { contains: search, mode: 'insensitive' } },
        { ndc: { contains: search } },
      ]
    }

    if (lowStock) {
      // Get all active drugs and filter for low stock
      const allDrugs = await db.drug.findMany({ 
        where: { isActive: true },
        include: {
          createdBy: {
            select: { id: true, name: true, role: true }
          }
        }
      })
      return NextResponse.json(allDrugs.filter(d => d.stock <= d.reorderLevel).map(serializeDrug))
    }

    const drugs = await db.drug.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        createdBy: {
          select: { id: true, name: true, role: true }
        }
      }
    })
    
    return NextResponse.json(drugs.map(serializeDrug))
  } catch (error) {
    console.error('Failed to fetch drugs:', error)
    return NextResponse.json({ error: 'Failed to fetch drugs' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser()
    
    // Check write permission
    if (!canWrite(user, 'drug')) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to create drugs' }, { status: 403 })
    }

    const formData = await request.formData()
    
    const drug = await db.drug.create({
      data: {
        ndc: formData.get('ndc') as string,
        name: formData.get('name') as string,
        genericName: formData.get('genericName') as string | null,
        strength: formData.get('strength') as string,
        form: formData.get('form') as string,
        manufacturer: formData.get('manufacturer') as string | null,
        price: parseFloat(formData.get('price') as string) || 0,
        cost: parseFloat(formData.get('cost') as string) || 0,
        stock: parseInt(formData.get('stock') as string) || 0,
        reorderLevel: parseInt(formData.get('reorderLevel') as string) || 10,
        maxStock: parseInt(formData.get('maxStock') as string) || 100,
        controlled: formData.get('controlled') === 'true',
        schedule: formData.get('schedule') as string | null,
        createdById: user?.id, // Track who created this record
      },
      include: {
        createdBy: {
          select: { id: true, name: true, role: true }
        }
      }
    })

    revalidatePath('/inventory')
    return NextResponse.json(serializeDrug(drug))
  } catch (error) {
    console.error('Failed to create drug:', error)
    return NextResponse.json({ error: 'Failed to create drug' }, { status: 500 })
  }
}
