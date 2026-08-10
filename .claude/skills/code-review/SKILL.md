---
name: code-review
description: Review a slice's diff on three axes — Invariants (does it break a rule this repo says can never break?), Spec (does it do what NEXT.md said?) and Standards (is it written the way this repo writes code?). Runs the three as parallel sub-agents and reports them side by side. Use at Phase 6 of a slice, or when the user asks to review a branch, a PR, or work in progress.
---

Three-axis review of a slice's diff. This is the project's own copy, adapted to
how this repo works — it beats any generic review skill of the same name, and
Phase 6 of `/slicer` means this one.

- **Invariants** — does the change break a rule `AGENTS.md` says is not negotiable?
- **Spec** — does it do what `docs/state/NEXT.md` said this slice would do, and only that?
- **Standards** — is it written the way this repo writes code?

Invariants come first because they are the axis with no judgement in it: money
in floats or a client talking to Postgres is wrong regardless of how clean the
code is or how well it matches the plan.

## Process

### 1. Pin the fixed point

**Default to `main`** — a slice is a branch off `main`, so `main...HEAD` is the slice. Take whatever the user said instead if they said one (a SHA, `slice-0007`, `HEAD~5`).

Capture the diff command once: `git diff <fixed-point>...HEAD` (three-dot, so the comparison is against the merge-base). Also note the list of commits via `git log <fixed-point>..HEAD --oneline`.

Before going further, confirm the fixed point resolves (`git rev-parse <fixed-point>`) and the diff is non-empty. A bad ref or empty diff should fail here — not inside two parallel sub-agents.

### 2. The spec is `docs/state/NEXT.md`

A slice's spec is written before the code and lives at `docs/state/NEXT.md`: goal, Before → After, plan, seams under test, acceptance, and — load-bearing for this review — **Out of scope**. Read it whole.

Two cases where it is not the spec: the user passed a path to something else, or the branch is not a slice (`NEXT.md` names a different number, or no slice at all). Then use what the user passed, or say "no spec available" and skip that axis. Do not go hunting for issues or PRDs; this repo does not keep the spec in a tracker.

If the slice is closed, its archive `docs/state/slices/NNNN-*.md` holds the same plan plus what actually shipped — use it alongside `NEXT.md`.

### 3. Identify the invariants and the standards

**Invariants** — the "not negotiable" list in `AGENTS.md`, plus `docs/state/DECISIONS.md`. A decision is not a suggestion: contradicting a `D-NNN` is allowed only by adding a new one that says so. Read both files; quote the rule you are citing.

**Standards** — this repo documents how it writes code in `AGENTS.md` (the entry point) and in the slicer's quality bar at `.claude/skills/slicer/SKILL.md`: smallest vertical path, deep modules with small interfaces over fat orchestrators, seams first with tests on them, no demo-only hacks, no god-files. `docs/state/OVERVIEW.md` lists the agreed seams — a new seam where an existing one would have done is a finding.

On top of whatever the repo documents, the Standards axis always carries the **smell baseline** below — a fixed set of Fowler code smells (_Refactoring_, ch.3) that applies even when a repo documents nothing. Two rules bind it:

- **The repo overrides.** A documented repo standard always wins; where it endorses something the baseline would flag, suppress the smell.
- **Always a judgement call.** Each smell is a labelled heuristic ("possible Feature Envy"), never a hard violation — and, like any standard here, skip anything tooling already enforces.

Each smell reads *what it is* → *how to fix*; match it against the diff:

