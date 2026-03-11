import { NextResponse } from 'next/server'
import { login } from '@/app/actions/auth'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const result = await login(formData)
    
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    
    return NextResponse.json({ success: true, user: result.user })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
