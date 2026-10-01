#!/usr/bin/env python3
"""Build the extension icons, store banners and store-sized screenshots.

Everything is generated from code so the art can be tweaked and rebuilt:

    python3 assets/build.py

Outputs (all committed):
    chrome/icons/icon{16,32,48,128}.png
    firefox/icons/icon{16,32,48,96,128}.png
    assets/icons/icon-1024.png
    assets/chrome-web-store/promo/*.png
    assets/{chrome-web-store,firefox-addons}/screenshots/*.png
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

INK = (25, 25, 24)
INK_SOFT = (120, 116, 112)
PAPER = (247, 247, 246)
CARD = (255, 255, 255)
CARD_LINE = (229, 226, 223)
ACCENT = (124, 58, 237)
GREEN = (34, 160, 107)
DARK_TOP = (37, 36, 43)
DARK_BOTTOM = (18, 18, 22)


def font(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)


# --------------------------------------------------------------------------- #
#  icon: dark rounded square, 2x2 card grid, one accent card with a live dot  #
# --------------------------------------------------------------------------- #

def draw_icon(size):
    s = 1024
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))

    # vertical gradient, clipped to a rounded square
    grad = Image.new("RGBA", (s, s))
    gd = ImageDraw.Draw(grad)
    for y in range(s):
        t = y / (s - 1)
        gd.line(
            [(0, y), (s, y)],
            fill=tuple(round(a + (b - a) * t) for a, b in zip(DARK_TOP, DARK_BOTTOM)) + (255,),
        )
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, s - 1, s - 1], radius=232, fill=255)
    img.paste(grad, (0, 0), mask)

    d = ImageDraw.Draw(img)
    margin, gap, radius = 158, 86, 66
    card = (s - 2 * margin - gap) // 2
    cells = [(margin, margin), (margin + card + gap, margin),
             (margin, margin + card + gap), (margin + card + gap, margin + card + gap)]
    for i, (x, y) in enumerate(cells):
        box = [x, y, x + card, y + card]
        d.rounded_rectangle(box, radius=radius, fill=ACCENT if i == 0 else (238, 236, 233, 255))

    # live / online dot on the accent card
    dot = 104
    cx = margin + card - dot // 2 - 46
    cy = margin + card - dot // 2 - 46
    d.ellipse([cx - dot // 2, cy - dot // 2, cx + dot // 2, cy + dot // 2], fill=GREEN)

    return img.resize((size, size), Image.LANCZOS)


def build_icons():
    master = draw_icon(1024)
    (ROOT / "assets/icons").mkdir(parents=True, exist_ok=True)
    master.save(ROOT / "assets/icons/icon-1024.png")

    for folder, sizes in (("chrome", (16, 32, 48, 128)), ("firefox", (16, 32, 48, 96, 128))):
        out = ROOT / folder / "icons"
        out.mkdir(parents=True, exist_ok=True)
        for n in sizes:
            draw_icon(n).save(out / f"icon{n}.png")


# --------------------------------------------------------------------------- #
#  shared promo helpers                                                       #
# --------------------------------------------------------------------------- #

def gradient_bg(w, h, top=DARK_TOP, bottom=DARK_BOTTOM):
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(h - 1, 1)
        d.line([(0, y), (w, y)],
               fill=tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))
    # soft glow behind the artwork
    glow = Image.new("L", (w, h), 0)
    ImageDraw.Draw(glow).ellipse(
        [w * 0.45, -h * 0.55, w * 1.15, h * 0.75], fill=70
    )
    img = Image.composite(Image.new("RGB", (w, h), (60, 46, 120)), img, glow.point(lambda v: v))
    return img


def paste_icon(img, size, xy):
    img.paste(draw_icon(size), xy, draw_icon(size))


def rounded(img, size, radius):
    img = img.convert("RGBA").resize(size, Image.LANCZOS)
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def text_block(d, xy, title, lines, align="left"):
    x, y = xy
    anchor = "la" if align == "left" else "ma"
    d.text((x, y), title, font=font(52, True), fill=(255, 255, 255, 255), anchor=anchor)
    y += 74
    for line in lines:
        d.text((x, y), line, font=font(26), fill=(196, 192, 206, 255), anchor=anchor)
        y += 40


def build_promo():
    out = ROOT / "assets/chrome-web-store/promo"
    out.mkdir(parents=True, exist_ok=True)
    shot = Image.open(ROOT / "screenshots/after.jpg")
    shot_card = rounded(shot, (760, 475), 22)

    # small tile 440x280 ------------------------------------------------------
    w, h = 440, 280
    img = gradient_bg(w, h)
    paste_icon(img, 84, ((w - 84) // 2, 40))
    d = ImageDraw.Draw(img)
    d.text((w / 2, 160), "Clean Console", font=font(34, True), fill=(255, 255, 255, 255), anchor="ma")
    d.text((w / 2, 202), "for the Tailscale admin panel", font=font(18),
           fill=(196, 192, 206, 255), anchor="ma")
    d.text((w / 2, 232), "grid view  ·  no banners  ·  hide anything", font=font(14),
           fill=(150, 146, 162, 255), anchor="ma")
    img.convert("RGB").save(out / "small-tile-440x280.png")

    # large tile 920x680 ------------------------------------------------------
    w, h = 920, 680
    img = gradient_bg(w, h)
    paste_icon(img, 116, (64, 64))
    d = ImageDraw.Draw(img)
    text_block(d, (206, 92), "Clean Console", ["A calmer Tailscale admin panel.",
                                                "Card grid · hides the plan banner."])
    img.paste(rounded(shot, (792, 495), 20), (64, 205), rounded(shot, (792, 495), 20))
    img.convert("RGB").save(out / "large-tile-920x680.png")

    # marquee 1400x560 --------------------------------------------------------
    w, h = 1400, 560
    img = gradient_bg(w, h)
    paste_icon(img, 132, (80, 76))
    d = ImageDraw.Draw(img)
    text_block(d, (240, 108), "Clean Console",
               ["A calmer Tailscale admin panel.",
                "Card grid, online/offline split,",
                "no trial banner, hide anything."])
    img.paste(shot_card, (640, 44), shot_card)
    img.convert("RGB").save(out / "marquee-1400x560.png")


# --------------------------------------------------------------------------- #
#  store screenshots: 1280x800 (the after shot first, that is the pitch)      #
# --------------------------------------------------------------------------- #

def build_screenshots():
    for store in ("chrome-web-store", "firefox-addons"):
        out = ROOT / "assets" / store / "screenshots"
        out.mkdir(parents=True, exist_ok=True)
        on = Image.open(ROOT / "screenshots/after.jpg").resize((1280, 800), Image.LANCZOS)
        off = Image.open(ROOT / "screenshots/before.jpg").resize((1280, 800), Image.LANCZOS)
        on.convert("RGB").save(out / "1-grid-view-1280x800.png")
        off.convert("RGB").save(out / "2-classic-view-1280x800.png")


if __name__ == "__main__":
    build_icons()
    build_promo()
    build_screenshots()
    print("built icons, promo tiles and store screenshots")
