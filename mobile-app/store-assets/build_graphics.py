#!/usr/bin/env python3
"""Generate the BuildInLime Play Store graphics.

Sources of truth:
  - brand mark   : web-app/code/public/favicon.svg (brick jhali, redrawn here as rects)
  - brand colour : design/.../DESIGN_SYSTEM.md  primary #976623, secondary #ac7f5e
  - typeface     : Instrument Sans, the same family the app renders with

Outputs (mobile-app/store-assets/):
  play-icon-512.png       512x512  32-bit PNG w/ alpha, full-bleed (Play masks corners)
  feature-graphic.png    1024x500  no alpha
"""

from PIL import Image, ImageDraw, ImageFont

BROWN = (151, 102, 35)      # #976623 primary
BROWN_DK = (110, 72, 22)    # deeper shade for the gradient
CREAM = (253, 248, 242)     # #fdf8f2 mark fill
SECONDARY = (172, 127, 94)  # #ac7f5e

FONT_DIR = "/home/parthae/Documents/Projects/BuildInLime/POC/BuildInLime/node_modules/@expo-google-fonts/instrument-sans"
OUT = "/home/parthae/Documents/Projects/BuildInLime/POC/BuildInLime/mobile-app/store-assets"


def font(weight, size):
    return ImageFont.truetype(f"{FONT_DIR}/{weight}/InstrumentSans_{weight}.ttf", size)


# The brick jhali, in the favicon.svg's 512-unit coordinate space.
BRICKS = [
    (72, 150, 168, 66), (272, 150, 168, 66),
    (72, 248, 68, 66), (172, 248, 168, 66), (372, 248, 68, 66),
    (72, 346, 168, 66), (272, 346, 168, 66),
]


def draw_mark(draw, x, y, size, fill=CREAM):
    """Draw the brick pattern (no background plate) at `size` px, top-left at x,y."""
    s = size / 512
    for bx, by, bw, bh in BRICKS:
        draw.rectangle(
            [x + bx * s, y + by * s, x + (bx + bw) * s, y + (by + bh) * s],
            fill=fill,
        )


def build_icon():
    """512x512, full-bleed brown plate. Play applies its own rounded mask."""
    SS = 4  # supersample for clean edges
    im = Image.new("RGBA", (512 * SS, 512 * SS), BROWN + (255,))
    draw_mark(ImageDraw.Draw(im), 0, 0, 512 * SS)
    im = im.resize((512, 512), Image.LANCZOS)
    im.save(f"{OUT}/play-icon-512.png")
    print("play-icon-512.png", im.size, im.mode)


def build_feature_graphic():
    """1024x500. Play crops/overlays this, so keep content well inside the centre."""
    W, H, SS = 1024, 500, 2
    im = Image.new("RGB", (W * SS, H * SS), BROWN)
    d = ImageDraw.Draw(im)

    # Diagonal wash from the deeper brown, bottom-left -> top-right.
    for i in range(H * SS):
        t = i / (H * SS)
        c = tuple(int(BROWN_DK[k] + (BROWN[k] - BROWN_DK[k]) * t) for k in range(3))
        d.line([(0, i), (W * SS, i)], fill=c)

    # Watermark: the full jhali, right-aligned and bleeding just past the edge so
    # the pattern still reads as a wall rather than as loose blocks.
    wm = int(H * SS * 1.25)
    draw_mark(d, int(W * SS - wm * 0.78), int(H * SS / 2 - wm / 2), wm,
              fill=(int(BROWN[0] * 1.10), int(BROWN[1] * 1.12), int(BROWN[2] * 1.26)))

    # The mark, as a cream plate on the left.
    plate = int(112 * SS)
    px, py = int(72 * SS), int(H * SS / 2 - plate / 2)
    d.rounded_rectangle([px, py, px + plate, py + plate], radius=int(20 * SS), fill=CREAM)
    draw_mark(d, px, py, plate, fill=BROWN)

    tx = px + plate + int(44 * SS)
    # Keep the text clear of the watermark bricks on the right.
    max_w = int(700 * SS) - tx

    def fitted(text, weight, size):
        """Shrink `size` until `text` fits max_w, so long copy never runs into the bricks."""
        while size > 12:
            f = font(weight, int(size * SS))
            if d.textbbox((0, 0), text, font=f)[2] <= max_w:
                return f
            size -= 1
        return font(weight, int(12 * SS))

    d.text((tx, int(H * SS / 2 - 82 * SS)), "BuildInLime",
           font=fitted("BuildInLime", "700Bold", 64), fill=CREAM)
    d.text((tx, int(H * SS / 2 - 4 * SS)), "Project Management For Natural Builders",
           font=fitted("Project Management For Natural Builders", "500Medium", 30), fill=CREAM)
    d.text((tx, int(H * SS / 2 + 40 * SS)), "Channels | Tasks | Data Ownership | Works-Offline",
           font=fitted("Channels | Tasks | Data Ownership | Works-Offline", "400Regular", 26),
           fill=(235, 214, 190))

    im = im.resize((W, H), Image.LANCZOS)
    im.save(f"{OUT}/feature-graphic.png")
    print("feature-graphic.png", im.size, im.mode)


if __name__ == "__main__":
    build_icon()
    build_feature_graphic()
