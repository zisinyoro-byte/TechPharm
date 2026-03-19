'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Settings, 
  Percent, 
  DollarSign, 
  Building, 
  Phone, 
  FileText,
  ArrowLeft,
  LogOut,
  Save,
  Loader2,
  CheckCircle
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/auth/auth-guard'

interface Setting {
  id: string
  key: string
  value: string
  description: string | null
  category: string
}

interface SettingsByCategory {
  [category: string]: Setting[]
}

interface SettingsContentProps {
  user: { id: string; name: string; email: string; role: string }
}

function SettingsContent({ user }: SettingsContentProps) {
  const router = useRouter()
  const [settings, setSettings] = useState<SettingsByCategory>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [vatEnabled, setVatEnabled] = useState(false)
  const [vatPercentage, setVatPercentage] = useState('0')
  const [currencySymbol, setCurrencySymbol] = useState('$')
  const [currencyCode, setCurrencyCode] = useState('USD')
  const [pharmacyName, setPharmacyName] = useState('')
  const [pharmacyAddress, setPharmacyAddress] = useState('')
  const [pharmacyPhone, setPharmacyPhone] = useState('')
  const [receiptFooter, setReceiptFooter] = useState('')

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    try {
      const res = await fetch('/api/settings')
      if (!res.ok) throw new Error('Failed to fetch settings')
      const data = await res.json()
      setSettings(data)

      // Populate form fields
      if (data.tax) {
        const vatEnabledSetting = data.tax.find((s: Setting) => s.key === 'vat_enabled')
        const vatPercentageSetting = data.tax.find((s: Setting) => s.key === 'vat_percentage')
        setVatEnabled(vatEnabledSetting?.value === 'true')
        setVatPercentage(vatPercentageSetting?.value || '0')
      }
      if (data.general) {
        const currencySymbolSetting = data.general.find((s: Setting) => s.key === 'currency_symbol')
        const currencyCodeSetting = data.general.find((s: Setting) => s.key === 'currency_code')
        const pharmacyNameSetting = data.general.find((s: Setting) => s.key === 'pharmacy_name')
        const pharmacyAddressSetting = data.general.find((s: Setting) => s.key === 'pharmacy_address')
        const pharmacyPhoneSetting = data.general.find((s: Setting) => s.key === 'pharmacy_phone')
        setCurrencySymbol(currencySymbolSetting?.value || '$')
        setCurrencyCode(currencyCodeSetting?.value || 'USD')
        setPharmacyName(pharmacyNameSetting?.value || '')
        setPharmacyAddress(pharmacyAddressSetting?.value || '')
        setPharmacyPhone(pharmacyPhoneSetting?.value || '')
      }
      if (data.pos) {
        const receiptFooterSetting = data.pos.find((s: Setting) => s.key === 'receipt_footer')
        setReceiptFooter(receiptFooterSetting?.value || '')
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveTaxSettings() {
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: [
            { key: 'vat_enabled', value: vatEnabled.toString() },
            { key: 'vat_percentage', value: vatPercentage },
          ],
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save settings')
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Failed to save settings:', error)
      setError(error instanceof Error ? error.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveGeneralSettings() {
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: [
            { key: 'currency_symbol', value: currencySymbol },
            { key: 'currency_code', value: currencyCode },
            { key: 'pharmacy_name', value: pharmacyName },
            { key: 'pharmacy_address', value: pharmacyAddress },
            { key: 'pharmacy_phone', value: pharmacyPhone },
          ],
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save settings')
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Failed to save settings:', error)
      setError(error instanceof Error ? error.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  async function handleSavePosSettings() {
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: [
            { key: 'receipt_footer', value: receiptFooter },
          ],
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save settings')
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Failed to save settings:', error)
      setError(error instanceof Error ? error.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-blue-600">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2">
              <Settings className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-bold text-slate-800">Settings</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-4">
              <Link href="/inventory" className="text-slate-600 hover:text-blue-600 transition">Inventory</Link>
              <Link href="/patients" className="text-slate-600 hover:text-blue-600 transition">Patients</Link>
              <Link href="/users" className="text-slate-600 hover:text-blue-600 transition">Users</Link>
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

      <main className="max-w-4xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {saved && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Settings saved successfully!
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading settings...</div>
        ) : (
          <Tabs defaultValue="tax" className="space-y-6">
            <TabsList className="bg-white">
              <TabsTrigger value="tax" className="gap-2">
                <Percent className="h-4 w-4" />
                Tax / VAT
              </TabsTrigger>
              <TabsTrigger value="general" className="gap-2">
                <Building className="h-4 w-4" />
                General
              </TabsTrigger>
              <TabsTrigger value="pos" className="gap-2">
                <FileText className="h-4 w-4" />
                POS & Receipts
              </TabsTrigger>
            </TabsList>

            {/* Tax / VAT Settings */}
            <TabsContent value="tax">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Percent className="h-5 w-5 text-blue-600" />
                    VAT Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure Value Added Tax (VAT) settings for eligible items. VAT will be automatically calculated for items marked as VAT-eligible in the inventory.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <Label htmlFor="vat-enabled" className="text-base font-medium">Enable VAT</Label>
                      <p className="text-sm text-slate-500">Turn on VAT calculation for eligible items</p>
                    </div>
                    <Switch
                      id="vat-enabled"
                      checked={vatEnabled}
                      onCheckedChange={setVatEnabled}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vat-percentage">VAT Percentage (%)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="vat-percentage"
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={vatPercentage}
                        onChange={(e) => setVatPercentage(e.target.value)}
                        disabled={!vatEnabled}
                        className="max-w-32"
                      />
                      <span className="text-slate-500">%</span>
                    </div>
                    <p className="text-sm text-slate-500">
                      Enter the VAT rate (e.g., 15 for 15%). This will be applied to items marked as VAT-eligible.
                    </p>
                  </div>

                  {/* Preview */}
                  {vatEnabled && parseFloat(vatPercentage) > 0 && (
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm font-medium text-blue-800 mb-2">VAT Preview</p>
                      <div className="text-sm text-blue-700 space-y-1">
                        <p>Item Price: $100.00</p>
                        <p>VAT ({vatPercentage}%): ${(100 * parseFloat(vatPercentage) / 100).toFixed(2)}</p>
                        <p className="font-medium">Total: ${(100 * (1 + parseFloat(vatPercentage) / 100)).toFixed(2)}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSaveTaxSettings} disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Tax Settings
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* General Settings */}
            <TabsContent value="general">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5 text-blue-600" />
                    General Settings
                  </CardTitle>
                  <CardDescription>
                    Configure your pharmacy information and regional settings.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="currency-symbol">Currency Symbol</Label>
                      <Input
                        id="currency-symbol"
                        value={currencySymbol}
                        onChange={(e) => setCurrencySymbol(e.target.value)}
                        placeholder="$"
                        className="max-w-32"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currency-code">Currency Code</Label>
                      <Input
                        id="currency-code"
                        value={currencyCode}
                        onChange={(e) => setCurrencyCode(e.target.value)}
                        placeholder="USD"
                        className="max-w-32"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pharmacy-name">Pharmacy Name</Label>
                    <Input
                      id="pharmacy-name"
                      value={pharmacyName}
                      onChange={(e) => setPharmacyName(e.target.value)}
                      placeholder="TechPharm Pharmacy"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pharmacy-address">Pharmacy Address</Label>
                    <Input
                      id="pharmacy-address"
                      value={pharmacyAddress}
                      onChange={(e) => setPharmacyAddress(e.target.value)}
                      placeholder="123 Main Street, City, State 12345"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pharmacy-phone">Pharmacy Phone</Label>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-slate-400" />
                      <Input
                        id="pharmacy-phone"
                        value={pharmacyPhone}
                        onChange={(e) => setPharmacyPhone(e.target.value)}
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSaveGeneralSettings} disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save General Settings
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* POS Settings */}
            <TabsContent value="pos">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    POS & Receipt Settings
                  </CardTitle>
                  <CardDescription>
                    Customize receipt appearance and POS behavior.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="receipt-footer">Receipt Footer Message</Label>
                    <Input
                      id="receipt-footer"
                      value={receiptFooter}
                      onChange={(e) => setReceiptFooter(e.target.value)}
                      placeholder="Thank you for your business!"
                    />
                    <p className="text-sm text-slate-500">
                      This message will appear at the bottom of printed receipts.
                    </p>
                  </div>

                  {/* Receipt Preview */}
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm font-medium text-slate-700 mb-3">Receipt Preview</p>
                    <div className="bg-white p-4 rounded border font-mono text-sm max-w-xs">
                      <div className="text-center mb-3">
                        <p className="font-bold">{pharmacyName || 'TechPharm Pharmacy'}</p>
                        {pharmacyAddress && <p className="text-xs">{pharmacyAddress}</p>}
                        {pharmacyPhone && <p className="text-xs">{pharmacyPhone}</p>}
                      </div>
                      <div className="border-t border-dashed pt-2 mb-2">
                        <p className="text-xs">Sample Item</p>
                        <p className="text-xs">Qty: 1 @ {currencySymbol}10.00...{currencySymbol}10.00</p>
                        {vatEnabled && parseFloat(vatPercentage) > 0 && (
                          <p className="text-xs">VAT ({vatPercentage}%)...{currencySymbol}{(10 * parseFloat(vatPercentage) / 100).toFixed(2)}</p>
                        )}
                        <p className="text-xs font-bold">Total: {currencySymbol}{vatEnabled ? (10 * (1 + parseFloat(vatPercentage) / 100)).toFixed(2) : '10.00'}</p>
                      </div>
                      <div className="border-t border-dashed pt-2 text-center">
                        <p className="text-xs">{receiptFooter || 'Thank you for your business!'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSavePosSettings} disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save POS Settings
                        </>
                      )}
                    </Button>
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

export default function SettingsPage() {
  return (
    <AuthGuard requireAdmin>
      {(user) => <SettingsContent user={user} />}
    </AuthGuard>
  )
}
