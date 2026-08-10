# Slice 0001 — fixture

**Tier** — core-value · **Closed** — 2026-01-01 · **Tag** — `slice-0001`

## What shipped

A list you can add to.

## Report

### Headline
The list exists.

### Highlights
- One screen
- One pure rule

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Things | None | A list |

### Surfaces touched

- **Client** — `src/home.ts`

### Decisions this slice

- D-001 — Things are strings

### Logic delta

- **Added** — `L-screen` (the only screen) · `L-add`

### Flow delta

- **Added** — `F-add`

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-screen` | list empty | It says so |

### Review

- Nothing found — the diff is two functions

### Shots

- `0001-home.png` — the home screen

### Diff pulse

`+40 / −0 · 2 files`
