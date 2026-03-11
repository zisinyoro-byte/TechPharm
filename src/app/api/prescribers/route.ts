import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - List all prescribers with search
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    
    const where: Record<string, unknown> = { active: true };
    
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { npi: { contains: search } },
        { practiceName: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    const prescribers = await db.prescriber.findMany({
      where,
      orderBy: { lastName: 'asc' },
    });

    return NextResponse.json(prescribers);
  } catch (error) {
    console.error('Error fetching prescribers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prescribers' },
      { status: 500 }
    );
  }
}

// POST - Create a new prescriber
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const prescriber = await db.prescriber.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        npi: body.npi,
        deaNumber: body.deaNumber,
        phone: body.phone,
        fax: body.fax,
        email: body.email,
        practiceName: body.practiceName,
        address: body.address,
        city: body.city,
        state: body.state,
        zipCode: body.zipCode,
        specialty: body.specialty,
      },
    });

    return NextResponse.json(prescriber, { status: 201 });
  } catch (error) {
    console.error('Error creating prescriber:', error);
    return NextResponse.json(
      { error: 'Failed to create prescriber' },
      { status: 500 }
    );
  }
}
