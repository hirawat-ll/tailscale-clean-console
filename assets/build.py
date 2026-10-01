#!/usr/bin/env python3
"""Build every image asset: extension icons, README shots, store shots, banners.

    python3 assets/build.py

Screenshots are captured from test/mock.html with real Chromium (Playwright) at
2x, using invented machine data; the rest is drawn with Pillow. Outputs:

    chrome/icons/icon{16,32,48,128}.png
    firefox/icons/icon{16,32,48,96,128}.png
    assets/icons/icon-1024.png
    screenshots/{before,after}.png                 README
    assets/chrome-web-store/promo/*.png            store banners
    assets/{chrome-web-store,firefox-addons}/screenshots/*.png
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from capture import capture_all

ROOT = Path(__file__).resolve().parent.parent
FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

ACCENT = (124, 58, 237)
GREEN = (34, 160, 107)
DARK_TOP = (37, 36, 43)
DARK_BOTTOM = (18, 18, 22)


def font(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)


# --------------------------------------------------------------- icon --------

def draw_icon(size):
    s = 1024
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    grad = Image.new("RGBA", (s, s))
    gd = ImageDraw.Draw(grad)
    for y in range(s):
        t = y / (s - 1)
        gd.line([(0, y), (s, y)],
                fill=tuple(round(a + (b - a) * t) for a, b in zip(DARK_TOP, DARK_BOTTOM)) + (255,))
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, s - 1, s - 1], radius=232, fill=255)
    img.paste(grad, (0, 0), mask)

    d = ImageDraw.Draw(img)
    margin, gap, radius = 158, 86, 66
    card = (s - 2 * margin - gap) // 2
    cells = [(margin, margin), (margin + card + gap, margin),
             (margin, margin + card + gap), (margin + card + gap, margin + card + gap)]
    for i, (x, y) in enumerate(cells):
        d.rounded_rectangle([x, y, x + card, y + card], radius=radius,
                            fill=ACCENT if i == 0 else (238, 236, 233, 255))
    dot = 104
    cx = margin + card - dot // 2 - 46
    cy = margin + card - dot // 2 - 46
    d.ellipse([cx - dot // 2, cy - dot // 2, cx + dot // 2, cy + dot // 2], fill=GREEN)
    return img.resize((size, size), Image.LANCZOS)


def build_icons():
    (ROOT / "assets/icons").mkdir(parents=True, exist_ok=True)
    draw_icon(1024).save(ROOT / "assets/icons/icon-1024.png")
    for folder, sizes in (("chrome", (16, 32, 48, 128)), ("firefox", (16, 32, 48, 96, 128))):
        out = ROOT / folder / "icons"
        out.mkdir(parents=True, exist_ok=True)
        for n in sizes:
            draw_icon(n).save(out / f"icon{n}.png")


# ------------------------------------------------------------ composition ----

def gradient(w, h, top=DARK_TOP, bottom=DARK_BOTTOM, glow=None):
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(h - 1, 1)
        d.line([(0, y), (w, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))
    if glow:
        glow_img = Image.new("L", (w, h), 0)
        ImageDraw.Draw(glow_img).ellipse(
            [w * glow[0], h * glow[1], w * glow[2], h * glow[3]], fill=glow[4])
        img = Image.composite(Image.new("RGB", (w, h), glow[5]), img, glow_img)
    return img.convert("RGBA")


def rounded_mask(size, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return m


def make_window(page, width, radius=14, chrome=44, url="console.tailscale.com/admin/machines"):
    """A page capture inside a browser-window frame."""
    ph = round(page.height * width / page.width)
    page = page.resize((width, ph), Image.LANCZOS)
    win = Image.new("RGB", (width, chrome + ph))
    bar = Image.new("RGB", (width, chrome), (33, 32, 36))
    bd = ImageDraw.Draw(bar)
    for i, c in enumerate(((255, 95, 87), (254, 188, 46), (40, 200, 64))):
        cx = 20 + i * 21
        bd.ellipse([cx - 6, chrome // 2 - 6, cx + 6, chrome // 2 + 6], fill=c)
    pw, ph2 = int(width * 0.52), 24
    px, py = (width - pw) // 2, (chrome - ph2) // 2
    bd.rounded_rectangle([px, py, px + pw, py + ph2], radius=12, fill=(52, 51, 57))
    bd.text((px + 14, py + ph2 / 2), url, font=font(12), fill=(158, 154, 165), anchor="lm")
    win.paste(bar, (0, 0))
    win.paste(page, (0, chrome))
    win = win.convert("RGBA")
    win.putalpha(rounded_mask(win.size, radius))
    return win


def place(canvas, win, xy, radius=16, blur=26, alpha=120, offset=(0, 18)):
    sh = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    sh.paste((0, 0, 0, 255), (xy[0] + offset[0], xy[1] + offset[1]),
             rounded_mask(win.size, radius).point(lambda v: alpha if v else 0))
    canvas.alpha_composite(sh.filter(ImageFilter.GaussianBlur(blur)))
    canvas.alpha_composite(win, xy)


def fit(page, box_w, box_h):
    scale = min(box_w / page.width, box_h / page.height)
    return page.resize((round(page.width * scale), round(page.height * scale)), Image.LANCZOS)


def write(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(path)


def build_readme_shots(shots):
    """Framed product shots on a soft gradient, for the README."""
    for key in ("before", "after"):
        win = make_window(shots[key], 1200)
        pad = 56
        canvas = gradient(win.width + pad * 2, win.height + pad * 2,
                          (243, 242, 247), (226, 224, 235), glow=(0.3, -0.2, 1.25, 0.9, 90, (221, 214, 245)))
        place(canvas, win, (pad, pad), alpha=70, blur=30)
        write(canvas, ROOT / f"screenshots/{key}.png")


def build_store_shots(shots):
    """Store screenshots, exactly 1280x800, no letterboxing."""
    specs = [
        ("1-grid-view", "after", (37, 36, 43), (18, 18, 22)),
        ("2-classic-view", "before", (37, 36, 43), (18, 18, 22)),
        ("3-dark-mode", "after_dark", (24, 24, 28), (10, 10, 12)),
    ]
    for store in ("chrome-web-store", "firefox-addons"):
        out = ROOT / "assets" / store / "screenshots"
        for name, key, top, bottom in specs:
            canvas = gradient(1280, 800, top, bottom, glow=(0.45, -0.4, 1.15, 0.8, 60, (86, 64, 160)))
            win = make_window(fit(shots[key], 1160, 640), 1160)
            place(canvas, win, ((1280 - win.width) // 2, (800 - win.height) // 2), alpha=150, blur=34)
            write(canvas, out / f"{name}-1280x800.png")


def build_promo(shots):
    out = ROOT / "assets/chrome-web-store/promo"
    out.mkdir(parents=True, exist_ok=True)
    after = shots["after"]

    # small tile 440x280 -------------------------------------------------------
    w, h = 440, 280
    img = gradient(w, h, glow=(0.4, -0.5, 1.2, 0.8, 80, (86, 64, 160)))
    img.alpha_composite(draw_icon(84), ((w - 84) // 2, 38))
    d = ImageDraw.Draw(img)
    d.text((w / 2, 158), "Clean Console", font=font(34, True), fill=(255, 255, 255), anchor="ma")
    d.text((w / 2, 200), "for the Tailscale admin panel", font=font(18), fill=(198, 194, 208), anchor="ma")
    d.text((w / 2, 230), "grid view  ·  no banners  ·  hide anything", font=font(14),
           fill=(150, 146, 162), anchor="ma")
    write(img, out / "small-tile-440x280.png")

    # large tile 920x680 -------------------------------------------------------
    w, h = 920, 680
    img = gradient(w, h, glow=(0.5, -0.5, 1.2, 0.7, 70, (86, 64, 160)))
    img.alpha_composite(draw_icon(104), (60, 58))
    d = ImageDraw.Draw(img)
    d.text((188, 74), "Clean Console", font=font(50, True), fill=(255, 255, 255))
    d.text((188, 132), "A calmer Tailscale admin panel.", font=font(24), fill=(198, 194, 208))
    win = make_window(after, 800)
    place(img, win, (60, 196), alpha=150, blur=30)
    write(img, out / "large-tile-920x680.png")

    # marquee 1400x560 ---------------------------------------------------------
    w, h = 1400, 560
    img = gradient(w, h, glow=(0.35, -0.5, 1.0, 0.9, 70, (86, 64, 160)))
    img.alpha_composite(draw_icon(120), (80, 74))
    d = ImageDraw.Draw(img)
    d.text((226, 100), "Clean Console", font=font(52, True), fill=(255, 255, 255))
    for i, line in enumerate(("A calmer Tailscale admin panel.",
                              "Card grid, online/offline split,",
                              "no trial banner, hide anything.")):
        d.text((226, 172 + i * 40), line, font=font(26), fill=(198, 194, 208))
    win = make_window(after, 720)
    place(img, win, (620, (h - win.height) // 2), alpha=160, blur=32)
    write(img, out / "marquee-1400x560.png")


if __name__ == "__main__":
    shots = capture_all()
    for name, img in shots.items():
        write(img, ROOT / f".captures/{name}.png")
    build_icons()
    build_readme_shots(shots)
    build_store_shots(shots)
    build_promo(shots)
    print("built icons, README shots, store screenshots and promo tiles")
