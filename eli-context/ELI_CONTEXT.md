# ELI — Build Context Doc
Grokathon, Tsai CITY. Build window 5:00–8:00pm. Awards 8:45pm.
This doc is the single source of truth. When in doubt, do the simpler thing and protect the demo.

## 1. What Eli is

**Eli is Yale's agent.** The problem: discovery at Yale is broken — every week hundreds of things happen (events, parties, free food, research gigs, auditions, application deadlines) scattered across 40 panlist emails, YaleConnect, and posters, and students miss almost all of it. Eli is the campus's awareness layer: one agent that reads the event feeds, the panlist emails, the posts, and keeps one living picture of Yale that everyone can see. Pitch line: "Every week, Yale happens and you miss most of it. Eli notices for you."

Five lenses, all from the same tools: what's happening (events), what's free (food), what's open (dining), what's closing (opportunities/deadlines), what people are talking about (pulse). Plus wayfinding as flavor, not a feature: "where do I even register for clubs?", "where do I find X?" — the lost-first-year questions — are answered by the existing Yale-restricted live search tool, zero extra build. The intelligence is composition — "I have 90 minutes near Science Hill before my 2:30" gets an answer no single app can give. The product is the agent; the surfaces are just ways to reach it: the live map on the big screen, the chat dock, Grok Bot on your phone or laptop, anywhere.

**The bigger vision (pitch close / Q&A):** y/cs has spent a decade building Yale's data layer (CourseTable, Yalies, YaleMeals — David built YaleMeals) and has no intelligence layer across it. Eli is that layer. Information at Yale is chained through panlists, upperclassmen, and buried pages; Eli collapses it to one question, the way AI-forward orgs now collapse their hierarchies into a prompt. Built so y/cs can keep building it — that's the "furthering the build" prize play.

## 1a. The four demo-defining moments (decided — rehearse these, add none)
1. **The ambient open.** Map is already full at walk-up: "Eli was working before we got up here."
2. **The map coming alive.** Prompt 1, then 3 seconds of silence while the ticker shows Scout/Vista/Chef and pins drop.
3. **The receipts click.** Click an opportunity card → the raw source panlist email appears. Proof it isn't hallucinated; the moment generic chatbots can't replicate. (Small build item: card click reveals source email/URL.)
4. **The phone moment** (only if MCP stretch passes its 7:15 go/no-go): text Eli in Grok Bot from the audience, card lands on the projector.

Positioning line for the pitch: "y/cs built Yale's data layer — CourseTable, Yalies, UMenus. Eli is the agent on top of all of it." Introduce it like a teammate, not a website.

Credit line, said on stage: architecture pattern (bots + MCP + live surface) inspired by Filippo's Hyperpolymath; Eli applies it to the shared campus instead of one person's life.

**Explicit non-goals tonight:** nothing about coursework, Canvas, psets, or grades (that lane belongs to Classmate). No login/auth of any kind. No accounts. No mobile layout. No persistence beyond the session DB. No voice.

## 2. Design language (this is how it does NOT look like Hyperpolymath)

- Hero surface: a LIVE MAP OF YALE (Leaflet or Mapbox, hardcoded `venues.json` with ~20 campus coordinates: residential colleges, Tsai CITY, SSS, Bass, dining halls). Events pin where they happen; dining halls glow when open; free food pins pulse amber. A card rail sits beside the map (cards are the same data, list form). Same pattern as TicketDodge's NYC map — proven muscle, budget 40 min. If the map fights past its budget, the card rail alone IS the fallback surface.
- Cards in the rail keep a pinned/poster feel — subtle rotation jitter, new cards animate in.
- Palette: Yale blue `#00356B` as the anchor, warm paper/cream background (`#F9F7F1`-ish), one accent (gold/amber) for "happening now" states. NOT a gray minimal productivity dashboard.
- Type: Fraunces for display/headers (free Google font, characterful, premium), Inter for body, a typewriter/mono accent (IBM Plex Mono or Special Elite) for the intro reveal and ticker.
- Intro moment: on load, "ELI" types itself out letter by letter in the typewriter face, then "Yale, right now." fades in beneath. 2 seconds, then the board. Cheap to build, sets tone for the demo's first breath.
- Logo: an ORIGINAL simple bulldog mark or crest-style "E". Do NOT use Yale's official Handsome Dan marks, logos, or wordmark assets — they're licensed. Original bulldog = fine; Yale's bulldog = not.
- Header: "ELI" wordmark + tagline "Yale, right now." + a live clock.
- Cards have slight rotation jitter (±0.5–1deg) and a pinned/poster feel — subtle, not kitsch. New cards animate in (fade + settle).
- A thin "agent activity" ticker strip (bottom or side): streams tool calls as they happen. Always on.
- **Bot roster framing (pure labels, zero architecture):** Eli is the coordinator; each tool is a named worker bot shown in the ticker — Scout (panlists/emails), Vista (events), Chef (dining), plus Eli itself for live search and composition. Ticker lines read "Scout: 14 events from this week's panlists", "Chef: 6 halls open now". This matches the Grok Bot idiom (small team of narrow, named bots under a coordinator) that this judging crowd knows.
- Demo opens with the board ALREADY populated: first line on stage is "Eli was working before we got up here." (Persistent agents, work that starts without a prompt.)

