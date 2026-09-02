import type { Preferences, StoredCredentials } from "@/domain/types"

export const CREDENTIALS_KEY = "sit-web.credentials.v1"
export const PREFERENCES_KEY = "sit-web.preferences.v1"

export function loadCredentials(): StoredCredentials | null {
  try {
    const raw = localStorage.getItem(CREDENTIALS_KEY)
    return raw ? JSON.parse(raw) as StoredCredentials : null
  } catch {
    return null
  }
}

export function saveCredentials(credentials: StoredCredentials) {
  if (credentials.remember) localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials))
  else localStorage.removeItem(CREDENTIALS_KEY)
}

export function clearCredentials() {
  localStorage.removeItem(CREDENTIALS_KEY)
}

export function loadPreferences(): Preferences {
  const fallback: Preferences = { version: 1, theme: "light", defaultImageFormat: "png", jpegQuality: 0.92, retentionDays: null }
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

export function clearLocalSettings() {
  localStorage.removeItem(CREDENTIALS_KEY)
  localStorage.removeItem(PREFERENCES_KEY)
}
