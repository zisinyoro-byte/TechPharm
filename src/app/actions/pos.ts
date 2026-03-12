'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { PaymentMethod, PaymentStatus } from '@prisma/client'

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

// Create sale
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
  // Calculate totals
  let subtotal = 0
  const saleItems = []

  for (const item of data.items) {
    const drug = await db.drug.findUnique({ where: { id: item.drugId } })
    if (!drug) throw new Error(`Drug not found: ${item.drugId}`)
    
    if (drug.stock < item.quantity) {
      throw new Error(`Insufficient stock for ${drug.name}. Available: ${drug.stock}`)
    }

    const itemSubtotal = item.unitPrice * item.quantity - (item.discount || 0)
    subtotal += itemSubtotal

    saleItems.push({
      drugId: item.drugId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount || 0,
      subtotal: itemSubtotal,
      prescriptionId: item.prescriptionId,
    })
  }

  const tax = 0 // Pharmacy items typically tax-exempt
  const total = subtotal + tax
  const change = Math.max(0, data.amountPaid - total)

  // Generate invoice number
  const invoiceNumber = await generateInvoiceNumber()

  // Create sale and update inventory
  const sale = await db.$transaction(async (tx) => {
    // Create sale
    const newSale = await tx.sale.create({
      data: {
        invoiceNumber,
        subtotal,
        tax,
        total,
        paymentMethod: data.paymentMethod,
        paymentStatus: data.amountPaid >= total ? PaymentStatus.PAID : PaymentStatus.PARTIAL,
        amountPaid: data.amountPaid,
        change,
        notes: data.notes,
        patientId: data.patientId,
        cashierId: data.cashierId,
        items: {
          create: saleItems,
        },
      },
      include: {
        items: { include: { drug: true } },
        patient: true,
      },
    })

    // Update inventory for each item
    for (const item of data.items) {
      const drug = await tx.drug.findUnique({ where: { id: item.drugId } })
      if (!drug) continue

      await tx.drug.update({
        where: { id: item.drugId },
        data: { stock: drug.stock - item.quantity },
      })

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
    include: { items: true },
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

    // Return items to inventory
    for (const item of sale.items) {
      const drug = await tx.drug.findUnique({ where: { id: item.drugId } })
      if (!drug) continue

      await tx.drug.update({
        where: { id: item.drugId },
        data: { stock: drug.stock + item.quantity },
      })

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
    select: { total: true, paymentMethod: true },
  })

  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total), 0)
  const cashSales = sales.filter(s => s.paymentMethod === PaymentMethod.CASH).length
  const cardSales = sales.filter(s => s.paymentMethod === PaymentMethod.CARD).length

  return {
    count: sales.length,
    revenue: totalRevenue,
    cashSales,
    cardSales,
  }
}
