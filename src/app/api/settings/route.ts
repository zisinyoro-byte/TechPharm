import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-api'
import { revalidatePath } from 'next/cache'

// Default settings that will be created if they don't exist
const DEFAULT_SETTINGS = [
  {
    key: 'vat_percentage',
    value: '0',
    description: 'VAT percentage to apply to eligible items (0-100)',
    category: 'tax',
  },
  {
    key: 'vat_enabled',
    value: 'false',
    description: 'Enable or disable VAT calculation globally',
    category: 'tax',
  },
  {
    key: 'currency_symbol',
    value: '$',
    description: 'Currency symbol for display',
    category: 'general',
  },
  {
    key: 'currency_code',
    value: 'USD',
    description: 'Currency code (USD, EUR, GBP, etc.)',
    category: 'general',
  },
  {
    key: 'pharmacy_name',
    value: 'TechPharm Pharmacy',
    description: 'Pharmacy name for receipts and reports',
    category: 'general',
  },
  {
    key: 'pharmacy_address',
    value: '',
    description: 'Pharmacy address for receipts',
    category: 'general',
  },
  {
    key: 'pharmacy_phone',
    value: '',
    description: 'Pharmacy phone number for receipts',
    category: 'general',
  },
  {
    key: 'receipt_footer',
    value: 'Thank you for your business!',
    description: 'Custom footer text for receipts',
    category: 'pos',
  },
]

// Helper to ensure default settings exist
async function ensureDefaultSettings() {
  for (const setting of DEFAULT_SETTINGS) {
    try {
      const existing = await db.setting.findUnique({
        where: { key: setting.key },
      })
      if (!existing) {
        await db.setting.create({
          data: setting,
        })
      }
    } catch (error) {
      console.error(`Failed to ensure setting ${setting.key}:`, error)
    }
  }
}

// GET - Retrieve all settings (grouped by category)
export async function GET() {
  try {
    const user = await getAuthUser()

    // Require authentication
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Ensure default settings exist
    await ensureDefaultSettings()

    const settings = await db.setting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    })

    // Group settings by category
    const groupedSettings = settings.reduce((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = []
      }
      acc[setting.category].push(setting)
      return acc
    }, {} as Record<string, typeof settings>)

    return NextResponse.json(groupedSettings)
  } catch (error) {
    console.error('Failed to fetch settings:', error)
    // Return more detailed error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch settings'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

// PUT - Update settings
export async function PUT(request: Request) {
  try {
    const user = await getAuthUser()

    // Only admins can update settings
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Only admins can update settings' }, { status: 403 })
    }

    const body = await request.json()
    const { settings } = body as { settings: { key: string; value: string }[] }

    if (!Array.isArray(settings)) {
      return NextResponse.json({ error: 'Invalid settings format' }, { status: 400 })
    }

    // Validate VAT percentage
    const vatSetting = settings.find(s => s.key === 'vat_percentage')
    if (vatSetting) {
      const vatValue = parseFloat(vatSetting.value)
      if (isNaN(vatValue) || vatValue < 0 || vatValue > 100) {
        return NextResponse.json({ error: 'VAT percentage must be between 0 and 100' }, { status: 400 })
      }
    }

    // Update each setting
    const updatePromises = settings.map(setting =>
      db.setting.upsert({
        where: { key: setting.key },
        update: { value: setting.value },
        create: {
          key: setting.key,
          value: setting.value,
          category: DEFAULT_SETTINGS.find(d => d.key === setting.key)?.category || 'general',
        },
      })
    )

    await Promise.all(updatePromises)

    revalidatePath('/settings')
    return NextResponse.json({ success: true, message: 'Settings updated successfully' })
  } catch (error) {
    console.error('Failed to update settings:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
