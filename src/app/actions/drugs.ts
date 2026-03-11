'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { InventoryAction } from '@prisma/client'

export async function getDrugs(search?: string, lowStock = false) {
  const where: any = {}

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { genericName: { contains: search, mode: 'insensitive' } },
      { ndc: { contains: search } },
    ]
  }

  if (lowStock) {
    // Get drugs where stock <= reorderLevel
    const allDrugs = await db.drug.findMany({ where: { isActive: true } })
    return allDrugs.filter(d => d.stock <= d.reorderLevel)
  }

  return db.drug.findMany({
    where: { isActive: true, ...where },
    orderBy: { name: 'asc' },
  })
}

export async function getDrug(id: string) {
  return db.drug.findUnique({
    where: { id },
    include: {
      inventoryLogs: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  })
}

export async function createDrug(formData: FormData) {
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
    },
  })

  revalidatePath('/inventory')
  return drug
}

export async function updateDrug(id: string, formData: FormData) {
  const drug = await db.drug.update({
    where: { id },
    data: {
      ndc: formData.get('ndc') as string,
      name: formData.get('name') as string,
      genericName: formData.get('genericName') as string | null,
      strength: formData.get('strength') as string,
      form: formData.get('form') as string,
      manufacturer: formData.get('manufacturer') as string | null,
      price: parseFloat(formData.get('price') as string) || 0,
      cost: parseFloat(formData.get('cost') as string) || 0,
      reorderLevel: parseInt(formData.get('reorderLevel') as string) || 10,
      maxStock: parseInt(formData.get('maxStock') as string) || 100,
      controlled: formData.get('controlled') === 'true',
      schedule: formData.get('schedule') as string | null,
    },
  })

  revalidatePath('/inventory')
  return drug
}

export async function adjustStock(drugId: string, quantity: number, type: InventoryAction, reason?: string, reference?: string) {
  const drug = await db.drug.findUnique({ where: { id: drugId } })
  if (!drug) throw new Error('Drug not found')

  const previousStock = drug.stock
  let newStock = previousStock

  switch (type) {
    case 'RECEIVE':
      newStock = previousStock + quantity
      break
    case 'DISPENSE':
    case 'RETURN':
    case 'EXPIRED':
    case 'DAMAGE':
      newStock = Math.max(0, previousStock - quantity)
      break
    case 'ADJUSTMENT':
      newStock = quantity // Direct adjustment
      break
  }

  await db.$transaction([
    db.drug.update({
      where: { id: drugId },
      data: { stock: newStock },
    }),
    db.inventoryLog.create({
      data: {
        drugId,
        type,
        quantity,
        previousStock,
        newStock,
        reason,
        reference,
      },
    }),
  ])

  revalidatePath('/inventory')
}

export async function getLowStockDrugs() {
  const drugs = await db.drug.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  })
  return drugs.filter(d => d.stock <= d.reorderLevel)
}

export async function getInventoryStats() {
  const drugs = await db.drug.findMany({ where: { isActive: true } })
  
  const totalItems = drugs.reduce((sum, d) => sum + d.stock, 0)
  const totalValue = drugs.reduce((sum, d) => sum + (Number(d.price) * d.stock), 0)
  const lowStockCount = drugs.filter(d => d.stock <= d.reorderLevel).length
  const outOfStockCount = drugs.filter(d => d.stock === 0).length

  return {
    totalDrugs: drugs.length,
    totalItems,
    totalValue,
    lowStockCount,
    outOfStockCount,
  }
}
