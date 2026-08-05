#!/usr/bin/env python3
"""Generate docs/slicer.html from docs/state/*.md — run from repo root or docs/."""

from __future__ import annotations

import html
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STATE = ROOT / "docs" / "state"
OUT = ROOT / "docs" / "slicer.html"


def esc(s: str) -> str:
    return html.escape(s, quote=True)


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


# Kinds are the browsing axis: what a piece *is*, declared in LOGIC.md's Kind
# column. Order is the reading order on the Symbols page — person-facing first,
# then the cheap pure core, then state, work, and the wire.
KIND_ORDER = ["Screen", "Pure", "State", "Job", "Network", "Endpoint"]
# One flat glyph per kind, inline so the page stays self-contained. Shape is the
# carrier, colour only reinforces it — the kind's word is always next to it too.
KIND_ICON = {
    "Screen": '<rect x="2" y="3" width="12" height="9"/><path d="M6 14h4"/>',
    "Pure": '<path d="M2 8h9"/><path d="M8 5l3 3-3 3"/><path d="M2 4v8"/>',
    "State": '<path d="M2 4h12"/><path d="M2 8h12"/><path d="M2 12h12"/>',
    "Job": (
        '<rect x="1.5" y="1.5" width="4" height="4"/>'
        '<rect x="10.5" y="10.5" width="4" height="4"/>'
        '<path d="M5.5 3.5h5a2 2 0 0 1 2 2v5"/>'
    ),
    "Network": (
        '<path d="M5 13V3"/><path d="M3 5l2-2 2 2"/>'
        '<path d="M11 3v10"/><path d="M9 11l2 2 2-2"/>'
    ),
    "Endpoint": (
        '<rect x="2" y="2.5" width="12" height="4.5"/>'
        '<rect x="2" y="9" width="12" height="4.5"/>'
        '<path d="M4.5 4.75h1.5"/><path d="M4.5 11.25h1.5"/>'
    ),
}


def used_badge(ref: str) -> str:
    """How many flows lean on this symbol — the reason it sorts where it does."""
    n = len(USED_BY.get(ref, ()))
    if not n:
        return '<span class="used none" title="No flow names this symbol">\u2014</span>'
    plural = "s" if n != 1 else ""
    return (
        f'<span class="used" title="Named by {n} flow{plural}">{n} flow{plural}</span>'
    )


# Deep link into the editor. Cursor (a VS Code fork) registers the `cursor://`
# scheme with the OS, and the running window handles it — clicking opens the
# file in the window you already have, never a second instance. Inside WSL the
# path must go through the remote authority, or the editor looks for it on the
# Windows filesystem and finds nothing.
WSL_DISTRO = os.environ.get("WSL_DISTRO_NAME", "")


def editor_uri(rel_path: str, line: int | None) -> str:
    abs_path = str((ROOT / rel_path).resolve())
    target = f"{abs_path}:{line}" if line else abs_path
    if WSL_DISTRO:
        return f"cursor://vscode-remote/wsl+{WSL_DISTRO}{target}"
    return f"cursor://file{target}"


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


def source_ref(rel_path: str, name: str = "") -> str:
    """The path chip, as a link into the editor."""
    line = symbol_line(rel_path, name) if name else None
    where = (ROOT / rel_path)
    if not where.exists():
        return f'<code class="ref">{esc(rel_path)}</code>'
    label = f"{rel_path}:{line}" if line else rel_path
    return (
        f'<a class="ref src" href="{esc(editor_uri(rel_path, line))}" '
        f'data-path="{esc(rel_path)}" data-line="{line or ""}" '
        f'title="Open in Cursor">{esc(label)}</a>'
    )


def kind_icon(kind: str, colour: str = "") -> str:
    body = KIND_ICON.get(kind, '<rect x="3" y="3" width="10" height="10"/>')
    style = f' style="--sc:{colour}"' if colour else ""
    return (
        f'<svg class="kicon"{style} viewBox="0 0 16 16" aria-hidden="true" '
        f'fill="none" stroke="currentColor" stroke-width="1.4">{body}</svg>'
    )


KIND_BLURB = {
    "Screen": "What the person sees and taps",
    "Pure": "Input in, answer out — no state, no network",
    "State": "Owns local data: store, SQLite, Secure Store",
    "Job": "Sequences other pieces into one unit of work",
    "Network": "Crosses the wire from the device",
    "Endpoint": "The server side of that wire",
}


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
        "out_of_scope": bullets("Out of scope"),
    }


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

    return {
        "churn": churn,
        "branch": run("rev-parse", "--abbrev-ref", "HEAD"),
        "last_commit": run("log", "-1", "--pretty=%h %s"),
        "changes": sorted(changes, key=lambda c: (c["state"] != "new", c["path"])),
        "stat": run("diff", "--shortstat"),
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
        "pulse": pulse,
    }


# id → human label, filled by render(). Ids stay in the DOM as anchors and in
# data-search; they are never shown to a reader.
LABELS: dict[str, str] = {}


def label_for(ref: str) -> str:
    # names may carry their own backticks (`a` / `b`) — the chip is already mono
    return LABELS.get(ref, ref).replace("`", "")


# a flow is not a kind, but a reference to one still deserves a mark of its own
FLOW_ICON = '<path d="M3 3h10"/><path d="M3 8h10"/><path d="M3 13h10"/><path d="M6 3v10"/>'


def ref_link(ref: str, suffix: str = "") -> str:
    """A deep link wears the kind of the thing it points at — glyph and colour."""
    if ref.startswith("F-"):
        icon = (
            '<svg class="kicon" viewBox="0 0 16 16" aria-hidden="true" fill="none" '
            f'stroke="currentColor" stroke-width="1.4">{FLOW_ICON}</svg>'
        )
        return (
            f'<a class="chip chip-f" href="#{esc(ref)}" title="{esc(ref)}">'
            f"{icon}{esc(label_for(ref) + suffix)}</a>"
        )

    kind = (LOGIC_BY_ID.get(ref) or {}).get("kind", "")
    colour = KIND_SLOT.get(kind, "")
    style = f' style="--sc:{colour}"' if colour else ""
    icon = kind_icon(kind) if kind else ""
    return (
        f'<a class="chip chip-l"{style} href="#{esc(ref)}" '
        f'title="{esc(ref)}{" · " + esc(kind) if kind else ""}">'
        f"{icon}{esc(label_for(ref) + suffix)}</a>"
    )


def chipify_logic_ids(text: str) -> str:
    """Escape, then swap L-/F- ids for links carrying their human label."""
    # Protect code spans first
    parts = re.split(r"(`[^`]+`)", text)
    out = []
    for part in parts:
        if part.startswith("`") and part.endswith("`"):
            inner = part[1:-1]
            # `L-openGroup(groupId)` — id plus call args still reads as one ref
            m = re.match(r"^([LF]-[\w-]+)(\(.*\))?$", inner)
            if m:
                out.append(ref_link(m.group(1), m.group(2) or ""))
            else:
                out.append(f"<code>{esc(inner)}</code>")
        else:
            e = esc(part)
            e = re.sub(r"\b([LF]-[\w-]+)\b", lambda m: ref_link(m.group(1)), e)
            out.append(e)
    return "".join(out)


def strip_md(text: str) -> str:
    """Quote a line of NEXT.md inline: keep its code spans, drop its bold marks."""
    return re.sub(r"\*\*(.+?)\*\*", r"\1", chipify_logic_ids(text))


def rich(text: str) -> str:
    """Escaped markdown-ish inline: code spans, refs, **bold**, [links](url)."""
    h = chipify_logic_ids(text)
    h = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", h)
    h = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', h)
    return h


# id → the LOGIC.md area it lives in, and that area's colour slot. A flow step
# inherits the layer of the first symbol it names, which is what lets a reader
# see the hop from screen to device to server without reading the sentence.
AREA_OF: dict[str, str] = {}
AREA_SLOT: dict[str, str] = {}
KIND_SLOT: dict[str, str] = {}
USED_BY: dict[str, set] = {}


def short_area(area: str) -> str:
    return area.split("/")[0].split("(")[0].strip()


def step_layer(step: str) -> tuple[str, str]:
    """(kind, colour) for the first symbol a step names — the same category, glyph
    and colour the Symbols page browses by. Blank when the step names none."""
    for ref in re.findall(r"\b(L-[\w]+)\b", step):
        kind = (LOGIC_BY_ID.get(ref) or {}).get("kind")
        if kind:
            return kind, KIND_SLOT.get(kind, "var(--line-strong)")
    return "", "var(--line-strong)"


def step_area(step: str) -> str:
    """Where the first symbol a step names runs — UI / Device / Edge / Server."""
    for ref in re.findall(r"\b(L-[\w]+)\b", step):
        area = AREA_OF.get(ref)
        if area:
            return area
    return ""


def step_html(step: str) -> str:
    lines = step.split("\n")
    main = rich(lines[0])
    subs = [ln[2:].strip() if ln.startswith("- ") else ln for ln in lines[1:] if ln.strip()]
    sub_html = ""
    if subs:
        sub_html = "<ul class='step-subs'>" + "".join(
            f"<li>{rich(s)}</li>" for s in subs
        ) + "</ul>"
    return f"<div class='step-body'>{main}{sub_html}</div>"


# The pieces a slice touched, rendered in the same shape Symbols and Flows use:
# one row per piece, so "what changed" is read in the vocabulary of the map.
LOGIC_BY_ID: dict[str, dict] = {}
FLOW_BY_ID: dict[str, dict] = {}

STATUS_TONE = {"added": "ok", "changed": "warn", "removed": "open"}


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


