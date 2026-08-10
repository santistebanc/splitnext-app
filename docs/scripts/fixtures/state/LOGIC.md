# Logic map

## UI

| Id | Name | Kind | Where | What it is for |
| --- | --- | --- | --- | --- |
| L-screen | `HomeScreen` | Screen | `src/home.ts` | The only screen: lists things and adds one. |

## Device

| Id | Name | Kind | Where | What it is for |
| --- | --- | --- | --- | --- |
| L-add | `addThing` | Pure | `src/home.ts` | Adds a thing to the list and returns the new list. |
| L-store | `saveThings` | State | `src/store.ts` | Keeps the list across restarts. |
