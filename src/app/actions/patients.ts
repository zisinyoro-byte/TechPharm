'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function getPatients(search?: string) {
  const where = search
    ? {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search } },
        ],
      }
    : {}

  return db.patient.findMany({
    where,
    include: {
      prescriptions: {
        include: { drug: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
    orderBy: { lastName: 'asc' },
  })
}

export async function getPatient(id: string) {
  return db.patient.findUnique({
    where: { id },
    include: {
      prescriptions: {
        include: { drug: true, prescriber: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
}

export async function createPatient(formData: FormData) {
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string
  const dob = new Date(formData.get('dob') as string)
  const phone = formData.get('phone') as string | null
  const email = formData.get('email') as string | null
  const address = formData.get('address') as string | null
  const city = formData.get('city') as string | null
  const state = formData.get('state') as string | null
  const zip = formData.get('zip') as string | null
  const gender = formData.get('gender') as string | null
  const allergiesStr = formData.get('allergies') as string | null
  const allergies = allergiesStr ? allergiesStr.split(',').map(a => a.trim()).filter(Boolean) : []

  const patient = await db.patient.create({
    data: {
      firstName,
      lastName,
      dob,
      phone,
      email,
      address,
      city,
      state,
      zip,
      gender,
      allergies,
    },
  })

  revalidatePath('/patients')
  return patient
}

export async function updatePatient(id: string, formData: FormData) {
  const allergiesStr = formData.get('allergies') as string | null
  const allergies = allergiesStr ? allergiesStr.split(',').map(a => a.trim()).filter(Boolean) : []

  const patient = await db.patient.update({
    where: { id },
    data: {
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      dob: new Date(formData.get('dob') as string),
      phone: formData.get('phone') as string | null,
      email: formData.get('email') as string | null,
      address: formData.get('address') as string | null,
      city: formData.get('city') as string | null,
      state: formData.get('state') as string | null,
      zip: formData.get('zip') as string | null,
      gender: formData.get('gender') as string | null,
      allergies,
    },
  })

  revalidatePath('/patients')
  return patient
}

export async function deletePatient(id: string) {
  await db.patient.delete({ where: { id } })
  revalidatePath('/patients')
}
