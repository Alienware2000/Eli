# ELI — Yale, right now.

**Every week, Yale happens and you miss most of it. Eli notices for you.**

Eli is Yale's campus agent. A small team of Grok workers reads the panlists, the public events calendar, and the dining halls, and keeps one live map of campus. The board is already up when you arrive. Ask what's happening, what's free, what's still open, or what you're about to miss — Eli answers in one line, and the map fills in behind it.

Built in four hours at the y/CS × SpaceXSI Grokathon, November 17, 2026, Tsai CITY.

## The problem

Discovery at Yale is scattered. Events, parties, free food, research gigs, auditions, and application deadlines live in panlist emails nobody opens, on YaleConnect, and on posters. Every Yalie has a story about the thing they found out about the day after.

Student tools have fixed this one vertical at a time — courses, dining, the directory — by taking Yale's public data and giving it a better interface. Nothing does it across campus life, and nothing reads the panlists for you.

## The board

One surface. The map and the rail are the same cards. The rail filters are **All**, **Tonight**, **Free food**, **Open now**, and **Deadlines**.

| Lens | Card | Where it comes from |
|---|---|---|
| Events | `event` | **Vista** pulls the next 7 days from [events.yale.edu](https://events.yale.edu). **Scout** reads panlist mail for the things that never make the calendar. |
| Free food | `event` with `freeFood` | A mention of free food, pizza, boba, snacks, refreshments, or dinner provided. Those pins pulse amber. |
| Dining | `food` | **Chef** reads Yale Hospitality on Nutrislice: which halls are inside a meal window, and what's on tonight's dinner line. Open halls glow. |
| Deadlines | `opp` | The same panlist pass — research gigs, auditions, club applications, anything with a close date. |
| Pulse | `pulse` | Eli's own web search, limited to yale.edu, events.yale.edu, yaleconnect.yale.edu, and yaledailynews.com, plus X search. Citations stay on the card. |
| A plan | `plan` | A composed evening: timed steps, each with a place. |

A **Heads up** card sits above the rail and is written from the board itself: tonight's event, the deadline closing soonest, and the nearest free food. It updates as cards arrive.

The map is MapLibre, pitched over central campus, with college names and a "you" pin. Cards share a venue key with `data/venues.json`, so a buttery, a college, and a calendar pin land on the same building. Happening-now pins glow, ended pins fade, and free food stays amber. A popup includes the walk in minutes. Select a pin or a card and the other follows. Open a card and the receipt is the original panlist text, or the event or citation URL.

Under the map, a ticker names the worker and the call as it happens: Scout, Vista, Chef, Eli. Click it for the work log. The header counts emails on disk, the last calendar sweep, and open halls. The chips under the bar come from the Heads-up card, the time of day, "What am I missing this week?", and "How do I…?".

On a fresh database the board opens with a walk-up set, so the map is already full. Ask a question and live cards land beside it. Panlist cards sort first.

## How it works

Eli is the coordinator. Scout, Vista, and Chef fetch. Grok decides who to call, and the only way onto the board is a strict card schema.

```
you ──▶ chat dock
          │
          ▼
    /api/chat ──▶ Grok 4.7  (xAI Responses API)
          │         ├─ web_search   four Yale domains
          │         ├─ x_search
          │         ├─ read_inbox()   Scout   emails/*.eml, .txt, .html
          │         ├─ get_events()   Vista   events.yale.edu
          │         └─ get_dining()   Chef    Nutrislice
          ▼
    render_cards()  — five card types, extra fields rejected
          ▼
    SQLite ──▶ /api/board and /api/activity, polled every 2 seconds
          ▼
    map + rail + ticker
```

The loop runs for up to six rounds. Cards that miss the schema are dropped. A panlist card's source has to name the file and the subject, and opening it loads that email. A calendar, dining, or news card opens its URL. Tool calls are logged and streamed on the ticker as named workers ("Scout: 12 emails from this week's panlists", "Chef: 6 halls open now").

Stack: Next.js, TypeScript, Tailwind, MapLibre GL, SQLite (`better-sqlite3`), xAI Responses API (`grok-4.7`). Built with Cursor, running Grok.

## Running it

```bash
npm install
echo "XAI_API_KEY=your-key" > .env.local
cp emails/samples/*.txt emails/
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Scout reads `.eml`, `.txt`, and `.html` files in the top of `emails/` (up to 40). The committed examples live in `emails/samples/` and stay there until you copy them up. Real panlist exports dropped in `emails/` are gitignored. The samples are invented notes in the shape of a Yale panlist: a free-food night, a research-assistant deadline, and a club application deadline.

`package.json` also has `build`, `start`, and `lint`. The demo loop is `npm run dev`.

## What's next

- **Your inbox, with your permission.** The panlists you already subscribe to describe your campus life better than a profile form. Next is reading them as you, so "what am I missing" means missing for you.
- **A morning note.** Tonight's thing you'd care about, the deadline sneaking up, and where the free food is.
- **Eli on other surfaces.** A Grok Bot you can text from your phone, posting onto this same board, and a spotlight-bar extension in the BetterCampus vein.

## Credits

- The pattern of named bots operating one live surface is inspired by [Hyperpolymath](https://github.com/filippo-fonseca/hyperpolymath-v3) by Filippo Fonseca.
- Data: Yale's public events calendar (Localist, at events.yale.edu), Yale Hospitality menus (Nutrislice), and the panlists of Yale's student organizations.
- Built by David Antwi (Yale EECS '28), also a developer on YaleMeals via the Yale Computer Society.
