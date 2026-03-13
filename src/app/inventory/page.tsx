'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
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
  LogOut,
  Edit,
  Trash2,
  PackagePlus,
  Loader2
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
  maxStock: number
  controlled: boolean
  schedule: string | null
  barcode: string | null
  isActive: boolean
  createdById: string | null
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
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingDrug, setEditingDrug] = useState<Drug | null>(null)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSuccess, setEditSuccess] = useState<string | null>(null)
  
  // Procurement dialog state
  const [procureDialogOpen, setProcureDialogOpen] = useState(false)
  const [procuringDrug, setProcuringDrug] = useState<Drug | null>(null)
  const [procureSubmitting, setProcureSubmitting] = useState(false)
  const [procureError, setProcureError] = useState<string | null>(null)
  const [procureSuccess, setProcureSuccess] = useState<string | null>(null)
  
  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Check permissions
  const canEditDrug = (drug: Drug) => {
    return user?.role === 'ADMIN' || drug.createdById === user?.id
  }
  
  const canDeleteDrug = (drug: Drug) => {
    return user?.role === 'ADMIN' || (drug.createdById === user?.id && (user?.role === 'PHARMACIST' || user?.role === 'TECHNICIAN'))
  }
  
  const canProcure = user?.role === 'ADMIN' || user?.role === 'PHARMACIST'

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
      setDrugs(Array.isArray(drugsData) ? drugsData : [])
      setLowStockDrugs(Array.isArray(lowStockData) ? lowStockData : [])
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
      const res = await fetch('/api/drugs', {
        method: 'POST',
        body: formData,
      })
      
      if (res.ok) {
        setDialogOpen(false)
        fetchData()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to create drug')
      }
    } catch (error) {
      console.error('Failed to create drug:', error)
      alert('Failed to create drug')
    } finally {
      setSubmitting(false)
    }
  }

  // Edit drug handler
  function openEditDialog(drug: Drug) {
    setEditingDrug(drug)
    setEditError(null)
    setEditSuccess(null)
    setEditDialogOpen(true)
  }

  async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingDrug) return
    
    setEditSubmitting(true)
    setEditError(null)
    setEditSuccess(null)
    
    const formData = new FormData(e.currentTarget)
    const body = {
      ndc: formData.get('ndc'),
      name: formData.get('name'),
      genericName: formData.get('genericName') || null,
      strength: formData.get('strength'),
      form: formData.get('form'),
      manufacturer: formData.get('manufacturer') || null,
      price: parseFloat(formData.get('price') as string),
      cost: parseFloat(formData.get('cost') as string),
      stock: parseInt(formData.get('stock') as string),
      reorderLevel: parseInt(formData.get('reorderLevel') as string),
      controlled: formData.get('controlled') === 'true',
      schedule: formData.get('schedule') || null,
    }
    
    try {
      const res = await fetch(`/api/drugs/${editingDrug.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      
      const data = await res.json()
      
      if (res.ok) {
        setEditSuccess('Drug updated successfully!')
        fetchData()
        setTimeout(() => {
          setEditDialogOpen(false)
          setEditingDrug(null)
        }, 1000)
      } else {
        setEditError(data.error || 'Failed to update drug')
      }
    } catch (error) {
      console.error('Failed to update drug:', error)
      setEditError('Failed to update drug')
    } finally {
      setEditSubmitting(false)
    }
  }

  // Procurement handler
  function openProcureDialog(drug: Drug) {
    setProcuringDrug(drug)
    setProcureError(null)
    setProcureSuccess(null)
    setProcureDialogOpen(true)
  }

  async function handleProcureSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!procuringDrug) return
    
    setProcureSubmitting(true)
    setProcureError(null)
    setProcureSuccess(null)
    
    const formData = new FormData(e.currentTarget)
    const body = {
      quantity: parseInt(formData.get('quantity') as string),
      supplier: formData.get('supplier'),
      lotNumber: formData.get('lotNumber'),
      expiryDate: formData.get('expiryDate'),
      costPerUnit: parseFloat(formData.get('costPerUnit') as string),
    }
    
    try {
      const res = await fetch(`/api/drugs/${procuringDrug.id}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      
      const data = await res.json()
      
      if (res.ok) {
        setProcureSuccess(data.message || 'Stock received successfully!')
        fetchData()
        setTimeout(() => {
          setProcureDialogOpen(false)
          setProcuringDrug(null)
        }, 1500)
      } else {
        setProcureError(data.error || 'Failed to procure drug')
      }
    } catch (error) {
      console.error('Failed to procure drug:', error)
      setProcureError('Failed to procure drug')
    } finally {
      setProcureSubmitting(false)
    }
  }

  // Delete handler
  async function handleDelete(drugId: string) {
    setDeletingId(drugId)
    setDeleteError(null)
    
    try {
      const res = await fetch(`/api/drugs/${drugId}`, {
        method: 'DELETE',
      })
      
      const data = await res.json()
      
      if (res.ok) {
        fetchData()
      } else {
        setDeleteError(data.error || 'Failed to delete drug')
      }
    } catch (error) {
      console.error('Failed to delete drug:', error)
      setDeleteError('Failed to delete drug')
    } finally {
      setDeletingId(null)
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

        {deleteError && (
          <div className="max-w-7xl mx-auto px-4 mt-4">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {deleteError}
            </div>
          </div>
        )}

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
                        <TableHead className="text-right">Actions</TableHead>
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
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {canProcure && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openProcureDialog(drug)}
                                    title="Receive Stock"
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  >
                                    <PackagePlus className="h-4 w-4" />
                                  </Button>
                                )}
                                {canEditDrug(drug) && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openEditDialog(drug)}
                                    title="Edit Drug"
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                )}
                                {canDeleteDrug(drug) && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        title="Delete Drug"
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Drug</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete <strong>{drug.name} {drug.strength}</strong>? 
                                          This will deactivate the drug from your inventory.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDelete(drug.id)}
                                          className="bg-red-600 hover:bg-red-700"
                                        >
                                          {deletingId === drug.id ? (
                                            <>
                                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                              Deleting...
                                            </>
                                          ) : (
                                            'Delete'
                                          )}
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </div>
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
                        <TableHead className="text-right">Actions</TableHead>
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
                            <TableCell className="text-right">
                              {canProcure && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openProcureDialog(drug)}
                                  className="text-green-600 border-green-200 hover:bg-green-50"
                                >
                                  <PackagePlus className="h-4 w-4 mr-1" />
                                  Receive Stock
                                </Button>
                              )}
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

      {/* Edit Drug Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Drug</DialogTitle>
          </DialogHeader>
          {editingDrug && (
            <form onSubmit={handleEditSubmit} className="grid grid-cols-2 gap-4 mt-4">
              {editError && (
                <div className="col-span-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {editError}
                </div>
              )}
              {editSuccess && (
                <div className="col-span-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                  {editSuccess}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="edit-ndc">NDC *</Label>
                <Input id="edit-ndc" name="ndc" required defaultValue={editingDrug.ndc} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Drug Name *</Label>
                <Input id="edit-name" name="name" required defaultValue={editingDrug.name} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-genericName">Generic Name</Label>
                <Input id="edit-genericName" name="genericName" defaultValue={editingDrug.genericName || ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-strength">Strength *</Label>
                <Input id="edit-strength" name="strength" required defaultValue={editingDrug.strength} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-form">Form *</Label>
                <select id="edit-form" name="form" required defaultValue={editingDrug.form} className="w-full border rounded-md p-2">
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
                <Label htmlFor="edit-manufacturer">Manufacturer</Label>
                <Input id="edit-manufacturer" name="manufacturer" defaultValue={editingDrug.manufacturer || ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-price">Retail Price ($) *</Label>
                <Input id="edit-price" name="price" type="number" step="0.01" required defaultValue={Number(editingDrug.price).toFixed(2)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-cost">Cost ($) *</Label>
                <Input id="edit-cost" name="cost" type="number" step="0.01" required defaultValue={Number(editingDrug.cost).toFixed(2)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-stock">Stock *</Label>
                <Input id="edit-stock" name="stock" type="number" required defaultValue={editingDrug.stock} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-reorderLevel">Reorder Level</Label>
                <Input id="edit-reorderLevel" name="reorderLevel" type="number" defaultValue={editingDrug.reorderLevel} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-controlled">Controlled Substance</Label>
                <select id="edit-controlled" name="controlled" defaultValue={editingDrug.controlled.toString()} className="w-full border rounded-md p-2">
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-schedule">Schedule (if controlled)</Label>
                <select id="edit-schedule" name="schedule" defaultValue={editingDrug.schedule || ''} className="w-full border rounded-md p-2">
                  <option value="">N/A</option>
                  <option value="II">Schedule II</option>
                  <option value="III">Schedule III</option>
                  <option value="IV">Schedule IV</option>
                  <option value="V">Schedule V</option>
                </select>
              </div>
              <div className="col-span-2 flex justify-end gap-2 mt-4">
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editSubmitting} className="bg-blue-600 hover:bg-blue-700">
                  {editSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Procurement Dialog */}
      <Dialog open={procureDialogOpen} onOpenChange={setProcureDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Receive Stock</DialogTitle>
          </DialogHeader>
          {procuringDrug && (
            <>
              <div className="bg-slate-50 rounded-lg p-4 mb-4">
                <p className="font-medium text-slate-800">{procuringDrug.name} {procuringDrug.strength}</p>
                <p className="text-sm text-slate-500">{procuringDrug.form} • NDC: {procuringDrug.ndc}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm text-slate-600">Current Stock:</span>
                  <span className={`font-bold ${procuringDrug.stock === 0 ? 'text-red-600' : procuringDrug.stock <= procuringDrug.reorderLevel ? 'text-orange-600' : 'text-green-600'}`}>
                    {procuringDrug.stock} units
                  </span>
                </div>
              </div>
              <form onSubmit={handleProcureSubmit} className="space-y-4">
                {procureError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {procureError}
                  </div>
                )}
                {procureSuccess && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                    {procureSuccess}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="procure-quantity">Quantity to Receive *</Label>
                  <Input id="procure-quantity" name="quantity" type="number" required min="1" placeholder="Enter quantity" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="procure-supplier">Supplier Name *</Label>
                  <Input id="procure-supplier" name="supplier" required placeholder="e.g., McKesson, Cardinal Health" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="procure-lotNumber">Lot Number</Label>
                  <Input id="procure-lotNumber" name="lotNumber" placeholder="e.g., ABC123" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="procure-expiryDate">Expiry Date</Label>
                  <Input id="procure-expiryDate" name="expiryDate" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="procure-costPerUnit">Cost Per Unit ($) *</Label>
                  <Input id="procure-costPerUnit" name="costPerUnit" type="number" step="0.01" required placeholder="0.00" />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setProcureDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={procureSubmitting} className="bg-green-600 hover:bg-green-700">
                    {procureSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <PackagePlus className="h-4 w-4 mr-2" />
                        Receive Stock
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </AuthGuard>
  )
}
