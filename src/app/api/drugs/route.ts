import { NextResponse } from 'next/server'
import { getDrugs, createDrug } from '@/app/actions/drugs'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || undefined
    const lowStock = searchParams.get('lowStock') === 'true'
    const drugs = await getDrugs(search, lowStock)
    return NextResponse.json(drugs)
  } catch (error) {
    console.error('Failed to fetch drugs:', error)
    return NextResponse.json({ error: 'Failed to fetch drugs' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const drug = await createDrug(formData)
    return NextResponse.json(drug)
  } catch (error) {
    console.error('Failed to create drug:', error)
    return NextResponse.json({ error: 'Failed to create drug' }, { status: 500 })
  }
}
