import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-api'
import { startOfDay, endOfDay, subDays, subMonths, startOfMonth, endOfMonth, format } from 'date-fns'

// GET - Comprehensive inventory reports
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
    const category = searchParams.get('category')

    const now = new Date()
    const periodStart = startDate ? new Date(startDate) : subMonths(now, 1)
    const periodEnd = endDate ? new Date(endDate) : now

    switch (reportType) {
      case 'summary':
        return await getInventorySummary(periodStart, periodEnd)
      case 'fast-movers':
        return await getFastMovers(periodStart, periodEnd)
      case 'slow-movers':
        return await getSlowMovers(periodStart, periodEnd)
      case 'valuation':
        return await getInventoryValuation()
      case 'expiring':
        return await getExpiringStock()
      case 'low-stock':
        return await getLowStock()
      case 'movement-analysis':
        return await getMovementAnalysis(periodStart, periodEnd)
      default:
        return await getInventorySummary(periodStart, periodEnd)
    }
  } catch (error) {
    console.error('Failed to generate inventory report:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate inventory report' },
      { status: 500 }
    )
  }
}

// Inventory Summary Report
async function getInventorySummary(startDate: Date, endDate: Date) {
  // Total drugs and stock value
  const drugs = await db.drug.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      ndc: true,
      stock: true,
      price: true,
      cost: true,
      reorderLevel: true,
      maxStock: true,
      form: true,
    },
  })

  const totalDrugs = drugs.length
  const totalStock = drugs.reduce((sum, d) => sum + d.stock, 0)
  const totalRetailValue = drugs.reduce((sum, d) => sum + d.stock * Number(d.price), 0)
  const totalCostValue = drugs.reduce((sum, d) => sum + d.stock * Number(d.cost), 0)

  // Movement in period
  const salesInPeriod = await db.saleItem.aggregate({
    where: {
      createdAt: { gte: startDate, lte: endDate },
    },
    _sum: { quantity: true, subtotal: true },
    _count: true,
  })

  const procurementsInPeriod = await db.inventoryLog.aggregate({
    where: {
      type: 'RECEIVE',
      createdAt: { gte: startDate, lte: endDate },
    },
    _sum: { quantity: true },
    _count: true,
  })

  // Low stock items
  const lowStockItems = drugs.filter(d => d.stock <= d.reorderLevel && d.stock > 0)
  const outOfStockItems = drugs.filter(d => d.stock === 0)
  const overStockedItems = drugs.filter(d => d.stock > d.maxStock)

  // Top selling drugs
  const topSellers = await db.saleItem.groupBy({
    by: ['drugId'],
    where: {
      createdAt: { gte: startDate, lte: endDate },
    },
    _sum: { quantity: true, subtotal: true },
    _count: true,
    orderBy: { _sum: { quantity: 'desc' } },
    take: 10,
  })

  const topSellerDetails = await Promise.all(
    topSellers.map(async (item) => {
      const drug = await db.drug.findUnique({
        where: { id: item.drugId },
        select: { name: true, ndc: true },
      })
      return {
        ...item,
        drugName: drug?.name,
        ndc: drug?.ndc,
      }
    })
  )

  return NextResponse.json({
    period: { start: startDate, end: endDate },
    summary: {
      totalDrugs,
      totalStockUnits: totalStock,
      totalRetailValue,
      totalCostValue,
      potentialProfit: totalRetailValue - totalCostValue,
    },
    movement: {
      itemsSold: salesInPeriod._sum.quantity || 0,
      salesRevenue: Number(salesInPeriod._sum.subtotal || 0),
      salesCount: salesInPeriod._count,
      itemsReceived: procurementsInPeriod._sum.quantity || 0,
      procurementCount: procurementsInPeriod._count,
    },
    stockStatus: {
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      overStockedCount: overStockedItems.length,
    },
    topSellers: topSellerDetails,
  })
}

