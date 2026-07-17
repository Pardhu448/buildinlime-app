# Styling & design tokens (web + mobile)

How colour, shared UI, and the guard that keeps the two apps in sync work today.
Written after the `chore/ui-styling-cleanup` pass that consolidated both apps'
styling; supersedes `css_style_design_system.md`, which documents a
`components/design-system/` library that no longer exists.

## The one rule

**Never write a colour literal in a component.** Not a hex, not an `rgb()/rgba()`.
Every brand colour has a token; reach for the token. A CI guard fails the build
if a new literal appears (see [The palette guard](#the-palette-guard)).

The exceptions that remain are real and few: semantic status colours (Tailwind's
green/red/amber for property pills), an HTML email body, and a `theme-color`
meta tag — none can reference a token. They are enumerated in the guard.

## Where colour lives

Each app has exactly **one** source of colour, and they are kept equal by name.

| App | File | Consumed as |
| --- | --- | --- |
| Web | `src/presentation/styles/theme.css` (`:root` + `@theme inline`) | Tailwind utilities: `bg-primary`, `text-muted-foreground`, `border-card-border` |
| Mobile | `src/presentation/shared/design-tokens.js` | `colors.primary` (via `src/presentation/shared/colors.ts`) and `bg-primary` NativeWind classes (via `tailwind.config.js`) |

Mobile's `design-tokens.js` is plain CommonJS on purpose: `tailwind.config.js` is
loaded by Metro outside TypeScript and can only `require()`, while `colors.ts`
imports the same object. One file feeds both readers — change a hex there, never
in a consumer.

### The shared vocabulary

These token names hold the **same value in both apps** and are pinned together:

```
primary #976623   primary-foreground #ffffff
secondary #ac7f5e   background #ffffff   foreground #1e1e1e
muted #f5f5f5   muted-foreground #717182   border #ac7f5e   card #ffffff
destructive #d4183d
card-surface #fdf8f2   card-border #e5d4c1   icon-chip #f0e5d8
```

Web additionally has interaction-state tokens with **no mobile twin** (a touch
screen has no hover, and the buttons don't grey out): `primary-hover #7d5419`,
`primary-disabled #c4a574`, `secondary-hover #9b6e4d`, plus a few one-offs
(`surface-highlight`, `card-border-subtle`, `foreground-disabled`) and
`--shadow-card`, which derives from `--primary` via `color-mix` rather than
respelling the brand colour as rgba.

Mobile has one token web lacks: `scrim` (`rgba(0,0,0,0.4)`), the dim behind a
modal. Web dialogs use Tailwind's `bg-black/50` instead.

### Naming principle

Name tokens for their **role**, not their shade. `--primary-hover`, not
`--brown-dark`. This is why the interaction states got names at all: they had
been leaking as raw hexes because the palette had no word for "the hover state,"
so people typed a colour — and once typed a *wrong* one (`#7a521c`, eight RGB
units off the real hover shade). A named token is the thing that stops that.

## The palette guard

`web-app/code/tests/unit/palette-parity.test.ts` runs in CI and enforces three
things across **both** apps:

1. **Parity** — every shared token holds an identical value in web and mobile.
   Deleting a token fails rather than silently skipping.
2. **Membership** — every colour literal in either app's source (`#rrggbb`,
   `rgb()`, or `rgba()` — alpha ignored) must be a known token or a documented
   exception. A new colour fails until someone decides which it is.
3. **No rot** — every documented exception must still correspond to a colour the
   code actually contains, so the exception list can't accumulate fiction.

It reads `rgb()/rgba()` because that is exactly where a colour once hid: the
login-card shadow spelled the brand primary as `rgba(151,102,35,0.1)` and escaped
every hex search for months.

**What it does NOT do:** prove the two apps look alike. Web's product components
still apply tokens rather than, say, sharing rendered markup — the guard pins the
palette, not its application. It also has nothing to say about spacing, type
scale, or layout.

When you add a colour: put it in the token file if it's brand, or in
`KNOWN_EXCEPTIONS` with a one-line reason if it genuinely can't be a token. Never
suppress the guard.

## Shared components

Extracted from duplicated markup during the cleanup. Prefer these over
re-implementing; if you find yourself pasting a second copy of one, that's the
signal to extract, not to paste.

**Web** (`src/presentation/components/buildInlime/shared/`):

| Component | Replaces |
| --- | --- |
| `Modal` | 7 hand-rolled centred dialogs (backdrop + card + close) |
| `FormField` (`Input`/`Select`/`Textarea`/`Label`) | 34 pasted form-control class strings |
| `HeaderShell` + `MarketingNav` | the bar/logo (and nav) that 3 headers each re-implemented |
| `LoginCard` | a card `LoginForm` had re-implemented inline |

**Mobile** (`src/presentation/shared/components/`):

| Component | Replaces |
| --- | --- |
| `CenteredModal` | the frame `RenameFileModal` and `UploadScheduleModal` shared |

### Deliberately NOT shared

Two dialog shapes exist and are kept distinct on both platforms: the **centred
modal** and the **bottom sheet** (slide-up, tap-to-dismiss). Web's `ChannelPage`
dialog and mobile's `TasksSheet`/`ResourcesSheet` are the bottom-sheet family and
are intentionally not folded into the centred `Modal`/`CenteredModal` — the
interaction difference is real, and collapsing it would be a regression, not a
cleanup.

## shadcn / `components/ui`

Web was scaffolded with the full shadcn library (46 primitives). The product
never adopted it — it hand-rolls its own components — so 44 were deleted (many
imported packages that were never even installed). Three remain because
`alert-dialog` is actually used: `alert-dialog.tsx`, `button.tsx`, `utils.ts`
(the `cn` helper).

**If you want a shadcn primitive, add it back deliberately via the CLI** (and its
dependency). Do not assume `@/components/ui/<anything>` exists — it mostly
doesn't. And note that adopting shadcn broadly would be a *visual* change, not a
refactor: its components are token-driven in ways (`bg-accent`, `border-input`)
that differ from how the product renders today.

## Dark mode

There isn't any, on either app. Web's `.dark` block and mobile's `ThemeProvider`
dark branch were both removed because nothing ever activated them — no toggle, no
`.dark` class writer. If dark mode is wanted later it needs a real dark palette
and a way to turn it on; both were absent, and the dead CSS was misleading.

## Verifying styling changes

Typecheck and unit tests **cannot see a wrong class name** — Tailwind and
NativeWind both silently drop an unknown class. So:

- **Web:** after a token/class change, `pnpm build` and grep the emitted CSS in
  `dist/client/assets/*.css` to confirm the class generated and resolves to the
  expected value. Note the CSS is minified (one line) — `grep -o`/`strings`, not
  `grep -c`, and don't read the first match as the whole story.
- **Mobile:** `npx expo export --platform android` bundles through Metro (the real
  resolver — Node/vitest bypass it). The output is Hermes bytecode, so verify
  strings with `strings -a … | grep`, not plain `grep`.
- Both repos carry **pre-existing typecheck errors** (web ~173, mobile ~33), so
  the exit code means nothing. Baseline-diff: capture errors before, compare
  after, ignore line-number shifts.

## Deferred

- **Priority/status label maps** are triplicated across mobile's `PropertyPill`
  and web's two property components — identical domain vocabulary. Belongs in
  `packages/domain-types/src/shared.ts` beside the `*_VALUES` consts it keys.
  Cross-app and non-styling; its own PR.
- **`--card-border-subtle` vs `--card-border`** differ by 29 RGB units. Possibly a
  real distinction (login card vs in-app cards), possibly drift — undecided.
- **Status colours** (~31 mobile hexes) are Tailwind's semantic palette, not
  brand. They stay as documented exceptions; tokenising would only relocate them.
