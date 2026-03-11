import { NextResponse } from 'next/server'
import { hasUsers } from '@/app/actions/auth'

export async function GET() {
  try {
    const hasUsersResult = await hasUsers()
    return NextResponse.json({ hasUsers: hasUsersResult })
  } catch (error) {
    console.error('Check setup error:', error)
    return NextResponse.json({ hasUsers: false })
  }
}