// Fast Movers Report
async function getFastMovers(startDate: Date, endDate: Date) {
  // Calculate days in period
  const daysInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

  // Get sales data grouped by drug
  const drugSales = await db.saleItem.groupBy({
    by: ['drugId'],
    where: {
      createdAt: { gte: startDate, lte: endDate },
    },
    _sum: { quantity: true, subtotal: true },
    _count: { id: true },
  })

  // Calculate average daily sales and turnover
  const fastMovers = await Promise.all(
    drugSales.map(async (sale) => {
      const drug = await db.drug.findUnique({
        where: { id: sale.drugId },
        select: {
          name: true,
          ndc: true,
          stock: true,
          price: true,
          cost: true,
          reorderLevel: true,
          form: true,
        },
      })

      if (!drug) return null

      const totalQty = sale._sum.quantity || 0
      const dailyAvg = totalQty / daysInPeriod
      const turnoverRate = drug.stock > 0 ? totalQty / drug.stock : 0
      const daysOfStock = dailyAvg > 0 ? Math.ceil(drug.stock / dailyAvg) : Infinity

      return {
        drugId: sale.drugId,
        drugName: drug.name,
        ndc: drug.ndc,
        form: drug.form,
        currentStock: drug.stock,
        totalQuantitySold: totalQty,
        salesCount: sale._count,
        revenue: Number(sale._sum.subtotal || 0),
        dailyAverage: Math.round(dailyAvg * 100) / 100,
        turnoverRate: Math.round(turnoverRate * 100) / 100,
        daysOfStockRemaining: daysOfStock === Infinity ? 'N/A' : daysOfStock,
        recommendedReorder: dailyAvg > 0 ? Math.ceil(dailyAvg * 30) : drug.reorderLevel,
        movementCategory: turnoverRate > 2 ? 'FAST' : turnoverRate > 0.5 ? 'NORMAL' : 'SLOW',
      }
    })
  )

  // Filter and sort by turnover rate (fastest first)
  const sortedMovers = fastMovers
    .filter(Boolean)
    .sort((a, b) => (b?.turnoverRate || 0) - (a?.turnoverRate || 0))
    .slice(0, 50) // Top 50 fast movers

  return NextResponse.json({
    period: { start: startDate, end: endDate, days: daysInPeriod },
    fastMovers: sortedMovers,
    count: sortedMovers.length,
  })
}

// Slow Movers Report
async function getSlowMovers(startDate: Date, endDate: Date) {
  const daysInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

  // Get all active drugs
  const allDrugs = await db.drug.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      ndc: true,
      stock: true,
      price: true,
      cost: true,
      form: true,
      createdAt: true,
    },
  })

  // Get sales data
  const drugSales = await db.saleItem.groupBy({
    by: ['drugId'],
    where: {
      createdAt: { gte: startDate, lte: endDate },
    },
    _sum: { quantity: true },
    _count: { id: true },
  })

  // Create a map of sales by drug
  const salesMap = new Map(drugSales.map(s => [s.drugId, s]))

  // Calculate slow movers
  const slowMovers = allDrugs.map(drug => {
    const sales = salesMap.get(drug.id)
    const totalQty = sales?._sum.quantity || 0
    const dailyAvg = totalQty / daysInPeriod
    const turnoverRate = drug.stock > 0 ? totalQty / drug.stock : 0
    const stockValue = drug.stock * Number(drug.cost)
    const daysSinceCreated = Math.ceil((now.getTime() - drug.createdAt.getTime()) / (1000 * 60 * 60 * 24))

    return {
      drugId: drug.id,
      drugName: drug.name,
      ndc: drug.ndc,
      form: drug.form,
      currentStock: drug.stock,
      stockValue,
      totalQuantitySold: totalQty,
      salesCount: sales?._count || 0,
      dailyAverage: Math.round(dailyAvg * 100) / 100,
      turnoverRate: Math.round(turnoverRate * 100) / 100,
      daysSinceCreated,
      lastSaleDate: null, // Would need to query last sale
      movementCategory: turnoverRate < 0.5 ? 'SLOW' : turnoverRate < 2 ? 'NORMAL' : 'FAST',
      recommendation: turnoverRate < 0.1 && drug.stock > 0 ? 'Consider discounting or returning' : 
                     turnoverRate < 0.5 && drug.stock > drug.stock * 0.5 ? 'Monitor closely' : 'Normal',
    }
  })

  // Filter slow movers and sort by turnover rate (slowest first)
  const sortedSlowMovers = slowMovers
    .filter(d => d.turnoverRate < 0.5 || d.totalQuantitySold === 0)
    .sort((a, b) => a.turnoverRate - b.turnoverRate)

  // Calculate stuck inventory value
  const stuckValue = sortedSlowMovers.reduce((sum, d) => sum + d.stockValue, 0)

  return NextResponse.json({
    period: { start: startDate, end: endDate, days: daysInPeriod },
    slowMovers: sortedSlowMovers,
    count: sortedSlowMovers.length,
    stuckInventoryValue: stuckValue,
  })
}

