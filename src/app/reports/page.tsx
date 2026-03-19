'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import { 
  TrendingUp, Package, DollarSign, LogOut, 
  Sun, Moon, AlertTriangle, Clock,
  RefreshCw, Printer
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/auth/auth-guard'
import { format, subMonths } from 'date-fns'

interface CurrentUser {
  id: string
  name: string
  email: string
  role: string
}

function ReportsContent({ user }: { user: CurrentUser }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('overview')
  
  // State
  const [cashRecord, setCashRecord] = useState<any>(null)
  const [openingCash, setOpeningCash] = useState('0')
  const [actualCash, setActualCash] = useState('')
  const [dayNotes, setDayNotes] = useState('')
  const [dayLoading, setDayLoading] = useState(false)
  
  const [inventoryReport, setInventoryReport] = useState<any>(null)
  const [fastMovers, setFastMovers] = useState<any[]>([])
  const [slowMovers, setSlowMovers] = useState<any[]>([])
  const [lowStock, setLowStock] = useState<any>(null)
  
  const [financialSummary, setFinancialSummary] = useState<any>(null)
  const [dailyBreakdown, setDailyBreakdown] = useState<any[]>([])
  
  const [startDate, setStartDate] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pharmacyName] = useState('TechPharm Pharmacy')

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const fetchAllData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ startDate, endDate })
      
      // Fetch all data in parallel with error handling
      const results = await Promise.allSettled([
        fetch('/api/cash/daily').then(r => r.ok ? r.json() : null),
        fetch(`/api/reports/inventory?type=summary&${params}`).then(r => r.ok ? r.json() : null),
        fetch(`/api/reports/inventory?type=fast-movers&${params}`).then(r => r.ok ? r.json() : null),
        fetch(`/api/reports/inventory?type=slow-movers&${params}`).then(r => r.ok ? r.json() : null),
        fetch('/api/reports/inventory?type=low-stock').then(r => r.ok ? r.json() : null),
        fetch(`/api/reports/financial?type=summary&${params}`).then(r => r.ok ? r.json() : null),
        fetch(`/api/reports/financial?type=daily&${params}`).then(r => r.ok ? r.json() : null),
      ])

      const [cash, inventory, fast, slow, low, financial, daily] = results

      if (cash.status === 'fulfilled' && cash.value) setCashRecord(cash.value)
      if (inventory.status === 'fulfilled' && inventory.value) setInventoryReport(inventory.value)
      if (fast.status === 'fulfilled' && fast.value) setFastMovers(fast.value.fastMovers || [])
      if (slow.status === 'fulfilled' && slow.value) setSlowMovers(slow.value.slowMovers || [])
      if (low.status === 'fulfilled' && low.value) setLowStock(low.value)
      if (financial.status === 'fulfilled' && financial.value) setFinancialSummary(financial.value)
      if (daily.status === 'fulfilled' && daily.value) setDailyBreakdown(daily.value.daily || [])

    } catch (err) {
      console.error('Failed to fetch data:', err)
      setError('Failed to load some data. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  async function handleOpenDay() {
    setDayLoading(true)
    try {
      const res = await fetch('/api/cash/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openingCash: parseFloat(openingCash) || 0, notes: dayNotes }),
      })
      if (res.ok) {
        const data = await res.json()
        setCashRecord(data)
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to open day')
      }
    } catch (err) {
      alert('Failed to open day')
    } finally {
      setDayLoading(false)
    }
  }

  async function handleCloseDay() {
    if (!actualCash) {
      alert('Please enter the actual cash count')
      return
    }
    setDayLoading(true)
    try {
      const res = await fetch('/api/cash/daily', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actualCash: parseFloat(actualCash), notes: dayNotes }),
      })
      if (res.ok) {
        const data = await res.json()
        setCashRecord(data)
        fetchAllData()
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to close day')
      }
    } catch (err) {
      alert('Failed to close day')
    } finally {
      setDayLoading(false)
    }
  }

  // Safe chart data
  const chartData = (dailyBreakdown || []).slice(-14).map(d => ({
    date: d?.dateStr || '',
    revenue: d?.sales?.revenue || 0
  }))

  const pieData = [
    { name: 'Cash', value: financialSummary?.paymentMethods?.CASH?.total || 0 },
    { name: 'Card', value: financialSummary?.paymentMethods?.CARD?.total || 0 },
    { name: 'Insurance', value: financialSummary?.paymentMethods?.INSURANCE?.total || 0 },
  ].filter(d => d.value > 0)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-blue-600">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">Rx</span>
              </div>
              <span className="font-semibold">TechPharm</span>
            </Link>
            <span className="text-slate-300">|</span>
            <h1 className="text-xl font-bold text-slate-800">Reports & Operations</h1>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-4">
              <Link href="/prescriptions/new" className="text-slate-600 hover:text-blue-600 transition">New Rx</Link>
              <Link href="/patients" className="text-slate-600 hover:text-blue-600 transition">Patients</Link>
              <Link href="/inventory" className="text-slate-600 hover:text-blue-600 transition">Inventory</Link>
            </nav>
            <div className="flex items-center gap-3 border-l pl-4">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-800">{user.name}</p>
                <p className="text-xs text-slate-500">{user.role}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-1" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Date Range Selector */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="start-date">From:</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="end-date">To:</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <Button onClick={fetchAllData} size="sm" variant="outline">
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">{error}</div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading reports...</div>
        ) : (
          <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-white">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="day-operations" className="gap-1">
                <Sun className="h-4 w-4" />
                Day Operations
              </TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="financial">Financial</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <DollarSign className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Total Revenue</p>
                        <p className="text-2xl font-bold text-slate-800">
                          ${financialSummary?.sales?.totalRevenue?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-green-100 rounded-lg">
                        <TrendingUp className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Gross Profit</p>
                        <p className="text-2xl font-bold text-green-600">
                          ${financialSummary?.costs?.grossProfit?.toFixed(2) || '0.00'}
                        </p>
                        <p className="text-xs text-slate-500">
                          Margin: {financialSummary?.costs?.grossMargin?.toFixed(1) || '0'}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-purple-100 rounded-lg">
                        <Package className="h-6 w-6 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Items Sold</p>
                        <p className="text-2xl font-bold text-slate-800">
                          {inventoryReport?.movement?.itemsSold || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-amber-100 rounded-lg">
                        <AlertTriangle className="h-6 w-6 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Low Stock Items</p>
                        <p className="text-2xl font-bold text-amber-600">
                          {lowStock?.summary?.lowStockCount || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Daily Revenue Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                            <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                            <Tooltip 
                              contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                              formatter={(value: any) => [`$${Number(value || 0).toFixed(2)}`, 'Revenue']}
                            />
                            <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-400">
                          No data available for this period
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Payment Methods</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      {pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={100}
                              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            >
                              {pieData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: any) => [`$${Number(value || 0).toFixed(2)}`, '']} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-400">
                          No payment data available
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Day Operations Tab */}
            <TabsContent value="day-operations" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {cashRecord?.status === 'OPEN' ? (
                        <><Sun className="h-5 w-5 text-amber-500" />Day Open</>
                      ) : cashRecord?.status === 'CLOSED' ? (
                        <><Moon className="h-5 w-5 text-indigo-500" />Day Closed</>
                      ) : (
                        <><Clock className="h-5 w-5 text-slate-400" />Day Not Started</>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {cashRecord?.date ? format(new Date(cashRecord.date), 'EEEE, MMMM d, yyyy') : format(new Date(), 'EEEE, MMMM d, yyyy')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!cashRecord?.openedAt ? (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="opening-cash">Opening Cash Float ($)</Label>
                          <Input 
                            id="opening-cash" 
                            type="number" 
                            value={openingCash} 
                            onChange={(e) => setOpeningCash(e.target.value)} 
                            placeholder="Enter opening cash amount" 
                          />
                        </div>
                        <div>
                          <Label htmlFor="day-notes">Notes (optional)</Label>
                          <Input 
                            id="day-notes" 
                            value={dayNotes} 
                            onChange={(e) => setDayNotes(e.target.value)} 
                            placeholder="Any notes for the day" 
                          />
                        </div>
                        <Button onClick={handleOpenDay} disabled={dayLoading} className="w-full">
                          <Sun className="h-4 w-4 mr-2" />Start Day
                        </Button>
                      </div>
                    ) : cashRecord?.status === 'OPEN' ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                          <div className="flex justify-between">
                            <span className="text-slate-600">Opened by:</span>
                            <span className="font-medium">{cashRecord.openedBy?.name || 'System'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Opening Cash:</span>
                            <span className="font-medium">${Number(cashRecord.openingCash || 0).toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="p-4 bg-green-50 rounded-lg space-y-2">
                          <div className="flex justify-between">
                            <span className="text-slate-600">Sales Today:</span>
                            <span className="font-medium">{cashRecord.totalSales || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Revenue:</span>
                            <span className="font-medium text-green-600">${Number(cashRecord.totalRevenue || 0).toFixed(2)}</span>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="actual-cash">Actual Cash Count ($)</Label>
                          <Input 
                            id="actual-cash" 
                            type="number" 
                            value={actualCash} 
                            onChange={(e) => setActualCash(e.target.value)} 
                            placeholder="Count the cash in drawer" 
                          />
                        </div>
                        <Button onClick={handleCloseDay} disabled={dayLoading} className="w-full bg-indigo-600 hover:bg-indigo-700">
                          <Moon className="h-4 w-4 mr-2" />Close Day
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-4 bg-slate-100 rounded-lg">
                          <p className="text-sm text-slate-600">Day is closed. Summary:</p>
                          <div className="mt-2 space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>Total Sales:</span>
                              <span>{cashRecord.totalSales || 0}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Total Revenue:</span>
                              <span className="font-bold text-green-600">${Number(cashRecord.totalRevenue || 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Variance:</span>
                              <span className={Number(cashRecord.cashVariance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                                ${Number(cashRecord.cashVariance || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Today&apos;s Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-blue-50 rounded-lg">
                          <p className="text-sm text-slate-600">Cash Sales</p>
                          <p className="text-xl font-bold">${Number(cashRecord?.cashSales || 0).toFixed(2)}</p>
                        </div>
                        <div className="p-4 bg-purple-50 rounded-lg">
                          <p className="text-sm text-slate-600">Card Sales</p>
                          <p className="text-xl font-bold">${Number(cashRecord?.cardSales || 0).toFixed(2)}</p>
                        </div>
                        <div className="p-4 bg-green-50 rounded-lg">
                          <p className="text-sm text-slate-600">Insurance</p>
                          <p className="text-xl font-bold">${Number(cashRecord?.insuranceSales || 0).toFixed(2)}</p>
                        </div>
                        <div className="p-4 bg-amber-50 rounded-lg">
                          <p className="text-sm text-slate-600">Transactions</p>
                          <p className="text-xl font-bold">{cashRecord?.totalSales || 0}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Inventory Tab */}
            <TabsContent value="inventory" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-slate-500">Total Drugs</p>
                    <p className="text-2xl font-bold">{inventoryReport?.summary?.totalDrugs || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-slate-500">Inventory Value</p>
                    <p className="text-2xl font-bold">${Number(inventoryReport?.summary?.totalCostValue || 0).toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-slate-500">Out of Stock</p>
                    <p className="text-2xl font-bold text-red-600">{inventoryReport?.stockStatus?.outOfStockCount || 0}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Fast Movers */}
              <Card>
                <CardHeader>
                  <CardTitle>Fast Movers</CardTitle>
                  <CardDescription>Top selling items by turnover rate</CardDescription>
                </CardHeader>
                <CardContent>
                  {fastMovers.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2">Drug</th>
                            <th className="text-left py-2">Stock</th>
                            <th className="text-left py-2">Sold</th>
                            <th className="text-left py-2">Turnover</th>
                            <th className="text-left py-2">Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fastMovers.slice(0, 10).map((item, i) => (
                            <tr key={i} className="border-b">
                              <td className="py-2">{item.drugName}</td>
                              <td className="py-2">{item.currentStock}</td>
                              <td className="py-2">{item.totalQuantitySold}</td>
                              <td className="py-2 text-green-600">{item.turnoverRate}x</td>
                              <td className="py-2">${Number(item.revenue || 0).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-slate-400 text-center py-4">No sales data for this period</p>
                  )}
                </CardContent>
              </Card>

              {/* Slow Movers */}
              <Card>
                <CardHeader>
                  <CardTitle>Slow Movers</CardTitle>
                  <CardDescription>Items with low turnover that may need attention</CardDescription>
                </CardHeader>
                <CardContent>
                  {slowMovers.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2">Drug</th>
                            <th className="text-left py-2">Stock</th>
                            <th className="text-left py-2">Value</th>
                            <th className="text-left py-2">Turnover</th>
                          </tr>
                        </thead>
                        <tbody>
                          {slowMovers.slice(0, 10).map((item, i) => (
                            <tr key={i} className="border-b">
                              <td className="py-2">{item.drugName}</td>
                              <td className="py-2">{item.currentStock}</td>
                              <td className="py-2">${Number(item.stockValue || 0).toFixed(2)}</td>
                              <td className="py-2 text-amber-600">{item.turnoverRate}x</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-slate-400 text-center py-4">No slow moving items identified</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Financial Tab */}
            <TabsContent value="financial" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-slate-500">Total Revenue</p>
                    <p className="text-2xl font-bold text-blue-600">${Number(financialSummary?.sales?.totalRevenue || 0).toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-slate-500">Cost of Goods</p>
                    <p className="text-2xl font-bold">${Number(financialSummary?.costs?.costOfGoodsSold || 0).toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-slate-500">Gross Profit</p>
                    <p className="text-2xl font-bold text-green-600">${Number(financialSummary?.costs?.grossProfit || 0).toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-slate-500">Margin</p>
                    <p className="text-2xl font-bold">{Number(financialSummary?.costs?.grossMargin || 0).toFixed(1)}%</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Payment Methods</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-slate-600">Cash</p>
                      <p className="text-xl font-bold">${Number(financialSummary?.paymentMethods?.CASH?.total || 0).toFixed(2)}</p>
                      <p className="text-xs text-slate-500">{financialSummary?.paymentMethods?.CASH?.count || 0} transactions</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-slate-600">Card</p>
                      <p className="text-xl font-bold">${Number(financialSummary?.paymentMethods?.CARD?.total || 0).toFixed(2)}</p>
                      <p className="text-xs text-slate-500">{financialSummary?.paymentMethods?.CARD?.count || 0} transactions</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <p className="text-sm text-slate-600">Insurance</p>
                      <p className="text-xl font-bold">${Number(financialSummary?.paymentMethods?.INSURANCE?.total || 0).toFixed(2)}</p>
                      <p className="text-xs text-slate-500">{financialSummary?.paymentMethods?.INSURANCE?.count || 0} transactions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  )
}

export default function ReportsPage() {
  return (
    <AuthGuard>
      {(user) => <ReportsContent user={user} />}
    </AuthGuard>
  )
}
