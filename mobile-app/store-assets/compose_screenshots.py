#!/usr/bin/env python3
"""Compose the raw device captures into Play-ready screenshots.

Three form factors, all captured from the same physical moto g34 5G. The phone
set is the device's native panel; the tablet sets were captured with the display
temporarily overridden to the canonical large-screen breakpoints:

    7-inch  : adb shell wm size 1200x1920 ; wm density 320   -> 600dp wide
    10-inch : adb shell wm size 1600x2560 ; wm density 320   -> 800dp wide

None of these panels is 9:16, which is what Play requires, so each capture is
cropped to its app content (system bars removed) and placed on a 9:16 brand
canvas with a caption. Within a set every plate uses the same scale factor, so
the app UI is the same size across that carousel.

Input : screenshots/<set>/NN-name.png  (raw adb screencap)
Output: screenshots/out/<set>/NN-name.png
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

SS = 2  # supersample

# Caption copy is shared across form factors; only the framing differs.
CAPTIONS = {
    "01-channels.png": ("A channel for every workstream",
                        "Requirements, design, materials — each with its own status"),
    "02-messages.png": ("Talk where the work is",
                        "Threaded messages, with photos and files attached"),
    "03-task-detail.png": ("Tasks that keep their history",
                           "Owner, status and every change, recorded on the task"),
    "04-resources.png": ("Files stay with the work",
                         "Every attachment tied to the message or task it came from"),
    "05-signin.png": ("Sign in with your email",
                      "A one-time code — no password to forget"),
}

# Per-set framing.
#   crop_top/crop_bottom : system status bar and nav bar, in raw pixels.
#   canvas               : output size, always exactly 9:16.
#   type_scale           : caption sizing, so text reads the same relative size.
#   content_bottom       : per-file trim of trailing empty space (None = keep all).
#
# Lists that run out mid-screen read as an empty app, and the tablet renders are
# mostly empty below the fold because the layout is phone-width with no large-screen
# breakpoints. Screens whose content is anchored (a composer, a bottom sheet) or
# deliberately centred keep their full height.
SETS = {
    "phone": {
        "canvas": (1080, 1920), "crop_top": 88, "crop_bottom": 105, "type_scale": 1.0,
        "files": ["01-channels.png", "02-messages.png", "03-task-detail.png",
                  "04-resources.png", "05-signin.png"],
        "content_bottom": {"01-channels.png": 965, "03-task-detail.png": 1105},
    },
    "tab7": {
        "canvas": (1440, 2560), "crop_top": 100, "crop_bottom": 0, "type_scale": 1.33,
        "files": ["01-channels.png", "02-messages.png", "03-task-detail.png",
                  "04-resources.png"],
        # No content trimming: a short, wide tablet screen cannot fill a 9:16
        # canvas, so cropping to content leaves a large void *outside* the plate.
        # Keeping the full screen puts that emptiness inside the app, where it
        # honestly belongs -- this is what 600dp/800dp actually renders like.
        "content_bottom": {},
    },
    "tab10": {
        "canvas": (1440, 2560), "crop_top": 130, "crop_bottom": 0, "type_scale": 1.33,
        "files": ["01-channels.png", "02-messages.png", "03-task-detail.png",
                  "04-resources.png"],
        "content_bottom": {},
    },
}

PLATE_TOP, PLATE_BOTTOM, PLATE_SIDE = 248, 52, 90  # fractions of a 1080x1920 canvas


def font(weight, size):
    return ImageFont.truetype(f"{FONT_DIR}/{weight}/InstrumentSans_{weight}.ttf", size)


def background(w, h):
    im = Image.new("RGB", (w, h), BROWN)
    d = ImageDraw.Draw(im)
    for i in range(h):
        t = i / h
        d.line([(0, i), (w, i)],
               fill=tuple(int(BROWN[k] + (BROWN_DK[k] - BROWN[k]) * t) for k in range(3)))
    return im


def rounded(im, radius):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, *im.size], radius=radius, fill=255)
    im = im.convert("RGBA")
    im.putalpha(mask)
    return im


def compose(set_name, cfg, fname):
    W, H = cfg["canvas"]
    k = W / 1080.0           # canvas scale relative to the phone layout
    ts = cfg["type_scale"]
    caption, sub = CAPTIONS[fname]

    shot = Image.open(f"{SHOTS}/{set_name}/{fname}").convert("RGB")
    bottom = cfg["content_bottom"].get(fname) or (shot.height - cfg["crop_bottom"])
    shot = shot.crop((0, cfg["crop_top"], shot.width, bottom))

    im = background(int(W * SS), int(H * SS))
    d = ImageDraw.Draw(im)

    def centred(text, y, fnt, fill):
        w = d.textbbox((0, 0), text, font=fnt)[2]
        d.text(((W * SS - w) / 2, y), text, font=fnt, fill=fill)

    centred(caption, int(96 * k * SS), font("700Bold", int(52 * ts * SS)), CREAM)
    centred(sub, int(168 * k * SS), font("400Regular", int(28 * ts * SS)), SUBTLE)

    # One scale per set, derived from a full-height capture of that set, so the
    # app UI is the same size on every plate in the carousel.
    raw_full = Image.open(f"{SHOTS}/{set_name}/02-messages.png")
    full_h = raw_full.height - cfg["crop_top"] - cfg["crop_bottom"]
    avail_h = (H - PLATE_TOP * k - PLATE_BOTTOM * k) * SS
    avail_w = (W - 2 * PLATE_SIDE * k) * SS
    scale = min(avail_w / raw_full.width, avail_h / full_h)

    sw, sh = int(shot.width * scale), int(shot.height * scale)
    shot = rounded(shot.resize((sw, sh), Image.LANCZOS), int(22 * k * SS))

    # Centre the plate in the area below the caption. Full-height plates fill it
    # anyway; heavily-cropped ones (the tablet lists) would otherwise leave a
    # large void at the bottom of the canvas.
    x = (int(W * SS) - sw) // 2
    y = int(PLATE_TOP * k * SS + max(0, (avail_h - sh) / 2))

    sh_layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh_layer).rounded_rectangle(
        [x, y + int(10 * k * SS), x + sw, y + sh + int(10 * k * SS)],
        radius=int(22 * k * SS), fill=(60, 38, 10, 130))
    sh_layer = sh_layer.filter(ImageFilter.GaussianBlur(int(14 * k * SS)))
    im = Image.alpha_composite(im.convert("RGBA"), sh_layer)

    im.paste(shot, (x, y), shot)
    im = im.convert("RGB").resize((W, H), Image.LANCZOS)

    os.makedirs(f"{OUT}/{set_name}", exist_ok=True)
    im.save(f"{OUT}/{set_name}/{fname}")
    print(f"  {set_name}/{fname}  {im.size}")


if __name__ == "__main__":
    for set_name, cfg in SETS.items():
        print(f"{set_name}:")
        for fname in cfg["files"]:
            compose(set_name, cfg, fname)
