'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { RxStatus } from '@prisma/client'

export async function getPrescriptions(status?: RxStatus) {
  const where = status ? { status } : { NOT: { status: RxStatus.COMPLETE } }

  return db.prescription.findMany({
    where,
    include: {
      patient: true,
      drug: true,
      prescriber: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getPrescription(id: string) {
  return db.prescription.findUnique({
    where: { id },
    include: {
      patient: true,
      drug: true,
      prescriber: true,
    },
  })
}

export async function createPrescription(formData: FormData) {
  const patientId = formData.get('patientId') as string
  const drugId = formData.get('drugId') as string
  const prescriberId = formData.get('prescriberId') as string | null
  const quantity = parseFloat(formData.get('quantity') as string)
  const daysSupply = parseInt(formData.get('daysSupply') as string) || 30
  const directions = formData.get('directions') as string
  const refills = parseInt(formData.get('refills') as string) || 0

  // Get current count for RX number
  const count = await db.prescription.count()
  const rxNumber = `RX${(count + 100001).toString().slice(-6)}`

  const prescription = await db.prescription.create({
    data: {
      rxNumber,
      patientId,
      drugId,
      prescriberId: prescriberId || null,
      quantity,
      daysSupply,
      directions,
      refills,
      refillsRemaining: refills,
      status: RxStatus.QUEUE,
    },
    include: {
      patient: true,
      drug: true,
    },
  })

  revalidatePath('/')
  revalidatePath('/prescriptions')
  return prescription
}

export async function updatePrescriptionStatus(rxNumber: string, newStatus: RxStatus) {
  const updateData: any = { status: newStatus }
  
  if (newStatus === RxStatus.COMPLETE) {
    updateData.filledDate = new Date()
    updateData.dispensed = true
  }

  const prescription = await db.prescription.update({
    where: { rxNumber },
    data: updateData,
    include: { drug: true },
  })

  // Update inventory when complete
  if (newStatus === RxStatus.COMPLETE && prescription.drug) {
    const drug = await db.drug.findUnique({ where: { id: prescription.drugId } })
    if (drug) {
      await db.drug.update({
        where: { id: prescription.drugId },
        data: { stock: Math.max(0, drug.stock - Number(prescription.quantity)) },
      })
      await db.inventoryLog.create({
        data: {
          drugId: prescription.drugId,
          type: 'DISPENSE',
          quantity: Number(prescription.quantity),
          previousStock: drug.stock,
          newStock: Math.max(0, drug.stock - Number(prescription.quantity)),
          reference: rxNumber,
        },
      })
    }
  }

  revalidatePath('/')
  revalidatePath('/prescriptions')
  return prescription
}

export async function updatePrescription(id: string, formData: FormData) {
  const prescription = await db.prescription.update({
    where: { id },
    data: {
      quantity: parseFloat(formData.get('quantity') as string),
      daysSupply: parseInt(formData.get('daysSupply') as string) || 30,
      directions: formData.get('directions') as string,
      refills: parseInt(formData.get('refills') as string) || 0,
    },
  })

  revalidatePath('/')
  revalidatePath('/prescriptions')
  return prescription
}

export async function deletePrescription(id: string) {
  await db.prescription.delete({ where: { id } })
  revalidatePath('/')
  revalidatePath('/prescriptions')
}

export async function getPrescriptionsByPatient(patientId: string) {
  return db.prescription.findMany({
    where: { patientId },
    include: { drug: true, prescriber: true },
    orderBy: { createdAt: 'desc' },
  })
}

export async function searchDrugs(query: string) {
  return db.drug.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { genericName: { contains: query, mode: 'insensitive' } },
        { ndc: { contains: query } },
      ],
    },
    take: 10,
  })
}

export async function searchPatients(query: string) {
  return db.patient.findMany({
    where: {
      OR: [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query } },
      ],
    },
    take: 10,
  })
}
