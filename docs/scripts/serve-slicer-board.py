#!/usr/bin/env python3
"""Generate the board, serve docs/, and open files in the *running* editor window.

`docs/slicer.html` is not committed — it is a render of `docs/state/`, and a
tracked copy of it only ever produced rebase conflicts and stale boards. So it
is built here at startup, and rebuilt by CI for the published site.

`cursor://` URLs go through the OS handler, which starts a fresh Cursor and —
inside WSL — often lands you in a second instance. The CLI does not: `cursor -r
-g <file>:<line>` reuses the window that is already attached to this WSL folder.
A static page cannot run a command, so this server does it: the board fetches
`/open?...` and the page never navigates, which also makes path chips work
inside Cursor's built-in browser, where custom schemes are blocked outright.

Change chips (`mode=diff`) open a side-by-side diff of HEAD vs the working
tree via `cursor -r -d`. The CLI cannot select a line *range* inside one file,
but `--diff` is the highlighted view of what actually moved. Ordinary path
chips still use `-g <file>:<line>`.

    python3 docs/scripts/serve-slicer-board.py [port]   # default 8777
"""

from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs"
EDITOR = shutil.which("cursor") or shutil.which("code")
# HEAD snapshots for --diff; overwritten per path, never deleted while open.
DIFF_CACHE = Path("/tmp/slicer-board-diff")


def git_show_head(rel: str) -> bytes | None:
    """Blob at HEAD, or None when the path is new / missing from the tree."""
    try:
        out = subprocess.run(
            ["git", "show", f"HEAD:{rel}"],
            cwd=ROOT,
            capture_output=True,
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    return out.stdout if out.returncode == 0 else None


def open_diff(rel: str, target: Path) -> None:
    """Side-by-side: left = HEAD (or empty), right = working tree."""
    DIFF_CACHE.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha1(rel.encode()).hexdigest()[:12]
    before = DIFF_CACHE / f"{key}-{Path(rel).name}"
    blob = git_show_head(rel)
    before.write_bytes(blob if blob is not None else b"")
    # Right side must be the real file so edits in the diff land on disk.
    subprocess.run(
        [EDITOR, "-r", "-d", str(before), str(target)],
        timeout=10,
        check=False,
    )


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DOCS), **kwargs)

    def do_GET(self):  # noqa: N802 - stdlib naming
        url = urlparse(self.path)
        if url.path != "/open":
            return super().do_GET()

        query = parse_qs(url.query)
        rel = (query.get("path") or [""])[0]
        line_s = (query.get("line") or [""])[0]
        mode = (query.get("mode") or [""])[0]
        target = (ROOT / rel).resolve()

        # only ever open something inside this repo
        if not rel or ROOT not in target.parents and target != ROOT:
            return self.reply(400, "outside the repo")
        if not target.exists():
            return self.reply(404, "no such file")
        if not EDITOR:
            return self.reply(501, "no cursor/code CLI on PATH")

        try:
            if mode == "diff":
                open_diff(rel, target)
            else:
                line = int(line_s) if line_s.isdigit() else None
                if line:
                    subprocess.run(
                        [EDITOR, "-r", "-g", f"{target}:{line}"],
                        timeout=10,
                        check=False,
                    )
                else:
                    subprocess.run(
                        [EDITOR, "-r", str(target)], timeout=10, check=False
                    )
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


def generate() -> None:
    """Build docs/slicer.html before the first request can ask for it."""
    out = subprocess.run(
        [sys.executable, str(ROOT / "docs/scripts/generate-slicer-board.py")],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if out.returncode:
        print(out.stdout + out.stderr, flush=True)
        print("board generation failed — serving whatever is on disk", flush=True)


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
    generate()
    # 0.0.0.0 so a Windows-side browser can reach the WSL port.
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"Slicer board → http://127.0.0.1:{port}/slicer.html", flush=True)
    print(f"Opening files with: {EDITOR or 'nothing found — install the CLI'}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()


if __name__ == "__main__":
    main()