def delta_row(status: str, piece: dict) -> str:
    """One changed piece, in the Symbols row shape — name, path, what it is for."""
    ref = piece["ref"]
    tone = STATUS_TONE.get(status.lower(), "warn")
    entry = LOGIC_BY_ID.get(ref)
    flow = FLOW_BY_ID.get(ref)
    colour = KIND_SLOT.get((entry or {}).get("kind", ""), "var(--line-strong)")
    if flow:
        colour = "var(--s5)"

    if entry:
        title = f'<h4><a class="self" href="#{esc(ref)}">{esc(entry["name"])}</a></h4>'
        where = source_ref(entry["where"], entry["name"])
        what = rich(entry["what"])
    elif flow:
        title = f'<h4><a class="self" href="#{esc(ref)}">{esc(flow["title"])}</a></h4>'
        where = '<code class="ref">flow</code>'
        what = rich(flow["trigger"])
    else:
        # removed, or never in the map — say so rather than inventing a row
        title = f"<h4>{esc(label_for(ref) if ref else piece['note'])}</h4>"
        where = ""
        what = "<em>no longer in the map</em>" if status.lower() == "removed" else ""

    note = (
        f'<p class="dnote{" change" if status.lower() != "added" else ""}">'
        f'{rich(piece["note"])}</p>'
        if piece["note"]
        else ""
    )
    icon = kind_icon(entry["kind"]) if entry else ""
    return (
        f'<div class="row{" row-flow" if flow else ""}" style="--sc:{colour}">'
        f'<div class="rmain">'
        f'<div class="rhead">{icon}{title}{where}'
        f'<span class="pill {tone}">{esc(status)}</span></div>'
        f'<p class="one">{what}</p>{note}'
        f"</div></div>"
    )


def delta_block(bullets: list[str]) -> str:
    rows = "".join(
        delta_row(status, piece)
        for status, pieces in parse_delta(bullets)
        for piece in pieces
    )
    return f'<div class="rows">{rows}</div>' if rows else '<p class="empty">Nothing.</p>'


def flow_tests() -> dict[str, dict]:
    """Which flows have a test, read from the test files — never hand-maintained.

    A file naming a flow id (`F-sync.flow.test.ts`, or a `describe('F-sync …')`)
    counts as that flow's test; its `it(...)` titles are the cases.
    """
    out: dict[str, dict] = {}
    for path in sorted((ROOT / "src").rglob("*.test.ts")):
        text = path.read_text(encoding="utf-8", errors="ignore")
        ids = set(re.findall(r"\bF-[\w-]+", path.name + " " + text))
        if not ids:
            continue
        cases = re.findall(r"\bit\(\s*['\"](.+?)['\"]", text, re.S)
        for fid in ids:
            entry = out.setdefault(fid, {"file": "", "cases": []})
            entry["file"] = str(path.relative_to(ROOT))
            entry["cases"].extend(c.strip() for c in cases)
    return out


def newest_archive() -> Path | None:
    files = sorted(STATE.joinpath("slices").glob("*.md"), reverse=True)
    return files[0] if files else None