// Inventory Valuation Report
async function getInventoryValuation() {
  // Get all inventory lots with remaining stock
  const lots = await db.inventoryLot.findMany({
    where: { quantityRemaining: { gt: 0 } },
    include: {
      drug: {
        select: { name: true, ndc: true, price: true, form: true },
      },
    },
    orderBy: { receivedDate: 'asc' },
  })

  // Get drugs without lots (use drug.cost as fallback)
  const drugsWithoutLots = await db.drug.findMany({
    where: {
      isActive: true,
      stock: { gt: 0 },
      inventoryLots: { none: { quantityRemaining: { gt: 0 } } },
    },
  })

  // Calculate valuations
  const lotValuations = lots.map(lot => ({
    lotId: lot.id,
    lotNumber: lot.lotNumber,
    drugId: lot.drugId,
    drugName: lot.drug.name,
    ndc: lot.drug.ndc,
    form: lot.drug.form,
    quantityRemaining: lot.quantityRemaining,
    unitCost: Number(lot.unitCost),
    totalCost: lot.quantityRemaining * Number(lot.unitCost),
    retailValue: lot.quantityRemaining * Number(lot.drug.price),
    margin: Number(lot.drug.price) - Number(lot.unitCost),
    marginPercent: ((Number(lot.drug.price) - Number(lot.unitCost)) / Number(lot.unitCost)) * 100,
    receivedDate: lot.receivedDate,
    expiryDate: lot.expiryDate,
  }))

  const drugsWithoutLotValuations = drugsWithoutLots.map(drug => ({
    drugId: drug.id,
    drugName: drug.name,
    ndc: drug.ndc,
    form: drug.form,
    quantityRemaining: drug.stock,
    unitCost: Number(drug.cost),
    totalCost: drug.stock * Number(drug.cost),
    retailValue: drug.stock * Number(drug.price),
    margin: Number(drug.price) - Number(drug.cost),
    marginPercent: ((Number(drug.price) - Number(drug.cost)) / Number(drug.cost)) * 100,
    note: 'Using average cost (no lot data)',
  }))

  const summary = {
    totalLots: lots.length,
    totalUnits: lots.reduce((sum, l) => sum + l.quantityRemaining, 0) +
                drugsWithoutLots.reduce((sum, d) => sum + d.stock, 0),
    totalCostValue: lotValuations.reduce((sum, l) => sum + l.totalCost, 0) +
                    drugsWithoutLotValuations.reduce((sum, d) => sum + d.totalCost, 0),
    totalRetailValue: lotValuations.reduce((sum, l) => sum + l.retailValue, 0) +
                      drugsWithoutLotValuations.reduce((sum, d) => sum + d.retailValue, 0),
    potentialProfit: lotValuations.reduce((sum, l) => sum + (l.retailValue - l.totalCost), 0) +
                     drugsWithoutLotValuations.reduce((sum, d) => sum + (d.retailValue - d.totalCost), 0),
  }

  return NextResponse.json({
    summary,
    lotValuations,
    drugsWithoutLots: drugsWithoutLotValuations,
  })
}

