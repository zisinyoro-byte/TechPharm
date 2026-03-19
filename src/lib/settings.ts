import { db } from '@/lib/db'

// Cache for settings (simple in-memory cache)
let settingsCache: Record<string, string> | null = null
let cacheExpiry = 0
const CACHE_TTL = 60000 // 1 minute cache

export async function getSettings(): Promise<Record<string, string>> {
  // Return cached settings if still valid
  if (settingsCache && Date.now() < cacheExpiry) {
    return settingsCache
  }

  try {
    const settings = await db.setting.findMany()
    settingsCache = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value
      return acc
    }, {} as Record<string, string>)
    cacheExpiry = Date.now() + CACHE_TTL
    return settingsCache
  } catch (error) {
    console.error('Failed to get settings:', error)
    return {}
  }
}

export async function getSetting(key: string): Promise<string | null> {
  const settings = await getSettings()
  return settings[key] ?? null
}

export async function getVatPercentage(): Promise<number> {
  const vatEnabled = await getSetting('vat_enabled')
  if (vatEnabled !== 'true') {
    return 0
  }
  const vatPercentage = await getSetting('vat_percentage')
  return parseFloat(vatPercentage || '0') || 0
}

export function calculateVat(amount: number, vatPercentage: number): number {
  if (vatPercentage <= 0) return 0
  return Math.round(amount * vatPercentage) / 100
}

export function clearSettingsCache() {
  settingsCache = null
  cacheExpiry = 0
}
