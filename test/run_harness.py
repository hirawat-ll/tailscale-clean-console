#!/usr/bin/env python3
"""Run test/harness.html headlessly for both extension flavors.

    python3 test/run_harness.py

Starts test/serve.mjs, drives Chromium with Playwright, and exits non-zero if
either the chrome/ or firefox/ build reports a failure. Requires:

    pip install playwright && playwright install chromium

Used by CI (.github/workflows/ci.yml); the same harness opens in a browser for
manual runs with `node test/serve.mjs`.
"""
from __future__ import annotations

import os
import socket
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = int(os.environ.get("PORT", "8788"))
FLAVORS = ("firefox", "chrome")


def wait_for_port(port: int, timeout: float = 15.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        with socket.socket() as sock:
            sock.settimeout(0.2)
            if sock.connect_ex(("127.0.0.1", port)) == 0:
                return
        time.sleep(0.1)
    raise SystemExit(f"test server did not start on :{port}")


def main() -> int:
    env = {**os.environ, "PORT": str(PORT)}
    server = subprocess.Popen(
        ["node", "test/serve.mjs"],
        cwd=ROOT,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.STDOUT,
    )

    failures: list[str] = []
    try:
        wait_for_port(PORT)
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            for flavor in FLAVORS:
                page = browser.new_page(viewport={"width": 1400, "height": 1700})
                url = f"http://127.0.0.1:{PORT}/test/harness.html?ext={flavor}"
                page.goto(url, wait_until="load")
                page.wait_for_function(
                    "document.title === 'PASS' || document.title === 'FAIL'",
                    timeout=60_000,
                )
                passed = page.title() == "PASS"
                print(f"\n=== {flavor}: {page.title()} ===")
                print(page.inner_text("#results"))
                if not passed:
                    failures.append(flavor)
                page.close()
            browser.close()
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()

    if failures:
        print(f"\nFAILED flavors: {', '.join(failures)}")
        return 1
    print("\nAll flavors passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
