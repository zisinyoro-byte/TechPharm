import { db } from '@/lib/db'

/**
 * FIFO (First In, First Out) Inventory Costing System
 * 
 * This module implements FIFO costing for inventory management.
 * When inventory is sold, the cost is calculated based on the oldest
 * lots first, ensuring accurate cost of goods sold tracking.
 */

export interface FifoCostResult {
  totalCost: number
  lotUsages: {
    lotId: string
    quantityUsed: number
    unitCost: number
    totalCost: number
  }[]
}

/**
 * Get available inventory lots for a drug, ordered by received date (FIFO order)
 */
export async function getAvailableLots(drugId: string) {
  try {
    const lots = await db.inventoryLot.findMany({
      where: {
        drugId,
        quantityRemaining: { gt: 0 },
      },
      orderBy: {
        receivedDate: 'asc', // Oldest first (FIFO)
      },
    })
    return lots
  } catch (error) {
    // Table might not exist yet
    console.warn('InventoryLot table might not exist:', error)
    return []
  }
}

/**
 * Calculate FIFO cost for a given quantity of a drug
 * Returns the total cost and which lots would be used
 * Falls back to drug's cost if no lots are available
 */
export async function calculateFifoCost(drugId: string, quantity: number): Promise<FifoCostResult> {
  const lots = await getAvailableLots(drugId)
  
  // If no lots available, get the drug's cost as fallback
  if (lots.length === 0) {
    const drug = await db.drug.findUnique({
      where: { id: drugId },
      select: { cost: true, name: true },
    })
    
    if (drug) {
      const unitCost = Number(drug.cost) || 0
      return {
        totalCost: quantity * unitCost,
        lotUsages: [], // No lot usages when using fallback cost
      }
    }
    
    return { totalCost: 0, lotUsages: [] }
  }
  
  let remainingQuantity = quantity
  const lotUsages: FifoCostResult['lotUsages'] = []
  let totalCost = 0

  for (const lot of lots) {
    if (remainingQuantity <= 0) break

    const availableQty = lot.quantityRemaining
    const useQty = Math.min(availableQty, remainingQuantity)
    const unitCost = Number(lot.unitCost)
    const costForLot = useQty * unitCost

    lotUsages.push({
      lotId: lot.id,
      quantityUsed: useQty,
      unitCost,
      totalCost: costForLot,
    })

    totalCost += costForLot
    remainingQuantity -= useQty
  }

  // If we couldn't fulfill the entire quantity from lots, use drug cost for remaining
  if (remainingQuantity > 0) {
    const drug = await db.drug.findUnique({
      where: { id: drugId },
      select: { cost: true, name: true },
    })
    
    if (drug) {
      const unitCost = Number(drug.cost) || 0
      const additionalCost = remainingQuantity * unitCost
      totalCost += additionalCost
      console.warn(`Partial lot coverage for ${drug.name}. Used lots for ${quantity - remainingQuantity}, using drug cost for ${remainingQuantity}`)
    }
  }

  return {
    totalCost,
    lotUsages,
  }
}

/**
 * Consume inventory using FIFO costing
 * Updates lot quantities and creates lot usage records
 * Should be called within a transaction
 * Gracefully handles cases where lots don't exist
 */
export async function consumeInventoryFifo(
  drugId: string,
  quantity: number,
  saleItemId?: string,
  prescriptionId?: string,
  tx?: any
): Promise<FifoCostResult> {
  const prisma = tx || db
  const fifoResult = await calculateFifoCost(drugId, quantity)

  // Only process lot updates if we have lots
  for (const lotUsage of fifoResult.lotUsages) {
    try {
      // Update lot remaining quantity
      await prisma.inventoryLot.update({
        where: { id: lotUsage.lotId },
        data: {
          quantityRemaining: { decrement: lotUsage.quantityUsed },
          updatedAt: new Date(),
        },
      })

      // Create lot usage record
      await prisma.inventoryLotUsage.create({
        data: {
          lotId: lotUsage.lotId,
          quantityUsed: lotUsage.quantityUsed,
          unitCost: lotUsage.unitCost,
          totalCost: lotUsage.totalCost,
          usedAt: new Date(),
          saleItemId,
          prescriptionId,
        },
      })
    } catch (error) {
      // Log but don't fail - inventory tracking is secondary to sale completion
      console.warn('Failed to update inventory lot:', error)
    }
  }

  return fifoResult
}

/**
 * Receive inventory into a new lot
 */
