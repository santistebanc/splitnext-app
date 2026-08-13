#!/usr/bin/env python3
"""Audit docs/state/*.md against itself, against the code, and against git.

Run at slice close (`npm run audit`): it catches dangling ids, paths that
moved, symbols that no flow names, "Added" claims for things that already
existed, captures the board will silently drop, and flow clips left behind by
a change to the flow they document.

Exits non-zero when it finds anything, so CI and the close checklist can gate
on it rather than on someone reading the output.
"""
import importlib.util
import re
import subprocess
import sys
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
notes = []


def report(kind, msg):
    """A finding that fails the audit — the state files say something untrue."""
    problems.append((kind, msg))


def note(kind, msg):
    """Worth reading, not worth failing: history, or a shape nobody promised."""
    notes.append((kind, msg))


# 1. every id cited anywhere resolves
def cited(text, where):
    for ref in set(re.findall(r"\b([LF]-[\w-]+)\b", text)):
        if ref.startswith("L-") and ref not in by_id:
            report("dangling-id", f"{where} cites {ref} — not in LOGIC.md")
        if ref.startswith("F-") and ref not in flow_ids:
            report("dangling-id", f"{where} cites {ref} — not in FLOWS.md")


for f in [STATE / "FLOWS.md", STATE / "OVERVIEW.md"]:
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

# 6. an archive naming a piece the map no longer has
#
# An archive describes the app as it was, so a since-removed id is history
# rather than a mistake — printed, never fatal. It is still worth reading: a
# typo looks exactly the same, and this is the only place it would surface.
for arch in archives:
    for ref in sorted(set(re.findall(r"\b([LF]-[\w-]+)\b", arch.read_text()))):
        if ref.startswith("L-") and ref not in by_id:
            note("archive-history", f"{arch.name} names {ref}, which the map no longer has")
        if ref.startswith("F-") and ref not in flow_ids:
            note("archive-history", f"{arch.name} names {ref}, which the map no longer has")

# 7. symbols no flow names — a gap in FLOWS.md or a piece nothing needs
for e in rows:
    if not any(re.search(rf"\b{re.escape(e['id'])}\b", " ".join([f["trigger"], f["outcome"], *f["steps"]])) for f in flows):
        note("orphan", f'{e["id"]} ({e["name"]}) is named by no flow')

# 8. every capture an archive claims is on disk, under the name the board reads
for arch in archives:
    rep = g.parse_report(arch.read_text())
    for shot in (rep or {}).get("shots", []):
        name = re.sub(r"^shots/", "", shot["file"])
        if not (STATE / "shots" / name).exists():
            report("missing-shot", f'{arch.name} claims {shot["file"]} — not in docs/state/shots/')

# 9. NEXT.md slice number vs archives
nxt = g.parse_next((STATE / "NEXT.md").read_text())
nums = {re.match(r"(\d{4})", a.name).group(1) for a in archives}
newest = max(nums) if nums else ""
if nxt["number"] in nums:
    if nxt["number"] == newest:
        # the slice just closed and no next one has been picked yet
        note("slice-number", f'NEXT.md still describes slice {nxt["number"]}, which is closed')
    else:
        report("slice-number", f'NEXT.md is slice {nxt["number"]} but that slice is already archived')

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

# 11. flow clips that predate the flow they document
#
# A clip is the only non-prose record of what the app does, and a stale one is
# worse than a missing one: it plays confidently beside steps it no longer
# shows. Compare the last commit that touched the flow's own block in FLOWS.md
# against the last commit that touched its clip.
def last_commit(*paths):
    out = subprocess.run(
        ["git", "log", "-1", "--format=%ct", "--", *paths],
        cwd=ROOT, capture_output=True, text=True, check=False,
    ).stdout.strip()
    return int(out) if out.isdigit() else None


