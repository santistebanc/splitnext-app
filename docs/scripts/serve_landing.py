"""Serve the public landing locally, with /try framing the Expo web target.

Production Pages iframes `../app/`. Locally this process proxies `/app` to
Metro at http://127.0.0.1:8081 so the frame is same-origin — a Windows or
Cursor browser that can reach :8788 does not also need :8081 (D-094).

    npm run landing                 # 127.0.0.1:8788, starts Expo web if needed
    npm run landing -- --no-expo    # landing only; Metro already running
    npm run landing -- 8999 --lan   # another port, reachable from the LAN
"""

from __future__ import annotations

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

_LANDING_PATHS = {
    "/",
    "/index.html",
    "/styles.css",
    "/favicon.png",
    "/preview.png",
    "/try",
    "/try/",
    "/try/index.html",
}


def metro_path_for(url_path: str) -> str | None:
    """Metro path to fetch, or None to serve a landing file."""
    path = url_path.split("?", 1)[0]
    if path in _LANDING_PATHS:
        return None
    if path == "/app" or path.startswith("/app/"):
        rest = path[4:] or "/"
        return rest if rest.startswith("/") else "/" + rest
    return path


def rewrite_root_urls(html: str, prefix: str = "/app") -> str:
    """Keep Metro's absolute `/…` asset URLs inside the `/app` iframe."""
    prefix = prefix.rstrip("/")
    html = html.replace('src="/', f'src="{prefix}/')
    html = html.replace("src='/", f"src='{prefix}/")
    html = html.replace('href="/', f'href="{prefix}/')
    html = html.replace("href='/", f"href='{prefix}/")
    return html


# Expo Router keys off pathname. The iframe URL is /app so the request can
# proxy; this runs before the deferred bundle and makes the lobby `/`.
_STRIP_APP_PREFIX = (
    "<script>(function(){var p=location.pathname;"
    "if(p==='/app'||p.indexOf('/app/')===0){"
    "var r=p==='/app'||p==='/app/'?'/':p.slice(4);"
    "history.replaceState(null,'',r+location.search+location.hash);}"
    "})();</script>"
)


def prepare_metro_html(html: str) -> str:
    html = rewrite_root_urls(html)
    if "<head>" in html:
        return html.replace("<head>", "<head>" + _STRIP_APP_PREFIX, 1)
    return _STRIP_APP_PREFIX + html


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


def handler_for(metro_origin: str):
    origin = metro_origin.rstrip("/") + "/"

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(LANDING), **kwargs)

        def do_GET(self):  # noqa: N802 - stdlib naming
            self._handle("GET")

        def do_HEAD(self):  # noqa: N802 - stdlib naming
            self._handle("HEAD")

        def _handle(self, command: str) -> None:
            parsed = urlparse(self.path)
            if parsed.path in ("/try", "/try/", "/try/index.html"):
                html = (LANDING / "try" / "index.html").read_text(encoding="utf-8")
                body = html.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                if command != "HEAD":
                    self.wfile.write(body)
                return
            metro_path = metro_path_for(parsed.path)
            if metro_path is None:
                if command == "HEAD":
                    return super().do_HEAD()
                return super().do_GET()
            self._proxy(command, metro_path, parsed.query)

        def _proxy(self, command: str, metro_path: str, query: str) -> None:
            url = origin.rstrip("/") + metro_path
            if query:
                url += "?" + query
            try:
                req = urllib.request.Request(url, method="GET", headers={"Accept": self.headers.get("Accept", "*/*")})
                with urllib.request.urlopen(req, timeout=60) as res:
                    body = res.read()
                    ctype = res.headers.get("Content-Type") or "application/octet-stream"
                    if "text/html" in ctype:
                        body = prepare_metro_html(body.decode("utf-8", errors="replace")).encode("utf-8")
                    self.send_response(res.status)
                    self.send_header("Content-Type", ctype)
                    self.send_header("Content-Length", str(len(body)))
                    self.send_header("Cache-Control", "no-store")
                    self.end_headers()
                    if command != "HEAD":
                        self.wfile.write(body)
            except (urllib.error.URLError, TimeoutError, OSError):
                msg = b"Metro is not reachable on 8081. Is Expo web running?"
                self.send_response(502)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.send_header("Content-Length", str(len(msg)))
                self.end_headers()
                if command != "HEAD":
                    self.wfile.write(msg)

        def log_message(self, *args) -> None:
            pass

    return Handler


def main() -> None:
    argv = sys.argv[1:]
    lan = "--lan" in argv
    no_expo = "--no-expo" in argv
    args = [a for a in argv if not a.startswith("--")]
    port = int(args[0]) if args else DEFAULT_PORT
    metro_origin = DEFAULT_APP

    expo: subprocess.Popen | None = None
    if not no_expo:
        if app_ready(metro_origin):
            print(f"Expo already serving {metro_origin}", flush=True)
        else:
            print("Starting Expo web (BROWSER=none)…", flush=True)
            expo = start_expo()

    host = "0.0.0.0" if lan else "127.0.0.1"  # noqa: S104 - opt-in
    server = ThreadingHTTPServer((host, port), handler_for(metro_origin))
    print(f"Landing     → http://127.0.0.1:{port}/", flush=True)
    print(f"Use on web  → http://127.0.0.1:{port}/try/", flush=True)
    print(f"Frame loads → http://127.0.0.1:{port}/app/  (proxied {metro_origin})", flush=True)
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