export async function receiveInventoryLot(params: {
  drugId: string
  lotNumber?: string
  quantity: number
  unitCost: number
  expiryDate?: Date
  receivedById?: string
  reference?: string
  notes?: string
  tx?: any
}) {
  const prisma = params.tx || db

  try {
    // Create the lot
    const lot = await prisma.inventoryLot.create({
      data: {
        drugId: params.drugId,
        lotNumber: params.lotNumber,
        quantityReceived: params.quantity,
        quantityRemaining: params.quantity,
        unitCost: params.unitCost,
        expiryDate: params.expiryDate,
        receivedById: params.receivedById,
        reference: params.reference,
        notes: params.notes,
      },
    })

    // Update drug stock and average cost
    const drug = await prisma.drug.findUnique({
      where: { id: params.drugId },
      include: {
        inventoryLots: {
          where: { quantityRemaining: { gt: 0 } },
        },
      },
    })

    if (drug) {
      // Calculate weighted average cost
      const totalValue = drug.inventoryLots.reduce(
        (sum, lot) => sum + Number(lot.unitCost) * lot.quantityRemaining,
        0
      )
      const totalQty = drug.inventoryLots.reduce(
        (sum, lot) => sum + lot.quantityRemaining,
        0
      )
      const avgCost = totalQty > 0 ? totalValue / totalQty : 0

      await prisma.drug.update({
        where: { id: params.drugId },
        data: {
          stock: { increment: params.quantity },
          cost: avgCost,
          updatedAt: new Date(),
        },
      })
    }

    return lot
  } catch (error) {
    console.error('Failed to create inventory lot:', error)
    // Still update drug stock even if lot creation fails
    await prisma.drug.update({
      where: { id: params.drugId },
      data: {
        stock: { increment: params.quantity },
        updatedAt: new Date(),
      },
    })
    return null
  }
}

/**
 * Get inventory valuation at FIFO cost
 */
export async function getInventoryValuation(drugId?: string) {
  const whereClause = drugId ? { drugId } : {}
  
  try {
    const lots = await db.inventoryLot.findMany({
      where: {
        ...whereClause,
        quantityRemaining: { gt: 0 },
      },
      include: {
        drug: {
          select: {
            id: true,
            name: true,
            ndc: true,
            stock: true,
            price: true,
          },
        },
      },
      orderBy: {
        receivedDate: 'asc',
      },
    })

    const valuation = lots.map(lot => ({
      lotId: lot.id,
      drugId: lot.drugId,
      drugName: lot.drug.name,
      ndc: lot.drug.ndc,
      lotNumber: lot.lotNumber,
      quantityRemaining: lot.quantityRemaining,
      unitCost: Number(lot.unitCost),
      totalValue: lot.quantityRemaining * Number(lot.unitCost),
      retailValue: lot.quantityRemaining * Number(lot.drug.price),
      expiryDate: lot.expiryDate,
      receivedDate: lot.receivedDate,
    }))

    const summary = {
      totalUnits: valuation.reduce((sum, lot) => sum + lot.quantityRemaining, 0),
      totalCostValue: valuation.reduce((sum, lot) => sum + lot.totalValue, 0),
      totalRetailValue: valuation.reduce((sum, lot) => sum + lot.retailValue, 0),
      potentialProfit: valuation.reduce((sum, lot) => sum + (lot.retailValue - lot.totalValue), 0),
    }

    return { lots: valuation, summary }
  } catch (error) {
    console.warn('Failed to get inventory valuation:', error)
    return { lots: [], summary: { totalUnits: 0, totalCostValue: 0, totalRetailValue: 0, potentialProfit: 0 } }
  }
}

/**
 * Check for expiring lots
 */
export async function getExpiringLots(daysThreshold: number = 90) {
  const thresholdDate = new Date()
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold)

  try {
    const lots = await db.inventoryLot.findMany({
      where: {
        quantityRemaining: { gt: 0 },
        expiryDate: {
          lte: thresholdDate,
          gte: new Date(),
        },
      },
      include: {
        drug: {
          select: {
            id: true,
            name: true,
            ndc: true,
          },
        },
      },
      orderBy: {
        expiryDate: 'asc',
      },
    })

    return lots.map(lot => ({
      lotId: lot.id,
      drugId: lot.drugId,
      drugName: lot.drug.name,
      ndc: lot.drug.ndc,
      lotNumber: lot.lotNumber,
      quantityRemaining: lot.quantityRemaining,
      unitCost: Number(lot.unitCost),
      expiryDate: lot.expiryDate,
      daysUntilExpiry: lot.expiryDate ? Math.ceil((lot.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null,
    }))
  } catch (error) {
    console.warn('Failed to get expiring lots:', error)
    return []
  }
}