def flow_block_touched(fid):
    """Newest commit time across the lines of this flow's block in FLOWS.md."""
    text = (STATE / "FLOWS.md").read_text().splitlines()
    start = next((i for i, ln in enumerate(text, 1) if ln.startswith(f"## {fid} ")), None)
    if not start:
        return None
    end = next(
        (i for i, ln in enumerate(text[start:], start + 1) if ln.startswith("## F-")),
        len(text),
    )
    blame = subprocess.run(
        ["git", "blame", "-L", f"{start},{end}", "--line-porcelain", "--", "docs/state/FLOWS.md"],
        cwd=ROOT, capture_output=True, text=True, check=False,
    ).stdout
    times = [int(m) for m in re.findall(r"^committer-time (\d+)", blame, re.M)]
    return max(times) if times else None


unrecorded = set(
    re.findall(r"'(F-[\w-]+)':", (ROOT / "docs/scripts/capture-flows.mjs").read_text())
)
uncommitted = {
    ln[3:].strip()
    for ln in subprocess.run(
        ["git", "status", "--porcelain"], cwd=ROOT, capture_output=True, text=True, check=False
    ).stdout.splitlines()
}
for f in flows:
    clip = STATE / "shots" / "flows" / f'{f["id"]}.webm'
    if not clip.exists():
        if f["id"] not in unrecorded:
            report("missing-clip", f'{f["id"]} has no clip and capture-flows.mjs does not say why')
        continue
    rel_clip = str(clip.relative_to(ROOT))
    if rel_clip in uncommitted:
        continue  # just re-recorded, not yet committed — fresher than any commit
    flow_t, clip_t = flow_block_touched(f["id"]), last_commit(rel_clip)
    if flow_t and clip_t and flow_t > clip_t:
        report("stale-clip", f'{f["id"]}: FLOWS.md changed after {clip.name} was last recorded')

# 12. the driver and the map name the same flows
#
# capture-flows.mjs keeps its own list of flow ids — it has to, it drives them —
# so a flow renamed in FLOWS.md leaves a driver entry and a clip named after an
# id nothing else knows.
driver = ROOT / "docs/scripts/capture-flows.mjs"
driver_ids = set(re.findall(r"id: '(F-[\w-]+)'", driver.read_text())) | unrecorded
for fid in sorted(driver_ids - flow_ids):
    report("driver-drift", f"capture-flows.mjs drives {fid}, which FLOWS.md does not define")
for clip in sorted((STATE / "shots" / "flows").glob("*.webm")):
    if clip.stem not in flow_ids:
        report("orphan-clip", f"{clip.name} names {clip.stem}, which FLOWS.md does not define")

# 13. every archive's claimed tag exists, and lands on main
#
# The tag is cut on `main` *after* the squash merge (D-028), so an archive that
# ships inside the slice PR necessarily claims a tag that does not exist yet.
# On a branch that is a finding-in-waiting — a note. On `main`, it is a finding:
# the close is not done until the tag is.
_head_branch = subprocess.run(
    ["git", "rev-parse", "--abbrev-ref", "HEAD"],
    cwd=ROOT, capture_output=True, text=True, check=False,
).stdout.strip()
_on_main = _head_branch in ("main", "master")

for arch in archives:
    text = arch.read_text()
    m = re.search(r"\*\*Tag\*\*\s*—\s*`([^`]+)`", text)
    if not m:
        continue
    tag = m.group(1)
    if not re.match(r"^slice-\d{4}$", tag):
        continue  # 0001–0004 recorded a subject line instead
    exists = subprocess.run(
        ["git", "rev-parse", "-q", "--verify", f"refs/tags/{tag}"],
        cwd=ROOT, capture_output=True, text=True, check=False,
    ).returncode == 0
    if not exists:
        msg = f"{arch.name} claims tag {tag}, which does not exist"
        if _on_main:
            report("missing-tag", msg)
        else:
            note("missing-tag", msg + " (ok on a slice branch — tag after merge)")

