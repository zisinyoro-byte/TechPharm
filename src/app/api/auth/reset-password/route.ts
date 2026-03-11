import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createHash } from 'crypto'

// Password hashing (must match auth.ts)
function hashPassword(password: string): string {
  return createHash('sha256').update(password + 'techpharm_salt').digest('hex')
}

export async function POST(request: Request) {
  try {
    const { email, newPassword } = await request.json()
    
    if (!email || !newPassword) {
      return NextResponse.json({ error: 'Email and newPassword required' }, { status: 400 })
    }
    
    // Find user by email
    const user = await db.user.findUnique({
      where: { email }
    })
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    // Update password
    await db.user.update({
      where: { id: user.id },
      data: {
        password: hashPassword(newPassword)
      }
    })
    
    return NextResponse.json({ 
      success: true, 
      message: `Password reset for ${email}. New password is: ${newPassword}` 
    })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
  }
}

// GET endpoint to list users (for debugging)
export async function GET() {
  try {
    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        password: true,
      }
    })
    
    return NextResponse.json({ 
      users,
      count: users.length,
      note: 'Use POST with {email, newPassword} to reset a password'
    })
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json({ error: 'Failed to get users' }, { status: 500 })
  }
}
