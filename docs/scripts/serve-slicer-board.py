#!/usr/bin/env python3
"""Serve docs/ and open files in the *running* editor window.

`cursor://` URLs go through the OS handler, which starts a fresh Cursor and —
inside WSL — often lands you in a second instance. The CLI does not: `cursor -r
-g <file>:<line>` reuses the window that is already attached to this WSL folder.
A static page cannot run a command, so this server does it: the board fetches
`/open?...` and the page never navigates, which also makes path chips work
inside Cursor's built-in browser, where custom schemes are blocked outright.

    python3 docs/scripts/serve-slicer-board.py [port]   # default 8777
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs"
EDITOR = shutil.which("cursor") or shutil.which("code")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DOCS), **kwargs)

    def do_GET(self):  # noqa: N802 - stdlib naming
        url = urlparse(self.path)
        if url.path != "/open":
            return super().do_GET()

        query = parse_qs(url.query)
        rel = (query.get("path") or [""])[0]
        line = (query.get("line") or [""])[0]
        target = (ROOT / rel).resolve()

        # only ever open something inside this repo
        if not rel or ROOT not in target.parents and target != ROOT:
            return self.reply(400, "outside the repo")
        if not target.exists():
            return self.reply(404, "no such file")
        if not EDITOR:
            return self.reply(501, "no cursor/code CLI on PATH")

        spec = f"{target}:{line}" if line.isdigit() else str(target)
        try:
            subprocess.run([EDITOR, "-r", "-g", spec], timeout=10, check=False)
        except (OSError, subprocess.SubprocessError) as err:
            return self.reply(500, str(err))
        return self.reply(204, "")

    def reply(self, code: int, body: str) -> None:
        payload = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        if payload:
            self.wfile.write(payload)

    def log_message(self, *args):  # quiet: the board reloads a lot
        pass


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Slicer board → http://127.0.0.1:{port}/slicer.html")
    print(f"Opening files with: {EDITOR or 'nothing found — install the CLI'}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()


if __name__ == "__main__":
    main()