# 14. one slice, one commit on main
#
# Squash-only enforces one commit per *pull request*, not per slice: a slice
# merged as three PRs is three commits, and `git revert <slice>` stops meaning
# anything. Nothing can fix that after the fact, so this is a note — but a
# loud one, because the rule reads as if the repo enforced it.
main_ref = next(
    (
        ref
        for ref in ("main", "origin/main")
        if subprocess.run(
            ["git", "rev-parse", "-q", "--verify", ref],
            cwd=ROOT, capture_output=True, check=False,
        ).returncode == 0
    ),
    None,
)
subjects = subprocess.run(
    ["git", "log", main_ref, "--format=%s"],
    cwd=ROOT, capture_output=True, text=True, check=False,
).stdout.splitlines() if main_ref else []
if not main_ref:
    note("no-main", "no main ref here, so the one-commit-per-slice check did not run")
counts = {}
for line in subjects:
    m = re.match(r"slice\((\d{4})\)", line.strip())
    if m:
        counts[m.group(1)] = counts.get(m.group(1), 0) + 1
for num, n in sorted(counts.items()):
    if n > 1:
        note("split-slice", f"slice {num} is {n} commits on main, not one")

# 15. OVERVIEW.md is the current-state doc, so its claims have to hold
ov_text = (STATE / "OVERVIEW.md").read_text()
for link in re.findall(r"\]\((slices/[\w.-]+\.md)\)", ov_text):
    if not (STATE / link).exists():
        report("dead-link", f"OVERVIEW.md links {link}, which is not in docs/state/slices/")
seams_block = re.search(r"\n## Seams\n(.*?)(?=\n## |\Z)", ov_text, re.S)
for ln in (seams_block.group(1).splitlines() if seams_block else []):
    for path in re.findall(r"`((?:src|app|docs|supabase|workers)/[\w./\[\]-]+)`", ln):
        if not (ROOT / path).exists():
            report("missing-path", f"OVERVIEW.md names seam file {path} — not on disk")
routes_block = re.search(r"\n## Routes / surfaces\n(.*?)(?=\n## |\Z)", ov_text, re.S)
listed = set(re.findall(r"^\| `([^`]+)`", routes_block.group(1) if routes_block else "", re.M))
on_disk = set()
for f in sorted((ROOT / "app").rglob("*.tsx")):
    rel = f.relative_to(ROOT / "app").with_suffix("")
    if rel.name.startswith(("_", "+")):
        continue
    route = "/" + str(rel).removesuffix("/index").removesuffix("index")
    on_disk.add(route.rstrip("/") or "/")
for route in sorted(on_disk - listed):
    note("route-drift", f"{route} is a route in app/ that OVERVIEW.md does not list")

# 16. an archive records that the review and the demo happened
#
# The Report block is the only trace of either. An empty Edge paths block says
# the self-review did not happen, which is information; a missing one says
# nobody wrote the section at all. 0001–0004 predate the template.
for arch in archives:
    num = re.match(r"(\d{4})", arch.name).group(1)
    if num < "0005":
        continue
    text = arch.read_text()
    for needed in ["### Headline", "### Edge paths", "### Shots"]:
        if needed not in text:
            report("thin-archive", f"{arch.name} has no {needed} block")
    if num >= "0010" and "### Review" not in text:
        report("thin-archive", f"{arch.name} has no ### Review block — /code-review left no trace")

# 17. Delivered parking that has outstayed its welcome
newest_num = max((re.match(r"(\d{4})", a.name).group(1) for a in archives), default="0000")
delivered = re.search(r"\n## Delivered\n(.*?)(?=\n## |\Z)", (STATE / "PARKING.md").read_text(), re.S)
for ln in (delivered.group(1).splitlines() if delivered else []):
    m = re.search(r"slice (\d{4})", ln)
    if m and int(newest_num) - int(m.group(1)) > 2:
        label = re.search(r"\*\*(.+?)\*\*", ln)
        note("stale-delivered", f'"{label.group(1) if label else ln.strip()[:40]}" was delivered in slice {m.group(1)} — prune it')


def dump(items, heading):
    if not items:
        return
    print(f"\n# {heading}")
    for kind in sorted({k for k, _ in items}):
        print(f"\n## {kind}")
        for k, msg in items:
            if k == kind:
                print(" -", msg)


dump(problems, "findings")
dump(notes, "notes")
print(f"\n{len(problems)} findings, {len(notes)} notes")
sys.exit(1 if problems else 0)
