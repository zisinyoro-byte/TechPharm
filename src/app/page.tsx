'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Users, 
  Package, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  Plus,
  LogOut,
  ShoppingCart
} from 'lucide-react'
import Link from 'next/link'

// Types
interface Drug {
  id: string
  name: string
  strength: string
  form: string
  stock: number
  reorderLevel: number
}

interface Patient {
  id: string
  firstName: string
  lastName: string
}

interface Prescription {
  id: string
  rxNumber: string
  status: string
  quantity: number
  directions: string
  patient: Patient
  drug: Drug
  createdAt: string
}

interface Stats {
  totalPatients: number
  totalDrugs: number
  pendingPrescriptions: number
  completedToday: number
  lowStockCount: number
  outOfStockCount: number
}

interface WorkflowQueues {
  queue: Prescription[]
  entry: Prescription[]
  fill: Prescription[]
  verify: Prescription[]
}

interface CurrentUser {
  id: string
  name: string
  email: string
  role: string
}

// Status configuration
const statusConfig: Record<string, { label: string; color: string; nextStatus: string; bgColor: string }> = {
  QUEUE: { label: 'Queue', color: 'text-slate-600', nextStatus: 'ENTRY', bgColor: 'bg-slate-100' },
  ENTRY: { label: 'Data Entry', color: 'text-blue-600', nextStatus: 'FILL', bgColor: 'bg-blue-50' },
  FILL: { label: 'Filling', color: 'text-amber-600', nextStatus: 'VERIFY', bgColor: 'bg-amber-50' },
  VERIFY: { label: 'Verify (RPh)', color: 'text-purple-600', nextStatus: 'COMPLETE', bgColor: 'bg-purple-50' },
}

