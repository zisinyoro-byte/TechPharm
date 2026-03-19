import { NextResponse } from 'next/server'
import { setupInitialAdmin } from '@/app/actions/auth'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const result = await setupInitialAdmin(formData)
    
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    
    return NextResponse.json({ success: true, user: result.user })
  } catch (error) {
    console.error('Setup error:', error)
    return NextResponse.json({ error: 'Setup failed' }, { status: 500 })
  }
}
