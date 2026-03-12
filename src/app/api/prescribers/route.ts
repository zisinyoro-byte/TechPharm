import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth-api';
import { canRead, canWrite } from '@/lib/permissions';

// GET - List all prescribers with search
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    
    // Check read permission
    if (!canRead(user, 'prescriber')) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to view prescribers' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    
    const where: Record<string, unknown> = { active: true };
    
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { npi: { contains: search } },
      ];
    }
    
    const prescribers = await db.prescriber.findMany({
      where,
      orderBy: { lastName: 'asc' },
      include: {
        createdBy: {
          select: { id: true, name: true, role: true }
        }
      }
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
    const user = await getAuthUser();
    
    // Check write permission
    if (!canWrite(user, 'prescriber')) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to create prescribers' },
        { status: 403 }
      );
    }

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
        specialty: body.specialty,
        degree: body.degree,
        address: body.address,
        city: body.city,
        state: body.state,
        zip: body.zipCode || body.zip,
        createdById: user?.id, // Track who created this record
      },
      include: {
        createdBy: {
          select: { id: true, name: true, role: true }
        }
      }
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
