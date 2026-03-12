'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Search, 
  Plus, 
  Package, 
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  DollarSign,
  BarChart3,
  LogOut
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuthGuard, useAuth } from '@/components/auth/auth-guard'

interface Drug {
  id: string
  ndc: string
  name: string
  genericName: string | null
  strength: string
  form: string
  manufacturer: string | null
  price: number
  cost: number
  stock: number
  reorderLevel: number
  controlled: boolean
  schedule: string | null
}

interface Stats {
  totalDrugs: number
  totalItems: number
  totalValue: number
  lowStockCount: number
  outOfStockCount: number
}

export default function InventoryPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [drugs, setDrugs] = useState<Drug[]>([])
  const [lowStockDrugs, setLowStockDrugs] = useState<Drug[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  useEffect(() => {
    fetchData()
  }, [search])

  async function fetchData() {
    setLoading(true)
    try {
      const [drugsRes, lowStockRes, statsRes] = await Promise.all([
        fetch(search ? `/api/drugs?search=${encodeURIComponent(search)}` : '/api/drugs'),
        fetch('/api/drugs?lowStock=true'),
        fetch('/api/drugs/stats'),
      ])
      const drugsData = await drugsRes.json()
      const lowStockData = await lowStockRes.json()
      const statsData = await statsRes.json()
      setDrugs(drugsData)
      setLowStockDrugs(lowStockData)
      setStats(statsData)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    
    const formData = new FormData(e.currentTarget)
    
    try {
      await fetch('/api/drugs', {
        method: 'POST',
        body: formData,
      })
      setDialogOpen(false)
      fetchData()
    } catch (error) {
      console.error('Failed to create drug:', error)
    } finally {
      setSubmitting(false)
    }
  }

  function getStockStatus(drug: Drug): { label: string; color: string; icon: React.ReactNode } {
    if (drug.stock === 0) {
      return { label: 'Out of Stock', color: 'text-red-600 bg-red-50', icon: <AlertCircle className="h-4 w-4" /> }
    }
    if (drug.stock <= drug.reorderLevel) {
      return { label: 'Low Stock', color: 'text-orange-600 bg-orange-50', icon: <AlertTriangle className="h-4 w-4" /> }
    }
    return { label: 'In Stock', color: 'text-green-600 bg-green-50', icon: <CheckCircle className="h-4 w-4" /> }
  }

  return (
    <AuthGuard>
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
              <h1 className="text-xl font-bold text-slate-800">Inventory</h1>
            </div>
            <div className="flex items-center gap-4">
              <nav className="flex items-center gap-4">
                <Link href="/prescriptions/new" className="text-slate-600 hover:text-blue-600 transition">New Rx</Link>
                <Link href="/patients" className="text-slate-600 hover:text-blue-600 transition">Patients</Link>
                <Link href="/reports" className="text-slate-600 hover:text-blue-600 transition">Reports</Link>
              </nav>
              <div className="flex items-center gap-3 border-l pl-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-800">{user?.name}</p>
                  <p className="text-xs text-slate-500">{user?.role}</p>
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
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total SKUs</p>
                  <p className="text-xl font-bold text-slate-800">{stats?.totalDrugs || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total Units</p>
                  <p className="text-xl font-bold text-slate-800">{stats?.totalItems || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total Value</p>
                  <p className="text-xl font-bold text-slate-800">${stats?.totalValue?.toLocaleString() || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={lowStockDrugs.length > 0 ? 'ring-2 ring-orange-300' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-50 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Low Stock</p>
                  <p className="text-xl font-bold text-orange-600">{stats?.lowStockCount || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={stats?.outOfStockCount ? 'ring-2 ring-red-300' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-50 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Out of Stock</p>
                  <p className="text-xl font-bold text-red-600">{stats?.outOfStockCount || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for All Drugs / Low Stock */}
        <Tabs defaultValue="all" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="all">All Drugs</TabsTrigger>
              <TabsTrigger value="lowStock" className="text-orange-600">
                Low Stock ({lowStockDrugs.length})
              </TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search drugs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Drug
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add New Drug</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="ndc">NDC *</Label>
                      <Input id="ndc" name="ndc" required placeholder="12345-678-90" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name">Drug Name *</Label>
                      <Input id="name" name="name" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="genericName">Generic Name</Label>
                      <Input id="genericName" name="genericName" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="strength">Strength *</Label>
                      <Input id="strength" name="strength" required placeholder="e.g., 500mg" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="form">Form *</Label>
                      <select id="form" name="form" required className="w-full border rounded-md p-2">
                        <option value="Tablet">Tablet</option>
                        <option value="Capsule">Capsule</option>
                        <option value="Liquid">Liquid</option>
                        <option value="Injection">Injection</option>
                        <option value="Cream">Cream</option>
                        <option value="Ointment">Ointment</option>
                        <option value="Inhaler">Inhaler</option>
                        <option value="Patch">Patch</option>
                        <option value="Suppository">Suppository</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manufacturer">Manufacturer</Label>
                      <Input id="manufacturer" name="manufacturer" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="price">Retail Price ($) *</Label>
                      <Input id="price" name="price" type="number" step="0.01" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cost">Cost ($) *</Label>
                      <Input id="cost" name="cost" type="number" step="0.01" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stock">Initial Stock *</Label>
                      <Input id="stock" name="stock" type="number" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reorderLevel">Reorder Level</Label>
                      <Input id="reorderLevel" name="reorderLevel" type="number" defaultValue="10" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="controlled">Controlled Substance</Label>
                      <select id="controlled" name="controlled" className="w-full border rounded-md p-2">
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="schedule">Schedule (if controlled)</Label>
                      <select id="schedule" name="schedule" className="w-full border rounded-md p-2">
                        <option value="">N/A</option>
                        <option value="II">Schedule II</option>
                        <option value="III">Schedule III</option>
                        <option value="IV">Schedule IV</option>
                        <option value="V">Schedule V</option>
                      </select>
                    </div>
                    <div className="col-span-2 flex justify-end gap-2 mt-4">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
                        {submitting ? 'Saving...' : 'Save Drug'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <TabsContent value="all">
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="text-center py-12 text-slate-500">Loading drugs...</div>
                ) : drugs.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    No drugs found. Add your first drug to get started.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Drug Name</TableHead>
                        <TableHead>NDC</TableHead>
                        <TableHead>Form</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drugs.map((drug) => {
                        const status = getStockStatus(drug)
                        return (
                          <TableRow key={drug.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{drug.name} {drug.strength}</p>
                                {drug.genericName && (
                                  <p className="text-xs text-slate-500">Generic: {drug.genericName}</p>
                                )}
                                {drug.controlled && (
                                  <Badge variant="destructive" className="text-xs mt-1">
                                    C-{drug.schedule}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{drug.ndc}</TableCell>
                            <TableCell>{drug.form}</TableCell>
                            <TableCell>${Number(drug.price).toFixed(2)}</TableCell>
                            <TableCell>
                              <span className={`font-bold ${drug.stock === 0 ? 'text-red-600' : drug.stock <= drug.reorderLevel ? 'text-orange-600' : 'text-slate-800'}`}>
                                {drug.stock}
                              </span>
                              <span className="text-slate-400 text-sm"> / {drug.reorderLevel}</span>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${status.color} border-0`}>
                                {status.icon}
                                <span className="ml-1">{status.label}</span>
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lowStock">
            <Card>
              <CardContent className="p-0">
                {lowStockDrugs.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                    All inventory levels are healthy!
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Drug Name</TableHead>
                        <TableHead>Current Stock</TableHead>
                        <TableHead>Reorder Level</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lowStockDrugs.map((drug) => {
                        const status = getStockStatus(drug)
                        return (
                          <TableRow key={drug.id}>
                            <TableCell>
                              <p className="font-medium">{drug.name} {drug.strength}</p>
                              <p className="text-xs text-slate-500">{drug.form}</p>
                            </TableCell>
                            <TableCell>
                              <span className={`font-bold ${drug.stock === 0 ? 'text-red-600' : 'text-orange-600'}`}>
                                {drug.stock}
                              </span>
                            </TableCell>
                            <TableCell>{drug.reorderLevel}</TableCell>
                            <TableCell>
                              <Badge className={`${status.color} border-0`}>
                                {status.icon}
                                <span className="ml-1">{status.label}</span>
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
    </AuthGuard>
  )
}
