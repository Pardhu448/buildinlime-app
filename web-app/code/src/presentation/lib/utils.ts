import { clsx } from 'clsx'
import type { ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Property } from '%/domain/communication/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Re-exported, not redefined. This file used to carry its OWN copy returning
// `unknown` — a third implementation alongside the one in @buildinlime/contracts
// that sync-core re-exports — so every unwrapped jsonb value arrived untyped in
// the presentation layer and had to be cast at each call site. The shared one is
// generic (defaulting to string, which every jsonb column here holds).
// One implementation, typed at the UI boundary.
//
// This file used to carry its OWN copy — a third alongside contracts' and the
// sync-core re-export — which returned `unknown`, so every unwrapped jsonb value
// arrived untyped and was cast at each call site.
//
// The generic lives HERE rather than on the shared function on purpose: that one
// is passed to `z.preprocess(...)` inside the row schemas, and making it generic
// changes what those schemas infer. Presentation gets the convenient type; the
// schemas keep the function they were written against.
import { unwrapJsonb as unwrapJsonbRaw } from '@buildinlime/contracts'

/** Unwraps a jsonb column. Defaults to `string` — every jsonb column here is a
 *  string enum. Pass an explicit type argument for anything else. */
export const unwrapJsonb = <T = string>(v: unknown): T => unwrapJsonbRaw(v) as T

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
