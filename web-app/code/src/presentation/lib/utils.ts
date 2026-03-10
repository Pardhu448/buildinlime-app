import { clsx } from 'clsx'
import type { ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Electric SQL returns jsonb columns as JSON-encoded strings (e.g. '"critical"').
// This unwraps them to their actual value.
export function unwrapJsonb(v: unknown): unknown {
  return typeof v === 'string' && v.startsWith('"') ? JSON.parse(v) : v
}

// Parses Postgres array literals (e.g. "{a,b,c}") or JS arrays into string[].
export function parseTextArray(val: unknown): string[] {
  if (Array.isArray(val)) return val as string[]
  if (typeof val === 'string' && val.startsWith('{') && val.endsWith('}'))
    return val.slice(1, -1).split(',').filter(Boolean)
  return []
}
