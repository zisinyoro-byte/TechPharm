import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Dashboard statistics
export async function GET() {
  try {
    // Get total counts
    const [
      totalPatients,
      totalDrugs,
      totalPrescriptions,
      totalPrescribers,
    ] = await Promise.all([
      db.patient.count(),
      db.drug.count({ where: { isActive: true } }),
      db.prescription.count(),
      db.prescriber.count({ where: { active: true } }),
    ]);

    // Get prescriptions by status
    const prescriptionsByStatus = await db.prescription.groupBy({
      by: ['status'],
      _count: true,
    });

    // Get low stock drugs
    const allDrugs = await db.drug.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        strength: true,
        stock: true,
        reorderLevel: true,
        form: true,
        price: true,
      },
    });

    const lowStockDrugs = allDrugs.filter(
      (drug) => drug.stock <= drug.reorderLevel
    );

    // Get recent prescriptions
    const recentPrescriptions = await db.prescription.findMany({
      include: {
        patient: true,
        drug: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Get prescriptions created today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const prescriptionsToday = await db.prescription.count({
      where: {
        createdAt: {
          gte: today,
        },
      },
    });

    // Get completed prescriptions today
    const completedToday = await db.prescription.count({
      where: {
        status: 'COMPLETE',
        filledDate: {
          gte: today,
        },
      },
    });

    // Calculate inventory value
    const inventoryValue = allDrugs.reduce(
      (total, drug) => total + drug.stock * Number(drug.price || 0),
      0
    );

    // Get last 7 days prescription counts for chart
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const count = await db.prescription.count({
        where: {
          createdAt: {
            gte: date,
            lt: nextDate,
          },
        },
      });
      
      last7Days.push({
        date: date.toISOString().split('T')[0],
        count,
      });
    }

    // Get top 10 dispensed drugs
    const completedPrescriptions = await db.prescription.findMany({
      where: { status: 'COMPLETE' },
      include: { drug: true },
    });

    const drugCounts: Record<string, { name: string; count: number }> = {};
    completedPrescriptions.forEach((rx) => {
      if (rx.drug) {
        if (!drugCounts[rx.drugId]) {
          drugCounts[rx.drugId] = {
            name: rx.drug.name,
            count: 0,
          };
        }
        drugCounts[rx.drugId].count++;
      }
    });

    const topDrugs = Object.values(drugCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return NextResponse.json({
      totalPatients,
      totalDrugs,
      totalPrescriptions,
      totalPrescribers,
      prescriptionsByStatus,
      lowStockDrugs,
      recentPrescriptions,
      prescriptionsToday,
      completedToday,
      inventoryValue,
      last7Days,
      topDrugs,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
