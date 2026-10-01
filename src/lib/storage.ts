import { DEFAULT_SLIPPAGE, MAX_SLIPPAGE, MIN_SLIPPAGE } from '@/lib/constants'
import type { ActivityItem, SwapSettings, TokenInfo } from '@/lib/types'

const SETTINGS_KEY = 'deserialize.settings.v1'
const TOKENS_KEY = 'deserialize.tokens.v1'
const RECENT_KEY = 'deserialize.recent.v1'
const ACTIVITY_KEY = 'deserialize.activity.v1'

function readJson<T>(key: string): T | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private mode and full disks should not break the swap form.
  }
}

function isToken(value: unknown): value is TokenInfo {
  if (!value || typeof value !== 'object') return false
  const token = value as TokenInfo
  return (
    typeof token.address === 'string' &&
    typeof token.symbol === 'string' &&
    typeof token.name === 'string' &&
    typeof token.decimals === 'number'
  )
}

export function readSettings(): SwapSettings {
  const stored = readJson<Partial<SwapSettings>>(SETTINGS_KEY)
  const slippage = stored?.slippage
  if (typeof slippage !== 'number' || slippage < MIN_SLIPPAGE || slippage > MAX_SLIPPAGE) {
    return { slippage: DEFAULT_SLIPPAGE }
  }
  return { slippage }
}

export function writeSettings(settings: SwapSettings) {
  writeJson(SETTINGS_KEY, settings)
}

const tokenListeners = new Set<() => void>()
let customTokens: TokenInfo[] = (readJson<unknown[]>(TOKENS_KEY) ?? []).filter(isToken)

export function subscribeCustomTokens(listener: () => void) {
  tokenListeners.add(listener)
  return () => tokenListeners.delete(listener)
}

export function getCustomTokens(): TokenInfo[] {
  return customTokens
}

export function addCustomToken(token: TokenInfo) {
  customTokens = [
    token,
    ...customTokens.filter((item) => item.address.toLowerCase() !== token.address.toLowerCase()),
  ].slice(0, 40)
  writeJson(TOKENS_KEY, customTokens)
  tokenListeners.forEach((listener) => listener())
}

export function rememberToken(address: string) {
  const current = readJson<string[]>(RECENT_KEY) ?? []
  const next = [address, ...current.filter((item) => item.toLowerCase() !== address.toLowerCase())].slice(0, 8)
  writeJson(RECENT_KEY, next)
}

export function readRecentTokens(): string[] {
  const stored = readJson<string[]>(RECENT_KEY)
  return Array.isArray(stored) ? stored.filter((item) => typeof item === 'string') : []
}

function isActivity(value: unknown): value is ActivityItem {
  if (!value || typeof value !== 'object') return false
  const item = value as ActivityItem
  return typeof item.hash === 'string' && typeof item.timestamp === 'number'
}

const activityListeners = new Set<() => void>()
let activity: ActivityItem[] = (readJson<unknown[]>(ACTIVITY_KEY) ?? []).filter(isActivity)

export function subscribeActivity(listener: () => void) {
  activityListeners.add(listener)
  return () => activityListeners.delete(listener)
}

export function getActivity(): ActivityItem[] {
  return activity
}

export function pushActivity(item: ActivityItem) {
  activity = [item, ...activity.filter((existing) => existing.hash !== item.hash)].slice(0, 30)
  writeJson(ACTIVITY_KEY, activity)
  activityListeners.forEach((listener) => listener())
}

export function clearActivity() {
  activity = []
  writeJson(ACTIVITY_KEY, activity)
  activityListeners.forEach((listener) => listener())
}
