'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  ShoppingCart, 
  Search, 
  Plus, 
  Minus, 
  ArrowLeft,
  DollarSign,
  CreditCard,
  Banknote,
  Receipt,
  Check,
  X,
  Package,
  LogOut
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuthGuard, useAuth } from '@/components/auth/auth-guard'

interface Drug {
  id: string
  ndc: string
  name: string
  strength: string
  form: string
  price: number
  stock: number
  controlled: boolean
}

interface CartItem extends Drug {
  quantity: number
  discount: number
  subtotal: number
}

export default function POSPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Drug[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [searching, setSearching] = useState(false)
  const [paymentDialog, setPaymentDialog] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH')
  const [amountPaid, setAmountPaid] = useState('')
  const [receipt, setReceipt] = useState<any>(null)

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0)
  const tax = 0 // Pharmacy items typically tax-exempt
  const total = subtotal + tax
  const change = Math.max(0, parseFloat(amountPaid || '0') - total)

  // Search drugs
  const searchDrugs = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const res = await fetch(`/api/drugs/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      setSearchResults(data)
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => {
      searchDrugs(searchQuery)
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchQuery, searchDrugs])

  // Add to cart
  function addToCart(drug: Drug) {
    const existing = cart.find(item => item.id === drug.id)
    
    if (existing) {
      if (existing.quantity >= drug.stock) {
        alert('Insufficient stock')
        return
      }
      setCart(cart.map(item =>
        item.id === drug.id
          ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price }
          : item
      ))
    } else {
      if (drug.stock < 1) {
        alert('Out of stock')
        return
      }
      setCart([...cart, {
        ...drug,
        quantity: 1,
        discount: 0,
        subtotal: drug.price,
      }])
    }
    setSearchQuery('')
    setSearchResults([])
  }

  // Update quantity
  function updateQuantity(id: string, delta: number) {
    setCart(cart.map(item => {
      if (item.id !== id) return item
      const newQty = Math.max(1, Math.min(item.quantity + delta, item.stock))
      return { ...item, quantity: newQty, subtotal: newQty * item.price - item.discount }
    }))
  }

  // Remove from cart
  function removeFromCart(id: string) {
    setCart(cart.filter(item => item.id !== id))
  }

  // Clear cart
  function clearCart() {
    setCart([])
    setReceipt(null)
  }

  // Process payment
  async function processPayment() {
    if (cart.length === 0) return
    if (paymentMethod === 'CASH' && parseFloat(amountPaid || '0') < total) {
      alert('Insufficient payment amount')
      return
    }

    setProcessing(true)
    try {
      const res = await fetch('/api/pos/sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(item => ({
            drugId: item.id,
            quantity: item.quantity,
            unitPrice: item.price,
            discount: item.discount,
          })),
          paymentMethod,
          amountPaid: paymentMethod === 'CASH' ? parseFloat(amountPaid) : total,
        }),
      })

      const data = await res.json()
      
      if (data.error) {
        alert(data.error)
      } else {
        setReceipt(data)
        setPaymentDialog(false)
        clearCart()
      }
    } catch (error) {
      console.error('Payment failed:', error)
      alert('Payment failed. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-blue-600">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-6 w-6 text-green-600" />
                <h1 className="text-xl font-bold text-slate-800">Point of Sale</h1>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <nav className="flex items-center gap-4">
                <Link href="/" className="text-slate-600 hover:text-blue-600 transition">Dashboard</Link>
                <Link href="/patients" className="text-slate-600 hover:text-blue-600 transition">Patients</Link>
                <Link href="/inventory" className="text-slate-600 hover:text-blue-600 transition">Inventory</Link>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Product Search & Results */}
          <div className="lg:col-span-2 space-y-4">
            {/* Search */}
            <Card>
              <CardContent className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    placeholder="Search by drug name, NDC, or barcode..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-12 text-lg"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Search Results */}
            {searchQuery.length >= 2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Search Results</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {searching ? (
                    <div className="text-center py-8 text-slate-500">Searching...</div>
                  ) : searchResults.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">No products found</div>
                  ) : (
                    <div className="divide-y">
                      {searchResults.map((drug) => (
                        <div
                          key={drug.id}
                          className="flex items-center justify-between p-4 hover:bg-slate-50 cursor-pointer"
                          onClick={() => addToCart(drug)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Package className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium">{drug.name} {drug.strength}</p>
                              <p className="text-sm text-slate-500">
                                {drug.form} • NDC: {drug.ndc}
                                {drug.controlled && (
                                  <Badge variant="destructive" className="ml-2 text-xs">Controlled</Badge>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg">${drug.price.toFixed(2)}</p>
                            <p className={`text-sm ${drug.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              Stock: {drug.stock}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Receipt Display */}
            {receipt && (
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-6">
                  <div className="text-center mb-4">
                    <Check className="h-12 w-12 text-green-600 mx-auto mb-2" />
                    <h3 className="text-lg font-bold text-green-700">Sale Complete!</h3>
                    <p className="text-sm text-green-600">Invoice: {receipt.invoiceNumber}</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 text-sm">
                    <div className="text-center border-b pb-2 mb-2">
                      <p className="font-bold">PharmaFlow PMS</p>
                      <p className="text-xs text-slate-500">{new Date().toLocaleString()}</p>
                    </div>
                    {receipt.items?.map((item: any, i: number) => (
                      <div key={i} className="flex justify-between py-1">
                        <span>{item.drug?.name} x{item.quantity}</span>
                        <span>${item.subtotal.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between font-bold">
                        <span>Total</span>
                        <span>${receipt.total.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Paid ({receipt.paymentMethod})</span>
                        <span>${receipt.amountPaid.toFixed(2)}</span>
                      </div>
                      {receipt.change > 0 && (
                        <div className="flex justify-between text-slate-500">
                          <span>Change</span>
                          <span>${receipt.change.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    className="w-full mt-4 bg-green-600 hover:bg-green-700"
                    onClick={() => setReceipt(null)}
                  >
                    New Sale
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Panel - Cart */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Cart
                  </CardTitle>
                  {cart.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600"
                      onClick={clearCart}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {cart.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Cart is empty</p>
                    <p className="text-sm">Search and add products</p>
                  </div>
                ) : (
                  <>
                    <ScrollArea className="h-[300px] mb-4">
                      <div className="space-y-3 pr-4">
                        {cart.map((item) => (
                          <div key={item.id} className="bg-slate-50 rounded-lg p-3">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <p className="font-medium text-sm">{item.name}</p>
                                <p className="text-xs text-slate-500">{item.strength} • {item.form}</p>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-red-500"
                                onClick={() => removeFromCart(item.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 w-7 p-0"
                                  onClick={() => updateQuantity(item.id, -1)}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-8 text-center font-medium">{item.quantity}</span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 w-7 p-0"
                                  onClick={() => updateQuantity(item.id, 1)}
                                  disabled={item.quantity >= item.stock}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                              <p className="font-bold">${item.subtotal.toFixed(2)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    {/* Totals */}
                    <div className="border-t pt-4 space-y-2">
                      <div className="flex justify-between text-sm text-slate-600">
                        <span>Subtotal</span>
                        <span>${subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-slate-600">
                        <span>Tax</span>
                        <span>${tax.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total</span>
                        <span>${total.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Pay Button */}
                    <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
                      <DialogTrigger asChild>
                        <Button className="w-full mt-4 h-12 text-lg bg-green-600 hover:bg-green-700">
                          <DollarSign className="h-5 w-5 mr-2" />
                          Pay ${total.toFixed(2)}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Process Payment</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                          <div className="text-center p-4 bg-slate-50 rounded-lg">
                            <p className="text-sm text-slate-500">Total Amount</p>
                            <p className="text-3xl font-bold">${total.toFixed(2)}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant={paymentMethod === 'CASH' ? 'default' : 'outline'}
                              className={paymentMethod === 'CASH' ? 'bg-green-600' : ''}
                              onClick={() => setPaymentMethod('CASH')}
                            >
                              <Banknote className="h-4 w-4 mr-2" />
                              Cash
                            </Button>
                            <Button
                              variant={paymentMethod === 'CARD' ? 'default' : 'outline'}
                              className={paymentMethod === 'CARD' ? 'bg-green-600' : ''}
                              onClick={() => setPaymentMethod('CARD')}
                            >
                              <CreditCard className="h-4 w-4 mr-2" />
                              Card
                            </Button>
                          </div>

                          {paymentMethod === 'CASH' && (
                            <div className="space-y-2">
                              <Label htmlFor="amountPaid">Amount Received</Label>
                              <Input
                                id="amountPaid"
                                type="number"
                                step="0.01"
                                value={amountPaid}
                                onChange={(e) => setAmountPaid(e.target.value)}
                                placeholder="0.00"
                                className="text-lg h-12"
                              />
                              {parseFloat(amountPaid) >= total && (
                                <div className="flex justify-between p-3 bg-green-50 rounded-lg text-green-700">
                                  <span>Change</span>
                                  <span className="font-bold">${change.toFixed(2)}</span>
                                </div>
                              )}
                            </div>
                          )}

                          <Button
                            className="w-full h-12 bg-green-600 hover:bg-green-700"
                            onClick={processPayment}
                            disabled={processing || (paymentMethod === 'CASH' && parseFloat(amountPaid || '0') < total)}
                          >
                            {processing ? (
                              'Processing...'
                            ) : (
                              <>
                                <Receipt className="h-5 w-5 mr-2" />
                                Complete Sale
                              </>
                            )}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
    </AuthGuard>
  )
}
