'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, Plus, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Prescription {
  id: string
  rxNumber: string
  status: string
  quantity: number
  daysSupply: number
  directions: string
  patient: { firstName: string; lastName: string }
  drug: { name: string; strength: string; form: string }
  createdAt: string
}

const statusColors: Record<string, string> = {
  QUEUE: 'bg-slate-100 text-slate-700',
  ENTRY: 'bg-blue-100 text-blue-700',
  FILL: 'bg-amber-100 text-amber-700',
  VERIFY: 'bg-purple-100 text-purple-700',
  COMPLETE: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  ON_HOLD: 'bg-orange-100 text-orange-700',
}

export default function PrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  useEffect(() => {
    fetchPrescriptions()
  }, [])

  async function fetchPrescriptions() {
    try {
      const res = await fetch('/api/prescriptions')
      const data = await res.json()
      setPrescriptions(data)
    } catch (error) {
      console.error('Failed to fetch prescriptions:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredPrescriptions = prescriptions.filter(p => {
    const matchesSearch = 
      p.rxNumber.toLowerCase().includes(search.toLowerCase()) ||
      `${p.patient.firstName} ${p.patient.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      p.drug.name.toLowerCase().includes(search.toLowerCase())
    
    if (activeTab === 'all') return matchesSearch
    if (activeTab === 'active') return matchesSearch && !['COMPLETE', 'CANCELLED'].includes(p.status)
    return matchesSearch && p.status === activeTab.toUpperCase()
  })

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-blue-600">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl font-bold text-slate-800">All Prescriptions</h1>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/prescriptions/new">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                New Rx
              </Button>
            </Link>
            <Link href="/patients" className="text-slate-600 hover:text-blue-600 transition">Patients</Link>
            <Link href="/inventory" className="text-slate-600 hover:text-blue-600 transition">Inventory</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by RX#, patient, or drug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="queue">Queue</TabsTrigger>
            <TabsTrigger value="complete">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="text-center py-12 text-slate-500">Loading prescriptions...</div>
                ) : filteredPrescriptions.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    No prescriptions found.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>RX #</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead>Drug</TableHead>
                        <TableHead>Qty / Days</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPrescriptions.map((rx) => (
                        <TableRow key={rx.id}>
                          <TableCell className="font-mono font-medium">{rx.rxNumber}</TableCell>
                          <TableCell>{rx.patient.firstName} {rx.patient.lastName}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{rx.drug.name} {rx.drug.strength}</p>
                              <p className="text-xs text-slate-500">{rx.drug.form}</p>
                            </div>
                          </TableCell>
                          <TableCell>{rx.quantity} / {rx.daysSupply} days</TableCell>
                          <TableCell>
                            <Badge className={statusColors[rx.status] || ''}>
                              {rx.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {new Date(rx.createdAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
