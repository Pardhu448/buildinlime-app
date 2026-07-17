import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import path from "node:path"

// Web and mobile render the same brand, from two token files that no build step
// connects: mobile-app/src/presentation/shared/design-tokens.js and
// web-app/code/src/presentation/styles/theme.css. Today they agree — #976623 is
// primary in both — but only because someone copied the hexes across. Nothing
// stops one app's palette moving without the other's, and the symptom would be
// two products that quietly stop looking alike.
//
// So this pins two things:
//
//   1. PARITY — the tokens both apps define must hold identical values.
//   2. MEMBERSHIP — a hex literal in either app's source must be a known colour:
//      a brand token, one of web's own theme vars, or a documented exception.
//      New colours fail until someone puts them in one of those buckets, which
//      is the point: it makes adding a colour a decision rather than a reflex.
//
// What this canNOT do is prove the apps LOOK alike. Web's product components
// hardcode brand hexes ~520 times instead of reading the tokens (see
// components/buildInlime), so editing theme.css moves the shadcn primitives and
// leaves the product untouched. This guards the palette, not its application.

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
)
const MOBILE_TOKENS = path.join(
  repoRoot,
  "mobile-app/src/presentation/shared/design-tokens.js",
)
const WEB_THEME = path.join(
  repoRoot,
  "web-app/code/src/presentation/styles/theme.css",
)

const require = createRequire(import.meta.url)
const mobileTokens: Record<string, string> = require(MOBILE_TOKENS)

/**
 * The `:root` block of theme.css, as a `--var` → hex map.
 *
 * Ends at :root's own matching brace rather than at some landmark that follows
 * it. An earlier version sliced up to the `.dark {` rule, which broke twice
 * over: first because theme.css opened with `@custom-variant dark (&:is(.dark
 * *))`, so a naive indexOf(".dark") matched line 1 and sliced an empty string;
 * then because `.dark` was deleted outright and the boundary vanished. Both
 * times the slice would have been empty and every assertion below would have
 * passed vacuously — hence the sanity check on the parsed count.
 */
function webRootVars(): Record<string, string> {
  const css = readFileSync(WEB_THEME, "utf8")
  const start = css.indexOf(":root")
  expect(start, "theme.css has no :root block").toBeGreaterThanOrEqual(0)

  let depth = 0
  let end = -1
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++
    else if (css[i] === "}" && --depth === 0) {
      end = i
      break
    }
  }
  expect(end, "theme.css :root block is unterminated").toBeGreaterThan(start)

  const vars: Record<string, string> = {}
  for (const m of css.slice(start, end).matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    vars[m[1]] = m[2].toLowerCase()
  }
  return vars
}

/** mobile token name → web CSS var name, for the palette both apps share. */
const SHARED: Record<string, string> = {
  primary: "primary",
  primaryForeground: "primary-foreground",
  secondary: "secondary",
  background: "background",
  foreground: "foreground",
  muted: "muted",
  mutedForeground: "muted-foreground",
  border: "border",
  card: "card",
  destructive: "destructive",
  // Web carried these as bare hexes in ~146 places until they were named in
  // theme.css to match mobile's spelling; now their values are pinned together.
  cardSurface: "card-surface",
  cardBorder: "card-border",
  iconChip: "icon-chip",
}

// Mobile tokens with no web counterpart. Empty for now — every mobile token has
// one. Kept because the asymmetry is likely to return: mobile has no hover
// states, so web's --primary-hover has no mobile twin and is not listed here.
const MOBILE_ONLY: readonly string[] = []

// Colours that are deliberately outside the brand palette. Each is a decision
// someone already made; listing them here is what makes a NEW one fail loudly.
const KNOWN_EXCEPTIONS: Record<string, string> = {
  // Mobile — semantic status colours (property pills, task state, sync state).
  // Tailwind's stock palette, not BuildInLime brand: green/red/blue/amber.
  "#166534": "mobile: property pill, green-800",
  "#16a34a": "mobile: status green-600",
  "#15803d": "mobile: status green-700",
  "#dc2626": "mobile: status red-600",
  "#b91c1c": "mobile: status red-700",
  "#c0392b": "mobile: offline-debug error red",
  "#ff7a7a": "mobile: upload-failure red",
  "#ffb3b3": "mobile: upload-failure red, light",
  "#3b1414": "mobile: upload-failure red, dark",
  "#2563eb": "mobile: status blue-600",
  "#1d4ed8": "mobile: status blue-700",
  "#ca8a04": "mobile: status amber-600",
  "#a16207": "mobile: status amber-700",
  "#ea580c": "mobile: status orange-600",
  "#c2410c": "mobile: status orange-700",
  "#9333ea": "mobile: status purple-600",
  "#9ca3af": "mobile: neutral gray-400",
  "#6b7280": "mobile: neutral gray-500",
  "#4b5563": "mobile: neutral gray-600",

  // Web — one-offs with no token yet. Each is a brand shade that wants naming
  // or a stray that wants deleting; pinned so the set cannot grow silently.
  //
  // Entries graduate out of this list rather than lingering: #7d5419, #c4a574
  // and #9b6e4d became --primary-hover, --primary-disabled and
  // --secondary-hover, so the membership check now allows them as theme vars.
  "#f5ece0": "web: focus highlight + row hover (4 uses) — near --icon-chip, may fold in",
  "#e5ddd5": "web: login-card border (2 uses) — near --card-border, may fold in",
  "#c8c8d0": "web: disabled date text in the schedule popover (1 use)",

  // Not a design-system colour at all: an HTML email body, which cannot
  // reference CSS custom properties. This one will never graduate.
  "#f0f0f0": "web: OTP email template (infrastructure/lib/utils/sendEmailOtp.ts)",
}

