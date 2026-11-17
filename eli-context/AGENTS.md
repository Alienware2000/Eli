# Working rules for the coding agent (Cursor / Grok Bot)

You are building ELI at a 4-hour hackathon (hard submission 8:00pm). Read `ELI_CONTEXT.md` (the product: what, why, design, schedule) and `DATA_SOURCES.md` (verified APIs) before writing any code. `venues.json` is ready data — copy it into the project.

## Non-negotiables
1. **Follow the build order in ELI_CONTEXT.md section 8 exactly.** Do not reorder, do not start a later layer before the current one runs end to end.
2. **One feature at a time.** Finish, run it, see it work in the browser, commit, then next.
3. **Never refactor working code.** Ugly and working beats clean and broken at every point tonight. No renames, no "cleanup", no abstraction passes.
4. **If something fights for 20 minutes, stop and say so** instead of digging. There is a planned fallback for every layer; ask which to take.
5. **No new dependencies beyond:** next, react, tailwind, leaflet + react-leaflet (or mapbox-gl if told), better-sqlite3, the xAI SDK (or plain fetch to https://api.x.ai). Nothing else without asking.
6. **No auth, no accounts, no persistence beyond the local SQLite file, no mobile layout, no settings pages.** These are explicitly cut.
7. After each layer lands, run demo query 1 ("What's happening on campus tonight?") as a smoke test. If it broke, fix before building anything new.

## Environment
- `XAI_API_KEY` in `.env.local`. Never print or commit it.
- Model: latest grok-4 family alias via the Responses API, with server-side tools `web_search` (allowed sites per DATA_SOURCES.md §5) and `x_search` enabled, plus the custom function tools.
- Dev loop: `npm run dev`, localhost demo is the target; deploy only if everything else is done.

## Code style for this project
- TypeScript, App Router, server routes under `app/api/`.
- All card/tool types in one file: `lib/types.ts`. The four card schemas in ELI_CONTEXT.md section 4 are the contract — agent output must validate against them; drop malformed cards, never crash on them.
- Wrap every external fetch (events, dining) in try/catch with a 5s timeout; on failure return `[]` and log to the activity table — the UI must never white-screen because an API hiccuped.
- Seed the board: on first run, insert 4–6 fake-but-plausible cards so the UI is never empty during development or at demo start.

## Kickoff prompt (paste this first)
"Read ELI_CONTEXT.md, DATA_SOURCES.md, and AGENTS.md in full. Then scaffold the app per ELI_CONTEXT section 3: Next.js + TypeScript + Tailwind, the map hero using venues.json pins, the card rail with seeded fake cards, the chat dock, and the activity ticker. Stop after the scaffold runs and show me before wiring Grok."
