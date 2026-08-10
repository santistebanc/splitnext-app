# Flows

## F-add — Add a thing

**Trigger** — On the home screen, the person taps **Add**.  
**Outcome** — The list has one more thing, and it survives a restart.

1. `L-screen` calls `L-add` with what was typed.
2. `L-store` writes the new list to disk.