def render() -> str:
    logic_areas = parse_logic(read(STATE / "LOGIC.md"))
    flows = parse_flows(read(STATE / "FLOWS.md"))
    direction = parse_overview_direction(read(STATE / "OVERVIEW.md"))
    nxt = parse_next(read(STATE / "NEXT.md"))
    parking = parse_parking(read(STATE / "PARKING.md"))
    arch = newest_archive()
    report = parse_report(read(arch)) if arch else None
    arch_name = arch.name if arch else ""

    all_logic = [e for _, rows in logic_areas for e in rows]
    LABELS.clear()
    LABELS.update({e["id"]: e["name"] for e in all_logic})
    LABELS.update({f["id"]: f["title"] for f in flows})
    AREA_OF.clear()
    AREA_SLOT.clear()
    AREA_OF.update({e["id"]: area for area, rows in logic_areas for e in rows})
    # A symbol's weight is how many flows lean on it — measured, not asserted.
    USED_BY.clear()
    for f in flows:
        text = " ".join([f["trigger"], f["outcome"], *f["steps"]])
        for ref in set(re.findall(r"\b(L-[\w]+)\b", text)):
            USED_BY.setdefault(ref, set()).add(f["id"])

    LOGIC_BY_ID.clear()
    LOGIC_BY_ID.update(
        {e["id"]: {**e, "area": area} for area, rows in logic_areas for e in rows}
    )
    FLOW_BY_ID.clear()
    FLOW_BY_ID.update({f["id"]: f for f in flows})
    logic_count = len(all_logic)
    flow_count = len(flows)
    shipped = len(list((STATE / "slices").glob("*.md")))
    # current from NEXT title
    current_slice = "—"
    m = re.search(r"(\d{4})", nxt["title"])
    if m:
        current_slice = m.group(1)

    area_names = [a for a, _ in logic_areas]

    # area → accent slot (flow step tags, which are about *where* code runs)
    slot = {a: f"var(--s{(i % 6) + 1})" for i, a in enumerate(area_names)}
    AREA_SLOT.update(slot)

    # kind → accent slot: the browsing axis, so it owns the rails on Symbols
    def kind_weight(k: str) -> tuple[int, int]:
        # a kind weighs what its symbols are leaned on for, then how many it has
        rows_of_kind = [e for e in all_logic if e["kind"] == k]
        return (
            sum(len(USED_BY.get(e["id"], ())) for e in rows_of_kind),
            len(rows_of_kind),
        )

    kinds_present = sorted(
        {e["kind"] for e in all_logic},
        key=lambda k: (
            -kind_weight(k)[0],
            -kind_weight(k)[1],
            KIND_ORDER.index(k) if k in KIND_ORDER else 99,
        ),
    )
    kind_slot = {k: f"var(--s{(i % 6) + 1})" for i, k in enumerate(kinds_present)}
    KIND_SLOT.clear()
    KIND_SLOT.update(kind_slot)

    # --- logic rows, grouped by area (where they run), ordered by weight ---
    def weight(ref: str) -> int:
        return len(USED_BY.get(ref, ()))

    # areas keep the order LOGIC.md writes them in — UI → Device → Edge → Server
    # is a path, and a path reads better than a leaderboard for four buckets
    areas_present = [a for a, rows in logic_areas if rows]

    logic_sections = []
    for area in areas_present:
        entries = sorted(dict(logic_areas)[area], key=lambda e: -weight(e["id"]))
        cards = []
        for e in entries:
            search = " ".join(
                [e["id"], e["name"], e["where"], e["what"], area, e["kind"]]
            ).lower()
            cards.append(
                f"""
<div class="row" id="{esc(e['id'])}" data-kind="{esc(e['kind'])}" data-search="{esc(search)}" style="--sc:{kind_slot[e['kind']]}">
  <div class="rmain">
    <div class="rhead">
      {kind_icon(e['kind'])}
      <h4><a class="self" href="#{esc(e['id'])}">{esc(e['name'])}</a></h4>
      {source_ref(e['where'], e['name'])}
      {used_badge(e['id'])}
    </div>
    <p class="one">{chipify_logic_ids(e['what'])}</p>
  </div>
</div>"""
            )
        logic_sections.append(
            f'<section class="logic-area" data-area-section="{esc(area)}" style="--sc:{slot[area]}">'
            f'<h3 class="area-title">{esc(area)}<u>{len(entries)}</u></h3>'
            f'<div class="rows">{"".join(cards)}</div></section>'
        )

    area_chips = ['<button type="button" class="btn chip-filter" data-kind="all" aria-pressed="true">All</button>']
    for k in kinds_present:
        n = sum(1 for e in all_logic if e["kind"] == k)
        area_chips.append(
            f'<button type="button" class="btn chip-filter" data-kind="{esc(k)}"'
            f' style="--sc:{kind_slot[k]}" aria-pressed="false"'
            f' title="{esc(KIND_BLURB.get(k, ""))}">{kind_icon(k)}{esc(k)}'
            f' <span class="cnt">{n}</span></button>'
        )

    # --- flows ---
    def flow_steps_html(
        f: dict,
        marks: set | None = None,
        mark_word: str = "",
        step_notes: dict | None = None,
    ) -> str:
        """Steps, interrupted by a band whenever the work crosses into another area.
        `marks` are step numbers this slice touched — they get called out."""
        marks = marks or set()
        parts, seen_area = [], None
        for n, step in enumerate(f["steps"], 1):
            area = step_area(step)
            if area and area != seen_area:
                parts.append(
                    f'<li class="fzone" style="--sc:{slot.get(area, "var(--line-strong)")}">'
                    f'<span>{esc(short_area(area))}</span></li>'
                )
                seen_area = area
            hot = n in marks
            # say what was adjusted in this step, not just that something was
            note = (step_notes or {}).get(n) or mark_word
            tag = f'<span class="stag">{note}</span>' if hot else ""
            parts.append(
                f'<li class="fstep{" hot" if hot else ""}"><span class="fn">{n:02d}</span>'
                f"{step_html(step)}{tag}</li>"
            )
        return "".join(parts)

    def test_block(f: dict) -> str:
        if not tests:
            return ""  # no flow tests in the tree at all — not a finding
        t = tests.get(f["id"])
        if not t:
            return (
                '<p class="ftests none">Untested — no test names this flow</p>'
            )
        cases = "".join(f"<li>{esc(c)}</li>" for c in t["cases"])
        return (
            f'<details class="ftests"><summary>Tested · {len(t["cases"])} cases</summary>'
            f'<ul>{cases}</ul>'
            f'<p class="ffile"><code class="ref">{esc(t["file"])}</code></p>'
            f"</details>"
        )

    def flow_case(
        f: dict,
        *,
        node_id: str,
        search: str = "",
        badge: str = "",
        note: str = "",
        open_steps: bool = False,
        title_href: str = "",
        marks: set | None = None,
        mark_word: str = "",
        step_notes: dict | None = None,
    ) -> str:
        href = title_href or f"#{f['id']}"
        fold = (
            f'<button type="button" class="fold" '
            f'aria-expanded="{"true" if open_steps else "false"}">{len(f["steps"])} steps</button>'
        )
        return f"""
<section class="fcase{' open' if open_steps else ''}" id="{esc(node_id)}"{f' data-search="{esc(search)}"' if search else ''}>
  <div class="fhead">
    <h4><a class="self" href="{esc(href)}">{esc(f['title'])}</a></h4>
    {badge}
    {fold}
  </div>
  {f'<p class="fmarks">{len(marks or ())} of {len(f["steps"])} steps {esc(mark_word)}</p>' if marks else (f'<p class="fmarks quiet">Changed — the archive does not say which step</p>' if mark_word else "")}
  <div class="fmeta">
    <span class="lbl">Starts when</span><span>{rich(f['trigger'])}</span>
    <span class="lbl">Ends with</span><span>{rich(f['outcome'])}</span>
  </div>
  {test_block(f)}
  {note}
  <ol class="fsteps"{'' if open_steps else ' hidden'}>{flow_steps_html(f, marks, mark_word, step_notes)}</ol>
</section>"""

    tests = flow_tests()

    flow_blocks = [
        flow_case(
            f,
            node_id=f["id"],
            search=" ".join(
                [f["id"], f["title"], f["trigger"], f["outcome"], " ".join(f["steps"])]
            ).lower(),
        )
        for f in flows
    ]

    # --- the slice being worked on right now ---
    git = git_state()
    archived_numbers = {
        m.group(1)
        for m in (re.match(r"(\d{4})", pth.name) for pth in (STATE / "slices").glob("*.md"))
        if m
    }
    in_progress = bool(nxt["number"]) and nxt["number"] not in archived_numbers

    # what the working tree has actually touched, mapped onto the map:
    # a changed file lands on the symbols that live in it
    changed_paths = {c["path"]: c["state"] for c in (git["changes"] if git else [])}

    def path_state(where: str) -> str | None:
        if where in changed_paths:
            return changed_paths[where]
        for path, state in changed_paths.items():
            if path.endswith("/") and where.startswith(path):
                return state
            if where.startswith(path.rstrip("/") + "/"):
                return state
        return None

    touched = [
        (e, path_state(e["where"]))
        for _, rws in logic_areas
        for e in rws
        if path_state(e["where"])
    ]
    touched_ids = {e["id"] for e, _ in touched}

    def touched_symbol_rows() -> str:
        if not touched:
            return '<p class="empty">No mapped file has been touched yet.</p>'
        word = {"new": "New file", "changed": "Changed", "gone": "Deleted"}
        tone = {"new": "ok", "changed": "warn", "gone": "open"}
        churn = (git or {}).get("churn", {})

        # The explanation of a change is authored, not counted: NEXT.md already
        # says what each piece is becoming. Match the symbol against its
        # Before → After row or its plan step and quote that.
        def why(e: dict) -> str:
            names = [n.strip() for n in e["name"].split("/")] + [
                e["where"].rsplit("/", 1)[-1],
                e["where"],
            ]

            def mentions(text: str) -> bool:
                # an id is an exact join; prose matching is the fallback, and it
                # is why NEXT.md should cite ids the way FLOWS.md does
                if e["id"] in re.findall(r"\bL-[\w]+", text):
                    return True
                low = text.lower()
                return any(n and n.lower() in low for n in names)

            for row in nxt["now_after"]:
                if mentions(row["aspect"]):
                    return (
                        f"{strip_md(row['before'])} → <b>{strip_md(row['after'])}</b>"
                    )
            for step in nxt["plan"]:
                if mentions(step):
                    return strip_md(step)
            for seam in nxt["seams"]:
                if mentions(seam["seam"]):
                    return f"under test — {strip_md(seam['behavior'])}"
            return ""

        def churn_note(e: dict, st: str) -> str:
            if st == "new":
                text = why(e) or "New file this slice"
                return f'<p class="dnote fresh">{text}</p>'
            text = why(e)
            if text:
                return f'<p class="dnote change">{text}</p>'
            # the map is file-level, so a shared file drags its neighbours in;
            # say that plainly rather than implying this symbol was the target
            n = churn.get(e["where"])
            hint = f"+{n[0]} −{n[1]}" if n else "edited"
            return (
                f'<p class="dnote change">Its file changed ({esc(hint)}), but '
                f"nothing in <code>NEXT.md</code> names this piece</p>"
            )

        rows = "".join(
            f'<div class="row"><div class="rmain"><div class="rhead">'
            f'{kind_icon(e["kind"])}'
            f'<h4><a class="self" href="#{esc(e["id"])}">{esc(e["name"])}</a></h4>'
            f'{source_ref(e["where"], e["name"])}'
            f'<span class="pill {tone[st]}">{esc(word[st])}</span></div>'
            f'<p class="one">{chipify_logic_ids(e["what"])}</p>'
            f"{churn_note(e, st)}</div></div>"
            for e, st in sorted(touched, key=lambda t: -len(USED_BY.get(t[0]["id"], ())))
        )
        return f'<div class="rows">{rows}</div>'

    def touched_flow_cases() -> str:
        out = []
        for f in flows:
            marks = {
                n
                for n, step in enumerate(f["steps"], 1)
                if touched_ids & set(re.findall(r"\b(L-[\w]+)\b", step))
            }
            if not marks:
                continue
            # name the pieces that moved, in the order the flow runs them —
            # "3 of 6 steps touched" says how much, not what
            step_notes = {}
            for n, step in enumerate(f["steps"], 1):
                here = [
                    label_for(ref)
                    for ref in dict.fromkeys(re.findall(r"\b(L-[\w]+)\b", step))
                    if ref in touched_ids
                ]
                if here:
                    step_notes[n] = "moving " + esc(
                        ", ".join(here[:-1]) + " and " + here[-1]
                        if len(here) > 1
                        else here[0]
                    )

            out.append(
                flow_case(
                    f,
                    node_id=f"w-{f['id']}",
                    badge='<span class="pill warn">In flight</span>',
                    marks=marks,
                    mark_word="touched",
                    step_notes=step_notes,
                    title_href=f"#{f['id']}",
                )
            )
        return "".join(out) or '<p class="empty">No flow runs through the changed files yet.</p>'

    na_now = "".join(
        f"<tr><th>{rich(r['aspect'])}</th><td class='before'>{rich(r['before'])}</td>"
        f"<td class='after'>{rich(r['after'])}</td></tr>"
        for r in nxt["now_after"]
    )
    plan_items = "".join(f"<li>{rich(x)}</li>" for x in nxt["plan"])
    seam_rows = "".join(
        f"<tr><td>{rich(x['seam'])}</td><td>{rich(x['behavior'])}</td></tr>"
        for x in nxt["seams"]
    )
    accept_items = "".join(f"<li>{rich(x)}</li>" for x in nxt["acceptance"])
    scope_chips = "".join(
        f'<span class="chip chip-dec">{esc(x)}</span>' for x in nxt["out_of_scope"]
    )

    changed_count = len(git["changes"]) if git else 0
    stat = git["stat"] if git else ""
    branch = git["branch"] if git else ""
    last_commit = git["last_commit"] if git else ""

    # --- newest ---
    if report:
        hl = "".join(f"<li>{chipify_logic_ids(h)}</li>" for h in report["highlights"])
        na_rows = "".join(
            f"<tr><th>{rich(r['aspect'])}</th><td class='before'>{rich(r['before'])}</td>"
            f"<td class='after'>{rich(r['after'])}</td></tr>"
            for r in report["now_after"]
        )
        logic_d = delta_block(report["logic_delta"])

        def flow_delta_html() -> str:
            out = []
            for status, pieces in parse_delta(report["flow_delta"]):
                tone = STATUS_TONE.get(status.lower(), "warn")
                for piece in pieces:
                    f = FLOW_BY_ID.get(piece["ref"])
                    if not f:
                        out.append(
                            f'<div class="rows"><div class="row"><div class="rmain">'
                            f'<div class="rhead"><h4>{esc(label_for(piece["ref"]) or piece["note"])}</h4>'
                            f'<span class="pill {tone}">{esc(status)}</span></div>'
                            f"<p class='one'><em>no longer in the map</em></p></div></div></div>"
                        )
                        continue
                    added = status.lower() == "added"
                    # "step 4 pull roster" / "steps 2, 3" in the slice note names
                    # what moved; an added flow is new all the way through
                    # an added flow is new end to end — the pill says so; marking
                    # every step would be noise
                    marks = (
                        set()
                        if added
                        else {
                            int(x)
                            for x in re.findall(
                                r"steps?\s+([\d,\s&and–-]+)", piece["note"], re.I
                            )
                            for x in re.findall(r"\d+", x)
                        }
                    )
                    out.append(
                        flow_case(
                            f,
                            node_id=f"n-{f['id']}",
                            marks=marks,
                            mark_word="" if added else "changed",
                            step_notes=(
                                {n: esc(re.sub(r"^steps?\s+[\d,\s&and–-]+", "", piece["note"]).strip() or "changed") for n in marks}
                                if piece["note"]
                                else {}
                            ),
                            badge=f'<span class="pill {tone}">{esc(status)}</span>',
                            note=(
                                f'<p class="fnote{" change" if not added else ""}">'
                                f'{rich(piece["note"])}</p>'
                                if piece["note"]
                                else ""
                            ),
                            open_steps=False,
                            title_href=f"#{f['id']}",
                        )
                    )
            return "".join(out) or '<p class="empty">Nothing.</p>'

        flow_d = flow_delta_html()
        surf = "".join(
            f"<div class='sw2'><b>{esc(k)}</b><span>{chipify_logic_ids(v)}</span></div>"
            for k, v in report["surfaces"].items()
        )
        def dec_chip(d: str) -> str:
            # "D-011 — Empty create" reads as the decision; the id is the tooltip
            head, _, rest = d.partition("—")
            did, text = (head.strip(), rest.strip()) if rest else ("", d.strip())
            return f'<span class="chip chip-dec" title="{esc(did)}">{esc(text)}</span>'

        dec = "".join(dec_chip(d) for d in report["decisions"])
        newest_search = " ".join(
            [
                report["title"],
                report["headline"],
                " ".join(report["highlights"]),
                " ".join(report["logic_delta"]),
                " ".join(report["flow_delta"]),
            ]
        ).lower()
        newest_body = f"""
  <h4 class="closed-title">{esc(report['title'])}</h4>
  <p class="lede">{esc(report['headline'])}</p>
  <p class="why">{esc(report['meta'])} · archive <code class="ref">{esc(arch_name)}</code></p>

  <h3 id="n-highlights">Highlights</h3>
  <ul class="bullets">{hl}</ul>

  <h3 id="n-delta">Before → After</h3>
  <div class="scroll"><table class="delta-table">
    <thead><tr><th>Aspect</th><th>Before</th><th>After</th></tr></thead>
    <tbody>{na_rows}</tbody>
  </table></div>

  <h3 id="n-symbols">Symbols that slice touched</h3>
  {logic_d}

  <h3 id="n-flows">Flows that slice touched</h3>
  {flow_d}

  <h3 id="n-surfaces">Surfaces touched</h3>
  <div class="rows swrows">{surf}</div>

  <h3 id="n-decisions">Decisions</h3>
  <div>{dec}</div>

  <h3 id="n-diff">Diff pulse</h3>
  <p class="mono diff">{esc(report['pulse'])}</p>"""
        closed_html = f'<section class="closed">{newest_body}</section>'
    else:
        closed_html = """
  <p class="kicker">Last closed slice</p>
  <p class="empty">No closed slices yet.</p>"""
        newest_search = ""

    if in_progress:
        newest_html = f"""
<section class="page" id="newest" data-title="This slice" tabindex="-1"
         data-search="{esc((nxt['title'] + ' ' + nxt['goal'] + ' ' + newest_search).lower())}">
  <p class="kicker">In progress</p>
  <h1>{esc(nxt['title'])}</h1>
  <p class="lede">{rich(nxt['goal'])}</p>

  <div class="statbar">
    <div style="--sc:var(--s3)"><b>{changed_count}</b><span>Uncommitted files</span></div>
    <div style="--sc:var(--s1)"><b>{esc(nxt['tier'])}</b><span>Tier</span></div>
    <div style="--sc:var(--s2)"><b>{esc(branch or '—')}</b><span>Branch</span></div>
    <div style="--sc:var(--s5)"><b>{len(nxt['acceptance'])}</b><span>Acceptance checks</span></div>
  </div>

  <h3 id="p-touched">Symbols in the changed files</h3>
  <p class="why">Mapped from the working tree — {esc(stat or 'no tracked edits yet')} since <code class="ref">{esc(last_commit)}</code>.</p>
  {touched_symbol_rows()}

  <h3 id="p-flows">Flows running through them</h3>
  <p class="why">Steps naming a touched symbol are marked — this is what may have moved.</p>
  {touched_flow_cases()}

  <h3 id="p-delta">Before → After</h3>
  <div class="scroll"><table class="delta-table">
    <thead><tr><th>Aspect</th><th>Before</th><th>After</th></tr></thead>
    <tbody>{na_now}</tbody>
  </table></div>

  <h3 id="p-plan">Plan</h3>
  <ol class="bullets">{plan_items}</ol>

  <h3 id="p-seams">Seams under test</h3>
  <div class="scroll"><table>
    <thead><tr><th>Seam</th><th>Behaviour</th></tr></thead>
    <tbody>{seam_rows}</tbody>
  </table></div>

  <h3 id="p-accept">Acceptance</h3>
  <ul class="bullets">{accept_items}</ul>

  <h3 id="p-scope">Out of scope</h3>
  <div>{scope_chips}</div>

  <h3 id="p-closed">Previously</h3>
  <details class="closedwrap">
    <summary>Last closed slice — {esc(report['title'] if report else 'none yet')}</summary>
    {closed_html}
  </details>
</section>"""
    else:
        newest_html = (
            f'<section class="page" id="newest" data-title="Newest slice" tabindex="-1"'
            f' data-search="{esc(newest_search)}">{closed_html}</section>'
        )

    # parking
    park_html = []
    park_count = 0
    for tier, items in parking:
        park_count += len(items)
        lis = "".join(f"<li>{esc(i)}</li>" for i in items[:8])
        more = f"<li class='more'>+{len(items)-8} more</li>" if len(items) > 8 else ""
        park_html.append(
            f"<div class='park-tier'><h5>{esc(tier)}<u>{len(items)}</u></h5>"
            f"<ul>{lis}{more}</ul></div>"
        )

    constraints = "".join(f"<li>{esc(c)}</li>" for c in direction["constraints"])

    timeline = "".join(
        f'<a class="tl" href="state/slices/{esc(p.name)}"><b>{esc(p.stem)}</b><span>archive</span></a>'
        for p in sorted((STATE / "slices").glob("*.md"), reverse=True)
    )

    layer_key = [
        f'<span class="lk" style="--sc:{kind_slot[k]}">{kind_icon(k)}{esc(k)}</span>'
        for k in kinds_present
    ]

    # --- overview page ---
    ov_caps = "".join(
        f"<div class='sw2'><b>{i:02d}</b><span>{rich(c)}</span></div>"
        for i, c in enumerate(direction["capabilities"], 1)
    )
    ov_stack = "".join(
        f"<div class='sw2'><b>{rich(part[0])}</b><span>{rich(' — '.join(part[1:]))}</span></div>"
        for part in (x.split(" — ") for x in direction["stack"])
    )
    ov_model = "".join(
        f"<div class='row' style=\"--sc:var(--s{(i % 6) + 1})\">"
        f"<div class='rmain'><div class='rhead'><h4>{esc(e['name'])}</h4></div>"
        f"<p class='one'>{rich(e['what'])}</p></div></div>"
        for i, e in enumerate(direction["model"])
    )
    ov_routes = "".join(
        f"<tr><td><code>{esc(r['route'].strip('`'))}</code></td><td>{rich(r['what'])}</td>"
        f"<td class='mono'>{esc(r['since'])}</td></tr>"
        for r in direction["routes"]
    )
    ov_constraints = "".join(f"<li>{rich(c)}</li>" for c in direction["constraints"])
    ov_nongoals = "".join(f"<span class='chip chip-dec'>{esc(g)}</span>" for g in direction["non_goals"])

    # everything the reference popover needs, so a chip can answer in place
    ref_data = {
        e["id"]: {
            "name": e["name"],
            "where": e["where"],
            "kind": e["kind"],
            "area": area,
            "what": e["what"],
            "used": len(USED_BY.get(e["id"], ())),
            "icon": kind_icon(e["kind"]),
            "src": editor_uri(e["where"], symbol_line(e["where"], e["name"])),
            "line": symbol_line(e["where"], e["name"]) or "",
        }
        for area, rows in logic_areas
        for e in rows
    }
    ref_data.update(
        {
            f["id"]: {
                "name": f["title"],
                "where": "flow",
                "kind": "Flow",
                "area": "",
                "what": f["trigger"],
                "outcome": f["outcome"],
                "steps": len(f["steps"]),
                "icon": "",
            }
            for f in flows
        }
    )
    ref_json = json.dumps(ref_data, ensure_ascii=False).replace("</", "<\\/")

    css = r"""
:root{
  --bg:#fbfbf9; --surface:#fff; --surface-2:#f3f4f0; --surface-3:#e9ebe4;
  --line:#dedfd6; --line-strong:#c2c4b7;
  --text:#14170f; --muted:#5a5f50; --faint:#878c7b;
  --accent:#1f6b4a; --accent-soft:#e3f0e9;
  --s1:#1f6b4a; --s2:#1e5fc4; --s3:#a35a06; --s4:#b3196b; --s5:#0d7d76; --s6:#5b21b6;
  --ok:#166534; --ok-soft:#dcf3e3; --warn:#92580b; --warn-soft:#fbeecb;
  --open:#a8123c; --open-soft:#fbe0e7;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
  --sans:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  --sp-1:.4rem; --sp-2:.75rem; --sp-3:1.15rem; --sp-4:1.8rem; --sp-5:2.6rem;
}
@media (prefers-color-scheme:dark){:root{
  --bg:#0c0e0a; --surface:#13160f; --surface-2:#1a1e15; --surface-3:#232819;
  --line:#272c1f; --line-strong:#3b4230;
  --text:#e9ecdf; --muted:#9aa38c; --faint:#727a63;
  --accent:#5dba8d; --accent-soft:#152a20;
  --s1:#5dba8d; --s2:#60a5fa; --s3:#fbbf24; --s4:#f472b6; --s5:#2dd4bf; --s6:#a78bfa;
  --ok:#4ade80; --ok-soft:#102a1b; --warn:#fbbf24; --warn-soft:#33260a;
  --open:#fb7185; --open-soft:#38101f;
}}
:root[data-theme="light"]{
  --bg:#fbfbf9; --surface:#fff; --surface-2:#f3f4f0; --surface-3:#e9ebe4;
  --line:#dedfd6; --line-strong:#c2c4b7;
  --text:#14170f; --muted:#5a5f50; --faint:#878c7b;
  --accent:#1f6b4a; --accent-soft:#e3f0e9;
  --s1:#1f6b4a; --s2:#1e5fc4; --s3:#a35a06; --s4:#b3196b; --s5:#0d7d76; --s6:#5b21b6;
}
:root[data-theme="dark"]{
  --bg:#0c0e0a; --surface:#13160f; --surface-2:#1a1e15; --surface-3:#232819;
  --line:#272c1f; --line-strong:#3b4230;
  --text:#e9ecdf; --muted:#9aa38c; --faint:#727a63;
  --accent:#5dba8d; --accent-soft:#152a20;
  --s1:#5dba8d; --s2:#60a5fa; --s3:#fbbf24; --s4:#f472b6; --s5:#2dd4bf; --s6:#a78bfa;
}
*{box-sizing:border-box;border-radius:0}
html{scroll-padding-top:4.2rem}
[id]{scroll-margin-top:4.2rem}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important;scroll-behavior:auto!important}}
body{margin:0;background:var(--bg);color:var(--text);font:15.5px/1.6 var(--sans);-webkit-font-smoothing:antialiased}
a{color:var(--accent)}
code{font-family:var(--mono);font-size:.8em}
code.ref,a.ref{background:var(--surface-2);border:1px solid var(--line);padding:.06em .34em;
  color:var(--muted);white-space:nowrap;font-size:.74rem;font-family:var(--mono);
  text-decoration:none;display:inline-block}
a.ref.src:hover{color:var(--accent);border-color:var(--accent);background:var(--accent-soft)}
a.ref.src.open-failed{color:var(--open);border-color:var(--open)}

/* ---------------- shell ---------------- */
.layout{display:grid;grid-template-columns:238px minmax(0,1fr);min-height:100vh}
.side{position:sticky;top:0;height:100vh;overflow-y:auto;border-right:1px solid var(--line);
  background:var(--surface);display:flex;flex-direction:column}
.brand{padding:1.15rem 1.1rem .9rem;border-bottom:1px solid var(--line)}
.brand b{display:block;font-size:.95rem;letter-spacing:-.01em}
.brand span{display:block;font-size:.71rem;color:var(--faint);font-family:var(--mono);margin-top:.2rem}
.searchwrap{position:relative;padding:.75rem .8rem;border-bottom:1px solid var(--line)}
.search{width:100%;padding:.45rem 1.7rem .45rem .55rem;border:1px solid var(--line-strong);
  background:var(--bg);color:var(--text);font:inherit;font-size:.82rem}
.search:focus-visible{outline:2px solid var(--accent);outline-offset:-1px}
.search::-webkit-search-cancel-button{-webkit-appearance:none;appearance:none}
.clear{position:absolute;right:1.05rem;top:1.15rem;border:0;background:none;color:var(--faint);
  font:1rem var(--mono);cursor:pointer;padding:0 .2rem;display:none}
.searchwrap.has-query .clear{display:block}
.hits{display:none;padding:.35rem .05rem 0;font:.68rem var(--mono);color:var(--faint)}
.searchwrap.has-query .hits{display:block}
.nav{padding:.5rem 0;flex:1}
.nav a{display:grid;grid-template-columns:1.9rem minmax(0,1fr) auto;align-items:center;
  column-gap:.45rem;padding:.44rem .8rem;font-size:.845rem;color:var(--muted);
  text-decoration:none;border-left:3px solid transparent}
.nav a:hover{background:var(--surface-2);color:var(--text)}
.nav a.on{background:var(--accent-soft);color:var(--text);border-left-color:var(--nc,var(--accent));font-weight:600}
.nav a i{font-style:normal;font-family:var(--mono);font-size:.72rem;color:var(--nc,var(--faint));line-height:1}
.nav a u{text-decoration:none;font:.7rem var(--mono);color:var(--faint);justify-self:end;line-height:1}
.nav a.on u{color:var(--muted)}
.nav a.no-hit{opacity:.4}
.side-tools{padding:.7rem .8rem;border-top:1px solid var(--line);display:flex;gap:.35rem;flex-wrap:wrap}
.kbd{font:.68rem var(--mono);color:var(--faint);padding:.6rem .85rem;border-top:1px solid var(--line)}
.kbd b{font-weight:700;color:var(--muted);background:var(--surface-2);border:1px solid var(--line);padding:0 .25rem}
.btn{border:1px solid var(--line-strong);background:var(--surface);color:var(--muted);
  padding:.3rem .55rem;font:inherit;font-size:.75rem;cursor:pointer}
.btn:hover{color:var(--text);border-color:var(--sc,var(--accent))}
.btn:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.btn[aria-pressed="true"]{background:var(--sc,var(--accent));border-color:var(--sc,var(--accent));
  color:var(--bg);font-weight:600}

/* ---------------- topbar ---------------- */
main{min-width:0;display:flex;flex-direction:column}
.topbar{position:sticky;top:0;z-index:20;background:var(--bg);border-bottom:1px solid var(--line);
  display:flex;align-items:center;gap:.6rem;padding:.6rem 1.6rem;flex-wrap:wrap}
.crumb{font:.78rem var(--mono);color:var(--faint);margin-right:auto}
.crumb b{color:var(--text);font-family:var(--sans);font-size:.86rem;font-weight:600}
.filterbar{display:flex;gap:.3rem;align-items:center;flex-wrap:wrap}
.filterbar>b{font-size:.68rem;text-transform:uppercase;letter-spacing:.08em;color:var(--faint)}
.filterbar[hidden]{display:none}

/* ---------------- pages ---------------- */
.pages{flex:1;padding:1.9rem 1.6rem 3rem;max-width:1080px;width:100%}
.page{display:none}
.page.on{display:block;animation:in .18s ease-out}
@keyframes in{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}
.page:focus{outline:none}
h1{font-size:1.95rem;line-height:1.15;letter-spacing:-.025em;margin:0 0 .4rem}
h3{font-size:.76rem;text-transform:uppercase;letter-spacing:.1em;color:var(--faint);
  margin:var(--sp-5) 0 var(--sp-2);padding-bottom:.35rem;border-bottom:1px solid var(--line)}
h3:first-of-type{margin-top:var(--sp-4)}
h3.with-count{display:flex;align-items:center}
h3.with-count u{margin-left:auto;text-decoration:none;font:.7rem var(--mono);color:var(--faint);letter-spacing:0}
h4{margin:0;font-size:.94rem}
h5{margin:0 0 .5rem;font:700 .66rem var(--sans);letter-spacing:.09em;text-transform:uppercase;color:var(--faint)}
.kicker{font:700 .68rem var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin:0 0 .5rem}
.lede{font-size:1.02rem;color:var(--muted);max-width:70ch;margin:var(--sp-1) 0 var(--sp-3)}
.why{color:var(--muted);font-size:.86rem;margin:var(--sp-1) 0 var(--sp-3);max-width:74ch}
p,li{max-width:76ch}
.fstep,.fzone,.rows li,.tl{max-width:none}
.rows,.scroll,.split,.statbar,.fcase,.note,.bullets{margin:var(--sp-3) 0}
h3+.rows,h3+.scroll,h3+.split,h3+.statbar,h3+.fcase,h3+p,h3+ul{margin-top:var(--sp-2)}

/* ---------------- stat bar ---------------- */
.statbar{display:flex;border:1px solid var(--line);background:var(--surface);flex-wrap:wrap}
.statbar div{flex:1 1 8rem;padding:.7rem .9rem;border-right:1px solid var(--line);
  border-top:3px solid var(--sc,var(--line-strong))}
.statbar div:last-child{border-right:0}
.statbar b{display:block;font:700 1.5rem/1.1 var(--sans);letter-spacing:-.02em}
.statbar span{font-size:.71rem;text-transform:uppercase;letter-spacing:.07em;color:var(--faint)}

/* ---------------- note / direction ---------------- */
.note{border:1px solid var(--line);border-left:3px solid var(--accent);background:var(--surface);
  padding:.7rem 1rem;font-size:.89rem}
.note b{display:block;font:700 .64rem var(--sans);text-transform:uppercase;letter-spacing:.08em;
  color:var(--faint);margin-bottom:.2rem}
.note p{margin:0 0 .5rem}
.note ul{margin:0;padding-left:1.05rem;color:var(--muted);font-size:.84rem}

/* ---------------- logic rows ---------------- */
.logic-area{margin:var(--sp-4) 0}
.logic-area.is-hidden{display:none}
.area-title{display:flex;align-items:center;gap:.5rem;margin:0 0 var(--sp-2);
  color:var(--sc,var(--faint));border-bottom-color:var(--line)}
.area-title{color:var(--sc,var(--faint))}
.area-title u{margin-left:auto;text-decoration:none;font:.7rem var(--mono);color:var(--faint);
  letter-spacing:0;text-transform:none}
.area-title em{font:400 .72rem var(--sans);letter-spacing:0;text-transform:none;color:var(--faint)}
/* the area is secondary here — kind is what you browse by, area is a whisper */
.used{margin-left:auto;font:.68rem var(--mono);color:var(--faint)}
.used.none{opacity:.45}
.area-tag{font:700 .58rem var(--sans);letter-spacing:.08em;text-transform:uppercase;
  color:var(--sc,var(--faint));border-left:3px solid var(--sc,var(--line));padding-left:.35rem;
  margin-left:.6rem}
.chip-filter .cnt{font-family:var(--mono);opacity:.7;margin-left:.15rem}
.kicon{width:1em;height:1em;flex:none;color:var(--sc,var(--faint));align-self:center;
  stroke-linecap:square;stroke-linejoin:miter}
.rhead .kicon{width:.95rem;height:.95rem;align-self:baseline;transform:translateY(.12rem)}
.area-title .kicon{width:1rem;height:1rem;color:var(--sc)}
.chip-filter{display:inline-flex;align-items:center;gap:.35rem}
.btn[aria-pressed="true"] .kicon{color:var(--bg)}
.rows{border:1px solid var(--line);border-bottom:0;background:var(--surface)}
.row{border-bottom:1px solid var(--line)}
.row:hover{background:var(--surface-2)}
.row.is-hidden{display:none}
.rmain{padding:.7rem 1rem;min-width:0}
.rhead{display:flex;align-items:baseline;gap:.5rem;flex-wrap:wrap}
/* the row's headline IS the code symbol — mono, so it matches what you grep for */
.rhead h4{font:700 .87rem var(--mono);letter-spacing:-.01em;word-break:break-word}
.fhead h4{font-family:var(--sans);font-size:.94rem}
/* the row's own title is its permalink — no id badge to read past */
a.self{color:inherit;text-decoration:none}
/* what happened to a piece this slice — never colour alone, the word is there */
.pill{margin-left:auto;font:700 .6rem var(--sans);letter-spacing:.08em;text-transform:uppercase;
  padding:.1rem .4rem;border:1px solid currentColor}
.pill.ok{color:var(--ok);background:var(--ok-soft)}
.pill.warn{color:var(--warn);background:var(--warn-soft)}
.pill.open{color:var(--open);background:var(--open-soft)}
.dnote{margin:.25rem 0 0;font-size:.8rem;color:var(--faint)}
/* what changed, in the colour of the Changed pill that claims it */
.dnote.change,.fnote.change{color:var(--warn)}
.dnote.fresh{color:var(--ok)}
.dnote.change code{background:var(--warn-soft);border:1px solid transparent;color:var(--warn)}
.dnote b{font-weight:700;color:var(--text)}
/* a flow's name is prose, not a symbol — it keeps the sans it wears on Flows */
.row-flow .rhead h4{font-family:var(--sans);font-weight:600}
a.self:hover{color:var(--accent);text-decoration:underline}
.row:target,.fcase:target{outline:2px solid var(--accent);outline-offset:-2px}
.one{margin:.25rem 0 0;font-size:.875rem;color:var(--muted)}
.one code{background:var(--surface-2);border:1px solid var(--line);padding:.04em .3em;color:var(--text)}

/* ---------------- flows ---------------- */
.fcase{border:1px solid var(--line);border-left:3px solid transparent;background:var(--surface)}
.fcase.open{border-left-color:var(--accent)}
.fhead{display:flex;gap:.5rem;align-items:baseline;flex-wrap:wrap;padding:.7rem 1rem .4rem}
.fcase.is-hidden{display:none}
/* the last closed slice is a document inside a document: box it, and demote its
   headings, or its sections read as if they belonged to the slice in flight */
.closedwrap{margin-top:var(--sp-2)}
.closedwrap > summary{cursor:pointer;list-style:none;padding:.5rem .8rem;border:1px solid var(--line);
  background:var(--surface-2);font-size:.85rem;color:var(--muted)}
.closedwrap > summary::-webkit-details-marker{display:none}
.closedwrap > summary::before{content:"+ ";font-family:var(--mono);font-weight:700;color:var(--accent)}
.closedwrap[open] > summary::before{content:"– "}
.closedwrap > summary:hover{color:var(--text)}
.closed{border:1px solid var(--line);border-top:0;background:var(--surface);padding:.2rem 1.1rem 1.2rem}
.closed .closed-title{margin:1rem 0 .3rem;font-size:1.05rem;letter-spacing:-.01em}
.closed .lede{font-size:.92rem;margin-bottom:var(--sp-2)}
.closed h3{font-size:.68rem;margin:var(--sp-4) 0 var(--sp-2);border-bottom:1px dashed var(--line)}
.closed .statbar,.closed .rows,.closed .fcase{background:var(--bg)}
.ftests{margin:0;padding:0 1rem .6rem;font-size:.78rem}
.ftests > summary{cursor:pointer;list-style:none;display:inline-block;color:var(--ok);
  font:700 .62rem var(--sans);letter-spacing:.08em;text-transform:uppercase}
.ftests > summary::-webkit-details-marker{display:none}
.ftests > summary::before{content:"✓ ";font-weight:700}
.ftests ul{margin:.35rem 0 0;padding-left:1.1rem;color:var(--muted)}
.ftests .ffile{margin:.35rem 0 0}
.ftests.none{font:700 .62rem var(--sans);letter-spacing:.08em;text-transform:uppercase;
  color:var(--open)}
.fnote{margin:0;padding:0 1rem .6rem;font-size:.8rem;color:var(--faint)}
.fmarks{margin:0;padding:.1rem 1rem .5rem;font:700 .62rem var(--sans);letter-spacing:.08em;
  text-transform:uppercase;color:var(--warn)}
.fmarks.quiet{color:var(--faint);font-weight:600}
/* the steps this slice actually moved */
.fstep.hot{background:var(--warn-soft);box-shadow:inset 3px 0 0 var(--warn)}
.fstep.hot .stag{grid-column:2;justify-self:start;font:600 .74rem var(--sans);color:var(--warn);
  margin-top:.25rem}
.fstep.hot .stag::before{content:"↳ ";font-weight:700}
.fhead .pill{margin-left:0}
.fold{margin-left:auto;border:1px solid var(--line);background:var(--surface-2);color:var(--muted);
  font:600 .66rem var(--sans);letter-spacing:.08em;text-transform:uppercase;padding:.15rem .45rem;cursor:pointer}
.fold:hover{color:var(--text);border-color:var(--accent)}
.fold::after{content:" +";font-family:var(--mono)}
.fold[aria-expanded="true"]::after{content:" –"}
.fmeta{display:grid;grid-template-columns:auto minmax(0,1fr);gap:.2rem .7rem;align-items:baseline;
  padding:0 1rem .7rem;font-size:.83rem;color:var(--muted)}
.fmeta .lbl{font:700 .62rem var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}
.fmeta code{background:var(--surface-2);border:1px solid var(--line);padding:.04em .3em;color:var(--text)}
.fsteps{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.fstep{display:grid;grid-template-columns:2.2rem minmax(0,1fr);gap:.9rem;padding:.6rem 1rem;
  border-bottom:1px solid var(--line);font-size:.87rem}
.fkey{display:flex;gap:.9rem;flex-wrap:wrap;align-items:center;border:1px solid var(--line);
  }
.fkey #fold-all{margin-left:auto}
.fkey{
  background:var(--surface);padding:.5rem .8rem;margin:var(--sp-3) 0}
.lk{display:inline-flex;align-items:center;gap:.3rem;border-left:3px solid var(--sc);padding-left:.4rem;font:700 .6rem var(--sans);
  letter-spacing:.08em;text-transform:uppercase;color:var(--sc)}
.fstep:last-child{border-bottom:0}
.fn{font:700 .7rem var(--mono);color:var(--faint);padding-top:.15rem}
/* the area band: where this stretch of the flow runs */
.fzone{display:flex;align-items:center;gap:.6rem;padding:.3rem 1rem;background:var(--surface-2);
  border-bottom:1px solid var(--line);border-top:1px solid var(--line)}
.fzone span{font:700 .6rem var(--sans);letter-spacing:.12em;text-transform:uppercase;
  color:var(--sc,var(--muted))}
.fzone::after{content:"";flex:1;height:1px;background:var(--sc,var(--line));opacity:.35}
.fsteps > .fzone:first-child{border-top:0}
.step-body{min-width:0}
.step-subs{margin:.3rem 0 0;padding-left:1.05rem;color:var(--muted);font-size:.83rem}

/* ---------------- chips ---------------- */
.chip{display:inline-block;font-size:.71rem;padding:.1rem .42rem;background:var(--surface-2);
  border:1px solid var(--line);color:var(--muted);margin:.12rem .2rem .12rem 0;white-space:nowrap;
  text-decoration:none;font-family:var(--mono)}
a.chip{color:var(--accent)}
.step-body .chip,.one .chip,.fmeta .chip,.bullets .chip,.sw2 .chip{margin:0}
a.chip:hover{border-color:var(--accent);background:var(--accent-soft)}
.pop{position:fixed;z-index:60;width:min(26rem,calc(100vw - 1rem));background:var(--surface);
  border:1px solid var(--line-strong);box-shadow:0 8px 30px rgba(0,0,0,.22);font-size:.86rem}
.pop[hidden]{display:none}
.pop header{display:flex;align-items:center;gap:.45rem;padding:.5rem .7rem;
  border-bottom:1px solid var(--line);background:var(--surface-2)}
.pop header b{font:700 .87rem var(--mono);min-width:0;overflow-wrap:anywhere}
.pop-icon{display:inline-flex;color:var(--muted)}
.pop-icon .kicon{width:1rem;height:1rem}
.pop-kind{font:700 .6rem var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--faint);
  white-space:nowrap}
.pop header button{margin-left:auto;border:0;background:none;color:var(--muted);font:1rem var(--mono);
  cursor:pointer;padding:0 .2rem}
.pop header button:hover{color:var(--text)}
.pop-body{padding:.6rem .7rem}
.pop-body p{margin:0 0 .4rem;max-width:none}
.pop-meta{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;font:.72rem var(--mono);color:var(--faint)}
.pop-go{display:block;padding:.5rem .7rem;border-top:1px solid var(--line);background:var(--surface-2);
  font-size:.78rem;text-decoration:none}
.pop-go:hover{background:var(--accent-soft)}
@media (max-width:600px){
  .pop{left:0!important;right:0;top:auto!important;bottom:0;width:100%;border-left:0;border-right:0;border-bottom:0}
}
.chip{display:inline-flex;align-items:center;gap:.28em}
.chip.pop-on{background:var(--accent-soft);border-color:var(--sc,var(--accent))}
.chip .kicon{width:.85em;height:.85em}
.chip-l{color:var(--sc,var(--accent))}
a.chip-l:hover{border-color:var(--sc,var(--accent));background:var(--surface-3)}
.chip-dec{font-family:var(--sans);color:var(--muted)}
.sw2 code{background:var(--surface-2);border:1px solid var(--line);padding:.04em .3em;color:var(--text)}
.chip-f{color:var(--s2);font-family:var(--sans)}
a.chip-f:hover{border-color:var(--s2)}

/* ---------------- tables / lists ---------------- */
.scroll{overflow-x:auto;border:1px solid var(--line);background:var(--surface)}
table{border-collapse:collapse;width:100%;font-size:.85rem;min-width:520px}
th,td{text-align:left;padding:.5rem .7rem;border-bottom:1px solid var(--line);vertical-align:top}
th{background:var(--surface-2);font:700 .68rem var(--sans);letter-spacing:.07em;text-transform:uppercase;
  color:var(--muted);border-bottom:1px solid var(--line-strong)}
tbody tr:last-child td{border-bottom:0}
tbody th{background:var(--surface);color:var(--text);font-family:var(--sans);text-transform:none;
  letter-spacing:0;font-size:.83rem;width:26%;border-bottom:1px solid var(--line)}
.delta-table .before{color:var(--faint)}
.delta-table .after{color:var(--text);background:var(--accent-soft);font-weight:550}
.bullets{padding-left:1.05rem;font-size:.89rem}
.bullets li{margin-bottom:.25rem}
.split{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1px;
  background:var(--line);border:1px solid var(--line)}
.split>div{padding:.85rem 1rem;background:var(--surface)}
.split ul{margin:0;padding-left:1.05rem;font-size:.86rem}
.swrows{border-bottom:1px solid var(--line)}
.sw2{display:grid;grid-template-columns:9rem minmax(0,1fr);gap:1rem;padding:.5rem 1rem;
  border-bottom:1px solid var(--line);font-size:.85rem}
.sw2:last-child{border-bottom:0}
.sw2 b{font:700 .66rem var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--faint);padding-top:.1rem}
.mono{font-family:var(--mono);font-size:.84rem}
.diff{color:var(--muted)}
.empty{color:var(--faint);font-size:.87rem;padding:1rem;border:1px dashed var(--line);background:var(--surface)}
.empty.is-hidden{display:none}

/* ---------------- steering ---------------- */
.park-tier{padding:.6rem 1rem;border-bottom:1px solid var(--line);background:var(--surface)}
.park-tier:last-child{border-bottom:0}
.park-tier h5{display:flex;align-items:center;gap:.5rem;margin-bottom:.3rem}
.park-tier u{margin-left:auto;text-decoration:none;font:.7rem var(--mono);color:var(--faint);
  letter-spacing:0;text-transform:none}
.park-tier ul{margin:0;padding-left:1.05rem;font-size:.85rem;color:var(--muted)}
.park-tier .more{color:var(--faint);list-style:none;margin-left:-1.05rem}
.tl{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:1rem;padding:.5rem 1rem;
  border-bottom:1px solid var(--line);background:var(--surface);text-decoration:none;color:var(--text)}
.tl:last-child{border-bottom:0}
.tl:hover{background:var(--surface-2)}
.tl b{font:600 .85rem var(--mono)}
.tl span{font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:var(--faint)}

/* ---------------- responsive ---------------- */
@media (max-width:880px){
  .layout{grid-template-columns:1fr}
  .side{position:static;height:auto;border-right:0;border-bottom:1px solid var(--line)}
  .nav{display:flex;flex-wrap:wrap;padding:.3rem}
  .nav a{border-left:0;border-bottom:3px solid transparent;padding:.4rem .6rem;grid-template-columns:auto auto auto}
  .nav a.on{border-left-color:transparent;border-bottom-color:var(--nc,var(--accent))}
  .kbd{display:none}
  .pages{padding:1.2rem 1rem}
  .fstep{grid-template-columns:2.2rem minmax(0,1fr);gap:.5rem}
  .sw2{grid-template-columns:1fr;gap:.15rem}
  h1{font-size:1.6rem}
}
@media print{
  .side,.topbar{display:none}
  .layout{display:block}
  .page{display:block!important;break-before:page}
  .fsteps[hidden]{display:block!important}
  .row,.fcase,.statbar{break-inside:avoid}
  body{background:#fff;color:#000;font-size:11pt}
}
"""

    js = r"""
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const pages=$$('.page'), navlinks=$$('#nav a');
const q=$('#q'), wrap=$('#searchwrap'), hits=$('#hits');
const rows=$$('#symbols .row'), flows=$$('#flows .fcase'), areas=$$('.logic-area');
const allCases=$$('.fcase');   // Flows page + the ones inlined on Newest slice
const newest=$('#newest');
const chips=$$('.chip-filter');
let kind='all';

// ---------- theme ----------
const root=document.documentElement, saved=localStorage.getItem('slicer-theme');
if(saved) root.dataset.theme=saved;
$('#theme').onclick=()=>{
  const dark=root.dataset.theme? root.dataset.theme==='dark'
    : matchMedia('(prefers-color-scheme:dark)').matches;
  root.dataset.theme=dark?'light':'dark';
  localStorage.setItem('slicer-theme',root.dataset.theme);
};

// ---------- router: one page at a time ----------
const baseTitle=document.title;
function pageOf(el){return el&&el.closest?el.closest('.page'):null;}
function show(id,anchor){
  const el=document.getElementById(id);
  const page=el&&el.classList.contains('page')?el:pages[0];
  pages.forEach(p=>p.classList.toggle('on',p===page));
  navlinks.forEach(a=>a.classList.toggle('on',a.getAttribute('href')==='#'+page.id));
  $('#here').textContent=page.dataset.title||page.id;
  document.title=(page.dataset.title?page.dataset.title+' — ':'')+baseTitle;
  $('#filterbar').hidden=page.id!=='symbols';
  const settle=()=>{
    const t=anchor&&document.getElementById(anchor);
    if(t)t.scrollIntoView({block:'start',behavior:'auto'});
    else scrollTo(0,0);
  };
  settle(); requestAnimationFrame(settle);
  page.focus({preventScroll:true});
}
function route(){
  const h=decodeURIComponent(location.hash.slice(1));
  if(!h)return show(pages[0].id);
  const el=document.getElementById(h);
  if(el&&el.classList.contains('page'))return show(h);
  const p=pageOf(el);
  if(p)return show(p.id,h);
  show(pages[0].id);
}
addEventListener('hashchange',route);

// ---------- search + area filter ----------
function norm(s){return (s||'').toLowerCase().trim();}
function apply(){
  const query=norm(q.value);
  wrap.classList.toggle('has-query',!!query);
  let logicHits=0, flowHits=0;

  rows.forEach(r=>{
    const ok=(kind==='all'||r.dataset.kind===kind) &&
             (!query||(r.dataset.search||'').includes(query));
    r.classList.toggle('is-hidden',!ok);
    if(ok)logicHits++;
  });
  areas.forEach(sec=>{
    const visible=sec.querySelectorAll('.row:not(.is-hidden)').length;
    sec.classList.toggle('is-hidden',visible===0);
    const c=sec.querySelector('.area-title u');
    if(c)c.textContent=visible;
  });
  flows.forEach(f=>{
    const ok=!query||(f.dataset.search||'').includes(query);
    f.classList.toggle('is-hidden',!ok);
    if(ok){
      flowHits++;
      if(query)setFold(f,true);
    }
  });
  const newestHit=!newest||!newest.dataset.search||!query||
    (newest.dataset.search||'').includes(query);

  $('#logic-empty').classList.toggle('is-hidden',logicHits>0);
  $('#flow-empty').classList.toggle('is-hidden',flowHits>0);
  $('#n-logic').textContent=logicHits;
  $('#n-flow').textContent=flowHits;
  navlinks.forEach(a=>{
    if(!query){a.classList.remove('no-hit');return;}
    const id=a.getAttribute('href').slice(1);
    const has=id==='symbols'?logicHits>0
             :id==='flows'?flowHits>0
             :id==='newest'?newestHit:true;
    a.classList.toggle('no-hit',!has);
  });
  hits.textContent=query
    ? logicHits+' symbols · '+flowHits+' flows'+(newestHit?' · newest':'')
    : '';
}
q.addEventListener('input',apply);
$('#clear-q').addEventListener('click',()=>{q.value='';q.focus();apply();});
chips.forEach(b=>b.addEventListener('click',()=>{
  chips.forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
  kind=b.dataset.kind||'all';
  apply();
}));

// ---------- flow folding ----------
function setFold(f,open){
  const btn=f.querySelector('.fold'), list=f.querySelector('.fsteps');
  if(!btn||!list)return;
  btn.setAttribute('aria-expanded',String(open));
  list.hidden=!open;
  f.classList.toggle('open',open);
}
allCases.forEach(f=>{
  const btn=f.querySelector('.fold');
  if(btn)btn.addEventListener('click',()=>
    setFold(f,btn.getAttribute('aria-expanded')!=='true'));
});

const foldAll=$('#fold-all');
foldAll.addEventListener('click',()=>{
  const open=foldAll.getAttribute('aria-pressed')!=='true';
  flows.forEach(f=>setFold(f,open));
  foldAll.setAttribute('aria-pressed',String(open));
  foldAll.textContent=open?'Collapse all':'Expand all';
});

// ---------- reference popover ----------
// a chip answers "what is this?" in place; the page only moves if you ask it to
const REFS=JSON.parse($('#refdata').textContent||'{}');
const pop=$('#pop'); let popAnchor=null;

function closePop(){
  pop.hidden=true;
  if(popAnchor)popAnchor.classList.remove('pop-on');
  popAnchor=null;
}
function openPop(a){
  const id=decodeURIComponent(a.getAttribute('href').slice(1));
  const d=REFS[id];
  if(!d)return false;
  const isFlow=d.kind==='Flow';
  $('#pop-icon').innerHTML=d.icon||'';
  $('#pop-name').textContent=d.name;
  $('#pop-kind').textContent=isFlow?'Flow':(d.kind+(d.area?' · '+d.area:''));
  $('#pop-what').textContent=isFlow?d.what:d.what;
  const where=$('#pop-where');
  where.textContent=d.where;
  if(d.src){
    where.href=d.src; where.title='Open in Cursor';
    where.dataset.path=d.where; where.dataset.line=d.line||'';
  } else {
    where.removeAttribute('href'); delete where.dataset.path;
  }
  $('#pop-used').textContent=isFlow
    ? (d.steps+' step'+(d.steps===1?'':'s')+(d.outcome?' · ends with '+d.outcome:''))
    : (d.used?('named by '+d.used+' flow'+(d.used===1?'':'s')):'no flow names it');
  const go=$('#pop-go');
  go.href='#'+id;
  go.textContent=(isFlow?'Open in Flows':'Open in Symbols')+' \u2192';

  pop.hidden=false;
  if(popAnchor)popAnchor.classList.remove('pop-on');
  popAnchor=a; a.classList.add('pop-on');
  const r=a.getBoundingClientRect(), pr=pop.getBoundingClientRect();
  const left=Math.min(Math.max(8,r.left),innerWidth-pr.width-8);
  const below=r.bottom+6, above=r.top-pr.height-6;
  pop.style.left=left+'px';
  pop.style.top=(below+pr.height<innerHeight-8||above<8?below:above)+'px';
  return true;
}
document.addEventListener('click',e=>{
  const a=e.target.closest && e.target.closest('a.chip-l, a.chip-f');
  if(a&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey){
    if(openPop(a)){e.preventDefault();return;}
  }
  if(!e.target.closest||!e.target.closest('#pop'))closePop();
});
$('#pop-close').addEventListener('click',closePop);
$('#pop-go').addEventListener('click',closePop);
addEventListener('scroll',()=>{if(popAnchor)closePop();},true);
addEventListener('resize',closePop);

// ---------- open in the editor ----------
// Served over http? Ask the helper to run `cursor -r -g`, which reuses the
// window. On file:// fall through to the cursor:// href, which does not.
const servedLocally=location.protocol==='http:'||location.protocol==='https:';
document.addEventListener('click',e=>{
  const a=e.target.closest && e.target.closest('a.ref.src');
  if(!a||!servedLocally||!a.dataset.path)return;
  e.preventDefault();
  const q=new URLSearchParams({path:a.dataset.path,line:a.dataset.line||''});
  // if the helper is not there (plain static server), fall back to the scheme
  fetch('/open?'+q).then(r=>{
    if(r.ok)return;
    a.classList.add('open-failed');
    if(r.status===404||r.status===501)location.href=a.href;
  }).catch(()=>{a.classList.add('open-failed');location.href=a.href;});
});

// ---------- keys ----------
addEventListener('keydown',e=>{
  const typing=/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName||'');
  if(e.key==='Escape'&&!pop.hidden){closePop();return;}
  if(e.key==='/'&&!typing){e.preventDefault();q.focus();q.select();}
  else if(e.key==='Escape'&&document.activeElement===q){q.value='';apply();q.blur();}
  else if(!typing&&/^[1-5]$/.test(e.key)){
    const a=navlinks[+e.key-1];
    if(a)location.hash=a.getAttribute('href');
  }
});

route();
apply();
"""

    return f"""<!DOCTYPE html>
<!-- generated by /slicer — edit docs/state/*.md, not this file -->
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SplitNext — Slicer board</title>
  <style>{css}</style>
</head>
<body>
<div class="layout">

  <aside class="side">
    <div class="brand">
      <b>SplitNext — Slicer</b>
      <span>{shipped} slices · slice {esc(current_slice)} open</span>
    </div>
    <div class="searchwrap" id="searchwrap">
      <label for="q" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)">Search</label>
      <input id="q" class="search" type="search" placeholder="Search symbols, flows, paths  (/)"
             autocomplete="off" />
      <button type="button" class="clear" id="clear-q" aria-label="Clear search">×</button>
      <div class="hits" id="hits" aria-live="polite"></div>
    </div>
    <nav class="nav" id="nav" aria-label="Board sections">
      <a href="#overview" style="--nc:var(--s6)"><i>01</i>Overview<u></u></a>
      <a href="#symbols" style="--nc:var(--s1)"><i>02</i>Symbols<u id="n-logic">{logic_count}</u></a>
      <a href="#flows" style="--nc:var(--s5)"><i>03</i>Flows<u id="n-flow">{flow_count}</u></a>
      <a href="#newest" style="--nc:var(--s3)"><i>04</i>{'This slice' if in_progress else 'Newest slice'}<u>{esc(nxt['number'] if in_progress else (arch_name.split('-')[0] if arch_name else '—'))}</u></a>
      <a href="#steering" style="--nc:var(--s2)"><i>05</i>Steering<u>{park_count}</u></a>
    </nav>
    <div class="side-tools">
      <button class="btn" id="theme">◐ Theme</button>
    </div>
    <div class="kbd">
<b>/</b> search · <b>Esc</b> clear · <b>1–5</b> jump
      <br>generated by /slicer — edit <code>docs/state/*.md</code>
    </div>
  </aside>

  <main>
    <div class="topbar">
      <span class="crumb">slicer board / <b id="here">Overview</b></span>
      <div class="filterbar" id="filterbar">
        <b>Kind</b>
        {''.join(area_chips)}
      </div>
    </div>

    <div class="pages">

      <section class="page" id="overview" data-title="Overview" tabindex="-1">
        <p class="kicker">Overview</p>
        <h1>What this app is</h1>
        <p class="lede">{rich(direction['destination'])}</p>

        <div class="statbar">
          <div style="--sc:var(--s1)"><b>{shipped}</b><span>Slices shipped</span></div>
          <div style="--sc:var(--s3)"><b>{esc(current_slice)}</b><span>Current slice</span></div>
          <div style="--sc:var(--s2)"><b>{logic_count}</b><span>Symbols</span></div>
          <div style="--sc:var(--s5)"><b>{flow_count}</b><span>Flows</span></div>
        </div>

        <h3 id="o-users">Who it is for</h3>
        <p>{rich(direction['users'])}</p>

        <h3 id="o-can">What it can do today</h3>
        <div class="rows swrows">{ov_caps}</div>

        <h3 id="o-constraints">Constraints</h3>
        <div class="note"><b>Rules the build holds to</b><ul>{ov_constraints}</ul></div>

        <h3 id="o-nongoals">Not building</h3>
        <div>{ov_nongoals}</div>

        <h3 id="o-stack">Stack</h3>
        <div class="rows swrows">{ov_stack}</div>

        <h3 id="o-model">Data model</h3>
        <div class="rows">{ov_model}</div>

        <h3 id="o-routes">Routes</h3>
        <div class="scroll"><table>
          <thead><tr><th>Route</th><th>What it does</th><th>Shipped in</th></tr></thead>
          <tbody>{ov_routes}</tbody>
        </table></div>
      </section>

      <section class="page" id="symbols" data-title="Symbols" tabindex="-1">
        <p class="kicker">Current system</p>
        <h1>What the code does</h1>
        <p class="lede">Every meaningful piece of behaviour, grouped by <em>where it runs</em> — UI, device, edge, server. Filter by <strong>kind</strong> above: what a piece is, marked by the glyph before each name. Areas run in path order; inside one, rows are ordered by weight — how many flows lean on them — so the pieces the app actually turns on come first. For how they run end to end, see <a href="#flows">Flows</a>.</p>
        <p class="empty is-hidden" id="logic-empty">No symbols match.</p>
        {''.join(logic_sections)}
      </section>

      <section class="page" id="flows" data-title="Flows" tabindex="-1">
        <p class="kicker">Current system</p>
        <h1>How it runs end to end</h1>
        <p class="lede">Each flow is one path a person can trigger, start to finish. A band marks each stretch by the area it runs in — UI, device, edge, server — and every symbol named inside carries the glyph of its <a href="#symbols">kind</a>. Click any symbol to open it in <a href="#symbols">Symbols</a>.</p>
        {f'<p class="why">{sum(1 for f in flows if f["id"] in tests)} of {len(flows)} flows have a test naming them — run <code class="ref">npm test</code>.</p>' if tests else ''}
        <div class="fkey">
          {''.join(layer_key)}
          <button type="button" class="btn" id="fold-all" aria-pressed="false">Expand all</button>
        </div>
        <p class="empty is-hidden" id="flow-empty">No flows match.</p>
        {''.join(flow_blocks)}
      </section>

      {newest_html}

      <section class="page" id="steering" data-title="Steering" tabindex="-1">
        <p class="kicker">Steering</p>
        <h1>What's next</h1>
        <p class="lede">{esc(nxt['goal'])}</p>

        <h3 id="s-next">Next slice</h3>
        <div class="rows">
          <div class="row" style="--sc:var(--s3)">
                      <div class="rmain">
              <div class="rhead">
                <h4>{esc(nxt['title'])}</h4>
                <code class="ref">{esc(nxt['tier'])}</code>
              </div>
              <p class="one">{esc(nxt['goal'])}</p>
            </div>
          </div>
        </div>

        <h3 id="s-parked" class="with-count">Parked<u>{park_count}</u></h3>
        <div class="rows">{''.join(park_html)}</div>

        <h3 id="s-timeline">Timeline</h3>
        <div class="rows">{timeline}</div>
      </section>

    </div>
  </main>
</div>
<div class="pop" id="pop" role="dialog" aria-modal="false" aria-labelledby="pop-name" hidden>
  <header>
    <span class="pop-icon" id="pop-icon"></span>
    <b id="pop-name"></b>
    <span class="pop-kind" id="pop-kind"></span>
    <button type="button" id="pop-close" aria-label="Close">\u00d7</button>
  </header>
  <div class="pop-body">
    <p id="pop-what"></p>
    <p class="pop-meta"><a class="ref src" id="pop-where" href="#"></a><span id="pop-used"></span></p>
  </div>
  <a class="pop-go" id="pop-go" href="#">Open in Symbols &rarr;</a>
</div>
<script id="refdata" type="application/json">{ref_json}</script>
<script>{js}</script>
</body>
</html>
"""


def main() -> None:
    html_out = render()
    OUT.write_text(html_out, encoding="utf-8")
    print(f"Wrote {OUT} ({len(html_out)} bytes)")


if __name__ == "__main__":
    main()
