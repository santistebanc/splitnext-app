#!/usr/bin/env python3
"""Reading `docs/state/*.md` — every parser the board is rendered from.

These are pure: Markdown in, dicts out. No filesystem, no git, no HTML. That
is the point of the split — the shapes the state files have to hold are the
part of the board most likely to be wrong and the cheapest part to test, and
they should not be reachable only through a 2000-line renderer.

Tested in `board_test.py`. The renderer is `generate-slicer-board.py`; the
call graph behind the Symbols tree is `callgraph.py`.
"""
from __future__ import annotations

import re


def parse_logic(text: str) -> list[tuple[str, list[dict]]]:
    """Areas of the map, header-driven so column order can change safely."""
    areas: list[tuple[str, list[dict]]] = []
    current: str | None = None
    rows: list[dict] = []
    cols: dict[str, int] = {}
    for line in text.splitlines():
        if line.startswith("## ") and not line.startswith("## Logic"):
            if current is not None:
                areas.append((current, rows))
            current = line[3:].strip()
            rows = []
            cols = {}
            continue
        if current is None or not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if cells and cells[0].lower() == "id":
            cols = {c.lower(): i for i, c in enumerate(cells)}
            continue
        if not re.match(r"^`?L-[\w]+`?$", cells[0] if cells else ""):
            continue

        def cell(name: str, fallback: int) -> str:
            i = cols.get(name, fallback)
            return cells[i].strip().replace("`", "").strip() if i < len(cells) else ""

        rows.append(
            {
                "id": cell("id", 0),
                "name": cell("name", 1),
                "kind": cell("kind", 2) or "Job",
                "where": cell("where", 3),
                "what": cells[cols.get("what it is for", 4)].strip()
                if cols.get("what it is for", 4) < len(cells)
                else "",
            }
        )
    if current is not None:
        areas.append((current, rows))
    return areas


def parse_flows(text: str) -> list[dict]:
    flows: list[dict] = []
    blocks = re.split(r"\n(?=## F-)", text)
    for block in blocks:
        if not block.strip().startswith("## F-"):
            continue
        lines = block.strip().splitlines()
        head = lines[0][3:].strip()
        m = re.match(r"(F-[\w-]+)\s*—\s*(.+)", head)
        if not m:
            continue
        fid, title = m.group(1), m.group(2)
        trigger = outcome = ""
        steps: list[str] = []
        for line in lines[1:]:
            if line.startswith("**Trigger**"):
                trigger = re.sub(r"^\*\*Trigger\*\*\s*—\s*", "", line).strip()
            elif line.startswith("**Outcome**"):
                outcome = re.sub(r"^\*\*Outcome\*\*\s*—\s*", "", line).strip()
            elif re.match(r"^\d+\.\s+", line):
                steps.append(re.sub(r"^\d+\.\s+", "", line).strip())
            elif line.startswith("   -") or line.startswith("   -"):
                if steps:
                    steps[-1] += "\n" + line.strip()
            elif line.startswith("   ") and steps and not line.startswith("##"):
                # continuation / nested bullets under a step
                steps[-1] += "\n" + line.strip()
        flows.append(
            {
                "id": fid,
                "title": title,
                "trigger": trigger,
                "outcome": outcome,
                "steps": steps,
            }
        )
    return flows


def parse_overview_direction(text: str) -> dict:
    """Everything the Overview page shows, straight out of OVERVIEW.md."""

    def section(name: str) -> str:
        m = re.search(rf"\n## {re.escape(name)}\n(.*?)(?=\n## |\Z)", text, re.S)
        return m.group(1).strip() if m else ""

    def field(label: str) -> str:
        m = re.search(rf"\*\*{label}\*\*\s*—\s*(.+)", text)
        return m.group(1).strip() if m else ""

    def bullets_after(label: str) -> list[str]:
        m = re.search(rf"\*\*{label}\*\*\s*—\s*\n((?:- .+\n?)+)", text)
        if not m:
            return []
        return [ln[2:].strip() for ln in m.group(1).splitlines() if ln.startswith("- ")]

    def bullets_of(name: str) -> list[str]:
        return [
            ln[2:].strip()
            for ln in section(name).splitlines()
            if ln.startswith("- ")
        ]

    non_goals = [g.strip() for g in field("Non-goals").split(",") if g.strip()]

    model = []
    for ln in section("Data model").splitlines():
        m = re.match(r"\*\*(.+?)\*\*\s*—\s*(.+)", ln)
        if m:
            model.append({"name": m.group(1), "what": m.group(2).strip()})

    routes = []
    for ln in section("Routes / surfaces").splitlines():
        if not ln.startswith("|") or "---" in ln or "Route" in ln:
            continue
        cells = [c.strip() for c in ln.strip("|").split("|")]
        if len(cells) >= 3:
            routes.append(
                {"route": cells[0], "what": cells[1], "since": cells[2]}
            )

    return {
        "destination": field("Destination"),
        "users": field("Users"),
        "constraints": bullets_after("Constraints"),
        "non_goals": non_goals,
        "capabilities": bullets_of("Capabilities"),
        "stack": bullets_of("Stack"),
        "model": model,
        "routes": routes,
    }


