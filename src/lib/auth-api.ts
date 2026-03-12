import { db } from '@/lib/db'
import { cookies } from 'next/headers'

/**
 * Get the current authenticated user for API routes
 * This is a non-server-action version suitable for use in API route handlers
 */
export async function getAuthUser() {
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

/**
 * Require authentication - returns user or returns null
 * For use in API routes where you want to return 401 if not authenticated
 */
export async function requireAuthUser() {
  const user = await getAuthUser()
  return user
}
