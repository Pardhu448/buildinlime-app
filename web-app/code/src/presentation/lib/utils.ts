import { clsx } from 'clsx'
import type { ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Property } from '%/domain/communication/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Electric SQL returns jsonb columns as JSON-encoded strings (e.g. '"critical"').
// This unwraps them to their actual value.
export function unwrapJsonb(v: unknown): unknown {
  return typeof v === 'string' && v.startsWith('"') ? JSON.parse(v) : v
}

// Turns a raw properties-collection row (jsonb columns still wrapped) into a
// Property the pill/icon display can read. Shared by the hooks that surface
// property data on cards/tables.
export function mapPropertyRow(p: Record<string, unknown>): Property {
  return {
    ...p,
    type: unwrapJsonb(p.type),
    entity: unwrapJsonb(p.entity),
    status_value: unwrapJsonb(p.status_value),
    priority_value: unwrapJsonb(p.priority_value),
    task_status_value: unwrapJsonb(p.task_status_value),
  } as Property
}

// Parses Postgres array literals (e.g. "{a,b,c}") or JS arrays into string[].
export function parseTextArray(val: unknown): string[] {
  if (Array.isArray(val)) return val as string[]
  if (typeof val === 'string' && val.startsWith('{') && val.endsWith('}'))
    return val.slice(1, -1).split(',').filter(Boolean)
  return []
}
