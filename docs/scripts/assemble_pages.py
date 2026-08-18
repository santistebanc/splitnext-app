"""Assemble the public GitHub Pages site: landing at `/`, Expo export at `/app`.

The slicer board is a local-only dev tool (`npm run board:serve`). It must
never ship as the production homepage.
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LANDING = ROOT / "landing"


def assemble(out: Path, app: Path | None = None) -> None:
    if out.exists():
        shutil.rmtree(out)
    shutil.copytree(LANDING, out)
    (out / ".nojekyll").write_text("", encoding="utf-8")
    if app is not None:
        dest = out / "app"
        shutil.copytree(app, dest)
        index = dest / "index.html"
        if index.exists():
            shutil.copyfile(index, dest / "404.html")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=str(ROOT / "_site"))
    parser.add_argument("--app", default=None, help="Expo web export directory")
    args = parser.parse_args()
    app = Path(args.app) if args.app else None
    assemble(Path(args.out), app)


if __name__ == "__main__":
    main()