## 3. Architecture

```
Next.js (App Router, TypeScript, Tailwind)
├─ / ................ the Picture: live campus map (hero) + card rail + chat dock + activity ticker
├─ /api/chat ........ POST: runs the agent loop (xAI Responses API)
├─ /api/board ....... GET: current cards (client polls every 2s — no websockets)
├─ /api/cards ....... POST: insert card (used by agent AND by MCP layer)
└─ lib/
   ├─ grok.ts ....... xAI client, agent loop, tool dispatch
   ├─ tools.ts ...... custom function tools (events, dining)
   └─ db.ts ......... SQLite via better-sqlite3 (single file, zero config)
```

- **Model:** use the xAI Responses API with the latest grok-4 family alias. Enable server-side tools `web_search` and `x_search` (restrict web_search allowed sites to: yale.edu, yaledailynews.com, yaleconnect.yale.edu, plus whatever event domains we verify). Server-side tools are REQUIRED — they are the Grok-specific edge and return citations.
- **Agent loop:** user message → Grok with server-side tools + custom function tools → model may call tools multiple rounds → final answer MUST be structured JSON (see card schemas) → server writes cards to DB → client poll picks them up. Also stream a short one-line text summary to the chat dock.
- **Live feel without websockets:** 2-second polling of /api/board. Do not build SSE/websockets unless polling visibly fails.
- **Every tool call** gets logged to an `activity` table; the ticker polls it.

## 4. Card schemas (exactly five — do not invent more)

All cards: `{ id, type, title, ts, source, venue? }` plus type-specific fields — `venue` is a key into `venues.json`; a card with a venue also renders as a map pin. Agent returns an array of cards + a one-line `summary` string.

```ts
type EventCard = { type:"event", title, when, where, blurb, freeFood:boolean, link? }
type FoodCard  = { type:"food",  title, hall, when, items:string[] }           // dining
type PulseCard = { type:"pulse", title, text, citations:string[] }             // news/X findings
type PlanCard  = { type:"plan",  title, steps:{time,what,where}[] }            // composed itineraries
type OppCard   = { type:"opp",   title, org, deadline, blurb, link? }          // opportunities: research gigs, auditions, club apps, paid studies — extracted from the SAME panlist emails, no new tool
```

Render: `freeFood:true` events get the amber "FREE FOOD" pin badge. PlanCard renders as a timeline poster.

## 5. Tools

Custom function tools (keep each one dumb — fetch, map to JSON, return; all intelligence lives in the model):

1. `read_inbox()` — **the headline tool.** Reads the `emails/` folder: 20–30 real panlist/club emails exported pre-event (.eml or .txt). Returns raw subject+body text; Grok extracts events, deadlines, and free food into cards. No OAuth, no live mailbox — the corpus IS the demo ("this is a week of real panlist email"). Live inbox connection is roadmap, not tonight.
2. `get_events({ when })` — Yale events. Primary source: Yale's Localist calendar public API (calendar.yale.edu — verify exact endpoint pre-5pm; Localist instances expose `/api/2/events`). Fallback: YaleConnect public event pages via the server-side web_search instead. Mark `freeFood` by keyword match in description (free food, pizza, boba, snacks, refreshments, dinner provided).
3. `get_dining({ hall? })` — dining menus. Source: the API UMenus uses (find via YaleAPIs pre-5pm). Fallback: hardcode today's scraped menus into a JSON file — the demo only needs tonight.

Built-in server-side tools (no code needed): `web_search` (Yale-restricted), `x_search`.

