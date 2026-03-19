import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-api'
import { startOfDay, endOfDay, subDays, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns'

// GET - Financial and Cashflow Reports
export async function GET(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get('type') || 'summary'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const now = new Date()
    const periodStart = startDate ? new Date(startDate) : startOfMonth(now)
    const periodEnd = endDate ? new Date(endDate) : endOfDay(now)

    switch (reportType) {
      case 'summary':
        return await getFinancialSummary(periodStart, periodEnd)
      case 'cashflow':
        return await getCashflowReport(periodStart, periodEnd)
      case 'daily':
        return await getDailyBreakdown(periodStart, periodEnd)
      case 'weekly':
        return await getWeeklyBreakdown(periodStart, periodEnd)
      case 'monthly':
        return await getMonthlyBreakdown(periodStart, periodEnd)
      case 'profit-loss':
        return await getProfitLossStatement(periodStart, periodEnd)
      case 'payment-methods':
        return await getPaymentMethodAnalysis(periodStart, periodEnd)
      default:
        return await getFinancialSummary(periodStart, periodEnd)
    }
  } catch (error) {
    console.error('Failed to generate financial report:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate financial report' },
      { status: 500 }
    )
  }
}

// Financial Summary
async function getFinancialSummary(startDate: Date, endDate: Date) {
  // Sales metrics
  const sales = await db.sale.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate },
      paymentStatus: 'PAID',
    },
    select: {
      total: true,
      subtotal: true,
      tax: true,
      discount: true,
      costOfGoodsSold: true,
      grossProfit: true,
      paymentMethod: true,
      createdAt: true,
    },
  })

  // Calculate totals
  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total), 0)
  const totalSubtotal = sales.reduce((sum, s) => sum + Number(s.subtotal), 0)
  const totalTax = sales.reduce((sum, s) => sum + Number(s.tax), 0)
  const totalDiscount = sales.reduce((sum, s) => sum + Number(s.discount), 0)
  const totalCOGS = sales.reduce((sum, s) => sum + Number(s.costOfGoodsSold), 0)
  const totalGrossProfit = sales.reduce((sum, s) => sum + Number(s.grossProfit), 0)

  // Payment method breakdown
  const byPaymentMethod = sales.reduce((acc, sale) => {
    if (!acc[sale.paymentMethod]) {
      acc[sale.paymentMethod] = { count: 0, total: 0 }
    }
    acc[sale.paymentMethod].count++
    acc[sale.paymentMethod].total += Number(sale.total)
    return acc
  }, {} as Record<string, { count: number; total: number }>)

  // Prescription metrics
  const prescriptionsFilled = await db.prescription.count({
    where: {
      filledDate: { gte: startDate, lte: endDate },
      status: 'COMPLETE',
    },
  })

  // New patients
  const newPatients = await db.patient.count({
    where: {
      createdAt: { gte: startDate, lte: endDate },
    },
  })

  // Cash transactions
  const cashTransactions = await db.cashTransaction.findMany({
    where: {
      recordedAt: { gte: startDate, lte: endDate },
    },
    select: { type: true, amount: true },
  })

  const cashIn = cashTransactions
    .filter(t => ['SALE_CASH', 'CASH_IN', 'FLOAT_ADD'].includes(t.type))
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const cashOut = cashTransactions
    .filter(t => ['REFUND', 'CASH_OUT', 'FLOAT_REMOVE'].includes(t.type))
    .reduce((sum, t) => sum + Number(t.amount), 0)

  // Average transaction
  const avgTransaction = sales.length > 0 ? totalRevenue / sales.length : 0

  // Profit margins
  const grossMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0

  // Compare to previous period
  const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const previousStart = new Date(startDate)
  previousStart.setDate(previousStart.getDate() - periodDays)
  const previousEnd = new Date(startDate)

  const previousSales = await db.sale.aggregate({
    where: {
      createdAt: { gte: previousStart, lte: previousEnd },
      paymentStatus: 'PAID',
    },
    _sum: { total: true, grossProfit: true },
    _count: true,
  })

  const previousRevenue = Number(previousSales._sum.total || 0)
  const revenueChange = previousRevenue > 0 
    ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 
    : 0

  return NextResponse.json({
    period: { start: startDate, end: endDate, days: periodDays },
    sales: {
      count: sales.length,
      totalRevenue,
      subtotal: totalSubtotal,
      tax: totalTax,
      discount: totalDiscount,
      avgTransaction,
    },
    costs: {
      costOfGoodsSold: totalCOGS,
      grossProfit: totalGrossProfit,
      grossMargin: Math.round(grossMargin * 100) / 100,
    },
    paymentMethods: byPaymentMethod,
    other: {
      prescriptionsFilled,
      newPatients,
    },
    cashflow: {
      cashIn,
      cashOut,
      netCash: cashIn - cashOut,
    },
    comparison: {
      previousPeriodRevenue: previousRevenue,
      revenueChange: Math.round(revenueChange * 100) / 100,
      previousSalesCount: previousSales._count,
    },
  })
}

