# Play Store graphics — BuildInLime

Fills the "Graphics assets" gap noted at the end of `../PLAY_CONSOLE_INPUTS.md`.
Prepared 2026-07-28. Upload at **Grow users → Store presence → Main store listing → Graphics**.

## What to upload

The app icon and feature graphic are **global** — uploaded once, they serve every
form factor. Only screenshots are per-form-factor.

| Play field | File | Spec | Status |
|---|---|---|---|
| App icon | `play-icon-512.png` | 512×512, 32-bit PNG w/ alpha | ✅ |
| Feature graphic | `feature-graphic.png` | 1024×500, no alpha | ✅ |
| Phone screenshots | `screenshots/out/phone/` | 1080×1920 (9:16) | ✅ 5 |
| 7-inch tablet | `screenshots/out/tab7/` | 1440×2560 (9:16) | ✅ 4 |
| 10-inch tablet | `screenshots/out/tab10/` | 1440×2560 (9:16) | ✅ 4 |
| Chromebook | — | — | ❌ not produced |
| Android XR | — | 8:5, ≥1920×1200 | ❌ not produced |

Play requires a **minimum of 4** screenshots per tablet form factor (2 for phone), and
blocks closed testing without the tablet sets. Chromebook and Android XR are only
required if you distribute to them; XR additionally needs a different aspect ratio
(8:5) that nothing here can be adapted to.

## Provenance

- **Brand mark** — `web-app/code/public/favicon.svg` (brick jhali, `#976623` on `#fdf8f2`),
  redrawn as rectangles in `build_graphics.py` so both outputs share one source.
- **Typeface** — Instrument Sans, from `@expo-google-fonts/instrument-sans`, the same
  family the app renders with.
- **Screenshots** — captured over `adb` from a physical moto g34 5G running the release
  build, 2026-07-28. Genuine app screens, no mockups.

## Regenerating

```sh
python3 build_graphics.py        # store icon + feature graphic (this directory)
python3 compose_screenshots.py   # screenshots/*.png -> screenshots/out/*.png
python3 build_app_icons.py       # in-app icon set -> ../assets/images/
```

`screenshots/*.png` are the raw 720×1600 device captures; `screenshots/out/` holds the
composed uploads. Re-running is safe and deterministic.

### Why the screenshots are composed rather than uploaded raw

The device panel is 720×1600 — **9:20**. Play requires **9:16**, so raw captures cannot
be uploaded. Each is cropped to remove the system status and navigation bars, then
placed on a 9:16 brand canvas with a caption. Within a set every plate is scaled by the
same factor, so the app UI is the same size across that carousel.

Two phone plates (`01`, `03`) are additionally cropped to where their content ends — see
`content_bottom` in `compose_screenshots.py`. Both are short lists that stop mid-screen,
and the trailing white read as an empty app. Screens whose content is anchored (a
composer, a bottom sheet) or deliberately centred keep their full height.

The tablet plates are deliberately **not** content-cropped. A short, wide tablet screen
cannot fill a 9:16 canvas, so trimming it just moves the void outside the plate; keeping
the full screen puts the emptiness inside the app, where it honestly belongs.

### How the tablet sets were captured

There is no tablet here and no `cmdline-tools`/`avdmanager` to create one, so the
physical phone's display was temporarily overridden to the canonical large-screen
breakpoints and the app relaunched into them:

```sh
adb shell wm size 1200x1920 && adb shell wm density 320   # 7-inch  -> 600dp wide
adb shell wm size 1600x2560 && adb shell wm density 320   # 10-inch -> 800dp wide
```

Restore afterwards with `wm size reset`. **Restore density with `wm density 306`, not
`wm density reset`** — this device runs a 306 override over a physical 280, and a plain
reset silently changes the user's phone.

Status-bar heights differ per resolution (100px at 7-inch, 130px at 10-inch); the tablet
renders have no navigation bar at all. Both are encoded in `SETS`.

> These show the phone layout stretched, because the app has no large-screen layout —
> one `useWindowDimensions` call in the entire codebase, for bottom-sheet height. That is
> what a tablet user actually gets, so the screenshots are accurate, but a real tablet
> layout would make this listing substantially better.

### Capture notes

Run these before capturing, or the real status bar leaks in — it is invisible on
white-background screens but shows through any dimmed overlay:

```sh
adb shell settings put global sysui_demo_allowed 1
D="am broadcast -a com.android.systemui.demo"
adb shell $D -e command enter
adb shell $D -e command clock -e hhmm 0930
adb shell $D -e command notifications -e visible false
adb shell $D -e command network -e wifi show -e level 4
```

Motorola's charging pill overrides demo mode while USB is attached; the status-bar crop
removes it anyway. Exit with `adb shell $D -e command exit`.

## Known weaknesses

- **`05-signin.png` is the weakest plate.** Mostly white, and its logo is
  `brick-logo-brown.png` — a photo of a jhali, rendered small and washed out next to the
  crisp mark used everywhere else. Play's minimum is two screenshots, so dropping this
  one costs nothing. It is last in the carousel either way.
- **Single-project data.** All screens come from one build unit ("Foundation Work") with
  three channels. Honest, but it shows a small deployment.
- **`InitialDraft`** (no space) is the headline text of `03`.

## In-app icon set — replaced 2026-07-28

`build_app_icons.py` overwrites the stock Expo chevron artwork in `../assets/images/`
with the same brand mark, at the sizes of the files it replaces:

| File | Size | Content |
|---|---|---|
| `icon.png` | 1024×1024 | Full-bleed brown plate + cream jhali |
| `android-icon-background.png` | 512×512 | Flat `#976623` |
| `android-icon-foreground.png` | 512×512 | Mark only, transparent, inside the safe zone |
| `android-icon-monochrome.png` | 432×432 | Opaque silhouette for themed icons |
| `splash-icon.png` | 1024×1024 | Rounded plate, transparent surround |
| `favicon.png` | 48×48 | Full-bleed plate |

`app.json` needed one change: `android.adaptiveIcon.backgroundColor`, which was still
Expo's `#E6F4FE`, is now `#976623`. All image paths are unchanged.

**Why the mark is drawn small on the two adaptive layers.** The adaptive layer canvas is
108dp; only the centre 72dp is ever visible and the centre 66dp circle is the safe zone.
A full-bleed web favicon (`logo512.png`) dropped into that slot would be clipped at the
edges and double-rounded. Verified by compositing the layers and applying a circular
mask — the mark clears it with margin.

### Not verified locally

`mobile-app/android/` is gitignored; EAS regenerates the native project from `app.json`
at build time, so the launcher mipmaps only pick this up on the next build. `expo
prebuild` was deliberately not run — it can touch dependencies, and the Expo/RN versions
here are pinned for the Electric + TanStack DB sync stack.

**Confirm the launcher icon on-device after the next build.** It costs a versionCode.
Closed testing can continue on vc3 meanwhile.

The previous Expo artwork is recoverable with
`git checkout -- mobile-app/assets/images/`.
