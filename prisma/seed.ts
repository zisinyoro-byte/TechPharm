import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env from the project root
config({ path: resolve(__dirname, '../.env') })

console.log('DATABASE_URL loaded:', process.env.DATABASE_URL?.substring(0, 50) + '...')

import { PrismaClient, Role, RxStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Create Users
  const pharmacist = await prisma.user.upsert({
    where: { email: 'pharmacist@techpharm.com' },
    update: {},
    create: {
      email: 'pharmacist@techpharm.com',
      name: 'Dr. Sarah Johnson',
      role: Role.PHARMACIST,
      phone: '555-0101',
    },
  })

  const technician = await prisma.user.upsert({
    where: { email: 'tech@techpharm.com' },
    update: {},
    create: {
      email: 'tech@techpharm.com',
      name: 'Mike Chen',
      role: Role.TECHNICIAN,
      phone: '555-0102',
    },
  })

  console.log('✅ Created users')

  // Create Sample Patients
  const patients = await Promise.all([
    prisma.patient.upsert({
      where: { id: 'patient-1' },
      update: {},
      create: {
        id: 'patient-1',
        firstName: 'John',
        lastName: 'Smith',
        dob: new Date('1985-03-15'),
        gender: 'M',
        phone: '555-1001',
        email: 'john.smith@email.com',
        address: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zip: '62701',
        allergies: ['Penicillin'],
      },
    }),
    prisma.patient.upsert({
      where: { id: 'patient-2' },
      update: {},
      create: {
        id: 'patient-2',
        firstName: 'Mary',
        lastName: 'Johnson',
        dob: new Date('1972-07-22'),
        gender: 'F',
        phone: '555-1002',
        email: 'mary.j@email.com',
        address: '456 Oak Ave',
        city: 'Springfield',
        state: 'IL',
        zip: '62702',
        allergies: ['Sulfa', 'Aspirin'],
      },
    }),
    prisma.patient.upsert({
      where: { id: 'patient-3' },
      update: {},
      create: {
        id: 'patient-3',
        firstName: 'Robert',
        lastName: 'Williams',
        dob: new Date('1990-11-08'),
        gender: 'M',
        phone: '555-1003',
        allergies: [],
      },
    }),
    prisma.patient.upsert({
      where: { id: 'patient-4' },
      update: {},
      create: {
        id: 'patient-4',
        firstName: 'Emily',
        lastName: 'Davis',
        dob: new Date('1968-01-30'),
        gender: 'F',
        phone: '555-1004',
        allergies: ['Codeine'],
      },
    }),
    prisma.patient.upsert({
      where: { id: 'patient-5' },
      update: {},
      create: {
        id: 'patient-5',
        firstName: 'James',
        lastName: 'Brown',
        dob: new Date('1955-09-12'),
        gender: 'M',
        phone: '555-1005',
        allergies: ['Latex', 'Iodine'],
      },
    }),
  ])

  console.log(`✅ Created ${patients.length} patients`)

  // Create Sample Drugs
  const drugs = await Promise.all([
    prisma.drug.upsert({
      where: { ndc: '00093-7180-01' },
      update: {},
      create: {
        ndc: '00093-7180-01',
        name: 'Lisinopril',
        genericName: 'Lisinopril',
        strength: '10mg',
        form: 'Tablet',
        manufacturer: 'Teva Pharmaceuticals',
        price: 12.99,
        cost: 3.50,
        stock: 500,
        reorderLevel: 100,
        maxStock: 1000,
        controlled: false,
      },
    }),
    prisma.drug.upsert({
      where: { ndc: '00093-0833-01' },
      update: {},
      create: {
        ndc: '00093-0833-01',
        name: 'Metformin',
        genericName: 'Metformin HCl',
        strength: '500mg',
        form: 'Tablet',
        manufacturer: 'Teva Pharmaceuticals',
        price: 8.99,
        cost: 2.00,
        stock: 750,
        reorderLevel: 150,
        maxStock: 1500,
        controlled: false,
      },
    }),
    prisma.drug.upsert({
      where: { ndc: '0071-2258-23' },
      update: {},
      create: {
        ndc: '0071-2258-23',
        name: 'Atorvastatin',
        genericName: 'Atorvastatin Calcium',
        strength: '20mg',
        form: 'Tablet',
        manufacturer: 'Pfizer',
        price: 25.99,
        cost: 8.00,
        stock: 300,
        reorderLevel: 75,
        maxStock: 600,
        controlled: false,
      },
    }),
    prisma.drug.upsert({
      where: { ndc: '00591-5621-01' },
      update: {},
      create: {
        ndc: '00591-5621-01',
        name: 'Amoxicillin',
        genericName: 'Amoxicillin',
        strength: '500mg',
        form: 'Capsule',
        manufacturer: 'Watson Labs',
        price: 15.99,
        cost: 5.00,
        stock: 200,
        reorderLevel: 50,
        maxStock: 400,
        controlled: false,
      },
    }),
    prisma.drug.upsert({
      where: { ndc: '00406-0512-01' },
      update: {},
      create: {
        ndc: '00406-0512-01',
        name: 'Alprazolam',
        genericName: 'Alprazolam',
        strength: '0.5mg',
        form: 'Tablet',
        manufacturer: 'Mallinckrodt',
        price: 35.99,
        cost: 12.00,
        stock: 150,
        reorderLevel: 30,
        maxStock: 200,
        controlled: true,
        schedule: 'IV',
      },
    }),
    prisma.drug.upsert({
      where: { ndc: '00093-0834-01' },
      update: {},
      create: {
        ndc: '00093-0834-01',
        name: 'Metformin',
        genericName: 'Metformin HCl',
        strength: '850mg',
        form: 'Tablet',
        manufacturer: 'Teva Pharmaceuticals',
        price: 10.99,
        cost: 2.50,
        stock: 25,
        reorderLevel: 100,
        maxStock: 500,
        controlled: false,
      },
    }),
    prisma.drug.upsert({
      where: { ndc: '00591-2234-01' },
      update: {},
      create: {
        ndc: '00591-2234-01',
        name: 'Ibuprofen',
        genericName: 'Ibuprofen',
        strength: '800mg',
        form: 'Tablet',
        manufacturer: 'Watson Labs',
        price: 9.99,
        cost: 2.00,
        stock: 0,
        reorderLevel: 100,
        maxStock: 800,
        controlled: false,
      },
    }),
    prisma.drug.upsert({
      where: { ndc: '00093-3147-01' },
      update: {},
      create: {
        ndc: '00093-3147-01',
        name: 'Omeprazole',
        genericName: 'Omeprazole',
        strength: '20mg',
        form: 'Capsule',
        manufacturer: 'Teva Pharmaceuticals',
        price: 18.99,
        cost: 6.00,
        stock: 400,
        reorderLevel: 100,
        maxStock: 800,
        controlled: false,
      },
    }),
    prisma.drug.upsert({
      where: { ndc: '00115-1721-01' },
      update: {},
      create: {
        ndc: '00115-1721-01',
        name: 'Sertraline',
        genericName: 'Sertraline HCl',
        strength: '50mg',
        form: 'Tablet',
        manufacturer: 'Amneal',
        price: 22.99,
        cost: 7.00,
        stock: 250,
        reorderLevel: 60,
        maxStock: 500,
        controlled: false,
      },
    }),
    prisma.drug.upsert({
      where: { ndc: '00378-1800-01' },
      update: {},
      create: {
        ndc: '00378-1800-01',
        name: 'Amlodipine',
        genericName: 'Amlodipine Besylate',
        strength: '5mg',
        form: 'Tablet',
        manufacturer: 'Mylan',
        price: 14.99,
        cost: 4.00,
        stock: 350,
        reorderLevel: 80,
        maxStock: 700,
        controlled: false,
      },
    }),
  ])

  console.log(`✅ Created ${drugs.length} drugs`)

  // Create Sample Prescribers
  const prescribers = await Promise.all([
    prisma.prescriber.upsert({
      where: { npi: '1234567890' },
      update: {},
      create: {
        npi: '1234567890',
        firstName: 'Michael',
        lastName: 'Thompson',
        degree: 'MD',
        specialty: 'Internal Medicine',
        phone: '555-2001',
        fax: '555-2002',
        address: '789 Medical Center Dr',
        city: 'Springfield',
        state: 'IL',
        zip: '62703',
      },
    }),
    prisma.prescriber.upsert({
      where: { npi: '0987654321' },
      update: {},
      create: {
        npi: '0987654321',
        firstName: 'Jennifer',
        lastName: 'Lee',
        degree: 'MD',
        specialty: 'Family Practice',
        phone: '555-3001',
        fax: '555-3002',
        address: '321 Health Plaza',
        city: 'Springfield',
        state: 'IL',
        zip: '62704',
      },
    }),
  ])

  console.log(`✅ Created ${prescribers.length} prescribers`)

  // Create Sample Prescriptions in various states
  const prescriptions = await Promise.all([
    prisma.prescription.create({
      data: {
        rxNumber: 'RX100001',
        patientId: 'patient-1',
        drugId: drugs[0].id,
        prescriberId: prescribers[0].id,
        quantity: 30,
        daysSupply: 30,
        directions: 'Take 1 tablet by mouth once daily',
        refills: 3,
        refillsRemaining: 3,
        status: RxStatus.QUEUE,
      },
    }),
    prisma.prescription.create({
      data: {
        rxNumber: 'RX100002',
        patientId: 'patient-2',
        drugId: drugs[1].id,
        prescriberId: prescribers[1].id,
        quantity: 60,
        daysSupply: 30,
        directions: 'Take 1 tablet by mouth twice daily with meals',
        refills: 5,
        refillsRemaining: 5,
        status: RxStatus.ENTRY,
      },
    }),
    prisma.prescription.create({
      data: {
        rxNumber: 'RX100003',
        patientId: 'patient-3',
        drugId: drugs[2].id,
        prescriberId: prescribers[0].id,
        quantity: 30,
        daysSupply: 30,
        directions: 'Take 1 tablet by mouth at bedtime',
        refills: 2,
        refillsRemaining: 2,
        status: RxStatus.FILL,
      },
    }),
    prisma.prescription.create({
      data: {
        rxNumber: 'RX100004',
        patientId: 'patient-4',
        drugId: drugs[3].id,
        prescriberId: prescribers[1].id,
        quantity: 21,
        daysSupply: 7,
        directions: 'Take 1 capsule by mouth three times daily',
        refills: 0,
        refillsRemaining: 0,
        status: RxStatus.VERIFY,
      },
    }),
    prisma.prescription.create({
      data: {
        rxNumber: 'RX100005',
        patientId: 'patient-5',
        drugId: drugs[4].id,
        prescriberId: prescribers[0].id,
        quantity: 30,
        daysSupply: 30,
        directions: 'Take 1 tablet by mouth as needed for anxiety',
        refills: 1,
        refillsRemaining: 1,
        status: RxStatus.QUEUE,
      },
    }),
  ])

  console.log(`✅ Created ${prescriptions.length} prescriptions`)

  console.log('🎉 Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