- **Mysterious Name** — a function, variable, or type whose name doesn't reveal what it does or holds. → rename it; if no honest name comes, the design's murky.
- **Duplicated Code** — the same logic shape appears in more than one hunk or file in the change. → extract the shared shape, call it from both.
- **Feature Envy** — a method that reaches into another object's data more than its own. → move the method onto the data it envies.
- **Data Clumps** — the same few fields or params keep travelling together (a type wanting to be born). → bundle them into one type, pass that.
- **Primitive Obsession** — a primitive or string standing in for a domain concept that deserves its own type. → give the concept its own small type.
- **Repeated Switches** — the same `switch`/`if`-cascade on the same type recurs across the change. → replace with polymorphism, or one map both sites share.
- **Shotgun Surgery** — one logical change forces scattered edits across many files in the diff. → gather what changes together into one module.
- **Divergent Change** — one file or module is edited for several unrelated reasons. → split so each module changes for one reason.
- **Speculative Generality** — abstraction, parameters, or hooks added for needs the spec doesn't have. → delete it; inline back until a real need shows.
- **Message Chains** — long `a.b().c().d()` navigation the caller shouldn't depend on. → hide the walk behind one method on the first object.
- **Middle Man** — a class or function that mostly just delegates onward. → cut it, call the real target direct.
- **Refused Bequest** — a subclass or implementer that ignores or overrides most of what it inherits. → drop the inheritance, use composition.

### 4. Spawn the sub-agents in parallel

Send a single message with three `Agent` tool calls. Use the `general-purpose` subagent for each.

**Invariants sub-agent prompt** — include:

- The full diff command and commit list.
- The invariants list from `AGENTS.md` and the decisions table from `docs/state/DECISIONS.md`, pasted in full — the sub-agent has no other access to them.
- The brief: "Report every place the diff breaks one of these rules, or silently reverses a `D-NNN` without adding a new decision. Quote the rule and the hunk. These are not judgement calls: report a violation as a violation. If a change contradicts a decision *deliberately*, say so and name the decision it needs. Under 300 words."

**Standards sub-agent prompt** — include:

- The full diff command and commit list.
- The list of standards-source files you found in step 3, **plus the smell baseline from step 3** pasted in full — the sub-agent has no other access to it.
- The brief: "Report — per file/hunk where relevant — (a) every place the diff violates a documented standard or the quality bar: cite it (file + the rule); and (b) any baseline smell you spot: name it and quote the hunk. Distinguish hard violations from judgement calls — documented-standard breaches can be hard, but baseline smells are always judgement calls, and a documented repo standard overrides the baseline. Skip anything tooling enforces. Under 400 words."

**Spec sub-agent prompt** — include:

- The diff command and commit list.
- The path or fetched contents of the spec.
- The brief: "Report: (a) requirements the spec asked for that are missing or partial — including seams listed under *Seams under test* that have no test; (b) behaviour in the diff that wasn't asked for, and in particular **anything the spec's Out of scope list names** — that list is a promise, not a preference; (c) requirements that look implemented but where the implementation looks wrong. Quote the spec line for each finding. Under 400 words."

If the spec is missing, skip the Spec sub-agent and note this in the final report.

### 5. Aggregate

Present the three reports under `## Invariants`, `## Spec` and `## Standards`, in that order, verbatim or lightly cleaned. Do **not** merge or rerank findings across axes — they are deliberately separate (see _Why three axes_).

End with a one-line summary: total findings per axis, and the worst issue _within each axis_ (if any). Don't pick a single winner across axes — that's the reranking the separation exists to prevent.

### 6. Write it down

Phase 6 of a slice puts the outcome in the archive's `### Review` block: one bullet per finding, what you did about it, and the ones you accepted with the reason. A clean review gets one bullet saying so. An unwritten review is indistinguishable from a skipped one — which is why the block exists (D-044).

## Why three axes

A change can pass one axis and fail another:

- Code that follows every standard but implements the wrong thing → **Standards pass, Spec fail.**
- Code that does exactly what the plan asked but breaks the project's conventions → **Spec pass, Standards fail.**
- Code that is clean, matches the plan, and stores money in a float → **both pass, Invariants fail.** This is the axis worth spending a whole sub-agent on: it is rare, it is fatal, and it is exactly what a reviewer reading for style will read straight past.

Reporting them separately stops one axis from masking another.