// Expiring Stock Report
async function getExpiringStock() {
  const now = new Date()
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const sixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
  const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

  // Get lots expiring within 90 days
  const expiringLots = await db.inventoryLot.findMany({
    where: {
      quantityRemaining: { gt: 0 },
      expiryDate: { lte: ninetyDays, gte: now },
    },
    include: {
      drug: { select: { name: true, ndc: true, price: true } },
    },
    orderBy: { expiryDate: 'asc' },
  })

  // Already expired
  const expiredLots = await db.inventoryLot.findMany({
    where: {
      quantityRemaining: { gt: 0 },
      expiryDate: { lt: now },
    },
    include: {
      drug: { select: { name: true, ndc: true, price: true } },
    },
    orderBy: { expiryDate: 'asc' },
  })

  const processLots = (lots: typeof expiringLots) => lots.map(lot => ({
    lotId: lot.id,
    lotNumber: lot.lotNumber,
    drugId: lot.drugId,
    drugName: lot.drug.name,
    ndc: lot.drug.ndc,
    quantityRemaining: lot.quantityRemaining,
    unitCost: Number(lot.unitCost),
    totalValue: lot.quantityRemaining * Number(lot.unitCost),
    retailValue: lot.quantityRemaining * Number(lot.drug.price),
    expiryDate: lot.expiryDate,
    daysUntilExpiry: lot.expiryDate ? Math.ceil((lot.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null,
  }))

  return NextResponse.json({
    expired: processLots(expiredLots),
    expiring30Days: processLots(expiringLots.filter(l => l.expiryDate && l.expiryDate <= thirtyDays)),
    expiring60Days: processLots(expiringLots.filter(l => l.expiryDate && l.expiryDate > thirtyDays && l.expiryDate <= sixtyDays)),
    expiring90Days: processLots(expiringLots.filter(l => l.expiryDate && l.expiryDate > sixtyDays && l.expiryDate <= ninetyDays)),
    summary: {
      expiredCount: expiredLots.length,
      expiredValue: expiredLots.reduce((sum, l) => sum + l.quantityRemaining * Number(l.unitCost), 0),
      expiring30Count: expiringLots.filter(l => l.expiryDate && l.expiryDate <= thirtyDays).length,
      expiring30Value: expiringLots
        .filter(l => l.expiryDate && l.expiryDate <= thirtyDays)
        .reduce((sum, l) => sum + l.quantityRemaining * Number(l.unitCost), 0),
    },
  })
}

// Low Stock Report
async function getLowStock() {
  const drugs = await db.drug.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      ndc: true,
      form: true,
      stock: true,
      reorderLevel: true,
      maxStock: true,
      price: true,
      cost: true,
      inventoryLots: {
        where: { quantityRemaining: { gt: 0 } },
        select: { quantityRemaining: true, expiryDate: true },
        orderBy: { expiryDate: 'asc' },
      },
    },
  })

  const lowStock = drugs
    .filter(d => d.stock <= d.reorderLevel)
    .map(d => ({
      drugId: d.id,
      drugName: d.name,
      ndc: d.ndc,
      form: d.form,
      currentStock: d.stock,
      reorderLevel: d.reorderLevel,
      maxStock: d.maxStock,
      stockStatus: d.stock === 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
      recommendedOrder: d.maxStock - d.stock,
      estimatedCost: (d.maxStock - d.stock) * Number(d.cost),
      nearestExpiry: d.inventoryLots[0]?.expiryDate || null,
    }))

  const outOfStock = lowStock.filter(d => d.stockStatus === 'OUT_OF_STOCK')
  const belowReorder = lowStock.filter(d => d.stockStatus === 'LOW_STOCK')

  return NextResponse.json({
    outOfStock,
    belowReorder,
    summary: {
      outOfStockCount: outOfStock.length,
      lowStockCount: belowReorder.length,
      totalToOrder: lowStock.reduce((sum, d) => sum + d.recommendedOrder, 0),
      estimatedOrderCost: lowStock.reduce((sum, d) => sum + d.estimatedCost, 0),
    },
  })
}

// Movement Analysis Report
async function getMovementAnalysis(startDate: Date, endDate: Date) {
  const daysInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

  // Get all inventory logs in period
  const logs = await db.inventoryLog.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate },
    },
    include: {
      drug: { select: { name: true, ndc: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Group by action type
  const byAction = logs.reduce((acc, log) => {
    if (!acc[log.type]) {
      acc[log.type] = { count: 0, totalQty: 0, logs: [] }
    }
    acc[log.type].count++
    acc[log.type].totalQty += log.quantity
    acc[log.type].logs.push({
      id: log.id,
      drugName: log.drug.name,
      ndc: log.drug.ndc,
      quantity: log.quantity,
      previousStock: log.previousStock,
      newStock: log.newStock,
      reason: log.reason,
      reference: log.reference,
      createdAt: log.createdAt,
    })
    return acc
  }, {} as Record<string, { count: number; totalQty: number; logs: any[] }>)

  // Daily movement summary
  const dailySummary = await db.inventoryLog.groupBy({
    by: ['type'],
    where: { createdAt: { gte: startDate, lte: endDate } },
    _sum: { quantity: true },
    _count: true,
  })

  // Top moved items
  const topMovedItems = await db.inventoryLog.groupBy({
    by: ['drugId'],
    where: { createdAt: { gte: startDate, lte: endDate } },
    _sum: { quantity: true },
    _count: true,
    orderBy: { _sum: { quantity: 'desc' } },
    take: 20,
  })

  const topMovedDetails = await Promise.all(
    topMovedItems.map(async (item) => {
      const drug = await db.drug.findUnique({
        where: { id: item.drugId },
        select: { name: true, ndc: true, stock: true },
      })
      return {
        ...item,
        drugName: drug?.name,
        ndc: drug?.ndc,
        currentStock: drug?.stock,
      }
    })
  )

  return NextResponse.json({
    period: { start: startDate, end: endDate, days: daysInPeriod },
    byActionType: byAction,
    summary: dailySummary,
    topMovedItems: topMovedDetails,
  })
}

const now = new Date()