// Cashflow Report
async function getCashflowReport(startDate: Date, endDate: Date) {
  // Get all cash transactions
  const transactions = await db.cashTransaction.findMany({
    where: {
      recordedAt: { gte: startDate, lte: endDate },
    },
    include: {
      recordedBy: { select: { name: true } },
      sale: { select: { invoiceNumber: true } },
      dailyCash: { select: { date: true } },
    },
    orderBy: { recordedAt: 'desc' },
  })

  // Get cash sales
  const cashSales = await db.sale.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate },
      paymentMethod: 'CASH',
      paymentStatus: 'PAID',
    },
    select: {
      id: true,
      invoiceNumber: true,
      total: true,
      createdAt: true,
    },
  })

  // Group transactions by type
  const byType = transactions.reduce((acc, t) => {
    if (!acc[t.type]) {
      acc[t.type] = { count: 0, total: 0, transactions: [] }
    }
    acc[t.type].count++
    acc[t.type].total += Number(t.amount)
    acc[t.type].transactions.push({
      id: t.id,
      amount: Number(t.amount),
      description: t.description,
      reference: t.reference,
      recordedBy: t.recordedBy.name,
      recordedAt: t.recordedAt,
    })
    return acc
  }, {} as Record<string, { count: number; total: number; transactions: any[] }>)

  // Calculate totals
  const totalIn = transactions
    .filter(t => ['SALE_CASH', 'CASH_IN', 'FLOAT_ADD'].includes(t.type))
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const totalOut = transactions
    .filter(t => ['REFUND', 'CASH_OUT', 'FLOAT_REMOVE'].includes(t.type))
    .reduce((sum, t) => sum + Number(t.amount), 0)

  // Daily cash records
  const dailyRecords = await db.dailyCashRecord.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: 'asc' },
  })

  return NextResponse.json({
    period: { start: startDate, end: endDate },
    summary: {
      totalCashIn: totalIn,
      totalCashOut: totalOut,
      netCashflow: totalIn - totalOut,
      transactionCount: transactions.length,
      cashSalesCount: cashSales.length,
      cashSalesTotal: cashSales.reduce((sum, s) => sum + Number(s.total), 0),
    },
    byType,
    transactions: transactions.map(t => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      description: t.description,
      reference: t.reference,
      saleInvoice: t.sale?.invoiceNumber,
      recordedBy: t.recordedBy.name,
      recordedAt: t.recordedAt,
    })),
    dailyRecords: dailyRecords.map(r => ({
      date: r.date,
      status: r.status,
      openingCash: Number(r.openingCash),
      expectedCash: Number(r.expectedCash),
      actualCash: r.actualCash ? Number(r.actualCash) : null,
      variance: Number(r.cashVariance),
      totalSales: r.totalSales,
      totalRevenue: Number(r.totalRevenue),
    })),
  })
}

