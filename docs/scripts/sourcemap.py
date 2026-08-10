#!/usr/bin/env python3
"""Where a symbol lives, how far it reaches, and what the working tree did to it.

The board's hardest claim is "this slice changed this piece". Answering it
means locating a declaration in a file, deciding how far down it owns, and
mapping diff hunks onto that span — a file-level answer would report every
symbol that merely shares a file with the edit, which on the one page whose
job is saying what changed is most of the rows wrong.

Kept apart from the renderer because it is the part with a right answer.
Tested in `board_test.py`.
"""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def symbol_line(rel_path: str, name: str) -> int | None:
    """Where the symbol is declared, so the link lands on it and not line 1."""
    path = ROOT / rel_path
    if path.is_dir():
        path = path / "index.ts"
    if not path.is_file():
        return None
    first = name.split("/")[0].strip().strip("`")
    if not re.match(r"^[A-Za-z_][\w]*$", first):
        return None
    body = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    patterns = [
        rf"^export\s+(async\s+)?function\s+{re.escape(first)}\b",
        rf"^export\s+(const|class|type|interface)\s+{re.escape(first)}\b",
        rf"\b(function|const|class)\s+{re.escape(first)}\b",
    ]
    for pattern in patterns:
        for i, ln in enumerate(body, 1):
            if re.search(pattern, ln):
                return i
    return None


DECL_RE = re.compile(
    r"^(export\s+)?(default\s+)?(async\s+)?"
    r"(function|const|let|var|class|type|interface|enum)\b"
)

def symbol_extent(rel_path: str, start: int) -> int:
    """Last line a symbol declared at `start` can be said to own.

    Everything up to the next top-level declaration — any declaration, not
    just the ones the map lists. Used to decide whether a diff hunk landed on
    this piece or merely on its neighbour in the same file.
    """
    path = ROOT / rel_path
    if path.is_dir():
        path = path / "index.ts"
    if not path.is_file():
        return start
    body = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    for i in range(start, len(body)):  # start is 1-based, so this is start+1 on
        if DECL_RE.match(body[i]):
            return i  # the line before the next declaration, 1-based
    return len(body)


def symbol_change_ranges(
    entry: dict, hunks_by_path: dict[str, list[tuple[int, int]]]
) -> list[tuple[int, int]]:
    """Diff hunks that fall inside this symbol's declaration extent."""
    where = entry["where"]
    file_hunks = hunks_by_path.get(where) or []
    if not file_hunks:
        return []
    mine = symbol_line(where, entry["name"])
    if not mine:
        return list(file_hunks)
    end_of = symbol_extent(where, mine)
    return [(s, e) for s, e in file_hunks if s <= end_of and e >= mine]


def git_state() -> dict | None:
    """Working-tree truth: what is uncommitted right now. None when not a repo."""
    def raw(*args: str) -> str:
        """Never strip: porcelain's status codes are column-positioned."""
        try:
            out = subprocess.run(
                ["git", *args], cwd=ROOT, capture_output=True, text=True, timeout=10
            )
        except (OSError, subprocess.SubprocessError):
            return ""
        return out.stdout if out.returncode == 0 else ""

    def run(*args: str) -> str:
        return raw(*args).strip()

    if run("rev-parse", "--is-inside-work-tree") != "true":
        return None

    changes = []
    for line in raw("status", "--porcelain").splitlines():
        m = re.match(r"^(..) (.+)$", line)
        if not m:
            continue
        code, path = m.group(1).strip() or "?", m.group(2).strip()
        state = (
            "new" if code in ("??", "A") else "gone" if code == "D" else "changed"
        )
        changes.append({"code": code, "path": path, "state": state})

    churn = {}
    for line in raw("diff", "--numstat").splitlines():
        parts = line.split("\t")
        if len(parts) == 3 and parts[0].isdigit() and parts[1].isdigit():
            churn[parts[2]] = (int(parts[0]), int(parts[1]))

    # Which *lines* changed, not just which files. Without this the board can
    # only say "something in this file moved", so every symbol sharing a file
    # with the real edit gets reported as touched — nine wrong rows for six
    # right ones, on a page whose whole job is saying what this slice changed.
    hunks: dict[str, list[tuple[int, int]]] = {}
    current: str | None = None
    for line in raw("diff", "-U0", "HEAD").splitlines():
        if line.startswith("+++ b/"):
            current = line[6:].strip()
            hunks.setdefault(current, [])
        elif line.startswith("@@") and current:
            m = re.match(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))?", line)
            if not m:
                continue
            start = int(m.group(1))
            count = int(m.group(2)) if m.group(2) is not None else 1
            # A pure deletion reports zero new lines; it still happened *at*
            # that point, so give it the line it collapsed to.
            hunks[current].append((start, start + max(count, 1) - 1))

    # Untracked files never appear in `diff HEAD`, so treat the whole file as
    # the change — otherwise the board can say *what* changed but not *where*.
    for c in changes:
        if c["state"] != "new" or c["path"] in hunks:
            continue
        path = ROOT / c["path"]
        if not path.is_file():
            continue
        n = len(path.read_text(encoding="utf-8", errors="ignore").splitlines()) or 1
        hunks[c["path"]] = [(1, n)]

    return {
        "churn": churn,
        "hunks": hunks,
        "branch": run("rev-parse", "--abbrev-ref", "HEAD"),
        "last_commit": run("log", "-1", "--pretty=%h %s"),
        "changes": sorted(changes, key=lambda c: (c["state"] != "new", c["path"])),
        "stat": run("diff", "--shortstat"),
    }