const SCAN_ROOTS = [
  path.join(repoRoot, "web-app/code/src"),
  path.join(repoRoot, "mobile-app/src"),
  path.join(repoRoot, "mobile-app/app"),
]

/** Every .ts/.tsx under the scan roots, minus the token file itself. */
function sourceFiles(): string[] {
  const out: string[] = []
  for (const root of SCAN_ROOTS) {
    for (const rel of readdirSync(root, { recursive: true }) as string[]) {
      const f = path.join(root, String(rel))
      if (!/\.tsx?$/.test(f)) continue
      if (f.endsWith("design-tokens.js")) continue
      out.push(f)
    }
  }
  return out
}

describe("brand palette", () => {
  it("mobile and web agree on every shared token", () => {
    const web = webRootVars()
    // Sanity: prove the CSS actually parsed. Without this a broken parser
    // yields {} and every comparison below vacuously passes.
    expect(Object.keys(web).length).toBeGreaterThanOrEqual(15)

    const mismatches: string[] = []
    for (const [mobileKey, webVar] of Object.entries(SHARED)) {
      const m = mobileTokens[mobileKey]?.toLowerCase()
      const w = web[webVar]
      if (!m) mismatches.push(`design-tokens.js is missing "${mobileKey}"`)
      else if (!w) mismatches.push(`theme.css is missing "--${webVar}"`)
      else if (m !== w)
        mismatches.push(`${mobileKey}: mobile ${m} vs web --${webVar} ${w}`)
    }
    expect(mismatches).toEqual([])
  })

  it("documents the mobile tokens web has no var for", () => {
    // Not a mismatch — a known gap. If web ever grows these as real vars, move
    // them into SHARED so their values get pinned together too.
    const web = webRootVars()
    for (const key of MOBILE_ONLY) {
      expect(mobileTokens[key], `design-tokens.js lost "${key}"`).toBeTruthy()
      expect(web[key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)]).toBeUndefined()
    }
  })

  it("every documented exception is still in use", () => {
    // Without this the list rots silently: three entries (#936b4f, #7a5840,
    // #654212) outlived the files that used them and sat here describing
    // colours the repo no longer contained. An exception is a claim about the
    // code — if the claim expires, it should say so rather than accumulate.
    const blob = sourceFiles()
      .map((f) => readFileSync(f, "utf8"))
      .join("\n")
      .toLowerCase()
    const stale = Object.keys(KNOWN_EXCEPTIONS).filter((hex) => !blob.includes(hex))
    expect(stale, "KNOWN_EXCEPTIONS entries whose colour is gone — delete them").toEqual([])
  })

  it("every hex in either app is a known colour", () => {
    const files = sourceFiles()
    // Sanity: a scan that finds no files would pass silently.
    expect(files.length).toBeGreaterThanOrEqual(100)

    const allowed = new Set<string>([
      ...Object.values(mobileTokens).map((v) => v.toLowerCase()),
      ...Object.values(webRootVars()),
      ...Object.keys(KNOWN_EXCEPTIONS),
    ])

    const offenders = new Map<string, string[]>()
    for (const file of files) {
      for (const m of readFileSync(file, "utf8").matchAll(/#[0-9a-fA-F]{6}\b/g)) {
        const hex = m[0].toLowerCase()
        if (allowed.has(hex)) continue
        const where = offenders.get(hex) ?? []
        where.push(path.relative(repoRoot, file))
        offenders.set(hex, where)
      }
    }

    // Sanity: the scan must actually be seeing colours, or `allowed` could be
    // wrong in a way that never surfaces.
    const sawKnown = files.some((f) => /#976623/i.test(readFileSync(f, "utf8")))
    expect(sawKnown, "scan found no brand hex at all — regex or roots broken").toBe(true)

    expect(
      [...offenders].map(([hex, files]) => `${hex} in ${files[0]}${files.length > 1 ? ` (+${files.length - 1} more)` : ""}`),
      "Unknown colour. Add it to design-tokens.js if it is brand, or to KNOWN_EXCEPTIONS with a reason if it is not.",
    ).toEqual([])
  })
})