def parse_next(text: str) -> dict:
    """The slice being built right now, from NEXT.md."""

    def section(name: str) -> str:
        m = re.search(rf"\n## {re.escape(name)}\n(.*?)(?=\n## |\Z)", text, re.S)
        return m.group(1).strip() if m else ""

    def bullets(name: str) -> list[str]:
        return [
            re.sub(r"^[-\d.]+\s*", "", ln).strip()
            for ln in section(name).splitlines()
            if ln.strip().startswith("-") or re.match(r"^\d+\.", ln.strip())
        ]

    title = ""
    tier = ""
    for line in text.splitlines():
        if line.startswith("# Slice"):
            title = line[2:].strip()
        elif line.startswith("**Tier**"):
            tier = re.sub(r"^\*\*Tier\*\*\s*—\s*", "", line).strip()

    goal = section("Goal").replace("\n", " ").strip()

    now_after = []
    for ln in (section("Before → After") or section("Now → After")).splitlines():
        if not ln.startswith("|") or "---" in ln or ln.strip().startswith("| |"):
            continue
        cells = [c.strip() for c in ln.strip("|").split("|")]
        if len(cells) >= 3 and cells[1].lower() != "now":
            now_after.append({"aspect": cells[0], "before": cells[1], "after": cells[2]})

    seams = []
    for ln in section("Seams under test").splitlines():
        if not ln.startswith("|") or "---" in ln or "Seam" in ln:
            continue
        cells = [c.strip() for c in ln.strip("|").split("|")]
        if len(cells) >= 2:
            seams.append({"seam": cells[0], "behavior": cells[1]})

    # The self-review while it is still a review — kept here during the build,
    # moved into the archive's Report at close.
    edge = []
    for ln in section("Edge paths").splitlines():
        if not ln.startswith("|") or "---" in ln or "Surface" in ln:
            continue
        cells = [c.strip() for c in ln.strip("|").split("|")]
        if len(cells) >= 3 and any(cells[:3]):
            edge.append({"surface": cells[0], "state": cells[1], "what": cells[2]})

    m = re.search(r"(\d{4})", title)
    return {
        "title": title,
        "number": m.group(1) if m else "",
        "tier": tier,
        "goal": goal,
        "now_after": now_after,
        "plan": bullets("Plan"),
        "seams": seams,
        "acceptance": bullets("Acceptance"),
        "edge_paths": edge,
        "out_of_scope": bullets("Out of scope"),
    }


def parse_parking(text: str) -> list[tuple[str, list[str]]]:
    tiers: list[tuple[str, list[str]]] = []
    current = None
    items: list[str] = []
    for line in text.splitlines():
        if line.startswith("## "):
            if current:
                tiers.append((current, items))
            heading = line[3:].strip()
            if heading == "Delivered":
                current = None
                items = []
                break
            current = heading
            items = []
        elif current and line.startswith("- **"):
            m = re.match(r"- \*\*(.+?)\*\*", line)
            if m:
                items.append(m.group(1))
    if current:
        tiers.append((current, items))
    return tiers


