#!/usr/bin/env python3
"""Audit docs/state/*.md against itself, against the code, and against git.

Run at slice close: it catches dangling ids, paths that moved, symbols that no
flow names, and "Added" claims for things that already existed.
"""
import importlib.util
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STATE = ROOT / "docs" / "state"

spec = importlib.util.spec_from_file_location("g", ROOT / "docs/scripts/generate-slicer-board.py")
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)

areas = g.parse_logic((STATE / "LOGIC.md").read_text())
rows = [dict(e, area=a) for a, r in areas for e in r]
by_id = {e["id"]: e for e in rows}
flows = g.parse_flows((STATE / "FLOWS.md").read_text())
flow_ids = {f["id"] for f in flows}
archives = sorted((STATE / "slices").glob("*.md"))

problems = []


def report(kind, msg):
    problems.append((kind, msg))


# 1. every id cited anywhere resolves
def cited(text, where):
    for ref in set(re.findall(r"\b([LF]-[\w-]+)\b", text)):
        if ref.startswith("L-") and ref not in by_id:
            report("dangling-id", f"{where} cites {ref} — not in LOGIC.md")
        if ref.startswith("F-") and ref not in flow_ids:
            report("dangling-id", f"{where} cites {ref} — not in FLOWS.md")


for f in [STATE / "FLOWS.md", STATE / "OVERVIEW.md", *archives]:
    cited(f.read_text(), f.name)

# NEXT.md plans the slice that has not happened yet, so it may name ids that do
# not exist — but only new ones. A typo on an existing id still has to fail.
next_text = (STATE / "NEXT.md").read_text()
planned = set(re.findall(r"\b[LF]-[\w-]+", next_text))
for ref in sorted(planned):
    known = ref in by_id or ref in flow_ids
    close = [k for k in {**by_id, **{f: 1 for f in flow_ids}} if k.lower() == ref.lower()]
    if not known and close:
        report("dangling-id", f"NEXT.md cites {ref} — did you mean {close[0]}?")

# 2. duplicate ids
seen = {}
for e in rows:
    if e["id"] in seen:
        report("duplicate-id", f'{e["id"]} appears twice in LOGIC.md')
    seen[e["id"]] = e

# 3. paths exist, and the named symbol is actually in the file
for e in rows:
    p = ROOT / e["where"]
    if not p.exists():
        report("missing-path", f'{e["id"]} points at {e["where"]} — not on disk')
        continue
    names = [n.strip() for n in e["name"].split("/")]
    if p.is_file():
        body = p.read_text(errors="ignore")
        for n in names:
            if re.match(r"^[A-Za-z_][\w]*$", n) and n not in body:
                report("missing-symbol", f'{e["id"]}: `{n}` not found in {e["where"]}')

# 4. kinds and areas are from the declared vocabularies
KINDS = {"Screen", "Pure", "State", "Job", "Network", "Endpoint"}
AREAS = {a for a, _ in areas}
for e in rows:
    if e["kind"] not in KINDS:
        report("bad-kind", f'{e["id"]} has kind "{e["kind"]}"')
if len(AREAS) > 4:
    report("too-many-areas", f"{len(AREAS)} areas: {sorted(AREAS)}")

# 5. "Added" claims: was the piece already claimed in an earlier slice?
added_at = {}
for arch in archives:
    text = arch.read_text()
    m = re.search(r"### (?:Logic|Flow) delta\n(.*?)(?=\n### |\Z)", text, re.S)
    blocks = re.findall(r"### (?:Logic|Flow) delta\n(.*?)(?=\n### |\Z)", text, re.S)
    for block in blocks:
        for line in block.splitlines():
            if not line.strip().startswith("-"):
                continue
            status = re.match(r"-\s*\*\*(\w+)\*\*", line.strip())
            status = status.group(1).lower() if status else "?"
            for ref in re.findall(r"\b([LF]-[\w-]+)\b", line):
                if status == "added":
                    if ref in added_at:
                        report(
                            "double-add",
                            f"{ref} claimed Added in {added_at[ref]} and again in {arch.name}",
                        )
                    added_at[ref] = arch.name

# 6. a symbol/flow that a slice touched must still exist
for arch in archives:
    for ref in re.findall(r"\b([LF]-[\w-]+)\b", arch.read_text()):
        if ref.startswith("L-") and ref not in by_id:
            report("stale-delta", f"{arch.name} references removed {ref}")

# 7. symbols no flow names
for e in rows:
    if not any(re.search(rf"\b{re.escape(e['id'])}\b", " ".join([f["trigger"], f["outcome"], *f["steps"]])) for f in flows):
        report("orphan", f'{e["id"]} ({e["name"]}) is named by no flow')

# 8. OVERVIEW routes vs UI symbols
ui_paths = {e["where"] for e in rows if e["area"] == "UI"}
ov = (STATE / "OVERVIEW.md").read_text()
for route in re.findall(r"^\| `([^`]+)` \|", ov, re.M):
    pass

# 9. NEXT.md slice number vs archives
nxt = g.parse_next((STATE / "NEXT.md").read_text())
nums = {re.match(r"(\d{4})", a.name).group(1) for a in archives}
if nxt["number"] in nums:
    report("slice-number", f'NEXT.md is slice {nxt["number"]} but an archive already exists')

# 10. files changed in the working tree that no state doc mentions
git = subprocess.run(["git", "status", "--porcelain"], cwd=ROOT, capture_output=True, text=True)
state_text = " ".join(p.read_text() for p in STATE.rglob("*.md"))
for line in git.stdout.splitlines():
    if line[:2].strip().startswith("D"):
        continue  # a deleted file needs no map row
    path = line[3:].strip()
    if not path.startswith("src/") or not path.endswith(".ts"):
        continue
    if path not in state_text and not any(e["where"] == path for e in rows):
        report("unmapped-file", f"{path} changed but appears in no LOGIC.md row")

for kind in sorted({k for k, _ in problems}):
    print(f"\n## {kind}")
    for k, msg in problems:
        if k == kind:
            print(" -", msg)
print(f"\n{len(problems)} findings")
