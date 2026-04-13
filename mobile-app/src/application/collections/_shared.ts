import { createCookieFetch } from "../../infrastructure/auth/cookie-fetch"

export const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000"
export const cookieFetch = createCookieFetch()

export const retryOnError = async (error: Error) => {
  const delay = error.message.includes("401") ? 2000 : 5000
  await new Promise((resolve) => setTimeout(resolve, delay))
}

export const coerceBool = (v: unknown) => v === "true" || v === true
export const unwrapJsonb = (v: unknown) =>
  typeof v === "string" && v.startsWith('"') ? JSON.parse(v) : v

// Hermes (React Native) cannot parse PostgreSQL's timestamp format
// "2024-01-15 10:30:00.123456+00" — it needs strict ISO 8601 with 'T' separator.
const normalizeTs = (d: string) =>
  d.replace(" ", "T").replace(/\+00(?::00)?$/, "Z")

export const parser = {
  timestamptz: (d: string) => new Date(normalizeTs(d)),
}
