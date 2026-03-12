import { NextResponse } from 'next/server'
import { getUsers, createUser } from '@/app/actions/auth'

export async function GET() {
  try {
    const users = await getUsers()
    return NextResponse.json(users)
  } catch (error) {
    console.error('Failed to fetch users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    
    // Debug: Log form data
    const email = formData.get('email')
    const name = formData.get('name')
    const password = formData.get('password')
    const role = formData.get('role')
    const phone = formData.get('phone')
    
    console.log('Creating user with data:', { email, name, role, phone, hasPassword: !!password })
    
    const result = await createUser(formData)
    
    console.log('Create user result:', result)
    
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to create user:', error)
    return NextResponse.json({ error: 'Failed to create user: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 })
  }
}
