# Overview

Last updated: slice 0001

## Direction

**Destination** — A list of things, for testing the board.

**Users** — The board's own tests.

**Constraints**

- Fixture only

**Non-goals** — Being a real app

## Capabilities

- Add a thing — shipped in [slice 0001](slices/0001-fixture.md)

## Stack

- Runtime — TypeScript — because the fixture parses like the real thing

## Data model

**Thing** — an id and a label

## Routes / surfaces

| Route | What it does | Shipped in |
| --- | --- | --- |
| `/` | The home screen | slice 0001 |

## Seams

- `addThing` — `src/home.ts` — unit