def parse_report(text: str) -> dict | None:
    if "## Report" not in text:
        return None
    report = text.split("## Report", 1)[1]
    # stop at next ## that's not ###
    parts = re.split(r"\n## (?!#)", report, maxsplit=1)
    report = parts[0]

    def section(name: str) -> str:
        m = re.search(
            rf"### {re.escape(name)}\n(.*?)(?=\n### |\Z)",
            report,
            re.S,
        )
        return m.group(1).strip() if m else ""

    head = text.splitlines()[0]
    meta = ""
    for line in text.splitlines()[:6]:
        if line.startswith("**Tier**"):
            meta = re.sub(r"\*\*", "", line).strip()
            break

    headline = section("Headline").strip()
    highlights_raw = section("Highlights")
    highlights = [
        re.sub(r"\*\*", "", re.sub(r"^-\s*", "", ln)).strip()
        for ln in highlights_raw.splitlines()
        if ln.strip().startswith("-")
    ]

    # Before → After table (older archives wrote it as "Now → After")
    na = section("Before → After") or section("Now → After")
    rows = []
    for ln in na.splitlines():
        if not ln.startswith("|") or "---" in ln or "Aspect" in ln:
            continue
        cells = [c.strip() for c in ln.strip("|").split("|")]
        if len(cells) >= 3:
            rows.append({"aspect": cells[0], "before": cells[1], "after": cells[2]})

    def bullets(sec: str) -> list[str]:
        return [
            re.sub(r"\*\*", "", re.sub(r"^-\s*", "", ln)).strip()
            for ln in section(sec).splitlines()
            if ln.strip().startswith("-")
        ]

    decisions = [
        re.sub(r"^-\s*", "", ln).strip()
        for ln in section("Decisions this slice").splitlines()
        if ln.strip().startswith("-")
    ]
    surfaces = {}
    for ln in section("Surfaces touched").splitlines():
        m = re.match(r"- \*\*(.+?)\*\*\s*—\s*(.+)", ln)
        if m:
            surfaces[m.group(1)] = m.group(2).strip()

    pulse = section("Diff pulse").strip().strip("`")

    # Edge paths — the written-down self-review. Surface | State | What happens.
    edge = []
    for ln in section("Edge paths").splitlines():
        if not ln.startswith("|") or "---" in ln or "Surface" in ln:
            continue
        cells = [c.strip() for c in ln.strip("|").split("|")]
        if len(cells) >= 3 and any(cells[:3]):
            edge.append({"surface": cells[0], "state": cells[1], "what": cells[2]})

    # Shots — `file.png` — caption. A line with no file is the "could not capture" note.
    shots = []
    for ln in section("Shots").splitlines():
        if not ln.strip().startswith("-"):
            continue
        body = re.sub(r"^-\s*", "", ln).strip()
        m = re.match(
            # a path, not just a name: flow clips are recorded as `flows/F-x.webm`
            r"`?([\w.\-/]+\.(?:png|jpg|jpeg|webp|gif|webm|mp4))`?\s*(?:—|--|-)?\s*(.*)",
            body,
        )
        if m:
            shots.append({"file": m.group(1), "caption": m.group(2).strip()})

    # archive filename from head
    return {
        "title": head[2:].strip() if head.startswith("#") else head,
        "meta": meta,
        "headline": headline,
        "highlights": highlights,
        "now_after": rows,
        "logic_delta": bullets("Logic delta"),
        "flow_delta": bullets("Flow delta"),
        "surfaces": surfaces,
        "decisions": decisions,
        "edge_paths": edge,
        "review": bullets("Review"),
        "shots": shots,
        "pulse": pulse,
    }


# id → human label, filled by render(). Ids stay in the DOM as anchors and in
# data-search; they are never shown to a reader.


def parse_delta(bullets: list[str]) -> list[tuple[str, list[dict]]]:
    """["Added — `L-hub` members UI · `L-addMember`"] → [("Added", [{ref, note}])]."""
    out: list[tuple[str, list[dict]]] = []
    for line in bullets:
        head, _, rest = line.partition("—")
        status = head.strip().strip("*").strip()
        if not rest.strip():
            status, rest = "Changed", line
        pieces = []
        for chunk in rest.split("·"):
            chunk = chunk.strip()
            if not chunk:
                continue
            refs = re.findall(r"[LF]-[\w-]+", chunk)
            if not refs:
                pieces.append({"ref": "", "note": chunk})
                continue
            note = chunk
            for ref in refs:
                note = note.replace(ref, "")
            note = note.replace("`", "").strip(" ()/·").strip()
            for ref in refs:
                pieces.append({"ref": ref, "note": note})
        if pieces:
            out.append((status, pieces))
    return out

