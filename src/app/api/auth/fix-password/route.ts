import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createHash } from 'crypto'
import { Role } from '@prisma/client'

// Password hashing (must match auth.ts)
function hashPassword(password: string): string {
  return createHash('sha256').update(password + 'techpharm_salt').digest('hex')
}

export async function GET() {
  try {
    const email = 'zisinyoro@gmail.com'
    const newPassword = 'TechPharm2024!'
    
    // Find user by email
    const user = await db.user.findUnique({
      where: { email }
    })
    
    if (!user) {
      // Create admin user if doesn't exist
      await db.user.create({
        data: {
          email,
          password: hashPassword(newPassword),
          name: 'Admin',
          role: 'ADMIN',
          active: true,
        }
      })
      return NextResponse.json({ 
        success: true, 
        message: 'Admin account created!',
        credentials: {
          email,
          password: newPassword
        }
      })
    }
    
    // Update password
    await db.user.update({
      where: { id: user.id },
      data: {
        password: hashPassword(newPassword),
        active: true,
      }
    })
    
    return NextResponse.json({ 
      success: true, 
      message: 'Password reset successfully!',
      credentials: {
        email,
        password: newPassword
      }
    })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Failed to reset password', details: String(error) }, { status: 500 })
  }
}
