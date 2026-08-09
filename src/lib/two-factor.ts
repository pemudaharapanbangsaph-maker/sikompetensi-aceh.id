// Shared 2FA utilities - extracted to avoid cross-route imports
import crypto from 'crypto'

// In-memory store for pending 2FA verifications (userId -> { tempToken, expires })
const pending2FA = new Map<string, { tempToken: string; expires: number }>()

// Clean up expired entries every 5 minutes
if (typeof globalThis !== 'undefined' && typeof setInterval === 'function') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, val] of pending2FA.entries()) {
      if (val.expires < now) pending2FA.delete(key)
    }
  }, 5 * 60 * 1000)
}

/** Generate a temporary token for a user pending 2FA verification (3 min TTL) */
export function generate2FAPendingToken(userId: string): string {
  const tempToken = crypto.randomBytes(32).toString('hex')
  pending2FA.set(userId, { tempToken, expires: Date.now() + 3 * 60 * 1000 })
  return tempToken
}

/** Validate a temp token and return the userId, or null if invalid/expired */
export function validate2FAPendingToken(tempToken: string): string | null {
  for (const [uid, data] of pending2FA.entries()) {
    if (data.tempToken === tempToken) {
      if (data.expires < Date.now()) {
        pending2FA.delete(uid)
        return null
      }
      return uid
    }
  }
  return null
}

/** Consume (delete) a pending 2FA entry by userId */
export function consume2FAPending(userId: string): void {
  pending2FA.delete(userId)
}
