import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-api'
import { startOfDay, endOfDay, format } from 'date-fns'

// GET - Get today's cash record or create if not exists
export async function GET(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const date = dateParam ? new Date(dateParam) : new Date()
    const dayStart = startOfDay(date)
    const dayEnd = endOfDay(date)

    // Find or create today's cash record
    let cashRecord = await db.dailyCashRecord.findUnique({
      where: { date: dayStart },
      include: {
        openedBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
        cashTransactions: {
          include: {
            recordedBy: { select: { id: true, name: true } },
          },
          orderBy: { recordedAt: 'desc' },
        },
      },
    })

    // If no record exists and querying for today, calculate expected values from sales
    if (!cashRecord && !dateParam) {
      // Get today's sales summary
      const todaySales = await db.sale.aggregate({
        where: {
          createdAt: {
            gte: dayStart,
            lte: dayEnd,
          },
          paymentStatus: 'PAID',
        },
        _count: true,
        _sum: {
          total: true,
        },
      })

      const todayCashSales = await db.sale.aggregate({
        where: {
          createdAt: { gte: dayStart, lte: dayEnd },
          paymentMethod: 'CASH',
          paymentStatus: 'PAID',
        },
        _sum: { total: true },
      })

      const todayCardSales = await db.sale.aggregate({
        where: {
          createdAt: { gte: dayStart, lte: dayEnd },
          paymentMethod: 'CARD',
          paymentStatus: 'PAID',
        },
        _sum: { total: true },
      })

      const todayInsuranceSales = await db.sale.aggregate({
        where: {
          createdAt: { gte: dayStart, lte: dayEnd },
          paymentMethod: 'INSURANCE',
          paymentStatus: 'PAID',
        },
        _sum: { total: true },
      })

      // Get yesterday's closing cash as suggested opening
      const yesterday = new Date(date)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayRecord = await db.dailyCashRecord.findUnique({
        where: { date: startOfDay(yesterday) },
        select: { actualCash: true },
      })

      cashRecord = {
        id: 'new',
        date: dayStart,
        status: 'OPEN' as const,
        openingCash: yesterdayRecord?.actualCash || 0,
        openedAt: null,
        openedById: null,
        openedBy: null,
        openingNotes: null,
        expectedCash: Number(todayCashSales._sum.total || 0),
        actualCash: null,
        cashVariance: 0,
        closedAt: null,
        closedById: null,
        closedBy: null,
        closingNotes: null,
        totalSales: todaySales._count,
        cashSales: Number(todayCashSales._sum.total || 0),
        cardSales: Number(todayCardSales._sum.total || 0),
        insuranceSales: Number(todayInsuranceSales._sum.total || 0),
        totalRevenue: Number(todaySales._sum.total || 0),
        createdAt: new Date(),
        updatedAt: new Date(),
        cashTransactions: [],
      }
    }

    return NextResponse.json(cashRecord)
  } catch (error) {
    console.error('Failed to fetch daily cash record:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch daily cash record' },
      { status: 500 }
    )
  }
}

// POST - Open day (start of day)
export async function POST(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { openingCash, notes } = body
    const today = startOfDay(new Date())

    // Check if already opened today
    const existing = await db.dailyCashRecord.findUnique({
      where: { date: today },
    })

    if (existing && existing.openedAt) {
      return NextResponse.json(
        { error: 'Day already opened' },
        { status: 400 }
      )
    }

    // Create or update the cash record
    const cashRecord = await db.dailyCashRecord.upsert({
      where: { date: today },
      create: {
        date: today,
        status: 'OPEN',
        openingCash: openingCash || 0,
        openedAt: new Date(),
        openedById: user.id,
        openingNotes: notes,
      },
      update: {
        status: 'OPEN',
        openingCash: openingCash || existing?.openingCash || 0,
        openedAt: existing?.openedAt || new Date(),
        openedById: existing?.openedById || user.id,
        openingNotes: notes || existing?.openingNotes,
      },
      include: {
        openedBy: { select: { id: true, name: true } },
      },
    })

    // Create a cash transaction for opening float
    await db.cashTransaction.create({
      data: {
        dailyCashId: cashRecord.id,
        type: 'FLOAT_ADD',
        amount: openingCash || 0,
        description: 'Opening cash float',
        category: 'opening',
        recordedById: user.id,
      },
    })

    return NextResponse.json(cashRecord)
  } catch (error) {
    console.error('Failed to open day:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to open day' },
      { status: 500 }
    )
  }
}

