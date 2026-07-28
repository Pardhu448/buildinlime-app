#!/usr/bin/env python3
"""Compose the raw device captures into Play-ready phone screenshots.

The device is 720x1600 (9:20). Play requires 9:16, so each capture is cropped to
its app content (system status bar and navigation bar removed) and placed on a
1080x1920 brand canvas with a caption.

Input : store-assets/screenshots/NN-name.png   (raw adb screencap, 720x1600)
Output: store-assets/screenshots/out/NN-name.png (1080x1920)
"""

import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

BROWN = (151, 102, 35)
BROWN_DK = (110, 72, 22)
CREAM = (253, 248, 242)
SUBTLE = (231, 209, 184)

FONT_DIR = "/home/parthae/Documents/Projects/BuildInLime/POC/BuildInLime/node_modules/@expo-google-fonts/instrument-sans"
SHOTS = "/home/parthae/Documents/Projects/BuildInLime/POC/BuildInLime/mobile-app/store-assets/screenshots"
OUT = f"{SHOTS}/out"

W, H = 1080, 1920
SS = 2  # supersample factor

# Rows to trim off each raw capture: the system status bar and the nav bar.
CROP_TOP = 88
CROP_BOTTOM = 105

# (file, caption, sub-caption, content_bottom)
#
# content_bottom trims trailing empty space in the raw capture, in raw pixels.
# Lists that run out mid-screen read as an empty app; screens whose content is
# anchored (a composer, a sheet) or deliberately centred keep their full height.
# None = keep the full capture.
PLATES = [
    ("01-channels.png", "A channel for every workstream",
     "Requirements, design, materials — each with its own status", 965),
    ("02-messages.png", "Talk where the work is",
     "Threaded messages, with photos and files attached", None),
    ("03-task-detail.png", "Tasks that keep their history",
     "Owner, status and every change, recorded on the task", 1105),
    ("04-resources.png", "Files stay with the work",
     "Every attachment tied to the message or task it came from", None),
    ("05-signin.png", "Sign in with your email",
     "A one-time code — no password to forget", None),
]

# Every plate is scaled by the same factor, derived from a full-height capture,
# so the app UI renders at an identical size across the whole carousel.
PLATE_TOP, PLATE_BOTTOM, PLATE_SIDE = 248, 52, 90


def font(weight, size):
    return ImageFont.truetype(f"{FONT_DIR}/{weight}/InstrumentSans_{weight}.ttf", size)


def background():
    """Brown vertical wash, matching the feature graphic."""
    im = Image.new("RGB", (W * SS, H * SS), BROWN)
    d = ImageDraw.Draw(im)
    for i in range(H * SS):
        t = i / (H * SS)
        c = tuple(int(BROWN[k] + (BROWN_DK[k] - BROWN[k]) * t) for k in range(3))
        d.line([(0, i), (W * SS, i)], fill=c)
    return im


def rounded(im, radius):
    """Apply rounded corners, returning an RGBA image."""
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.size[0], im.size[1]],
                                           radius=radius, fill=255)
    im = im.convert("RGBA")
    im.putalpha(mask)
    return im


def centred(d, text, y, fnt, fill):
    w = d.textbbox((0, 0), text, font=fnt)[2]
    d.text(((W * SS - w) / 2, y), text, font=fnt, fill=fill)


def plate_scale(raw_h=1600):
    """The scale a full-height capture needs to fill the plate area, in SS units."""
    full = raw_h - CROP_TOP - CROP_BOTTOM
    avail_h = (H - PLATE_TOP - PLATE_BOTTOM) * SS
    avail_w = (W - 2 * PLATE_SIDE) * SS
    return min(avail_w / 720, avail_h / full)


def compose(src, caption, sub, content_bottom):
    shot = Image.open(f"{SHOTS}/{src}").convert("RGB")
    bottom_px = content_bottom if content_bottom else shot.height - CROP_BOTTOM
    shot = shot.crop((0, CROP_TOP, shot.width, bottom_px))

    im = background()
    d = ImageDraw.Draw(im)

    centred(d, caption, int(96 * SS), font("700Bold", int(52 * SS)), CREAM)
    centred(d, sub, int(168 * SS), font("400Regular", int(28 * SS)), SUBTLE)

    top = PLATE_TOP * SS
    scale = plate_scale()
    sw, sh = int(shot.width * scale), int(shot.height * scale)
    shot = shot.resize((sw, sh), Image.LANCZOS)
    shot = rounded(shot, int(22 * SS))

    x, y = (W * SS - sw) // 2, top

    # Soft drop shadow so the plate lifts off the brown.
    sh_layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh_layer).rounded_rectangle(
        [x, y + int(10 * SS), x + sw, y + sh + int(10 * SS)],
        radius=int(22 * SS), fill=(60, 38, 10, 130))
    sh_layer = sh_layer.filter(ImageFilter.GaussianBlur(int(14 * SS)))
    im = Image.alpha_composite(im.convert("RGBA"), sh_layer)

    im.paste(shot, (x, y), shot)
    im = im.convert("RGB").resize((W, H), Image.LANCZOS)
    im.save(f"{OUT}/{src}")
    print(f"{src}  {im.size}")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for src, cap, sub, cb in PLATES:
        compose(src, cap, sub, cb)
