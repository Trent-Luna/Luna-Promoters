'use client'

// The pass link is remembered on this phone so "My season pass" opens it
// straight away. Browser storage can be missing (private mode), so every
// read and write is guarded and the page works without it.
const KEY = 'offcampus-pass'

export function rememberPass(token: string) {
  try { window.localStorage.setItem(KEY, token) } catch { /* private mode */ }
}

export function recallPass(): string | null {
  try { return window.localStorage.getItem(KEY) } catch { return null }
}

export function forgetPass() {
  try { window.localStorage.removeItem(KEY) } catch { /* private mode */ }
}
