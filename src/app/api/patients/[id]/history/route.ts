import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-api'

// GET - Get patient history with prescriptions and sales
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get patient with full history
    const patient = await db.patient.findUnique({
      where: { id },
      include: {
        prescriptions: {
          include: {
            drug: {
              select: {
                id: true,
                name: true,
                ndc: true,
                strength: true,
                form: true,
              },
            },
            prescriber: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                degree: true,
                specialty: true,
              },
            },
            filledBy: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        sales: {
          include: {
            items: {
              include: {
                drug: {
                  select: {
                    id: true,
                    name: true,
                    ndc: true,
                  },
                },
              },
            },
            cashier: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 30,
        },
      },
    })

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Calculate patient statistics
    const totalPrescriptions = await db.prescription.count({
      where: { patientId: id },
    })

    const totalSales = await db.sale.count({
      where: { patientId: id },
    })

    const totalSpent = await db.sale.aggregate({
      where: {
        patientId: id,
        paymentStatus: 'PAID',
      },
      _sum: { total: true },
    })

    // Get unique drugs prescribed
    const uniqueDrugs = await db.prescription.groupBy({
      by: ['drugId'],
      where: { patientId: id },
      _count: { id: true },
    })

    const drugDetails = await Promise.all(
      uniqueDrugs.map(async (item) => {
        const drug = await db.drug.findUnique({
          where: { id: item.drugId },
          select: { name: true, strength: true, form: true },
        })
        return {
          ...drug,
          timesPrescribed: item._count.id,
        }
      })
    )

    // Serialize Decimal fields
    const serializedPatient = {
      ...patient,
      dob: patient.dob.toISOString(),
      createdAt: patient.createdAt.toISOString(),
      updatedAt: patient.updatedAt.toISOString(),
      prescriptions: patient.prescriptions.map(rx => ({
        ...rx,
        quantity: Number(rx.quantity),
        copay: Number(rx.copay),
        priceCharged: Number(rx.priceCharged),
        createdAt: rx.createdAt.toISOString(),
        updatedAt: rx.updatedAt.toISOString(),
        filledDate: rx.filledDate?.toISOString() || null,
      })),
      sales: patient.sales.map(sale => ({
        ...sale,
        subtotal: Number(sale.subtotal),
        tax: Number(sale.tax),
        discount: Number(sale.discount),
        total: Number(sale.total),
        amountPaid: Number(sale.amountPaid),
        change: Number(sale.change),
        costOfGoodsSold: Number(sale.costOfGoodsSold),
        grossProfit: Number(sale.grossProfit),
        createdAt: sale.createdAt.toISOString(),
        updatedAt: sale.updatedAt.toISOString(),
        items: sale.items.map(item => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          unitCost: Number(item.unitCost),
          totalCost: Number(item.totalCost),
          discount: Number(item.discount),
          subtotal: Number(item.subtotal),
          createdAt: item.createdAt.toISOString(),
        })),
      })),
    }

    return NextResponse.json({
      patient: serializedPatient,
      statistics: {
        totalPrescriptions,
        totalSales,
        totalSpent: Number(totalSpent._sum.total || 0),
        uniqueDrugsPrescribed: uniqueDrugs.length,
        drugHistory: drugDetails,
      },
    })
  } catch (error) {
    console.error('Failed to fetch patient history:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch patient history' },
      { status: 500 }
    )
  }
}
