'use client'

import { useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

interface CurrentUser {
  id: string
  name: string
  email: string
  role: string
}

interface AuthGuardProps {
  children: (user: CurrentUser) => ReactNode
  requireAdmin?: boolean
}

export function AuthGuard({ children, requireAdmin = false }: AuthGuardProps) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [router])

  async function checkAuth() {
    try {
      // First check if setup is needed
      const setupRes = await fetch('/api/auth/check-setup')
      const setupData = await setupRes.json()
      
      if (!setupData.hasUsers) {
        router.push('/setup')
        return
      }

      // Check if logged in
      const authRes = await fetch('/api/auth/me')
      if (!authRes.ok) {
        router.push('/login')
        return
      }
      
      const userData = await authRes.json()
      setUser(userData.user)
    } catch (error) {
      console.error('Auth check failed:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (requireAdmin && user.role !== 'ADMIN') {
    router.push('/')
    return null
  }

  return <>{children(user)}</>
}

// Export a hook for getting current user (for use in components that are already inside AuthGuard)
export function useAuth() {
  // This is now deprecated - use the render prop pattern instead
  console.warn('useAuth is deprecated. Use AuthGuard render prop instead.')
  return { user: null, loading: false }
}
