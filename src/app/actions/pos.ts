'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { PaymentMethod, PaymentStatus } from '@prisma/client'
import { calculateFifoCost, consumeInventoryFifo } from '@/lib/fifo'
import { getSettings } from '@/lib/settings'

// Get all sales
export async function getSales(limit = 50) {
  return db.sale.findMany({
    include: {
      patient: true,
      cashier: true,
      items: {
        include: { drug: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

// Get sale by ID
export async function getSale(id: string) {
  return db.sale.findUnique({
    where: { id },
    include: {
      patient: true,
      cashier: true,
      items: {
        include: { drug: true },
      },
    },
  })
}

// Get sale by invoice number
export async function getSaleByInvoice(invoiceNumber: string) {
  return db.sale.findUnique({
    where: { invoiceNumber },
    include: {
      patient: true,
      cashier: true,
      items: {
        include: { drug: true },
      },
    },
  })
}

// Generate invoice number
async function generateInvoiceNumber(): Promise<string> {
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
  
  // Count today's sales
  const startOfDay = new Date(today.setHours(0, 0, 0, 0))
  const endOfDay = new Date(today.setHours(23, 59, 59, 999))
  
  const count = await db.sale.count({
    where: {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  })

  return `INV-${dateStr}-${(count + 1).toString().padStart(4, '0')}`
}

// Create sale with FIFO costing
export async function createSale(data: {
  patientId?: string
  items: Array<{
    drugId: string
    quantity: number
    unitPrice: number
    discount?: number
    prescriptionId?: string
  }>
  paymentMethod: PaymentMethod
  amountPaid: number
  notes?: string
  cashierId: string
}) {
  // Get VAT settings
  const settings = await getSettings()
  const vatEnabled = settings['vat_enabled'] === 'true'
  const vatPercentage = parseFloat(settings['vat_percentage'] || '0')

  // Calculate totals and FIFO costs
  let subtotal = 0
  let totalCostOfGoods = 0
  const saleItems = []

  for (const item of data.items) {
    const drug = await db.drug.findUnique({ where: { id: item.drugId } })
    if (!drug) throw new Error(`Drug not found: ${item.drugId}`)
    
    if (drug.stock < item.quantity) {
      throw new Error(`Insufficient stock for ${drug.name}. Available: ${drug.stock}`)
    }

    // Calculate FIFO cost for this item
    const fifoResult = await calculateFifoCost(item.drugId, item.quantity)
    const itemCost = fifoResult.totalCost
    totalCostOfGoods += itemCost

    const itemSubtotal = item.unitPrice * item.quantity - (item.discount || 0)
    subtotal += itemSubtotal

    saleItems.push({
      drugId: item.drugId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unitCost: fifoResult.lotUsages.length > 0 ? fifoResult.lotUsages[0].unitCost : Number(drug.cost),
      totalCost: itemCost,
      discount: item.discount || 0,
      subtotal: itemSubtotal,
      prescriptionId: item.prescriptionId,
      lotUsages: fifoResult.lotUsages,
    })
  }

  // Calculate VAT for eligible items
  let vatAmount = 0
  if (vatEnabled && vatPercentage > 0) {
    for (const item of data.items) {
      const drug = await db.drug.findUnique({ where: { id: item.drugId } })
      if (drug?.vatEligible) {
        const itemSubtotal = item.unitPrice * item.quantity - (item.discount || 0)
        vatAmount += Math.round(itemSubtotal * vatPercentage) / 100
      }
    }
  }

  const total = subtotal + vatAmount
  const change = Math.max(0, data.amountPaid - total)
  const grossProfit = subtotal - totalCostOfGoods

  // Generate invoice number
  const invoiceNumber = await generateInvoiceNumber()

  // Create sale and update inventory in a transaction
  const sale = await db.$transaction(async (tx) => {
    // Create sale
    const newSale = await tx.sale.create({
      data: {
        invoiceNumber,
        subtotal,
        tax: vatAmount,
        total,
        paymentMethod: data.paymentMethod,
        paymentStatus: data.amountPaid >= total ? PaymentStatus.PAID : PaymentStatus.PARTIAL,
        amountPaid: data.amountPaid,
        change,
        notes: data.notes,
        costOfGoodsSold: totalCostOfGoods,
        grossProfit,
        patientId: data.patientId,
        cashierId: data.cashierId,
        items: {
          create: saleItems.map(item => ({
            drugId: item.drugId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unitCost: item.unitCost,
            totalCost: item.totalCost,
            discount: item.discount,
            subtotal: item.subtotal,
            prescriptionId: item.prescriptionId,
          })),
        },
      },
      include: {
        items: { include: { drug: true } },
        patient: true,
      },
    })

    // Update inventory using FIFO and create lot usage records
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i]
      const saleItem = newSale.items[i]
      const drug = await tx.drug.findUnique({ where: { id: item.drugId } })
      if (!drug) continue

      // Consume inventory using FIFO (handles missing lots gracefully)
      try {
        await consumeInventoryFifo(
          item.drugId,
          item.quantity,
          saleItem.id,
          item.prescriptionId,
          tx
        )
      } catch (error) {
        console.warn('FIFO consumption failed, continuing with sale:', error)
      }

      // Create inventory log
      try {
        await tx.inventoryLog.create({
          data: {
            drugId: item.drugId,
            type: 'SALE',
            quantity: item.quantity,
            previousStock: drug.stock,
            newStock: drug.stock - item.quantity,
            reference: invoiceNumber,
          },
        })
      } catch (error) {
        console.warn('Failed to create inventory log:', error)
      }

      // Update drug movement stats
      try {
        await tx.drugMovementStats.upsert({
          where: { drugId: item.drugId },
          create: {
            drugId: item.drugId,
            dailySalesCount: 1,
            dailyQuantitySold: item.quantity,
            dailyRevenue: item.subtotal,
            weeklySalesCount: 1,
            weeklyQuantitySold: item.quantity,
            weeklyRevenue: item.subtotal,
            monthlySalesCount: 1,
            monthlyQuantitySold: item.quantity,
            monthlyRevenue: item.subtotal,
            lastSaleDate: new Date(),
          },
          update: {
            dailySalesCount: { increment: 1 },
            dailyQuantitySold: { increment: item.quantity },
            dailyRevenue: { increment: item.subtotal },
            weeklySalesCount: { increment: 1 },
            weeklyQuantitySold: { increment: item.quantity },
            weeklyRevenue: { increment: item.subtotal },
            monthlySalesCount: { increment: 1 },
            monthlyQuantitySold: { increment: item.quantity },
            monthlyRevenue: { increment: item.subtotal },
            lastSaleDate: new Date(),
          },
        })
      } catch (error) {
        console.warn('Failed to update drug movement stats:', error)
      }
    }

    // Create cash transaction if cash payment
    if (data.paymentMethod === 'CASH') {
      try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        // Get or create today's cash record
        let cashRecord = await tx.dailyCashRecord.findUnique({
          where: { date: today },
        })

        if (!cashRecord) {
          cashRecord = await tx.dailyCashRecord.create({
            data: {
              date: today,
              status: 'OPEN',
              openingCash: 0,
            },
          })
        }

        await tx.cashTransaction.create({
          data: {
            dailyCashId: cashRecord.id,
            type: 'SALE_CASH',
            amount: total,
            description: `Sale ${invoiceNumber}`,
            reference: invoiceNumber,
            category: 'sales',
            saleId: newSale.id,
            recordedById: data.cashierId,
          },
        })
      } catch (error) {
        console.warn('Failed to create cash transaction:', error)
      }
    }

    return newSale
  })

  revalidatePath('/pos')
  revalidatePath('/')
  return sale
}

// Refund sale
export async function refundSale(id: string) {
  const sale = await db.sale.findUnique({
    where: { id },
    include: { items: { include: { lotUsages: true } } },
  })

  if (!sale) throw new Error('Sale not found')
  if (sale.paymentStatus === PaymentStatus.REFUNDED) {
    throw new Error('Sale already refunded')
  }

  await db.$transaction(async (tx) => {
    // Update sale status
    await tx.sale.update({
      where: { id },
      data: { paymentStatus: PaymentStatus.REFUNDED },
    })

    // Return items to inventory lots (reverse FIFO)
    for (const item of sale.items) {
      // Reverse lot usages
      for (const lotUsage of item.lotUsages) {
        try {
          await tx.inventoryLot.update({
            where: { id: lotUsage.lotId },
            data: { quantityRemaining: { increment: lotUsage.quantityUsed } },
          })
          
          await tx.inventoryLotUsage.delete({
            where: { id: lotUsage.id },
          })
        } catch (error) {
          console.warn('Failed to reverse lot usage:', error)
        }
      }

      // Update drug stock
      const drug = await tx.drug.findUnique({ where: { id: item.drugId } })
      if (drug) {
        await tx.drug.update({
          where: { id: item.drugId },
          data: { stock: drug.stock + item.quantity },
        })

        try {
          await tx.inventoryLog.create({
            data: {
              drugId: item.drugId,
              type: 'RETURN',
              quantity: item.quantity,
              previousStock: drug.stock,
              newStock: drug.stock + item.quantity,
              reference: `REFUND-${sale.invoiceNumber}`,
            },
          })
        } catch (error) {
          console.warn('Failed to create inventory log for refund:', error)
        }
      }
    }

    // Create refund cash transaction if it was cash
    if (sale.paymentMethod === 'CASH') {
      try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        const cashRecord = await tx.dailyCashRecord.findUnique({
          where: { date: today },
        })

        if (cashRecord) {
          await tx.cashTransaction.create({
            data: {
              dailyCashId: cashRecord.id,
              type: 'REFUND',
              amount: Number(sale.total),
              description: `Refund for ${sale.invoiceNumber}`,
              reference: `REFUND-${sale.invoiceNumber}`,
              category: 'refund',
              saleId: sale.id,
              recordedById: sale.cashierId,
            },
          })
        }
      } catch (error) {
        console.warn('Failed to create refund cash transaction:', error)
      }
    }
  })

  revalidatePath('/pos')
  revalidatePath('/')
  return { success: true }
}

// Get today's sales stats
export async function getTodaySalesStats() {
  const today = new Date()
  const startOfDay = new Date(today.setHours(0, 0, 0, 0))
  const endOfDay = new Date(today.setHours(23, 59, 59, 999))

  const sales = await db.sale.findMany({
    where: {
      createdAt: { gte: startOfDay, lte: endOfDay },
      paymentStatus: { not: PaymentStatus.REFUNDED },
    },
    select: { total: true, paymentMethod: true, costOfGoodsSold: true, grossProfit: true },
  })

  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total), 0)
  const totalCOGS = sales.reduce((sum, s) => sum + Number(s.costOfGoodsSold), 0)
  const totalProfit = sales.reduce((sum, s) => sum + Number(s.grossProfit), 0)
  const cashSales = sales.filter(s => s.paymentMethod === PaymentMethod.CASH).length
  const cardSales = sales.filter(s => s.paymentMethod === PaymentMethod.CARD).length

  return {
    count: sales.length,
    revenue: totalRevenue,
    costOfGoodsSold: totalCOGS,
    grossProfit: totalProfit,
    cashSales,
    cardSales,
  }
}