// Daily Breakdown
async function getDailyBreakdown(startDate: Date, endDate: Date) {
  const days = eachDayOfInterval({ start: startDate, end: endDate })

  const dailyData = await Promise.all(
    days.map(async (day) => {
      const dayStart = startOfDay(day)
      const dayEnd = endOfDay(day)

      const sales = await db.sale.aggregate({
        where: {
          createdAt: { gte: dayStart, lte: dayEnd },
          paymentStatus: 'PAID',
        },
        _sum: { total: true, costOfGoodsSold: true, grossProfit: true },
        _count: true,
      })

      const byPayment = await db.sale.groupBy({
        by: ['paymentMethod'],
        where: {
          createdAt: { gte: dayStart, lte: dayEnd },
          paymentStatus: 'PAID',
        },
        _sum: { total: true },
      })

      const cashRecord = await db.dailyCashRecord.findUnique({
        where: { date: dayStart },
        select: { status: true, openingCash: true, actualCash: true, cashVariance: true },
      })

      return {
        date: day,
        dateStr: format(day, 'yyyy-MM-dd'),
        dayName: format(day, 'EEEE'),
        sales: {
          count: sales._count,
          revenue: Number(sales._sum.total || 0),
          cogs: Number(sales._sum.costOfGoodsSold || 0),
          profit: Number(sales._sum.grossProfit || 0),
        },
        byPayment: byPayment.reduce((acc, p) => {
          acc[p.paymentMethod] = Number(p._sum.total || 0)
          return acc
        }, {} as Record<string, number>),
        cashRecord: cashRecord ? {
          status: cashRecord.status,
          openingCash: Number(cashRecord.openingCash),
          actualCash: cashRecord.actualCash ? Number(cashRecord.actualCash) : null,
          variance: Number(cashRecord.cashVariance),
        } : null,
      }
    })
  )

  const totals = dailyData.reduce((acc, day) => {
    acc.totalRevenue += day.sales.revenue
    acc.totalCOGS += day.sales.cogs
    acc.totalProfit += day.sales.profit
    acc.totalSales += day.sales.count
    return acc
  }, { totalRevenue: 0, totalCOGS: 0, totalProfit: 0, totalSales: 0 })

  return NextResponse.json({
    period: { start: startDate, end: endDate },
    daily: dailyData,
    totals,
    avgDailyRevenue: dailyData.length > 0 ? totals.totalRevenue / dailyData.length : 0,
  })
}

// Weekly Breakdown
async function getWeeklyBreakdown(startDate: Date, endDate: Date) {
  const weeks = eachWeekOfInterval({ start: startDate, end: endDate }, { weekStartsOn: 1 })

  const weeklyData = await Promise.all(
    weeks.map(async (weekStart) => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })

      const sales = await db.sale.aggregate({
        where: {
          createdAt: { gte: startOfDay(weekStart), lte: endOfDay(weekEnd) },
          paymentStatus: 'PAID',
        },
        _sum: { total: true, costOfGoodsSold: true, grossProfit: true },
        _count: true,
      })

      return {
        weekStart,
        weekEnd,
        weekLabel: `Week ${format(weekStart, 'w')} - ${format(weekStart, 'MMM d')} to ${format(weekEnd, 'MMM d')}`,
        sales: {
          count: sales._count,
          revenue: Number(sales._sum.total || 0),
          cogs: Number(sales._sum.costOfGoodsSold || 0),
          profit: Number(sales._sum.grossProfit || 0),
        },
      }
    })
  )

  return NextResponse.json({
    period: { start: startDate, end: endDate },
    weekly: weeklyData,
  })
}

// Monthly Breakdown
async function getMonthlyBreakdown(startDate: Date, endDate: Date) {
  const months = eachMonthOfInterval({ start: startDate, end: endDate })

  const monthlyData = await Promise.all(
    months.map(async (monthStart) => {
      const monthEnd = endOfMonth(monthStart)

      const sales = await db.sale.aggregate({
        where: {
          createdAt: { gte: startOfDay(monthStart), lte: endOfDay(monthEnd) },
          paymentStatus: 'PAID',
        },
        _sum: { total: true, costOfGoodsSold: true, grossProfit: true },
        _count: true,
      })

      const newPatients = await db.patient.count({
        where: {
          createdAt: { gte: startOfDay(monthStart), lte: endOfDay(monthEnd) },
        },
      })

      const prescriptions = await db.prescription.count({
        where: {
          filledDate: { gte: startOfDay(monthStart), lte: endOfDay(monthEnd) },
          status: 'COMPLETE',
        },
      })

      return {
        month: monthStart,
        monthLabel: format(monthStart, 'MMMM yyyy'),
        sales: {
          count: sales._count,
          revenue: Number(sales._sum.total || 0),
          cogs: Number(sales._sum.costOfGoodsSold || 0),
          profit: Number(sales._sum.grossProfit || 0),
        },
        other: {
          newPatients,
          prescriptions,
        },
      }
    })
  )

  return NextResponse.json({
    period: { start: startDate, end: endDate },
    monthly: monthlyData,
  })
}

