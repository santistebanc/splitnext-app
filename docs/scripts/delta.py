#!/usr/bin/env python3
"""What a slice changed, in the map's own vocabulary.

A diff says which lines moved. This says which *pieces* moved — the `L-` rows
of `LOGIC.md` a hunk actually landed on, the `F-` flows that run through them,
and, from `NEXT.md`, what each change was supposed to be for. That is the
reading a reviewer needs and the one a file list cannot give.

Two callers, one attribution:

    npm run delta                  the working tree, while you build
    npm run delta -- --range main  what the branch did, which CI posts on the PR

Attribution rule: a hunk belongs to the symbol whose declaration it falls
under, bounded by the next declaration in the *source* — not the next one the
map lists, or an unmapped export's edits get charged to the mapped piece above
it. Hunks above the first declaration (imports, types) belong to nobody. That
logic lives in `sourcemap.py` and is tested there.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import sourcemap  # noqa: E402
from state_files import parse_flows, parse_logic, parse_next  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
STATE = ROOT / "docs" / "state"


def strip_md(text: str) -> str:
    return re.sub(r"[`*]", "", text).strip()


def touched_symbols(state: dict, rows: list[dict]) -> list[tuple[dict, str]]:
    """Map rows the change actually landed on, with how the file changed."""
    changed = {c["path"]: c["state"] for c in state["changes"]}

    def path_state(where: str) -> str | None:
        """How this row's file changed — it may be named either way round.

        A row can point at a file inside a changed directory, or *be* a
        directory (a route folder, a function) that a changed file sits under.
        """
        if where in changed:
            return changed[where]
        for path, st in changed.items():
            if where.startswith(path.rstrip("/") + "/"):
                return st
            if path.startswith(where.rstrip("/") + "/"):
                return st
        return None

    def hunk_touches(entry: dict) -> bool:
        file_hunks = state["hunks"].get(entry["where"])
        if not file_hunks:
            # No line data — a new file, or a directory entry standing for
            # everything in it. Fall back to the file-level answer rather
            # than dropping the row.
            return True
        mine = sourcemap.symbol_line(entry["where"], entry["name"])
        if not mine:
            return True
        end_of = sourcemap.symbol_extent(entry["where"], mine)
        return any(s <= end_of and e >= mine for s, e in file_hunks)

    return [
        (e, path_state(e["where"]))
        for e in rows
        if path_state(e["where"]) and hunk_touches(e)
    ]


def why(entry: dict, nxt: dict) -> str:
    """What `NEXT.md` says this piece is becoming — authored, never counted.

    An `L-` id is an exact join; prose matches only by luck, which is the
    reason the templates ask for ids in the plan and the Before → After rows.
    """
    names = [n.strip() for n in entry["name"].split("/")] + [
        entry["where"].rsplit("/", 1)[-1],
        entry["where"],
    ]

    def mentions(text: str) -> bool:
        if entry["id"] in re.findall(r"\bL-[\w]+", text):
            return True
        low = text.lower()
        return any(n and n.lower() in low for n in names)

    for row in nxt["now_after"]:
        if mentions(row["aspect"]) or mentions(row["after"]):
            return f"{strip_md(row['before'])} → **{strip_md(row['after'])}**"
    for step in nxt["plan"]:
        if mentions(step):
            return strip_md(step)
    for seam in nxt["seams"]:
        if mentions(seam["seam"]):
            return f"under test — {strip_md(seam['behavior'])}"
    for edge in nxt["edge_paths"]:
        if mentions(edge["surface"]) or mentions(edge["what"]):
            return strip_md(edge["what"])
    return ""


def touched_flows(flows: list[dict], ids: set[str]) -> list[tuple[dict, list[int]]]:
    """Flows running through the changed pieces, and which steps do it."""
    out = []
    for flow in flows:
        steps = [
            n
            for n, step in enumerate(flow["steps"], 1)
            if ids & set(re.findall(r"\bL-[\w]+", step))
        ]
        if steps:
            out.append((flow, steps))
    return out


def report(state: dict, title: str) -> str:
    areas = parse_logic((STATE / "LOGIC.md").read_text())
    rows = [dict(e, area=area) for area, rws in areas for e in rws]
    flows = parse_flows((STATE / "FLOWS.md").read_text())
    nxt = parse_next((STATE / "NEXT.md").read_text())

    touched = touched_symbols(state, rows)
    ids = {e["id"] for e, _ in touched}
    planned = bool(nxt["number"])
    lines = [f"## {title}", ""]
    if not planned:
        lines += [
            "_`NEXT.md` names no slice, so nothing here is matched against a "
            "plan — this is what moved, not what it was for._",
            "",
        ]

    if state.get("stat"):
        provenance = state["stat"]
        if state.get("base"):
            provenance += f" · since `{state['base']}`"
        lines += [f"_{provenance}_", ""]

    word = {"new": "New", "changed": "Changed", "gone": "Removed"}
    lines.append(f"### Symbols touched ({len(touched)})")
    lines.append("")
    if not touched:
        lines.append("_No mapped piece was touched — only files the map does not name._")
    for entry, st in sorted(touched, key=lambda t: t[0]["where"]):
        loc = sourcemap.symbol_change_ranges(entry, state["hunks"])
        where = entry["where"]
        if loc:
            where += ":" + ", ".join(
                str(s) if s == e else f"{s}–{e}" for s, e in loc[:3]
            )
        reason = why(entry, nxt) if planned else ""
        if not reason:
            # The hunk landed on this piece, so the change is real; what is
            # missing is the reason. With a slice open that is a gap in
            # NEXT.md; with no slice open there was never anything to match,
            # and saying so on every row would be noise.
            churn = state["churn"].get(entry["where"])
            hint = f"+{churn[0]} −{churn[1]} in its file" if churn else "edited"
            reason = (
                f"nothing in `NEXT.md` says why ({hint})"
                if planned
                else f"{hint}"
            )
        lines.append(
            f"- **{word[st]}** · `{entry['name']}` — {entry['area']} · `{where}`  \n"
            f"  {reason}"
        )
    lines.append("")

    flow_hits = touched_flows(flows, ids)
    lines.append(f"### Flows running through them ({len(flow_hits)})")
    lines.append("")
    if not flow_hits:
        lines.append("_No flow names a changed piece._")
    for flow, steps in flow_hits:
        step_list = ", ".join(str(n) for n in steps)
        plural = "steps" if len(flow["steps"]) > 1 else "step"
        lines.append(
            f"- **{flow['title']}** — {len(steps)} of {len(flow['steps'])} "
            f"{plural} touched ({step_list})"
        )
    lines.append("")

    unmapped = sorted(
        c["path"]
        for c in state["changes"]
        if c["path"].startswith(("src/", "app/", "supabase/"))
        and not any(e["where"] == c["path"] for e in rows)
        and not any(c["path"].startswith(e["where"].rstrip("/") + "/") for e in rows)
    )
    if unmapped:
        lines.append("### Changed, but not on the map")
        lines.append("")
        lines += [f"- `{path}`" for path in unmapped]
        lines.append("")
        lines.append(
            "_Either they are below the map's grain, or `LOGIC.md` owes them a row._"
        )
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--range",
        metavar="BASE",
        help="compare BASE...HEAD instead of the working tree (CI uses main)",
    )
    ap.add_argument("--title", default="", help="heading for the report")
    args = ap.parse_args()

    if args.range:
        state = sourcemap.range_state(args.range)
        default_title = f"What this branch changed, on the map"
    else:
        state = sourcemap.git_state()
        default_title = "What the working tree changed, on the map"

    if not state:
        print("no git state here — not a repo, or no such base", file=sys.stderr)
        return 1

    print(report(state, args.title or default_title), end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
