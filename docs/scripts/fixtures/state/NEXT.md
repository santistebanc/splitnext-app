# Slice 0002 — second fixture slice

**Tier** — core-value

## Goal

Prove the board renders a slice in flight.

## Before → After

| | Now | After |
| --- | --- | --- |
| Things | One | Two |

## Plan

1. Extend `L-add` to take two.

## Seams under test

| Seam | Behavior |
| --- | --- |
| `L-add` | Adds without mutating the input |

## Acceptance

- Run the fixture and see two things.

## Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-screen` | list empty | It says so |

## Out of scope

- Deleting a thing — parked
