# Overview

Last updated: bootstrap (pre-slice 0001)

## Direction

**Destination** — A mobile app for splitting shared costs among a small group of friends: groups, members, expenses, derived balances, and settle-up suggestions. Records and suggests; never moves money.

**Users** — People on a trip or shared activity who need a running tally of who paid and who owes whom. Members are name-slots, not login identities. Someone can be on the ledger without installing the app.

**Constraints** —
- No user accounts (capability tokens prove access)
- Local-first / full offline, entity-level merge sync
- Stack: Expo React Native, Expo Router, Legend State, expo-sqlite, Supabase Postgres + Edge Functions + Realtime (wake-only)
- Remote Supabase project `splitnext-v3` (`ycpkguwfxlhpovnsuujr`, eu-central-1)
- Access tokens in `expo-secure-store`
- Dev/demo: physical phone + Expo Go
- Money as integer cents; version (not timestamps) for conflicts; soft-delete only
- Device floor iOS 16+ / Android 12+; English-only; light-only UI
- Clients never talk to Postgres; deny-all RLS; Edge Functions use service role after capability hash-check

**Non-goals** — User accounts / OAuth, payment rails, contact import / social graphs, accounting / OCR / budgets / recurring bills, behavioural analytics, push notifications, marketing site, OTA updates, full CRDT sync frameworks, dedicated sync platforms (ElectricSQL, PowerSync, Replicache), group-wide invite UI (MVP), close/reopen UI (MVP)

## Capabilities

<!-- nothing shipped yet -->

- *(none — implementation has not started)*

## Stack

- Client — Expo React Native + Expo Router — mobile-first; web secondary
- UI state — Legend State (`useValue`, per-group observable) — UI source of truth
- Local durability — `expo-sqlite` via Legend `observablePersistSqlite` — write-through persist
- Secrets — `expo-secure-store` — per-group access tokens + device_user_id
- Server DB — Supabase Postgres — versioned merge entities
- Server API — Supabase Edge Functions — sole entry point (merge / fetch / join / rt-jwt)
- Wake channel — Supabase Realtime private channel — signal only, no ledger payloads
- Hosting — remote project `splitnext-v3` — D-001

## Data model

<!-- empty until slice 0001 -->

*(no entities in code yet)*

## Routes / surfaces

| Route | What it does | Shipped in |
| --- | --- | --- |
| — | — | — |

## Seams

<!-- agreed at first slice -->

*(none yet)*
