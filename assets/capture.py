"""Capture the mock console with a real Chromium and return PIL images.

Used by build.py. Devices/IPs/names come from test/mock.html and are invented.

    from capture import capture_all
    shots = capture_all()          # {"before", "after", "after_dark"}
"""
from __future__ import annotations

import io
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
VIEWPORT = {"width": 1440, "height": 780}
SCALE = 2  # crisp, retina-quality captures


class Handler(SimpleHTTPRequestHandler):
    """/admin/machines/ serves the mock (the route the extension activates on);
    ?bare drops the extension so the page renders unmodified. Everything else
    is a normal static file."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path, _, query = self.path.partition("?")
        if path == "/admin/machines" or path.startswith("/admin/machines/"):
            body = (ROOT / "test/mock.html").read_bytes()
            if "bare" in query:  # drop the extension so the page renders unmodified
                for tag in (b'<link rel="stylesheet" href="/firefox/styles.css">',
                            b'<script src="/firefox/content.js"></script>'):
                    body = body.replace(tag, b"")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()

    def log_message(self, *args):  # keep the build output quiet
        pass


def _serve():
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f"http://127.0.0.1:{httpd.server_address[1]}"


def _shot(page):
    return Image.open(io.BytesIO(page.screenshot(full_page=True))).convert("RGB")


def capture_all():
    httpd, base = _serve()
    shots = {}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            for key, path, dark in (
                ("before", "/admin/machines/?bare", False),
                ("after", "/admin/machines/", False),
                ("after_dark", "/admin/machines/", True),
            ):
                page = browser.new_page(
                    viewport=VIEWPORT, device_scale_factor=SCALE,
                    color_scheme="dark" if dark else "light",
                )
                page.goto(base + path, wait_until="networkidle")
                page.wait_for_timeout(500)
                shots[key] = _shot(page)
                page.close()
            browser.close()
    finally:
        httpd.shutdown()
    return shots
