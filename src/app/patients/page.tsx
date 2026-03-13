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
import { Search, Plus, User, Phone, Calendar, AlertTriangle, LogOut, Edit, Trash2, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuthGuard, useAuth } from '@/components/auth/auth-guard'

interface Patient {
  id: string
  firstName: string
  lastName: string
  dob: string
  gender: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  allergies: string[]
  insuranceId: string | null
  insuranceName: string | null
  notes: string | null
  createdById: string | null
  prescriptions: { id: string; rxNumber: string }[]
}

export default function PatientsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSuccess, setEditSuccess] = useState<string | null>(null)
  
  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Check permissions
  const canEditPatient = (patient: Patient) => {
    return user?.role === 'ADMIN' || patient.createdById === user?.id
  }
  
  const canDeletePatient = (patient: Patient) => {
    return user?.role === 'ADMIN' || (patient.createdById === user?.id && (user?.role === 'PHARMACIST' || user?.role === 'TECHNICIAN'))
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  useEffect(() => {
    fetchPatients()
  }, [search])

  async function fetchPatients() {
    setLoading(true)
    try {
      const url = search ? `/api/patients?search=${encodeURIComponent(search)}` : '/api/patients'
      const res = await fetch(url)
      const data = await res.json()
      setPatients(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch patients:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    
    const formData = new FormData(e.currentTarget)
    
    try {
      const res = await fetch('/api/patients', {
        method: 'POST',
        body: formData,
      })
      
      if (res.ok) {
        setDialogOpen(false)
        fetchPatients()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to create patient')
      }
    } catch (error) {
      console.error('Failed to create patient:', error)
      alert('Failed to create patient')
    } finally {
      setSubmitting(false)
    }
  }

  // Edit patient handler
  function openEditDialog(patient: Patient) {
    setEditingPatient(patient)
    setEditError(null)
    setEditSuccess(null)
    setEditDialogOpen(true)
  }

  async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingPatient) return
    
    setEditSubmitting(true)
    setEditError(null)
    setEditSuccess(null)
    
    const formData = new FormData(e.currentTarget)
    const body = {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      dob: formData.get('dob'),
      gender: formData.get('gender') || null,
      phone: formData.get('phone') || null,
      email: formData.get('email') || null,
      address: formData.get('address') || null,
      city: formData.get('city') || null,
      state: formData.get('state') || null,
      zip: formData.get('zip') || null,
      allergies: formData.get('allergies') ? (formData.get('allergies') as string).split(',').map(a => a.trim()).filter(Boolean) : [],
      insuranceId: formData.get('insuranceId') || null,
      insuranceName: formData.get('insuranceName') || null,
      notes: formData.get('notes') || null,
    }
    
    try {
      const res = await fetch(`/api/patients/${editingPatient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      
      const data = await res.json()
      
      if (res.ok) {
        setEditSuccess('Patient updated successfully!')
        fetchPatients()
        setTimeout(() => {
          setEditDialogOpen(false)
          setEditingPatient(null)
        }, 1000)
      } else {
        setEditError(data.error || 'Failed to update patient')
      }
    } catch (error) {
      console.error('Failed to update patient:', error)
      setEditError('Failed to update patient')
    } finally {
      setEditSubmitting(false)
    }
  }

  // Delete handler
  async function handleDelete(patientId: string) {
    setDeletingId(patientId)
    setDeleteError(null)
    
    try {
      const res = await fetch(`/api/patients/${patientId}`, {
        method: 'DELETE',
      })
      
      const data = await res.json()
      
      if (res.ok) {
        fetchPatients()
      } else {
        setDeleteError(data.error || 'Failed to delete patient')
      }
    } catch (error) {
      console.error('Failed to delete patient:', error)
      setDeleteError('Failed to delete patient')
    } finally {
      setDeletingId(null)
    }
  }

  function calculateAge(dob: string): number {
    const birth = new Date(dob)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age
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
              <h1 className="text-xl font-bold text-slate-800">Patients</h1>
            </div>
            <div className="flex items-center gap-4">
              <nav className="flex items-center gap-4">
                <Link href="/prescriptions/new" className="text-slate-600 hover:text-blue-600 transition">New Rx</Link>
                <Link href="/inventory" className="text-slate-600 hover:text-blue-600 transition">Inventory</Link>
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
        {/* Search and Add */}
        <div className="flex items-center justify-between mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search patients by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Patient
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Patient</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input id="firstName" name="firstName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input id="lastName" name="lastName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dob">Date of Birth *</Label>
                  <Input id="dob" name="dob" type="date" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <select id="gender" name="gender" className="w-full border rounded-md p-2">
                    <option value="">Select...</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="O">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" type="tel" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" name="address" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" name="city" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" name="state" maxLength={2} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="allergies">Allergies (comma-separated)</Label>
                  <Input id="allergies" name="allergies" placeholder="e.g., Penicillin, Sulfa, Aspirin" />
                </div>
                <div className="col-span-2 flex justify-end gap-2 mt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
                    {submitting ? 'Saving...' : 'Save Patient'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Patients Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-12 text-slate-500">Loading patients...</div>
            ) : patients.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                No patients found. Add your first patient to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient Name</TableHead>
                    <TableHead>DOB / Age</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Allergies</TableHead>
                    <TableHead>Rx Count</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patients.map((patient) => (
                    <TableRow key={patient.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium">{patient.firstName} {patient.lastName}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-slate-600">
                          <Calendar className="h-3 w-3" />
                          {new Date(patient.dob).toLocaleDateString()} ({calculateAge(patient.dob)} yrs)
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {patient.phone && (
                            <div className="flex items-center gap-1 text-slate-600">
                              <Phone className="h-3 w-3" />
                              {patient.phone}
                            </div>
                          )}
                          {patient.email && (
                            <div className="text-slate-400 text-xs">{patient.email}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {patient.allergies && patient.allergies.length > 0 ? (
                            patient.allergies.map((allergy, i) => (
                              <Badge key={i} variant="destructive" className="text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                {allergy}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-slate-400 text-sm">None documented</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{patient.prescriptions?.length || 0}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/prescriptions/new?patientId=${patient.id}`}>
                            <Button size="sm" variant="outline" title="New Prescription">
                              <Plus className="h-3 w-3" />
                            </Button>
                          </Link>
                          {canEditPatient(patient) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditDialog(patient)}
                              title="Edit Patient"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canDeletePatient(patient) && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  title="Delete Patient"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Patient</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete <strong>{patient.firstName} {patient.lastName}</strong>? 
                                    This will also delete all their prescriptions. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(patient.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    {deletingId === patient.id ? (
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
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Edit Patient Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Patient</DialogTitle>
          </DialogHeader>
          {editingPatient && (
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
                <Label htmlFor="edit-firstName">First Name *</Label>
                <Input id="edit-firstName" name="firstName" required defaultValue={editingPatient.firstName} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-lastName">Last Name *</Label>
                <Input id="edit-lastName" name="lastName" required defaultValue={editingPatient.lastName} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-dob">Date of Birth *</Label>
                <Input id="edit-dob" name="dob" type="date" required defaultValue={editingPatient.dob ? editingPatient.dob.split('T')[0] : ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-gender">Gender</Label>
                <select id="edit-gender" name="gender" defaultValue={editingPatient.gender || ''} className="w-full border rounded-md p-2">
                  <option value="">Select...</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="O">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input id="edit-phone" name="phone" type="tel" defaultValue={editingPatient.phone || ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input id="edit-email" name="email" type="email" defaultValue={editingPatient.email || ''} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="edit-address">Address</Label>
                <Input id="edit-address" name="address" defaultValue={editingPatient.address || ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-city">City</Label>
                <Input id="edit-city" name="city" defaultValue={editingPatient.city || ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-state">State</Label>
                <Input id="edit-state" name="state" maxLength={2} defaultValue={editingPatient.state || ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-zip">Zip</Label>
                <Input id="edit-zip" name="zip" defaultValue={editingPatient.zip || ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-insuranceId">Insurance ID</Label>
                <Input id="edit-insuranceId" name="insuranceId" defaultValue={editingPatient.insuranceId || ''} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="edit-allergies">Allergies (comma-separated)</Label>
                <Input id="edit-allergies" name="allergies" defaultValue={editingPatient.allergies ? editingPatient.allergies.join(', ') : ''} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="edit-insuranceName">Insurance Name</Label>
                <Input id="edit-insuranceName" name="insuranceName" defaultValue={editingPatient.insuranceName || ''} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Input id="edit-notes" name="notes" defaultValue={editingPatient.notes || ''} />
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
    </div>
    </AuthGuard>
  )
}