**Stretch tool only if ahead at 7:00:** `get_shuttle()` — live Yale shuttle positions (TransLoc-style public transit API). Renders as a tiny live map card. Pure candy; first thing cut.

## 6. Stretch moment — pick ONE before 5pm, never both

Option A (recommended): the Grok Bot phone moment below — rehearsable, fails quietly.
Option B: authenticated browse — log into YaleConnect YOURSELF before the demo, then the agent browses the already-authenticated session and pulls one gated thing. NEVER type or hand over the NetID password on stage or to the model (Duo can re-prompt mid-demo; credential sharing is the one move this audience will wince at). Frame as "with your permission, on your machine."

## 6a. MCP layer (the "Grok Bot moment", Option A)

Goal: a bot living in Grok Bot can post to the board from a phone, and the card appears on the projector seconds later.

- Minimal MCP server exposing two tools: `post_card(card)` and `get_board()`, both thin wrappers over /api/cards and /api/board.
- Wire-up reference: Filippo's hyperpolymath-v3 repo includes his Grok Bot setup guide — follow it exactly, do not improvise.
- **Kill rule: 30 minutes.** If Grok Bot ↔ MCP is not round-tripping within 30 minutes of starting, cut it. The in-app agent already demos everything else. Roadmap-slide it instead.

## 7. Demo script (build ONLY what these three need)

1. "What's happening on campus tonight?" → read_inbox + events; pins land on the map, cards fill the rail. Say it plainly: "Eli went through this week's panlists and the event feeds." No slogans — the cards speak. (If live search surfaces this hackathon itself, point at it.)
2. "What am I missing this week?" → OppCards (deadlines, research gigs, auditions) + free-food pins pulse amber. The question every student has; the juniors in the room lean in here.
3. "I'm free Thursday 7 to 9 — plan my evening." → multi-tool: events + dining → PlanCard timeline assembles on screen.

If MCP layer survives: run query 2 from the phone via Grok Bot instead of the chat dock.

Close, two beats: (1) roadmap — "Next: connect your actual inbox, and agents that browse YaleConnect as you, with your permission." (2) ecosystem — "Eli is the surface; tools like Better Office Hours become bots on it. Every Yale system is one more tool."

## 8. Schedule and cut discipline

- 5:00–5:25 scaffold: Next.js app, map hero with venues.json pins + card rail shell with fake cards, chat dock. UI first so there is always something to show. Map gets a 40-min total budget across the night; past that, card rail becomes the surface.
- 5:25–6:00 agent loop + server-side search → PulseCards land on board end to end. **This is the survival line: reached = submittable project.**
- 6:00–6:30 `read_inbox` (easiest tool: local files) + EventCards + free-food badge. Headline feature live.
- 6:30–7:00 `get_events` and/or `get_dining` + PlanCard composition (demo query 3 working). If only one fits, pick dining — PlanCard needs it.
- 7:00–7:30 EITHER the MCP/Grok Bot layer OR polish — choose based on confidence, apply the 30-min kill rule.
- 7:30 hard feature freeze. Polish, seed the board, write the 90-second pitch.
- 7:40–7:55 rehearse all three demo queries twice, then submit. No code after 7:45.

Any single integration that fights for >20 minutes gets cut and the demo script shrinks around it. Fallback ladder: full Eli → Eli without MCP → Eli without dining (events + search only, still a real product).

## 9. Pre-5pm checklist (do in this order)

1. xAI API key from console.x.ai → run ONE Responses API call with `x_search` enabled, end to end. Hit any account/billing wall NOW, not at 5:15.
2. Export 20–30 recent panlist/club emails (download as .eml, or paste bodies into .txt files) into an `emails/` folder. Skim them once — nothing personal/sensitive goes on a projector. This is the headline tool's fuel.
3. Find and curl the Localist events endpoint on calendar.yale.edu. Save a sample response.
4. Find the dining API via YaleAPIs, curl it, save a sample. If it fights, scrape tonight's menus into `dining-fallback.json`.
5. Clone `filippo-fonseca/hyperpolymath-v3`, skim ONLY the Grok Bot setup guide and MCP wiring. 15 minutes max.
6. Confirm event rules: pre-collected data (emails, API samples) and this context doc OK, pre-written code presumably not.
7. `create-next-app` muscle memory check, Vercel login alive (deploy optional; localhost demo is fine).
