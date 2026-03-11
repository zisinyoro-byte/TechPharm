'use server'

import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import { randomBytes, createHash } from 'crypto'
import { Role } from '@prisma/client'

// Password hashing
function hashPassword(password: string): string {
  return createHash('sha256').update(password + 'techpharm_salt').digest('hex')
}

// Generate session token
function generateToken(): string {
  return randomBytes(32).toString('hex')
}

// Create session
export async function createSession(userId: string) {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  await db.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  })

  // Update last login
  await db.user.update({
    where: { id: userId },
    data: { lastLogin: new Date() },
  })

  return token
}

// Get current user from session
export async function getCurrentUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value

  if (!token) return null

  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!session || session.expiresAt < new Date()) {
    return null
  }

  return session.user
}

// Login
export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  const user = await db.user.findUnique({
    where: { email },
  })

  if (!user || !user.active) {
    return { error: 'Invalid credentials' }
  }

  if (user.password !== hashPassword(password)) {
    return { error: 'Invalid credentials' }
  }

  const token = await createSession(user.id)

  const cookieStore = await cookies()
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  })

  return { success: true, user }
}

// Logout
export async function logout() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value

  if (token) {
    await db.session.delete({ where: { token } }).catch(() => {})
  }

  cookieStore.delete('session')
  return { success: true }
}

// Get all users
export async function getUsers() {
  return db.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      phone: true,
      active: true,
      lastLogin: true,
      createdAt: true,
    },
    orderBy: { name: 'asc' },
  })
}

// Create user
export async function createUser(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const name = formData.get('name') as string
  const role = formData.get('role') as Role
  const phone = formData.get('phone') as string | null

  if (!email || !password || !name) {
    return { error: 'Required fields missing' }
  }

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return { error: 'Email already exists' }
  }

  const user = await db.user.create({
    data: {
      email,
      password: hashPassword(password),
      name,
      role: role || Role.TECHNICIAN,
      phone,
    },
  })

  return { success: true, user }
}

// Update user
export async function updateUser(id: string, formData: FormData) {
  const name = formData.get('name') as string
  const role = formData.get('role') as Role
  const phone = formData.get('phone') as string | null
  const active = formData.get('active') === 'true'
  const password = formData.get('password') as string | null

  const updateData: any = { name, role, phone, active }
  if (password && password.length > 0) {
    updateData.password = hashPassword(password)
  }

  const user = await db.user.update({
    where: { id },
    data: updateData,
  })

  return { success: true, user }
}

// Delete user
export async function deleteUser(id: string) {
  await db.user.delete({ where: { id } })
  return { success: true }
}

// Reset password
export async function resetPassword(id: string, newPassword: string) {
  await db.user.update({
    where: { id },
    data: { password: hashPassword(newPassword) },
  })
  return { success: true }
}

// Check if any user exists (for initial setup)
export async function hasUsers() {
  const count = await db.user.count()
  return count > 0
}

// Initial setup - create admin user
export async function setupInitialAdmin(formData: FormData) {
  const hasUsersAlready = await hasUsers()
  if (hasUsersAlready) {
    return { error: 'Setup already complete' }
  }

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const name = formData.get('name') as string

  if (!email || !password || !name) {
    return { error: 'All fields are required' }
  }

  const user = await db.user.create({
    data: {
      email,
      password: hashPassword(password),
      name,
      role: Role.ADMIN,
    },
  })

  const token = await createSession(user.id)

  const cookieStore = await cookies()
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  })

  return { success: true, user }
}