export default function Dashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [queues, setQueues] = useState<WorkflowQueues | null>(null)
  const [loading, setLoading] = useState(true)
  const [movingRx, setMovingRx] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

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
      setCurrentUser(userData.user)
      
      // Fetch dashboard data
      await fetchData()
    } catch (error) {
      router.push('/login')
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  async function fetchData() {
    try {
      const [statsRes, queuesRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/dashboard/queues'),
      ])
      const statsData = await statsRes.json()
      const queuesData = await queuesRes.json()
      setStats(statsData)
      setQueues(queuesData)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function movePrescription(rxNumber: string, newStatus: string) {
    setMovingRx(rxNumber)
    try {
      await fetch('/api/prescriptions/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rxNumber, newStatus }),
      })
      await fetchData()
    } catch (error) {
      console.error('Failed to update status:', error)
    } finally {
      setMovingRx(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading PharmaFlow...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">Rx</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">PharmaFlow</h1>
              <p className="text-xs text-slate-500">Pharmacy Management System</p>
            </div>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/prescriptions/new">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                New Rx
              </Button>
            </Link>
            <Link href="/pos" className="text-slate-600 hover:text-blue-600 transition flex items-center gap-1">
              <ShoppingCart className="h-4 w-4" />
              POS
            </Link>
            <Link href="/patients" className="text-slate-600 hover:text-blue-600 transition">Patients</Link>
            <Link href="/inventory" className="text-slate-600 hover:text-blue-600 transition">Inventory</Link>
            <Link href="/reports" className="text-slate-600 hover:text-blue-600 transition">Reports</Link>
            {currentUser?.role === 'ADMIN' && (
              <Link href="/users" className="text-slate-600 hover:text-blue-600 transition">Users</Link>
            )}
          </nav>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-800">{currentUser?.name}</p>
              <p className="text-xs text-slate-500">{currentUser?.role}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <StatsCard
            title="Patients"
            value={stats?.totalPatients || 0}
            icon={<Users className="h-5 w-5" />}
            color="text-blue-600"
            bgColor="bg-blue-50"
          />
          <StatsCard
            title="Drugs"
            value={stats?.totalDrugs || 0}
            icon={<Package className="h-5 w-5" />}
            color="text-green-600"
            bgColor="bg-green-50"
          />
          <StatsCard
            title="Pending"
            value={stats?.pendingPrescriptions || 0}
            icon={<Clock className="h-5 w-5" />}
            color="text-amber-600"
            bgColor="bg-amber-50"
          />
          <StatsCard
            title="Completed Today"
            value={stats?.completedToday || 0}
            icon={<CheckCircle className="h-5 w-5" />}
            color="text-emerald-600"
            bgColor="bg-emerald-50"
          />
          <StatsCard
            title="Low Stock"
            value={stats?.lowStockCount || 0}
            icon={<AlertTriangle className="h-5 w-5" />}
            color="text-orange-600"
            bgColor="bg-orange-50"
            alert={stats?.lowStockCount ? stats.lowStockCount > 0 : false}
          />
          <StatsCard
            title="Out of Stock"
            value={stats?.outOfStockCount || 0}
            icon={<AlertCircle className="h-5 w-5" />}
            color="text-red-600"
            bgColor="bg-red-50"
            alert={stats?.outOfStockCount ? stats.outOfStockCount > 0 : false}
          />
        </div>

        {/* Workflow Board */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Prescription Workflow</h2>
          <Link href="/prescriptions">
            <Button variant="outline" size="sm">View All Prescriptions</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {queues && Object.entries(statusConfig).map(([status, config]) => {
            const items = queues[status.toLowerCase() as keyof WorkflowQueues] || []
            return (
              <WorkflowColumn
                key={status}
                title={config.label}
                count={items.length}
                color={config.color}
                bgColor={config.bgColor}
                items={items}
                nextStatus={config.nextStatus}
                onMove={movePrescription}
                movingRx={movingRx}
              />
            )
          })}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="hover:shadow-md transition cursor-pointer">
            <Link href="/pos">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <ShoppingCart className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">Point of Sale</h3>
                    <p className="text-sm text-slate-500">Process transactions</p>
                  </div>
                </div>
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:shadow-md transition cursor-pointer">
            <Link href="/patients">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">Manage Patients</h3>
                    <p className="text-sm text-slate-500">Add, edit, or view patient records</p>
                  </div>
                </div>
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:shadow-md transition cursor-pointer">
            <Link href="/inventory">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Package className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">Inventory</h3>
                    <p className="text-sm text-slate-500">Manage drugs and stock levels</p>
                  </div>
                </div>
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:shadow-md transition cursor-pointer">
            <Link href="/reports">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">Reports</h3>
                    <p className="text-sm text-slate-500">Analytics and insights</p>
                  </div>
                </div>
              </CardContent>
            </Link>
          </Card>
        </div>
      </main>
    </div>
  )
}

// Stats Card Component
function StatsCard({ 
  title, 
  value, 
  icon, 
  color, 
  bgColor,
  alert = false 
}: { 
  title: string
  value: number
  icon: React.ReactNode
  color: string
  bgColor: string
  alert?: boolean
}) {
  return (
    <Card className={`${alert ? 'ring-2 ring-orange-300' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">{title}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
          <div className={`p-2 rounded-lg ${bgColor}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Workflow Column Component
function WorkflowColumn({ 
  title, 
  count, 
  color, 
  bgColor,
  items, 
  nextStatus,
  onMove,
  movingRx
}: { 
  title: string
  count: number
  color: string
  bgColor: string
  items: Prescription[]
  nextStatus: string
  onMove: (rx: string, status: string) => void
  movingRx: string | null
}) {
  return (
    <Card className={`${bgColor} border-0`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className={`text-sm font-semibold ${color}`}>{title}</CardTitle>
          <Badge variant="secondary" className="bg-white">{count}</Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <ScrollArea className="h-[400px] pr-2">
          <div className="space-y-2">
            {items.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                No prescriptions
              </div>
            ) : (
              items.map((rx) => (
                <Card key={rx.id} className="bg-white shadow-sm">
                  <CardContent className="p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-sm text-slate-800">
                          {rx.patient.firstName} {rx.patient.lastName}
                        </p>
                        <p className="text-xs text-slate-400 font-mono">{rx.rxNumber}</p>
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 mb-2">
                      <p className="font-medium">{rx.drug.name} {rx.drug.strength}</p>
                      <p className="text-slate-400">Qty: {rx.quantity} | {rx.drug.form}</p>
                    </div>
                    {nextStatus !== 'COMPLETE' && (
                      <Button
                        size="sm"
                        className="w-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs"
                        onClick={() => onMove(rx.rxNumber, nextStatus)}
                        disabled={movingRx === rx.rxNumber}
                      >
                        {movingRx === rx.rxNumber ? (
                          <span className="flex items-center gap-1">
                            <span className="animate-spin">⏳</span> Moving...
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <ArrowRight className="h-3 w-3" /> Move to Next
                          </span>
                        )}
                      </Button>
                    )}
                    {nextStatus === 'COMPLETE' && (
                      <Button
                        size="sm"
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                        onClick={() => onMove(rx.rxNumber, nextStatus)}
                        disabled={movingRx === rx.rxNumber}
                      >
                        {movingRx === rx.rxNumber ? 'Completing...' : '✓ Complete Rx'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
