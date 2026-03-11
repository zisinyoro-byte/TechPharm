'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, Plus, User, Phone, Calendar, AlertTriangle, LogOut } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuthGuard, useAuth } from '@/components/auth/auth-guard'

interface Patient {
  id: string
  firstName: string
  lastName: string
  dob: string
  phone: string | null
  email: string | null
  allergies: string[]
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
      setPatients(data)
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
      await fetch('/api/patients', {
        method: 'POST',
        body: formData,
      })
      setDialogOpen(false)
      fetchPatients()
    } catch (error) {
      console.error('Failed to create patient:', error)
    } finally {
      setSubmitting(false)
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
                          {patient.allergies.length > 0 ? (
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
                        <Link href={`/prescriptions/new?patientId=${patient.id}`}>
                          <Button size="sm" variant="outline">
                            <Plus className="h-3 w-3 mr-1" />
                            New Rx
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
    </AuthGuard>
  )
}
