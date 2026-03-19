'use server'

import { db } from '@/lib/db'
import { RxStatus } from '@prisma/client'

export async function getDashboardStats() {
  const [
    totalPatients,
    totalDrugs,
    pendingPrescriptions,
    completedToday,
    lowStockDrugs,
  ] = await Promise.all([
    db.patient.count(),
    db.drug.count({ where: { isActive: true } }),
    db.prescription.count({
      where: { NOT: { status: RxStatus.COMPLETE } },
    }),
    db.prescription.count({
      where: {
        status: RxStatus.COMPLETE,
        filledDate: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
    db.drug.findMany({
      where: { isActive: true },
    }),
  ])

  const lowStockCount = lowStockDrugs.filter(d => d.stock <= d.reorderLevel && d.stock > 0).length
  const outOfStockCount = lowStockDrugs.filter(d => d.stock === 0).length

  return {
    totalPatients,
    totalDrugs,
    pendingPrescriptions,
    completedToday,
    lowStockCount,
    outOfStockCount,
  }
}

export async function getWorkflowQueues() {
  const prescriptions = await db.prescription.findMany({
    where: { NOT: { status: RxStatus.COMPLETE } },
    include: {
      patient: true,
      drug: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  return {
    queue: prescriptions.filter(p => p.status === RxStatus.QUEUE),
    entry: prescriptions.filter(p => p.status === RxStatus.ENTRY),
    fill: prescriptions.filter(p => p.status === RxStatus.FILL),
    verify: prescriptions.filter(p => p.status === RxStatus.VERIFY),
  }
}

export async function getRecentActivity() {
  const [recentPrescriptions, recentPatients] = await Promise.all([
    db.prescription.findMany({
      take: 5,
      include: { patient: true, drug: true },
      orderBy: { createdAt: 'desc' },
    }),
    db.patient.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return { recentPrescriptions, recentPatients }
}

export async function getWeeklyStats() {
  const today = new Date()
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

  const prescriptions = await db.prescription.findMany({
    where: {
      createdAt: { gte: weekAgo },
    },
    select: {
      createdAt: true,
      status: true,
    },
  })

  // Group by day
  const dailyStats: Record<string, { total: number; completed: number }> = {}
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
    const key = date.toISOString().split('T')[0]
    dailyStats[key] = { total: 0, completed: 0 }
  }

  prescriptions.forEach(p => {
    const key = p.createdAt.toISOString().split('T')[0]
    if (dailyStats[key]) {
      dailyStats[key].total++
      if (p.status === RxStatus.COMPLETE) {
        dailyStats[key].completed++
      }
    }
  })

  return Object.entries(dailyStats)
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function getTopDrugs(limit = 10) {
  const prescriptions = await db.prescription.findMany({
    where: { status: RxStatus.COMPLETE },
    include: { drug: true },
  })

  const drugCounts: Record<string, { name: string; count: number }> = {}

  prescriptions.forEach(p => {
    const drugId = p.drugId
    if (!drugCounts[drugId]) {
      drugCounts[drugId] = { name: p.drug?.name || 'Unknown', count: 0 }
    }
    drugCounts[drugId].count++
  })

  return Object.values(drugCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}
