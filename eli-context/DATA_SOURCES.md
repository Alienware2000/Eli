# ELI — Verified Data Sources
All three verified live in-browser on Nov 17, 2026, ~4:25pm. All public, no keys, no login.

## 1. Yale events (Localist/Concept3D) — VERIFIED ✅
Base: `https://events.yale.edu/api/2/events`
(calendar.yale.edu redirects here. Public JSON, no auth.)

- Params that work: `?days=2&pp=5` (days ahead, per-page). Also standard Localist params: `start=YYYY-MM-DD`, `end=`, `pp=` up to 100.
- Response shape (seen live): `{ events: [ { event: { id, title, url, description_text, location_name, address, ticket_cost, photo_url, geo: { latitude, longitude }, event_instances: [{ event_instance: { start, end } }] } } ] }`
- **Events carry their own lat/long → map pins come free from this API.** venues.json only needed for emails/dining.
- Free-food detection: keyword match on `description_text`.

## 2. YaleConnect events — VERIFIED ✅ (public, no sign-in)
`https://yaleconnect.yale.edu/events` — 2,559 events listed publicly, with filters, a FREE tag, and Subscribe/Sync buttons (ICS feed available via Subscribe).
- Tonight's use: secondary. Either grab the ICS from the Subscribe button, or let Grok's server-side web_search (allowed site: yaleconnect.yale.edu) read it. Do NOT write a scraper for this page; events.yale.edu is the primary structured source.

## 3. Dining menus (Nutrislice) — VERIFIED ✅
Yale Hospitality runs on Nutrislice, slug **`yalehospitality`** (not yaleuniversity — that subdomain is dead).

- Schools list: `https://yalehospitality.api.nutrislice.com/menu/api/schools/?format=json`
  Returns every dining hall with: slug (e.g. `benjamin-franklin-college`, `berkeley-college`, `timothy-dwight-college`), meal hours per day (breakfast/lunch/dinner start/end), lat/long, operating status.
- Menu for a hall+meal+date: template seen in the schools response:
  `https://yalehospitality.api.nutrislice.com/menu/api/weeks/school/{slug}/menu-type/{menu-type}/date/{year}/{month}/{day}/?format=json` (menu types: breakfast / lunch / dinner — confirm exact slugs from each school's `active_menu_types`)
- Human-facing equivalent (for eyeballing): `https://yalehospitality.nutrislice.com/menu/timothy-dwight-college`
- **This API also gives hall open/closed hours and coordinates → "dining halls glow when open" is free.**

## 4. Panlist emails — manual export (headline tool fuel)
No API tonight by design. Export 20–30 recent panlist/club emails as .eml or paste bodies into .txt → `emails/` folder. Skim: nothing personal goes on a projector.

## 5. Grok server-side search — built-in
`web_search` restricted to: yale.edu, events.yale.edu, yaleconnect.yale.edu, yaledailynews.com. Plus `x_search`. No code, returns citations.

## Cut from tonight (dead ends found)
- Official Yale Portal APIs (developers.yale.edu: Buildings, Courses): real but need NetID registration + API key per app. Not worth it tonight; the sources above cover the demo.
- Old yaledining.org API: superseded by Nutrislice.

## Tool mapping
- `get_events` → events.yale.edu API (primary) 
- `get_dining` → Nutrislice schools + menu endpoints
- `read_inbox` → local emails/ folder
- live search → built-in, Yale-restricted