// Profit & Loss Statement
async function getProfitLossStatement(startDate: Date, endDate: Date) {
  // Revenue
  const sales = await db.sale.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate },
      paymentStatus: 'PAID',
    },
    select: {
      subtotal: true,
      tax: true,
      discount: true,
      total: true,
      costOfGoodsSold: true,
      grossProfit: true,
    },
  })

  const revenue = {
    grossSales: sales.reduce((sum, s) => sum + Number(s.subtotal), 0),
    discounts: sales.reduce((sum, s) => sum + Number(s.discount), 0),
    netSales: sales.reduce((sum, s) => sum + Number(s.subtotal) - Number(s.discount), 0),
    taxCollected: sales.reduce((sum, s) => sum + Number(s.tax), 0),
    totalRevenue: sales.reduce((sum, s) => sum + Number(s.total), 0),
  }

  // Cost of Goods Sold
  const cogs = {
    total: sales.reduce((sum, s) => sum + Number(s.costOfGoodsSold), 0),
  }

  // Gross Profit
  const grossProfit = {
    amount: revenue.netSales - cogs.total,
    margin: revenue.netSales > 0 ? ((revenue.netSales - cogs.total) / revenue.netSales) * 100 : 0,
  }

  // Expenses (from cash transactions)
  const expenses = await db.cashTransaction.findMany({
    where: {
      type: 'CASH_OUT',
      recordedAt: { gte: startDate, lte: endDate },
    },
    select: { amount: true, category: true, description: true },
  })

  const expensesByCategory = expenses.reduce((acc, e) => {
    const cat = e.category || 'other'
    if (!acc[cat]) acc[cat] = 0
    acc[cat] += Number(e.amount)
    return acc
  }, {} as Record<string, number>)

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  // Net Profit
  const netProfit = {
    amount: grossProfit.amount - totalExpenses,
    margin: revenue.netSales > 0 ? ((grossProfit.amount - totalExpenses) / revenue.netSales) * 100 : 0,
  }

  return NextResponse.json({
    period: { start: startDate, end: endDate },
    revenue,
    costOfGoodsSold: cogs,
    grossProfit: {
      ...grossProfit,
      margin: Math.round(grossProfit.margin * 100) / 100,
    },
    expenses: {
      byCategory: expensesByCategory,
      total: totalExpenses,
    },
    netProfit: {
      ...netProfit,
      margin: Math.round(netProfit.margin * 100) / 100,
    },
  })
}

// Payment Method Analysis
async function getPaymentMethodAnalysis(startDate: Date, endDate: Date) {
  const sales = await db.sale.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate },
    },
    select: {
      paymentMethod: true,
      paymentStatus: true,
      total: true,
      createdAt: true,
    },
  })

  const byMethod = sales.reduce((acc, sale) => {
    if (!acc[sale.paymentMethod]) {
      acc[sale.paymentMethod] = {
        count: 0,
        total: 0,
        paid: 0,
        pending: 0,
        refunded: 0,
      }
    }
    acc[sale.paymentMethod].count++
    acc[sale.paymentMethod].total += Number(sale.total)
    if (sale.paymentStatus === 'PAID') acc[sale.paymentMethod].paid += Number(sale.total)
    if (sale.paymentStatus === 'PENDING') acc[sale.paymentMethod].pending += Number(sale.total)
    if (sale.paymentStatus === 'REFUNDED') acc[sale.paymentMethod].refunded += Number(sale.total)
    return acc
  }, {} as Record<string, { count: number; total: number; paid: number; pending: number; refunded: number }>)

  // Calculate percentages
  const totalRevenue = Object.values(byMethod).reduce((sum, m) => sum + m.paid, 0)
  const methodAnalysis = Object.entries(byMethod).map(([method, data]) => ({
    method,
    ...data,
    percentage: totalRevenue > 0 ? Math.round((data.paid / totalRevenue) * 10000) / 100 : 0,
  }))

  return NextResponse.json({
    period: { start: startDate, end: endDate },
    byMethod: methodAnalysis,
    totalRevenue,
    totalSales: sales.length,
  })
}