// PUT - Close day (end of day)
export async function PUT(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { actualCash, notes, date } = body
    const targetDate = date ? startOfDay(new Date(date)) : startOfDay(new Date())

    // Get the cash record
    let cashRecord = await db.dailyCashRecord.findUnique({
      where: { date: targetDate },
    })

    if (!cashRecord) {
      return NextResponse.json(
        { error: 'Day not opened. Please open the day first.' },
        { status: 400 }
      )
    }

    if (cashRecord.status === 'CLOSED') {
      return NextResponse.json(
        { error: 'Day already closed' },
        { status: 400 }
      )
    }

    // Calculate today's sales summary
    const dayEnd = endOfDay(targetDate)
    const todaySales = await db.sale.aggregate({
      where: {
        createdAt: {
          gte: targetDate,
          lte: dayEnd,
        },
        paymentStatus: 'PAID',
      },
      _count: true,
      _sum: {
        total: true,
        costOfGoodsSold: true,
      },
    })

    const todayCashSales = await db.sale.aggregate({
      where: {
        createdAt: { gte: targetDate, lte: dayEnd },
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
      },
      _sum: { total: true },
    })

    const todayCardSales = await db.sale.aggregate({
      where: {
        createdAt: { gte: targetDate, lte: dayEnd },
        paymentMethod: 'CARD',
        paymentStatus: 'PAID',
      },
      _sum: { total: true },
    })

    const todayInsuranceSales = await db.sale.aggregate({
      where: {
        createdAt: { gte: targetDate, lte: dayEnd },
        paymentMethod: 'INSURANCE',
        paymentStatus: 'PAID',
      },
      _sum: { total: true },
    })

    // Calculate expected cash
    const expectedCash = Number(cashRecord.openingCash) + Number(todayCashSales._sum.total || 0)
    const cashVariance = actualCash ? Number(actualCash) - expectedCash : 0

    // Update the cash record
    const updatedRecord = await db.dailyCashRecord.update({
      where: { id: cashRecord.id },
      data: {
        status: 'CLOSED',
        expectedCash,
        actualCash: actualCash || expectedCash,
        cashVariance,
        closedAt: new Date(),
        closedById: user.id,
        closingNotes: notes,
        totalSales: todaySales._count,
        cashSales: Number(todayCashSales._sum.total || 0),
        cardSales: Number(todayCardSales._sum.total || 0),
        insuranceSales: Number(todayInsuranceSales._sum.total || 0),
        totalRevenue: Number(todaySales._sum.total || 0),
      },
      include: {
        openedBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
      },
    })

    // Create or update daily financial summary
    await db.financialSummary.upsert({
      where: { date: targetDate },
      create: {
        date: targetDate,
        totalRevenue: Number(todaySales._sum.total || 0),
        cashRevenue: Number(todayCashSales._sum.total || 0),
        cardRevenue: Number(todayCardSales._sum.total || 0),
        insuranceRevenue: Number(todayInsuranceSales._sum.total || 0),
        costOfGoodsSold: Number(todaySales._sum.costOfGoodsSold || 0),
        grossProfit: Number(todaySales._sum.total || 0) - Number(todaySales._sum.costOfGoodsSold || 0),
        netProfit: Number(todaySales._sum.total || 0) - Number(todaySales._sum.costOfGoodsSold || 0),
        prescriptionsFilled: todaySales._count,
      },
      update: {
        totalRevenue: Number(todaySales._sum.total || 0),
        cashRevenue: Number(todayCashSales._sum.total || 0),
        cardRevenue: Number(todayCardSales._sum.total || 0),
        insuranceRevenue: Number(todayInsuranceSales._sum.total || 0),
        costOfGoodsSold: Number(todaySales._sum.costOfGoodsSold || 0),
        grossProfit: Number(todaySales._sum.total || 0) - Number(todaySales._sum.costOfGoodsSold || 0),
        netProfit: Number(todaySales._sum.total || 0) - Number(todaySales._sum.costOfGoodsSold || 0),
        prescriptionsFilled: todaySales._count,
      },
    })

    return NextResponse.json(updatedRecord)
  } catch (error) {
    console.error('Failed to close day:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to close day' },
      { status: 500 }
    )
  }
}
