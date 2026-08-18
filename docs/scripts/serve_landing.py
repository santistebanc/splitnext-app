"""Serve the public landing locally, with /try framing the Expo web target.

Production Pages iframes `../app/`. Locally the Expo export is not on disk —
Metro serves the app at http://127.0.0.1:8081 — so this process injects that
origin into `/try` at serve time. The committed HTML is unchanged (D-094).

    npm run landing                 # 127.0.0.1:8788, starts Expo web if needed
    npm run landing -- --no-expo    # landing only; Metro already running
    npm run landing -- 8999 --lan   # another port, reachable from the LAN
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
LANDING = ROOT / "landing"
DEFAULT_PORT = 8788
DEFAULT_APP = "http://127.0.0.1:8081/"


def inject_app_origin(html: str, origin: str | None) -> str:
    if not origin:
        return html
    url = origin.rstrip("/") + "/"
    tag = f"<script>window.SPLITNEXT_APP={json.dumps(url)};</script>"
    marker = "<head>"
    if marker not in html:
        return tag + html
    return html.replace(marker, marker + "\n    " + tag, 1)


def app_ready(origin: str, timeout_s: float = 1.5) -> bool:
    try:
        urllib.request.urlopen(origin, timeout=timeout_s)
        return True
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def start_expo() -> subprocess.Popen:
    env = os.environ.copy()
    env["BROWSER"] = "none"
    return subprocess.Popen(
        ["npm", "run", "web"],
        cwd=ROOT,
        env=env,
        stdout=sys.stdout,
        stderr=sys.stderr,
    )


def handler_for(app_origin: str):
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(LANDING), **kwargs)

        def do_GET(self):  # noqa: N802 - stdlib naming
            path = urlparse(self.path).path
            if path in ("/try", "/try/", "/try/index.html"):
                html = (LANDING / "try" / "index.html").read_text(encoding="utf-8")
                body = inject_app_origin(html, app_origin).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(body)
                return
            return super().do_GET()

        def log_message(self, *args) -> None:
            pass

    return Handler


def main() -> None:
    argv = sys.argv[1:]
    lan = "--lan" in argv
    no_expo = "--no-expo" in argv
    args = [a for a in argv if not a.startswith("--")]
    port = int(args[0]) if args else DEFAULT_PORT
    app_origin = DEFAULT_APP

    expo: subprocess.Popen | None = None
    if not no_expo:
        if app_ready(app_origin):
            print(f"Expo already serving {app_origin}", flush=True)
        else:
            print("Starting Expo web (BROWSER=none)…", flush=True)
            expo = start_expo()

    host = "0.0.0.0" if lan else "127.0.0.1"  # noqa: S104 - opt-in
    server = ThreadingHTTPServer((host, port), handler_for(app_origin))
    print(f"Landing     → http://127.0.0.1:{port}/", flush=True)
    print(f"Use on web  → http://127.0.0.1:{port}/try/", flush=True)
    print(f"Frame loads → {app_origin}", flush=True)
    if lan:
        print("Bound to 0.0.0.0 — anything on this network can reach it.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
        if expo and expo.poll() is None:
            expo.terminate()


if __name__ == "__main__":
    main()
