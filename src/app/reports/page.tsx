'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts'
import { 
  BarChart3, TrendingUp, Package, DollarSign, LogOut, 
  Sun, Moon, AlertTriangle, CheckCircle, Clock,
  TrendingDown, Activity, Wallet, CreditCard, Banknote,
  Calendar, ArrowUpRight, ArrowDownRight, RefreshCw, Printer
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/auth/auth-guard'
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns'

interface CurrentUser {
  id: string
  name: string
  email: string
  role: string
}

interface CashRecord {
  id: string
  date: string
  status: string
  openingCash: number
  expectedCash: number
  actualCash: number | null
  cashVariance: number
  totalSales: number
  totalRevenue: number
  openedAt: string | null
  closedAt: string | null
  openedBy: { name: string } | null
  closedBy: { name: string } | null
}

function ReportsContent({ user }: { user: CurrentUser }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('overview')
  
  // Day operations state
  const [cashRecord, setCashRecord] = useState<CashRecord | null>(null)
  const [openingCash, setOpeningCash] = useState('0')
  const [actualCash, setActualCash] = useState('')
  const [dayNotes, setDayNotes] = useState('')
  const [dayLoading, setDayLoading] = useState(false)
  
  // Inventory reports state
  const [inventoryReport, setInventoryReport] = useState<any>(null)
  const [fastMovers, setFastMovers] = useState<any[]>([])
  const [slowMovers, setSlowMovers] = useState<any[]>([])
  const [lowStock, setLowStock] = useState<any>(null)
  const [expiring, setExpiring] = useState<any>(null)
  
  // Financial reports state
  const [financialSummary, setFinancialSummary] = useState<any>(null)
  const [cashflowData, setCashflowData] = useState<any>(null)
  const [dailyBreakdown, setDailyBreakdown] = useState<any[]>([])
  
  // Date range
  const [startDate, setStartDate] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  
  const [loading, setLoading] = useState(true)

  // Settings for printing
  const [pharmacyName, setPharmacyName] = useState('TechPharm Pharmacy')

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  useEffect(() => {
    fetchAllData()
    fetchSettings()
  }, [startDate, endDate])

  async function fetchSettings() {
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        const generalSettings = data.general || []
        const nameSetting = generalSettings.find((s: any) => s.key === 'pharmacy_name')
        if (nameSetting) setPharmacyName(nameSetting.value)
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    }
  }

  async function fetchAllData() {
    setLoading(true)
    try {
      await Promise.all([
        fetchCashRecord(),
        fetchInventoryReports(),
        fetchFinancialReports(),
      ])
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchCashRecord() {
    try {
      const res = await fetch('/api/cash/daily')
      if (res.ok) {
        const data = await res.json()
        setCashRecord(data)
        if (data?.openingCash) {
          setOpeningCash(Number(data.openingCash).toString())
        }
      }
    } catch (error) {
      console.error('Failed to fetch cash record:', error)
    }
  }

  async function fetchInventoryReports() {
    try {
      const params = new URLSearchParams({ startDate, endDate })
      
      const [summaryRes, fastRes, slowRes, lowRes, expiringRes] = await Promise.all([
        fetch(`/api/reports/inventory?type=summary&${params}`),
        fetch(`/api/reports/inventory?type=fast-movers&${params}`),
        fetch(`/api/reports/inventory?type=slow-movers&${params}`),
        fetch('/api/reports/inventory?type=low-stock'),
        fetch('/api/reports/inventory?type=expiring'),
      ])

      if (summaryRes.ok) setInventoryReport(await summaryRes.json())
      if (fastRes.ok) {
        const data = await fastRes.json()
        setFastMovers(data.fastMovers || [])
      }
      if (slowRes.ok) {
        const data = await slowRes.json()
        setSlowMovers(data.slowMovers || [])
      }
      if (lowRes.ok) setLowStock(await lowRes.json())
      if (expiringRes.ok) setExpiring(await expiringRes.json())
    } catch (error) {
      console.error('Failed to fetch inventory reports:', error)
    }
  }

  async function fetchFinancialReports() {
    try {
      const params = new URLSearchParams({ startDate, endDate })
      
      const [summaryRes, cashflowRes, dailyRes] = await Promise.all([
        fetch(`/api/reports/financial?type=summary&${params}`),
        fetch(`/api/reports/financial?type=cashflow&${params}`),
        fetch(`/api/reports/financial?type=daily&${params}`),
      ])

      if (summaryRes.ok) setFinancialSummary(await summaryRes.json())
      if (cashflowRes.ok) setCashflowData(await cashflowRes.json())
      if (dailyRes.ok) {
        const data = await dailyRes.json()
        setDailyBreakdown(data.daily || [])
      }
    } catch (error) {
      console.error('Failed to fetch financial reports:', error)
    }
  }

  // Day operations handlers
  async function handleOpenDay() {
    setDayLoading(true)
    try {
      const res = await fetch('/api/cash/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openingCash: parseFloat(openingCash) || 0,
          notes: dayNotes,
        }),
      })
      if (res.ok) {
        await fetchCashRecord()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to open day')
      }
    } catch (error) {
      console.error('Failed to open day:', error)
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
        body: JSON.stringify({
          actualCash: parseFloat(actualCash),
          notes: dayNotes,
        }),
      })
      if (res.ok) {
        await fetchCashRecord()
        await fetchFinancialReports()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to close day')
      }
    } catch (error) {
      console.error('Failed to close day:', error)
    } finally {
      setDayLoading(false)
    }
  }

  // Print functions
  const handlePrint = (reportType: string) => {
    window.print()
  }

  const handlePrintDayEnd = () => {
    if (!cashRecord) return
    const printContent = `
      <html>
        <head>
          <title>Day End Report - ${pharmacyName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .title { font-size: 24px; font-weight: bold; }
            .subtitle { font-size: 14px; color: #666; }
            .section { margin: 20px 0; }
            .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
            .label { color: #666; }
            .value { font-weight: bold; }
            .positive { color: green; }
            .negative { color: red; }
            .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${pharmacyName}</div>
            <div class="subtitle">Day End Report</div>
            <div class="subtitle">${format(new Date(cashRecord.date), 'EEEE, MMMM d, yyyy')}</div>
          </div>
          <div class="section">
            <div class="row"><span class="label">Opened By:</span><span class="value">${cashRecord.openedBy?.name || 'System'}</span></div>
            <div class="row"><span class="label">Closed By:</span><span class="value">${cashRecord.closedBy?.name || 'System'}</span></div>
          </div>
          <div class="section">
            <div class="row"><span class="label">Opening Cash:</span><span class="value">$${Number(cashRecord.openingCash).toFixed(2)}</span></div>
            <div class="row"><span class="label">Cash Sales:</span><span class="value">$${Number(cashRecord.cashSales).toFixed(2)}</span></div>
            <div class="row"><span class="label">Expected Cash:</span><span class="value">$${Number(cashRecord.expectedCash).toFixed(2)}</span></div>
            <div class="row"><span class="label">Actual Cash:</span><span class="value">$${Number(cashRecord.actualCash || 0).toFixed(2)}</span></div>
            <div class="row"><span class="label">Variance:</span><span class="value ${Number(cashRecord.cashVariance) >= 0 ? 'positive' : 'negative'}">$${Number(cashRecord.cashVariance).toFixed(2)}</span></div>
          </div>
          <div class="section">
            <div class="row"><span class="label">Total Transactions:</span><span class="value">${cashRecord.totalSales}</span></div>
            <div class="row"><span class="label">Card Sales:</span><span class="value">$${Number(cashRecord.cardSales).toFixed(2)}</span></div>
            <div class="row"><span class="label">Insurance Sales:</span><span class="value">$${Number(cashRecord.insuranceSales).toFixed(2)}</span></div>
            <div class="row"><span class="label">Total Revenue:</span><span class="value">$${Number(cashRecord.totalRevenue).toFixed(2)}</span></div>
          </div>
          <div class="footer">
            <p>Printed on ${format(new Date(), 'MMM d, yyyy h:mm a')}</p>
            <p>Generated by TechPharm Pharmacy Management System</p>
          </div>
        </body>
      </html>
    `
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(printContent)
      printWindow.document.close()
      printWindow.print()
    }
  }

  const handlePrintInventory = () => {
    const printContent = `
      <html>
        <head>
          <title>Inventory Report - ${pharmacyName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .title { font-size: 24px; font-weight: bold; }
            .subtitle { font-size: 14px; color: #666; }
            .summary { display: flex; gap: 40px; margin: 20px 0; }
            .stat { text-align: center; }
            .stat-value { font-size: 24px; font-weight: bold; }
            .stat-label { color: #666; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f5f5f5; }
            .section-title { font-size: 16px; font-weight: bold; margin-top: 30px; border-bottom: 1px solid #000; padding-bottom: 5px; }
            .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #666; }
            .positive { color: green; }
            .negative { color: red; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${pharmacyName}</div>
            <div class="subtitle">Inventory Report</div>
            <div class="subtitle">${format(new Date(startDate), 'MMM d, yyyy')} - ${format(new Date(endDate), 'MMM d, yyyy')}</div>
          </div>
          <div class="summary">
            <div class="stat"><div class="stat-value">${inventoryReport?.summary?.totalDrugs || 0}</div><div class="stat-label">Total Drugs</div></div>
            <div class="stat"><div class="stat-value">${inventoryReport?.summary?.totalStockUnits || 0}</div><div class="stat-label">Total Units</div></div>
            <div class="stat"><div class="stat-value">$${inventoryReport?.summary?.totalCostValue?.toFixed(2) || '0.00'}</div><div class="stat-label">Inventory Value</div></div>
            <div class="stat"><div class="stat-value negative">${inventoryReport?.stockStatus?.outOfStockCount || 0}</div><div class="stat-label">Out of Stock</div></div>
            <div class="stat"><div class="stat-value">${inventoryReport?.stockStatus?.lowStockCount || 0}</div><div class="stat-label">Low Stock</div></div>
          </div>
          
          <div class="section-title">Fast Movers (High Turnover)</div>
          <table>
            <thead><tr><th>Drug</th><th>NDC</th><th>Stock</th><th>Sold</th><th>Turnover</th><th>Revenue</th></tr></thead>
            <tbody>
              ${fastMovers.slice(0, 20).map(item => `
                <tr>
                  <td>${item.drugName}</td>
                  <td>${item.ndc}</td>
                  <td>${item.currentStock}</td>
                  <td>${item.totalQuantitySold}</td>
                  <td class="positive">${item.turnoverRate}x</td>
                  <td>$${item.revenue?.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="section-title">Slow Movers (Low Turnover)</div>
          <table>
            <thead><tr><th>Drug</th><th>NDC</th><th>Stock</th><th>Stock Value</th><th>Turnover</th><th>Recommendation</th></tr></thead>
            <tbody>
              ${slowMovers.slice(0, 20).map(item => `
                <tr>
                  <td>${item.drugName}</td>
                  <td>${item.ndc}</td>
                  <td>${item.currentStock}</td>
                  <td>$${item.stockValue?.toFixed(2)}</td>
                  <td>${item.turnoverRate}x</td>
                  <td>${item.recommendation}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          ${lowStock ? `
          <div class="section-title">Low Stock Alerts</div>
          <table>
            <thead><tr><th>Drug</th><th>Status</th><th>Current</th><th>Reorder Level</th><th>Order Qty</th><th>Est. Cost</th></tr></thead>
            <tbody>
              ${[...(lowStock.outOfStock || []), ...(lowStock.belowReorder || [])].map(item => `
                <tr>
                  <td>${item.drugName}</td>
                  <td>${item.stockStatus === 'OUT_OF_STOCK' ? 'Out of Stock' : 'Low Stock'}</td>
                  <td>${item.currentStock}</td>
                  <td>${item.reorderLevel}</td>
                  <td>${item.recommendedOrder}</td>
                  <td>$${item.estimatedCost?.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ` : ''}

          <div class="footer">
            <p>Printed on ${format(new Date(), 'MMM d, yyyy h:mm a')} by ${user.name}</p>
            <p>Generated by TechPharm Pharmacy Management System</p>
          </div>
        </body>
      </html>
    `
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(printContent)
      printWindow.document.close()
      printWindow.print()
    }
  }

  const handlePrintFinancial = () => {
    const printContent = `
      <html>
        <head>
          <title>Financial Report - ${pharmacyName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .title { font-size: 24px; font-weight: bold; }
            .subtitle { font-size: 14px; color: #666; }
            .summary { display: flex; gap: 40px; margin: 20px 0; padding: 20px; background: #f9f9f9; }
            .stat { text-align: center; flex: 1; }
            .stat-value { font-size: 20px; font-weight: bold; }
            .stat-label { color: #666; font-size: 11px; }
            .section { margin: 30px 0; }
            .section-title { font-size: 16px; font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 15px; }
            .row { display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #eee; }
            .row.total { background: #f5f5f5; font-weight: bold; font-size: 14px; }
            .label { color: #666; }
            .value { font-weight: bold; }
            .positive { color: green; }
            .negative { color: red; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f5f5f5; }
            .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${pharmacyName}</div>
            <div class="subtitle">Financial Report</div>
            <div class="subtitle">${format(new Date(startDate), 'MMM d, yyyy')} - ${format(new Date(endDate), 'MMM d, yyyy')}</div>
          </div>

          <div class="summary">
            <div class="stat"><div class="stat-value">$${financialSummary?.sales?.totalRevenue?.toFixed(2) || '0.00'}</div><div class="stat-label">Total Revenue</div></div>
            <div class="stat"><div class="stat-value">$${financialSummary?.costs?.costOfGoodsSold?.toFixed(2) || '0.00'}</div><div class="stat-label">Cost of Goods</div></div>
            <div class="stat"><div class="stat-value positive">$${financialSummary?.costs?.grossProfit?.toFixed(2) || '0.00'}</div><div class="stat-label">Gross Profit</div></div>
            <div class="stat"><div class="stat-value">${financialSummary?.costs?.grossMargin?.toFixed(1) || '0'}%</div><div class="stat-label">Margin</div></div>
            <div class="stat"><div class="stat-value">${financialSummary?.sales?.count || 0}</div><div class="stat-label">Transactions</div></div>
          </div>

          <div class="section">
            <div class="section-title">Profit & Loss Statement</div>
            <div class="row"><span class="label">Gross Sales</span><span class="value">$${financialSummary?.sales?.subtotal?.toFixed(2) || '0.00'}</span></div>
            <div class="row"><span class="label">Less: Discounts</span><span class="value negative">($${financialSummary?.sales?.discount?.toFixed(2) || '0.00'})</span></div>
            <div class="row"><span class="label">Add: Tax Collected</span><span class="value">$${financialSummary?.sales?.taxCollected?.toFixed(2) || '0.00'}</span></div>
            <div class="row total"><span>Net Sales</span><span>$${((financialSummary?.sales?.subtotal || 0) - (financialSummary?.sales?.discount || 0)).toFixed(2)}</span></div>
            <div class="row"><span class="label">Cost of Goods Sold (FIFO)</span><span class="value negative">($${financialSummary?.costs?.costOfGoodsSold?.toFixed(2) || '0.00'})</span></div>
            <div class="row total"><span>Gross Profit</span><span class="positive">$${financialSummary?.costs?.grossProfit?.toFixed(2) || '0.00'}</span></div>
          </div>

          <div class="section">
            <div class="section-title">Payment Method Breakdown</div>
            <div class="row"><span class="label">Cash</span><span class="value">$${financialSummary?.paymentMethods?.CASH?.total?.toFixed(2) || '0.00'} (${financialSummary?.paymentMethods?.CASH?.count || 0} transactions)</span></div>
            <div class="row"><span class="label">Card</span><span class="value">$${financialSummary?.paymentMethods?.CARD?.total?.toFixed(2) || '0.00'} (${financialSummary?.paymentMethods?.CARD?.count || 0} transactions)</span></div>
            <div class="row"><span class="label">Insurance</span><span class="value">$${financialSummary?.paymentMethods?.INSURANCE?.total?.toFixed(2) || '0.00'} (${financialSummary?.paymentMethods?.INSURANCE?.count || 0} transactions)</span></div>
          </div>

          <div class="section">
            <div class="section-title">Daily Breakdown</div>
            <table>
              <thead><tr><th>Date</th><th>Transactions</th><th>Revenue</th><th>COGS</th><th>Profit</th></tr></thead>
              <tbody>
                ${dailyBreakdown.slice(-14).map(day => `
                  <tr>
                    <td>${day.dateStr}</td>
                    <td>${day.sales.count}</td>
                    <td>$${day.sales.revenue?.toFixed(2)}</td>
                    <td>$${day.sales.cogs?.toFixed(2)}</td>
                    <td class="${day.sales.profit >= 0 ? 'positive' : 'negative'}">$${day.sales.profit?.toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="footer">
            <p>Printed on ${format(new Date(), 'MMM d, yyyy h:mm a')} by ${user.name}</p>
            <p>Generated by TechPharm Pharmacy Management System</p>
          </div>
        </body>
      </html>
    `
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(printContent)
      printWindow.document.close()
      printWindow.print()
    }
  }

  const handlePrintCashflow = () => {
    const printContent = `
      <html>
        <head>
          <title>Cash Flow Report - ${pharmacyName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .title { font-size: 24px; font-weight: bold; }
            .subtitle { font-size: 14px; color: #666; }
            .summary { display: flex; gap: 30px; margin: 20px 0; padding: 20px; background: #f9f9f9; }
            .stat { text-align: center; flex: 1; }
            .stat-value { font-size: 20px; font-weight: bold; }
            .stat-label { color: #666; font-size: 11px; }
            .section { margin: 30px 0; }
            .section-title { font-size: 16px; font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f5f5f5; }
            .positive { color: green; }
            .negative { color: red; }
            .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${pharmacyName}</div>
            <div class="subtitle">Cash Flow Report</div>
            <div class="subtitle">${format(new Date(startDate), 'MMM d, yyyy')} - ${format(new Date(endDate), 'MMM d, yyyy')}</div>
          </div>

          <div class="summary">
            <div class="stat"><div class="stat-value positive">$${cashflowData?.summary?.totalCashIn?.toFixed(2) || '0.00'}</div><div class="stat-label">Total Cash In</div></div>
            <div class="stat"><div class="stat-value negative">$${cashflowData?.summary?.totalCashOut?.toFixed(2) || '0.00'}</div><div class="stat-label">Total Cash Out</div></div>
            <div class="stat"><div class="stat-value">$${cashflowData?.summary?.netCashflow?.toFixed(2) || '0.00'}</div><div class="stat-label">Net Cash Flow</div></div>
            <div class="stat"><div class="stat-value">${cashflowData?.summary?.transactionCount || 0}</div><div class="stat-label">Transactions</div></div>
          </div>

          <div class="section">
            <div class="section-title">Transaction History</div>
            <table>
              <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Reference</th><th>Amount</th><th>By</th></tr></thead>
              <tbody>
                ${(cashflowData?.transactions || []).slice(0, 50).map((tx: any) => `
                  <tr>
                    <td>${format(new Date(tx.recordedAt), 'MMM d, HH:mm')}</td>
                    <td>${tx.type.replace(/_/g, ' ')}</td>
                    <td>${tx.description || '-'}</td>
                    <td>${tx.reference || '-'}</td>
                    <td class="${tx.type.includes('IN') || tx.type.includes('SALE') ? 'positive' : 'negative'}">
                      ${tx.type.includes('IN') || tx.type.includes('SALE') ? '+' : '-'}$${Number(tx.amount).toFixed(2)}
                    </td>
                    <td>${tx.recordedBy}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="footer">
            <p>Printed on ${format(new Date(), 'MMM d, yyyy h:mm a')} by ${user.name}</p>
            <p>Generated by TechPharm Pharmacy Management System</p>
          </div>
        </body>
      </html>
    `
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(printContent)
      printWindow.document.close()
      printWindow.print()
    }
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; }
          .print-header { display: block !important; text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
          .print-title { font-size: 24px; font-weight: bold; }
          .print-subtitle { font-size: 14px; color: #666; }
        }
        @media screen {
          .print-only { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 no-print">
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
        <Card className="mb-6 no-print">
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

        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading reports...</div>
        ) : (
          <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-white no-print">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="day-operations" className="gap-1">
                <Sun className="h-4 w-4" />
                Day Operations
              </TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="financial">Financial</TabsTrigger>
              <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="flex justify-end no-print">
                <Button onClick={() => handlePrint('overview')} variant="outline">
                  <Printer className="h-4 w-4 mr-2" />
                  Print Overview
                </Button>
              </div>

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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print">
                <Card>
                  <CardHeader>
                    <CardTitle>Daily Revenue Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dailyBreakdown.slice(-14)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="dateStr" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                            formatter={(value: any) => [`$${value?.toFixed(2)}`, 'Revenue']}
                          />
                          <Bar dataKey="sales.revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Payment Methods</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Cash', value: financialSummary?.paymentMethods?.CASH?.total || 0 },
                              { name: 'Card', value: financialSummary?.paymentMethods?.CARD?.total || 0 },
                              { name: 'Insurance', value: financialSummary?.paymentMethods?.INSURANCE?.total || 0 },
                            ].filter(d => d.value > 0)}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          >
                            {COLORS.map((color, index) => (
                              <Cell key={`cell-${index}`} fill={color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: any) => [`$${value?.toFixed(2)}`, '']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Day Operations Tab */}
            <TabsContent value="day-operations" className="space-y-6">
              <div className="flex justify-end no-print">
                {cashRecord?.status === 'CLOSED' && (
                  <Button onClick={handlePrintDayEnd} variant="outline">
                    <Printer className="h-4 w-4 mr-2" />
                    Print Day End Report
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Current Day Status */}
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
                          <Input id="opening-cash" type="number" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} placeholder="Enter opening cash amount" />
                          <p className="text-xs text-slate-500 mt-1">Suggested: ${cashRecord?.openingCash?.toFixed(2) || '0.00'} (yesterday's closing)</p>
                        </div>
                        <div>
                          <Label htmlFor="day-notes">Notes (optional)</Label>
                          <Input id="day-notes" value={dayNotes} onChange={(e) => setDayNotes(e.target.value)} placeholder="Any notes for the day" />
                        </div>
                        <Button onClick={handleOpenDay} disabled={dayLoading} className="w-full">
                          <Sun className="h-4 w-4 mr-2" />Start Day
                        </Button>
                      </div>
                    ) : cashRecord?.status === 'OPEN' ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                          <div className="flex justify-between"><span className="text-slate-600">Opened by:</span><span className="font-medium">{cashRecord.openedBy?.name || 'System'}</span></div>
                          <div className="flex justify-between"><span className="text-slate-600">Opening Cash:</span><span className="font-medium">${Number(cashRecord.openingCash).toFixed(2)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-600">Total Sales:</span><span className="font-medium">{cashRecord.totalSales}</span></div>
                          <div className="flex justify-between"><span className="text-slate-600">Expected Cash:</span><span className="font-medium">${Number(cashRecord.expectedCash).toFixed(2)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-600">Revenue:</span><span className="font-medium text-green-600">${Number(cashRecord.totalRevenue).toFixed(2)}</span></div>
                        </div>
                        <div>
                          <Label htmlFor="actual-cash">Actual Cash Count ($)</Label>
                          <Input id="actual-cash" type="number" value={actualCash} onChange={(e) => setActualCash(e.target.value)} placeholder="Enter actual cash counted" />
                        </div>
                        <div>
                          <Label htmlFor="closing-notes">Closing Notes</Label>
                          <Input id="closing-notes" value={dayNotes} onChange={(e) => setDayNotes(e.target.value)} placeholder="Any discrepancies or notes" />
                        </div>
                        <Button onClick={handleCloseDay} disabled={dayLoading || !actualCash} className="w-full" variant="destructive">
                          <Moon className="h-4 w-4 mr-2" />Close Day
                        </Button>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                        <div className="flex justify-between"><span className="text-slate-600">Opened by:</span><span className="font-medium">{cashRecord.openedBy?.name || 'System'}</span></div>
                        <div className="flex justify-between"><span className="text-slate-600">Closed by:</span><span className="font-medium">{cashRecord.closedBy?.name || 'System'}</span></div>
                        <div className="flex justify-between"><span className="text-slate-600">Opening Cash:</span><span className="font-medium">${Number(cashRecord.openingCash).toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-600">Expected Cash:</span><span className="font-medium">${Number(cashRecord.expectedCash).toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-600">Actual Cash:</span><span className="font-medium">${Number(cashRecord.actualCash).toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-600">Variance:</span><span className={`font-medium ${Number(cashRecord.cashVariance) >= 0 ? 'text-green-600' : 'text-red-600'}`}>${Number(cashRecord.cashVariance).toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-600">Total Revenue:</span><span className="font-medium text-green-600">${Number(cashRecord.totalRevenue).toFixed(2)}</span></div>
                        <div className="pt-2 flex items-center justify-center gap-2 text-green-600">
                          <CheckCircle className="h-5 w-5" />
                          <span className="font-medium">Day Closed Successfully</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Today's Sales Summary */}
                <Card>
                  <CardHeader><CardTitle>Today's Performance</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2"><Banknote className="h-5 w-5 text-blue-600" /><span className="text-sm text-blue-600">Cash Sales</span></div>
                        <p className="text-2xl font-bold text-blue-800">${Number(cashRecord?.cashSales || 0).toFixed(2)}</p>
                      </div>
                      <div className="p-4 bg-purple-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2"><CreditCard className="h-5 w-5 text-purple-600" /><span className="text-sm text-purple-600">Card Sales</span></div>
                        <p className="text-2xl font-bold text-purple-800">${Number(cashRecord?.cardSales || 0).toFixed(2)}</p>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2"><Activity className="h-5 w-5 text-green-600" /><span className="text-sm text-green-600">Transactions</span></div>
                        <p className="text-2xl font-bold text-green-800">{cashRecord?.totalSales || 0}</p>
                      </div>
                      <div className="p-4 bg-amber-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2"><Wallet className="h-5 w-5 text-amber-600" /><span className="text-sm text-amber-600">Total Revenue</span></div>
                        <p className="text-2xl font-bold text-amber-800">${Number(cashRecord?.totalRevenue || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Inventory Tab */}
            <TabsContent value="inventory" className="space-y-6">
              <div className="flex justify-end no-print">
                <Button onClick={handlePrintInventory} variant="outline">
                  <Printer className="h-4 w-4 mr-2" />
                  Print Inventory Report
                </Button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card><CardContent className="p-6"><div className="flex items-center gap-4"><div className="p-3 bg-blue-100 rounded-lg"><Package className="h-6 w-6 text-blue-600" /></div><div><p className="text-sm text-slate-500">Total Drugs</p><p className="text-2xl font-bold text-slate-800">{inventoryReport?.summary?.totalDrugs || 0}</p></div></div></CardContent></Card>
                <Card><CardContent className="p-6"><div className="flex items-center gap-4"><div className="p-3 bg-red-100 rounded-lg"><AlertTriangle className="h-6 w-6 text-red-600" /></div><div><p className="text-sm text-slate-500">Out of Stock</p><p className="text-2xl font-bold text-red-600">{inventoryReport?.stockStatus?.outOfStockCount || 0}</p></div></div></CardContent></Card>
                <Card><CardContent className="p-6"><div className="flex items-center gap-4"><div className="p-3 bg-amber-100 rounded-lg"><TrendingDown className="h-6 w-6 text-amber-600" /></div><div><p className="text-sm text-slate-500">Low Stock</p><p className="text-2xl font-bold text-amber-600">{inventoryReport?.stockStatus?.lowStockCount || 0}</p></div></div></CardContent></Card>
                <Card><CardContent className="p-6"><div className="flex items-center gap-4"><div className="p-3 bg-green-100 rounded-lg"><DollarSign className="h-6 w-6 text-green-600" /></div><div><p className="text-sm text-slate-500">Inventory Value</p><p className="text-2xl font-bold text-green-600">${inventoryReport?.summary?.totalCostValue?.toFixed(2) || '0.00'}</p></div></div></CardContent></Card>
              </div>

              {/* Fast Movers */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-green-600" />Fast Movers (High Turnover)</CardTitle>
                  <CardDescription>Products with turnover rate &gt; 2 in the selected period</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-white"><tr className="border-b"><th className="text-left py-2 px-3">Drug</th><th className="text-right py-2 px-3">Stock</th><th className="text-right py-2 px-3">Sold</th><th className="text-right py-2 px-3">Turnover</th><th className="text-right py-2 px-3">Revenue</th></tr></thead>
                      <tbody>
                        {fastMovers.map((item: any, i: number) => (
                          <tr key={i} className="border-b hover:bg-slate-50">
                            <td className="py-2 px-3"><p className="font-medium">{item.drugName}</p><p className="text-xs text-slate-500">{item.ndc}</p></td>
                            <td className="text-right py-2 px-3">{item.currentStock}</td>
                            <td className="text-right py-2 px-3">{item.totalQuantitySold}</td>
                            <td className="text-right py-2 px-3 font-medium text-green-600">{item.turnoverRate}x</td>
                            <td className="text-right py-2 px-3">${item.revenue?.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Slow Movers */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><TrendingDown className="h-5 w-5 text-amber-600" />Slow Movers (Low Turnover)</CardTitle>
                  <CardDescription>Products with turnover rate &lt; 0.5 - Consider discounting or returning</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-white"><tr className="border-b"><th className="text-left py-2 px-3">Drug</th><th className="text-right py-2 px-3">Stock</th><th className="text-right py-2 px-3">Sold</th><th className="text-right py-2 px-3">Turnover</th><th className="text-right py-2 px-3">Stock Value</th><th className="text-left py-2 px-3">Recommendation</th></tr></thead>
                      <tbody>
                        {slowMovers.slice(0, 20).map((item: any, i: number) => (
                          <tr key={i} className="border-b hover:bg-slate-50">
                            <td className="py-2 px-3"><p className="font-medium">{item.drugName}</p><p className="text-xs text-slate-500">{item.ndc}</p></td>
                            <td className="text-right py-2 px-3">{item.currentStock}</td>
                            <td className="text-right py-2 px-3">{item.totalQuantitySold}</td>
                            <td className="text-right py-2 px-3 font-medium text-amber-600">{item.turnoverRate}x</td>
                            <td className="text-right py-2 px-3">${item.stockValue?.toFixed(2)}</td>
                            <td className="py-2 px-3 text-sm text-slate-600">{item.recommendation}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Low Stock */}
              {lowStock && (
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-600" />Low Stock Alerts</CardTitle></CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-white"><tr className="border-b"><th className="text-left py-2 px-3">Drug</th><th className="text-right py-2 px-3">Current</th><th className="text-right py-2 px-3">Reorder Level</th><th className="text-right py-2 px-3">Order Qty</th><th className="text-right py-2 px-3">Est. Cost</th></tr></thead>
                        <tbody>
                          {[...(lowStock.outOfStock || []), ...(lowStock.belowReorder || [])].map((item: any, i: number) => (
                            <tr key={i} className="border-b hover:bg-slate-50">
                              <td className="py-2 px-3"><p className="font-medium">{item.drugName}</p><Badge variant={item.stockStatus === 'OUT_OF_STOCK' ? 'destructive' : 'secondary'}>{item.stockStatus === 'OUT_OF_STOCK' ? 'Out of Stock' : 'Low Stock'}</Badge></td>
                              <td className="text-right py-2 px-3">{item.currentStock}</td>
                              <td className="text-right py-2 px-3">{item.reorderLevel}</td>
                              <td className="text-right py-2 px-3">{item.recommendedOrder}</td>
                              <td className="text-right py-2 px-3">${item.estimatedCost?.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Financial Tab */}
            <TabsContent value="financial" className="space-y-6">
              <div className="flex justify-end no-print">
                <Button onClick={handlePrintFinancial} variant="outline">
                  <Printer className="h-4 w-4 mr-2" />
                  Print Financial Report
                </Button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card><CardContent className="p-6"><div className="flex items-center gap-4"><div className="p-3 bg-blue-100 rounded-lg"><DollarSign className="h-6 w-6 text-blue-600" /></div><div><p className="text-sm text-slate-500">Total Revenue</p><p className="text-2xl font-bold text-slate-800">${financialSummary?.sales?.totalRevenue?.toFixed(2) || '0.00'}</p></div></div></CardContent></Card>
                <Card><CardContent className="p-6"><div className="flex items-center gap-4"><div className="p-3 bg-orange-100 rounded-lg"><Package className="h-6 w-6 text-orange-600" /></div><div><p className="text-sm text-slate-500">Cost of Goods</p><p className="text-2xl font-bold text-orange-600">${financialSummary?.costs?.costOfGoodsSold?.toFixed(2) || '0.00'}</p></div></div></CardContent></Card>
                <Card><CardContent className="p-6"><div className="flex items-center gap-4"><div className="p-3 bg-green-100 rounded-lg"><TrendingUp className="h-6 w-6 text-green-600" /></div><div><p className="text-sm text-slate-500">Gross Profit</p><p className="text-2xl font-bold text-green-600">${financialSummary?.costs?.grossProfit?.toFixed(2) || '0.00'}</p></div></div></CardContent></Card>
                <Card><CardContent className="p-6"><div className="flex items-center gap-4"><div className="p-3 bg-purple-100 rounded-lg"><BarChart3 className="h-6 w-6 text-purple-600" /></div><div><p className="text-sm text-slate-500">Transactions</p><p className="text-2xl font-bold text-slate-800">{financialSummary?.sales?.count || 0}</p></div></div></CardContent></Card>
              </div>

              {/* P&L Statement */}
              <Card>
                <CardHeader>
                  <CardTitle>Profit & Loss Statement</CardTitle>
                  <CardDescription>{format(new Date(startDate), 'MMM d, yyyy')} - {format(new Date(endDate), 'MMM d, yyyy')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg"><div className="flex justify-between items-center"><span className="text-blue-800 font-medium">Gross Sales</span><span className="text-xl font-bold text-blue-800">${financialSummary?.sales?.subtotal?.toFixed(2) || '0.00'}</span></div></div>
                    <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                      <div className="flex justify-between"><span className="text-slate-600">Less: Discounts</span><span className="text-red-600">(${financialSummary?.sales?.discount?.toFixed(2) || '0.00'})</span></div>
                      <div className="flex justify-between font-medium"><span>Net Sales</span><span>${((financialSummary?.sales?.subtotal || 0) - (financialSummary?.sales?.discount || 0)).toFixed(2)}</span></div>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg"><div className="flex justify-between items-center"><span className="text-orange-800 font-medium">Cost of Goods Sold (FIFO)</span><span className="text-xl font-bold text-orange-600">(${financialSummary?.costs?.costOfGoodsSold?.toFixed(2) || '0.00'})</span></div></div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="flex justify-between items-center"><span className="text-green-800 font-medium">Gross Profit</span><span className="text-xl font-bold text-green-600">${financialSummary?.costs?.grossProfit?.toFixed(2) || '0.00'}</span></div>
                      <p className="text-sm text-green-700 mt-1">Margin: {financialSummary?.costs?.grossMargin?.toFixed(1) || '0'}%</p>
                    </div>
                    <div className="flex justify-between items-center pt-4 border-t">
                      <div className="flex items-center gap-2">
                        {financialSummary?.comparison?.revenueChange >= 0 ? <ArrowUpRight className="h-5 w-5 text-green-600" /> : <ArrowDownRight className="h-5 w-5 text-red-600" />}
                        <span className="text-slate-600">vs Previous Period</span>
                      </div>
                      <span className={financialSummary?.comparison?.revenueChange >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                        {financialSummary?.comparison?.revenueChange >= 0 ? '+' : ''}{financialSummary?.comparison?.revenueChange?.toFixed(1) || '0'}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Cash Flow Tab */}
            <TabsContent value="cashflow" className="space-y-6">
              <div className="flex justify-end no-print">
                <Button onClick={handlePrintCashflow} variant="outline">
                  <Printer className="h-4 w-4 mr-2" />
                  Print Cash Flow Report
                </Button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card><CardContent className="p-6"><div className="flex items-center gap-4"><div className="p-3 bg-green-100 rounded-lg"><ArrowUpRight className="h-6 w-6 text-green-600" /></div><div><p className="text-sm text-slate-500">Cash In</p><p className="text-2xl font-bold text-green-600">${cashflowData?.summary?.totalCashIn?.toFixed(2) || '0.00'}</p></div></div></CardContent></Card>
                <Card><CardContent className="p-6"><div className="flex items-center gap-4"><div className="p-3 bg-red-100 rounded-lg"><ArrowDownRight className="h-6 w-6 text-red-600" /></div><div><p className="text-sm text-slate-500">Cash Out</p><p className="text-2xl font-bold text-red-600">${cashflowData?.summary?.totalCashOut?.toFixed(2) || '0.00'}</p></div></div></CardContent></Card>
                <Card><CardContent className="p-6"><div className="flex items-center gap-4"><div className="p-3 bg-blue-100 rounded-lg"><Wallet className="h-6 w-6 text-blue-600" /></div><div><p className="text-sm text-slate-500">Net Cash Flow</p><p className="text-2xl font-bold text-blue-600">${cashflowData?.summary?.netCashflow?.toFixed(2) || '0.00'}</p></div></div></CardContent></Card>
                <Card><CardContent className="p-6"><div className="flex items-center gap-4"><div className="p-3 bg-purple-100 rounded-lg"><Banknote className="h-6 w-6 text-purple-600" /></div><div><p className="text-sm text-slate-500">Cash Sales</p><p className="text-2xl font-bold text-purple-600">${cashflowData?.summary?.cashSalesTotal?.toFixed(2) || '0.00'}</p></div></div></CardContent></Card>
              </div>

              {/* Chart */}
              <Card className="no-print">
                <CardHeader><CardTitle>Daily Cash Flow</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyBreakdown.slice(-14)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="dateStr" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                        <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                        <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px' }} formatter={(value: any) => [`$${value?.toFixed(2)}`, '']} />
                        <Legend />
                        <Line type="monotone" dataKey="sales.revenue" name="Revenue" stroke="#3b82f6" strokeWidth={2} />
                        <Line type="monotone" dataKey="sales.profit" name="Profit" stroke="#10b981" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Transactions */}
              {cashflowData?.transactions && (
                <Card>
                  <CardHeader><CardTitle>Recent Cash Transactions</CardTitle></CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-white"><tr className="border-b"><th className="text-left py-2 px-3">Date</th><th className="text-left py-2 px-3">Type</th><th className="text-left py-2 px-3">Description</th><th className="text-right py-2 px-3">Amount</th><th className="text-left py-2 px-3">By</th></tr></thead>
                        <tbody>
                          {cashflowData.transactions.slice(0, 30).map((tx: any, i: number) => (
                            <tr key={i} className="border-b hover:bg-slate-50">
                              <td className="py-2 px-3 text-sm">{format(new Date(tx.recordedAt), 'MMM d, HH:mm')}</td>
                              <td className="py-2 px-3"><Badge variant={tx.type.includes('IN') || tx.type.includes('SALE') ? 'default' : 'secondary'}>{tx.type.replace(/_/g, ' ')}</Badge></td>
                              <td className="py-2 px-3">{tx.description || tx.reference}</td>
                              <td className={`text-right py-2 px-3 font-medium ${tx.type.includes('IN') || tx.type.includes('SALE') ? 'text-green-600' : 'text-red-600'}`}>
                                {tx.type.includes('IN') || tx.type.includes('SALE') ? '+' : '-'}${Number(tx.amount).toFixed(2)}
                              </td>
                              <td className="py-2 px-3 text-sm">{tx.recordedBy}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
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
