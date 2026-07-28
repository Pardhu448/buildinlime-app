#!/usr/bin/env python3
"""Regenerate the in-app icon set from the BuildInLime brand mark.

Replaces the stock Expo chevron artwork in mobile-app/assets/images/ with the
brick jhali from web-app/code/public/favicon.svg. Sizes match the files being
replaced, so app.json needs no path changes (only adaptiveIcon.backgroundColor).

Adaptive-icon geometry: the layer canvas is 108dp, of which only the centre 72dp
is ever visible and the centre 66dp circle is the safe zone. The mark is therefore
drawn small and centred on the foreground and monochrome layers -- a full-bleed
web favicon dropped into those slots would be clipped at the edges.
"""

from PIL import Image, ImageDraw

BROWN = (151, 102, 35)      # #976623
CREAM = (253, 248, 242)     # #fdf8f2

IMAGES = "/home/parthae/Documents/Projects/BuildInLime/POC/BuildInLime/mobile-app/assets/images"

# The jhali in favicon.svg's 512-unit space.
BRICKS = [
    (72, 150, 168, 66), (272, 150, 168, 66),
    (72, 248, 68, 66), (172, 248, 168, 66), (372, 248, 68, 66),
    (72, 346, 168, 66), (272, 346, 168, 66),
]
# Bounding box of the pattern within that space.
PAT = (72, 150, 440, 412)
PAT_W, PAT_H = PAT[2] - PAT[0], PAT[3] - PAT[1]

SS = 4  # supersample


def draw_pattern(canvas, target_w, fill):
    """Draw the jhali centred on `canvas`, with the pattern `target_w` px wide."""
    d = ImageDraw.Draw(canvas)
    s = target_w / PAT_W
    ox = (canvas.width - PAT_W * s) / 2 - PAT[0] * s
    oy = (canvas.height - PAT_H * s) / 2 - PAT[1] * s
    for bx, by, bw, bh in BRICKS:
        d.rectangle([ox + bx * s, oy + by * s,
                     ox + (bx + bw) * s, oy + (by + bh) * s], fill=fill)


def plate(size, pattern_frac, radius_frac, bg, fg, bleed=False):
    """A brown plate (full-bleed or rounded) carrying the cream jhali."""
    im = Image.new("RGBA", (size * SS, size * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if bleed:
        d.rectangle([0, 0, size * SS, size * SS], fill=bg)
    else:
        d.rounded_rectangle([0, 0, size * SS, size * SS],
                            radius=int(size * SS * radius_frac), fill=bg)
    draw_pattern(im, size * SS * pattern_frac, fg)
    return im.resize((size, size), Image.LANCZOS)


def save(im, name):
    im.save(f"{IMAGES}/{name}")
    print(f"{name}  {im.size}  {im.mode}")


if __name__ == "__main__":
    # App icon: full-bleed plate. Stores and launchers apply their own masks.
    save(plate(1024, 0.72, 0, BROWN + (255,), CREAM + (255,), bleed=True), "icon.png")

    # Adaptive background layer: flat brand brown, no artwork.
    bg = Image.new("RGBA", (512, 512), BROWN + (255,))
    save(bg, "android-icon-background.png")

    # Adaptive foreground: mark only, inside the 66dp safe zone (~55% of canvas).
    fg = Image.new("RGBA", (512 * SS, 512 * SS), (0, 0, 0, 0))
    draw_pattern(fg, 512 * SS * 0.55, CREAM + (255,))
    save(fg.resize((512, 512), Image.LANCZOS), "android-icon-foreground.png")

    # Themed (monochrome) layer: opaque silhouette, same safe zone. Android tints it.
    mono = Image.new("RGBA", (432 * SS, 432 * SS), (0, 0, 0, 0))
    draw_pattern(mono, 432 * SS * 0.55, (0, 0, 0, 255))
    save(mono.resize((432, 432), Image.LANCZOS), "android-icon-monochrome.png")

    # Splash: rounded plate on transparency, over app.json's white background.
    sp = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    sp.paste(plate(560, 0.72, 0.18, BROWN + (255,), CREAM + (255,)), (232, 232))
    save(sp, "splash-icon.png")

    # Web favicon, kept in step with the rest.
    save(plate(48, 0.72, 0, BROWN + (255,), CREAM + (255,), bleed=True), "favicon.png")
