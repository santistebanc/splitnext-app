"""Which mapped symbol calls which — measured from the source, never authored.

`LOGIC.md` says what each piece of behaviour is; it does not say what leans on
what, and a `uses` column would be stale within a slice. So the relationship is
derived here at generation time, the same way flow weight is counted rather than
asserted (D-034).

The one thing that makes this non-trivial: **the map lists deep modules and
deliberately omits private helpers**, so the calls that matter usually sit one
hop below the mapped name. `flushQueue` is the case that proves it — it only
delegates to `flushQueueInner`, which holds all nine real calls. Scanning a
symbol's own declaration and stopping there reports `flushQueue` as calling
nothing and promotes it to an entry point beside the screens. So the walk
follows unmapped local declarations transitively, and stops at any name the map
claims: a mapped symbol is an *edge*, not a corridor, or every root inherits
every leaf and deep modules stop being boundaries (D-035).

Nothing here reads the repo directly — `resolve` takes a reader — so the seams
can be tested against synthetic sources instead of a tree that moves each slice.
"""

from __future__ import annotations

import re
from collections import deque
from dataclasses import dataclass, field

# Top-level declarations, with the name captured. Types and interfaces are in
# here not because anything calls them but because they end the span of the
# declaration above them.
DECL_RE = re.compile(
    r"^(?:export\s+)?(?:default\s+)?(?:async\s+)?"
    r"(?:function|const|let|var|class|type|interface|enum)\s+([A-Za-z_]\w*)"
)

# A call site, and not a declaration of the same name: `function target(` and
# `const target = (` are where a symbol is *defined*, and counting those makes a
# file's own declarations look like calls to whatever the map maps them to.
DECLARED_BEFORE = ("function ", "const ", "class ", "let ", "var ")


def _call_re(name: str) -> re.Pattern[str]:
    behind = "".join(f"(?<!{re.escape(kw)})" for kw in DECLARED_BEFORE)
    return re.compile(rf"{behind}\b{re.escape(name)}\s*\(")


def symbol_names(name: str) -> list[str]:
    """The code symbols in a `LOGIC.md` Name cell, if it holds any.

    `getAccessToken / saveAccessToken` is one idea with two verbs, so both
    halves belong to the same entry. A prose title (`Lobby screen`) or a route
    path (`/group/[id]`) names no export at all — that entry stands for its
    whole file, exactly as it does for change attribution.
    """
    parts = [p.strip().strip("`") for p in name.split("/")]
    names = [p for p in parts if re.fullmatch(r"[A-Za-z_]\w*", p)]
    # A route path splits on the same slash and can leave a bare segment that
    # happens to look like an identifier, so a cell is only a symbol cell when
    # every part of it is one.
    return names if len(names) == len(parts) else []


def declarations(source: str) -> dict[str, str]:
    """Every top-level declaration in a file, mapped to the lines it owns.

    A declaration owns everything up to the next one — the same rule the board
    already uses to decide which symbol a diff hunk landed on.
    """
    lines = source.splitlines()
    marks = [(i, m.group(1)) for i, ln in enumerate(lines) if (m := DECL_RE.match(ln))]
    out: dict[str, str] = {}
    for j, (start, name) in enumerate(marks):
        end = marks[j + 1][0] if j + 1 < len(marks) else len(lines)
        out.setdefault(name, "\n".join(lines[start:end]))
    return out


def _source_of(where: str, read_source) -> str | None:
    """A function directory (`supabase/functions/merge`) is read as its index."""
    text = read_source(where)
    if text is not None:
        return text
    for candidate in (f"{where}/index.ts", f"{where}/index.tsx"):
        text = read_source(candidate)
        if text is not None:
            return text
    return None


def _closure(decls: dict[str, str], mine: list[str], claimed: dict[str, str], me: str):
    """The caller's own declarations, plus the private helpers they reach.

    Stops at any name the map claims, because that is an edge rather than a
    corridor — traversing it would charge its callees to this symbol too.
    """
    blobs: list[str] = []
    seen: set[str] = set()
    queue = deque(mine)
    while queue:
        name = queue.popleft()
        if name in seen:
            continue
        seen.add(name)
        body = decls[name]
        blobs.append(body)
        for other in decls:
            if other in seen or claimed.get(other, me) != me:
                continue
            if _call_re(other).search(body):
                queue.append(other)
    return blobs


def resolve(entries: list[dict], read_source) -> dict[str, list[str]]:
    """`{entry id: [ids it calls]}`, children in the order the calls appear.

    `read_source(rel_path)` returns the file's text, or None when there is none
    — a path that no longer exists yields no edges rather than an error, since
    the map can name a piece the tree has already moved.
    """
    claimed: dict[str, str] = {}
    for e in entries:
        for n in symbol_names(e["name"]):
            claimed.setdefault(n, e["id"])

    edges: dict[str, list[str]] = {}
    for e in entries:
        source = _source_of(e["where"], read_source)
        if source is None:
            edges[e["id"]] = []
            continue
        decls = declarations(source)
        mine = [n for n in symbol_names(e["name"]) if n in decls]
        # No declared name of its own — a route file, a function directory, or
        # a name the file re-exports rather than declares. The entry stands for
        # the whole file, so every call in it is its own.
        blobs = _closure(decls, mine, claimed, e["id"]) if mine else [source]

        hits: list[tuple[int, str]] = []
        for offset, blob in enumerate(blobs):
            for name, owner in claimed.items():
                if owner == e["id"]:
                    continue
                m = _call_re(name).search(blob)
                if m:
                    hits.append((offset * 10**9 + m.start(), owner))
        ordered: list[str] = []
        for _, owner in sorted(hits):
            if owner not in ordered:
                ordered.append(owner)
        edges[e["id"]] = ordered
    return edges


@dataclass
class TreePlan:
    """Where each symbol expands, so Tree shows every one of them exactly once.

    A symbol with twelve callers cannot be nested twelve times without turning
    49 rows into 217 — a view of the map whose row count does not match the map
    is not a view of the map. So each expands at its shallowest position and is
    a stub everywhere else (D-036).
    """

    roots: list[str] = field(default_factory=list)
    home: dict[str, str | None] = field(default_factory=dict)
    unreached: list[str] = field(default_factory=list)

    def expands_here(self, parent: str, child: str) -> bool:
        return self.home.get(child) == parent


def plan_tree(entries: list[dict], edges: dict[str, list[str]]) -> TreePlan:
    """Roots, and the one place each symbol expands.

    Breadth-first from the roots, so the winning position is the shallowest and
    — among equals — the one the map writes first. Anything a root cannot reach
    is a cycle; it is seeded as its own root and reported, never dropped.
    """
    order = [e["id"] for e in entries]
    called: set[str] = set()
    for a in order:
        called.update(edges.get(a, ()))

    roots = [i for i in order if i not in called]
    plan = TreePlan(roots=list(roots))
    queue: deque[str] = deque()
    for r in roots:
        plan.home[r] = None
        queue.append(r)

    while True:
        while queue:
            u = queue.popleft()
            for v in edges.get(u, ()):
                if v not in plan.home:
                    plan.home[v] = u
                    queue.append(v)
        left = [i for i in order if i not in plan.home]
        if not left:
            return plan
        seed = left[0]
        plan.unreached.append(seed)
        plan.home[seed] = None
        queue.append(seed)
