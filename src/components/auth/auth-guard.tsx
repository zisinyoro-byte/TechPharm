'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

interface CurrentUser {
  id: string
  name: string
  email: string
  role: string
}

interface AuthContextType {
  user: CurrentUser | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true })

export function useAuth() {
  return useContext(AuthContext)
}

interface AuthProviderProps {
  children: ReactNode
}

function AuthProvider({ children }: AuthProviderProps) {
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

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

interface AuthGuardProps {
  children: ReactNode
  requireAdmin?: boolean
}

export function AuthGuard({ children, requireAdmin = false }: AuthGuardProps) {
  return (
    <AuthProvider>
      <AuthGuardContent requireAdmin={requireAdmin}>
        {children}
      </AuthGuardContent>
    </AuthProvider>
  )
}

function AuthGuardContent({ children, requireAdmin }: AuthGuardProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user && requireAdmin && user.role !== 'ADMIN') {
      router.push('/')
    }
  }, [user, loading, requireAdmin, router])

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
    return null
  }

  return <>{children}</>
}

// Export AuthProvider for wrapping at app level if needed
export { AuthProvider }
