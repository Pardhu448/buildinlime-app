# Play Store graphics — BuildInLime

Fills the "Graphics assets" gap noted at the end of `../PLAY_CONSOLE_INPUTS.md`.
Prepared 2026-07-28. Upload at **Grow users → Store presence → Main store listing → Graphics**.

## What to upload

| Play field | File | Spec | Status |
|---|---|---|---|
| App icon | `play-icon-512.png` | 512×512, 32-bit PNG w/ alpha | ✅ |
| Feature graphic | `feature-graphic.png` | 1024×500, no alpha | ✅ |
| Phone screenshots | `screenshots/out/0*.png` | 1080×1920 (9:16), 2–8 images | ✅ 5 images |

Tablet screenshots are not produced. `app.json` sets `ios.supportsTablet` but the
Android listing does not have to claim tablet support; leave that section empty.

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

The device is 720×1600 — a **9:20** panel. Play requires phone screenshots at **9:16**,
so raw captures cannot be uploaded. Each is cropped to its app content (system status
bar and navigation bar removed) and placed on a 1080×1920 brand canvas with a caption.
Every plate is scaled by the same factor, so the app UI is the same size across the
carousel.

Two plates (`01`, `03`) are additionally cropped to where their content ends — see
`content_bottom` in `compose_screenshots.py`. Both screens are short lists that stop
mid-screen, and the trailing white read as an empty app. Screens whose content is
anchored (a composer, a bottom sheet) or deliberately centred keep their full height.

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
