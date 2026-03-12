'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { 
  Search, 
  User, 
  Pill,
  AlertTriangle,
  ArrowLeft,
  LogOut
} from 'lucide-react'
import Link from 'next/link'
import { AuthGuard, useAuth } from '@/components/auth/auth-guard'

interface Patient {
  id: string
  firstName: string
  lastName: string
  dob: string
  allergies: string[]
}

interface Drug {
  id: string
  name: string
  strength: string
  form: string
  price: number
  stock: number
  reorderLevel: number
  controlled: boolean
}

function NewPrescriptionContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedPatientId = searchParams.get('patientId')

  const [step, setStep] = useState<'patient' | 'drug' | 'details'>(preselectedPatientId ? 'drug' : 'patient')
  const [patientSearch, setPatientSearch] = useState('')
  const [drugSearch, setDrugSearch] = useState('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [drugs, setDrugs] = useState<Drug[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [selectedDrug, setSelectedDrug] = useState<Drug | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form data
  const [quantity, setQuantity] = useState('30')
  const [daysSupply, setDaysSupply] = useState('30')
  const [directions, setDirections] = useState('')
  const [refills, setRefills] = useState('0')

  useEffect(() => {
    if (preselectedPatientId) {
      fetchPatientById(preselectedPatientId)
    }
  }, [preselectedPatientId])

  useEffect(() => {
    if (patientSearch.length >= 2) {
      searchPatients()
    } else {
      setPatients([])
    }
  }, [patientSearch])

  useEffect(() => {
    if (drugSearch.length >= 2) {
      searchDrugs()
    } else {
      setDrugs([])
    }
  }, [drugSearch])

  async function fetchPatientById(id: string) {
    try {
      const res = await fetch(`/api/patients/${id}`)
      const patient = await res.json()
      if (patient) {
        setSelectedPatient(patient)
      }
    } catch (error) {
      console.error('Failed to fetch patient:', error)
    }
  }

  async function searchPatients() {
    setLoading(true)
    try {
      const res = await fetch(`/api/patients?search=${encodeURIComponent(patientSearch)}`)
      const data = await res.json()
      setPatients(data.slice(0, 5))
    } catch (error) {
      console.error('Failed to search patients:', error)
    } finally {
      setLoading(false)
    }
  }

  async function searchDrugs() {
    setLoading(true)
    try {
      const res = await fetch(`/api/drugs?search=${encodeURIComponent(drugSearch)}`)
      const data = await res.json()
      setDrugs(data.slice(0, 5))
    } catch (error) {
      console.error('Failed to search drugs:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    if (!selectedPatient || !selectedDrug) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/prescriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          drugId: selectedDrug.id,
          quantity: parseFloat(quantity),
          daysSupply: parseInt(daysSupply),
          directions,
          refills: parseInt(refills),
        }),
      })
      
      if (res.ok) {
        window.location.href = '/'
      }
    } catch (error) {
      console.error('Failed to create prescription:', error)
    } finally {
      setSubmitting(false)
    }
  }

  // Check for drug-allergy interactions
  function checkAllergyInteraction(): string | null {
    if (!selectedPatient || !selectedDrug) return null
    
    const drugNameLower = selectedDrug.name.toLowerCase()
    for (const allergy of selectedPatient.allergies) {
      if (drugNameLower.includes(allergy.toLowerCase())) {
        return `Warning: Patient is allergic to ${allergy}!`
      }
    }
    return null
  }

  const allergyWarning = checkAllergyInteraction()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <AuthGuard>
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-blue-600">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl font-bold text-slate-800">New Prescription</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-800">{user?.name}</p>
              <p className="text-xs text-slate-500">{user?.role}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1" />
              Logout
            </Button>
          </div>
          
          {/* Progress Steps */}
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === 'patient' ? 'bg-blue-600 text-white' : 
              selectedPatient ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'
            }`}>
              {selectedPatient ? '✓' : '1'}
            </div>
            <div className={`w-12 h-1 ${selectedPatient ? 'bg-green-500' : 'bg-slate-200'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === 'drug' ? 'bg-blue-600 text-white' : 
              selectedDrug ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'
            }`}>
              {selectedDrug ? '✓' : '2'}
            </div>
            <div className={`w-12 h-1 ${selectedDrug ? 'bg-green-500' : 'bg-slate-200'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === 'details' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
            }`}>
              3
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Step 1: Select Patient */}
        {step === 'patient' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Select Patient
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by patient name or phone..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {loading && <div className="text-center py-4 text-slate-500">Searching...</div>}

              <div className="space-y-2">
                {patients.map((patient) => (
                  <div
                    key={patient.id}
                    onClick={() => {
                      setSelectedPatient(patient)
                      setStep('drug')
                    }}
                    className="p-4 border rounded-lg hover:bg-blue-50 cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{patient.firstName} {patient.lastName}</p>
                        <p className="text-sm text-slate-500">
                          DOB: {new Date(patient.dob).toLocaleDateString()}
                        </p>
                      </div>
                      {patient.allergies.length > 0 && (
                        <div className="flex gap-1">
                          {patient.allergies.slice(0, 2).map((allergy, i) => (
                            <Badge key={i} variant="destructive" className="text-xs">
                              {allergy}
                            </Badge>
                          ))}
                          {patient.allergies.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{patient.allergies.length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {patientSearch.length >= 2 && patients.length === 0 && !loading && (
                <div className="text-center py-4">
                  <p className="text-slate-500 mb-2">No patients found</p>
                  <Link href="/patients">
                    <Button variant="outline">Add New Patient</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Select Drug */}
        {step === 'drug' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pill className="h-5 w-5" />
                Select Medication
              </CardTitle>
              {selectedPatient && (
                <div className="text-sm text-slate-600">
                  For: <span className="font-medium">{selectedPatient.firstName} {selectedPatient.lastName}</span>
                  {selectedPatient.allergies.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      Allergies: {selectedPatient.allergies.join(', ')}
                    </div>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by drug name or NDC..."
                  value={drugSearch}
                  onChange={(e) => setDrugSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {loading && <div className="text-center py-4 text-slate-500">Searching...</div>}

              <div className="space-y-2">
                {drugs.map((drug) => {
                  const stockStatus = drug.stock === 0 ? 'out' : drug.stock <= drug.reorderLevel ? 'low' : 'ok'
                  return (
                    <div
                      key={drug.id}
                      onClick={() => {
                        if (drug.stock > 0) {
                          setSelectedDrug(drug)
                          setStep('details')
                        }
                      }}
                      className={`p-4 border rounded-lg cursor-pointer transition ${
                        drug.stock === 0 
                          ? 'bg-slate-100 cursor-not-allowed opacity-60' 
                          : 'hover:bg-blue-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{drug.name} {drug.strength}</p>
                          <p className="text-sm text-slate-500">{drug.form}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-medium ${
                            stockStatus === 'out' ? 'text-red-600' : 
                            stockStatus === 'low' ? 'text-orange-600' : 'text-green-600'
                          }`}>
                            {drug.stock === 0 ? 'Out of Stock' : `Stock: ${drug.stock}`}
                          </p>
                          <p className="text-xs text-slate-400">
                            ${Number(drug.price).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <Button variant="outline" onClick={() => setStep('patient')} className="mt-4">
                Back to Patient Selection
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Prescription Details */}
        {step === 'details' && selectedPatient && selectedDrug && (
          <div className="space-y-4">
            {allergyWarning && (
              <Card className="border-red-300 bg-red-50">
                <CardContent className="p-4 flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-medium">{allergyWarning}</span>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Prescription Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Patient & Drug Summary */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-xs text-slate-500">Patient</p>
                    <p className="font-medium">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Medication</p>
                    <p className="font-medium">{selectedDrug.name} {selectedDrug.strength}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Form</p>
                    <p>{selectedDrug.form}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Price</p>
                    <p>${Number(selectedDrug.price).toFixed(2)}</p>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="daysSupply">Days Supply *</Label>
                    <Input
                      id="daysSupply"
                      type="number"
                      value={daysSupply}
                      onChange={(e) => setDaysSupply(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="directions">Directions (Sig) *</Label>
                  <Textarea
                    id="directions"
                    placeholder="e.g., Take 1 tablet by mouth daily"
                    value={directions}
                    onChange={(e) => setDirections(e.target.value)}
                    rows={3}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="refills">Refills Authorized</Label>
                  <Input
                    id="refills"
                    type="number"
                    value={refills}
                    onChange={(e) => setRefills(e.target.value)}
                    min="0"
                    max="12"
                  />
                </div>

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setStep('drug')}>
                    Back
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || !directions || !quantity}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {submitting ? 'Creating...' : 'Create Prescription'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
    </AuthGuard>
  )
}

export default function NewPrescriptionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>}>
      <NewPrescriptionContent />
    </Suspense>
  )
}
