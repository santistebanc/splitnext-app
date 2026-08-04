# Decisions

| Id | Decision | Made in | Why |
| --- | --- | --- | --- |
| D-001 | Use remote Supabase project `splitnext-v3` (`ycpkguwfxlhpovnsuujr`, eu-central-1); do not reuse legacy `splitnext` | bootstrap | Fresh empty project matching locked architecture; old project has incompatible schema/functions |
| D-002 | Store access tokens (and device_user_id) in `expo-secure-store` | bootstrap | Long-lived capability secrets; OS keychain/keystore over plain KV |
| D-003 | Dev/demo on physical phone via Expo Go | bootstrap | Real mobile path from WSL; web SQLite is alpha; Expo Go cannot do HTTPS app links (invites later need a dev build) |
