# ELI — the intelligence layer for Yale

**Yale has a decade of data infrastructure. What's missing is intelligence. Eli is that layer.**

> 🎥 **[Demo video](https://drive.google.com/drive/folders/1ENmrt1szIr57BmfmQYwb4SDtri4k8Jf8)** · Built in 4 hours with Grok at the y/CS × SpaceXSI Grokathon · Nov 17, 2026, Tsai CITY

<img width="1498" height="793" alt="image" src="https://github.com/user-attachments/assets/7c27ccd6-b830-426d-81b3-f7559189e3eb" />


## The thesis

Yale is one of the most instrumented campuses anywhere: official APIs for events and dining, and a decade of student-built tools organizing the rest — courses, people, meals, degrees — one vertical at a time.

But all of it is data you consult. Nothing reads it for you, and nothing reasons across it. A question as simple as **"what am I missing this week?"** has no home, because the answer lives across an events feed, fifteen dining halls, and forty unread club emails at once.

Every layer of the stack exists except the top one. Eli is the top: **one agent with eyes on every feed.**

## The proof: campus life

We pointed the layer at the problem every Yalie feels daily. Events, free food, research gigs, and deadlines are scattered across club mailing-list emails, YaleConnect, and posters — and mostly missed.

Eli reads it all and keeps one living picture of Yale:

| Lens | Question | Source |
|---|---|---|
| **Events** | What's happening tonight? | events.yale.edu + club emails |
| **Free food** | Where's free food right now? | Email extraction |
| **Dining** | What's open, what's for dinner? | Yale Hospitality (Nutrislice) |
| **Opportunities** | What's closing — gigs, auditions, apps? | Email extraction |
| **Pulse** | What's campus talking about? | Grok's X + web search, Yale-pinned |

The surface is a live 3D map of campus: pins brighten as events approach, open dining halls glow, free food pulses amber, and a **Heads up** brief composes itself from whatever matters most. The board is full before you ask — chat is just your lens on it.

## Built on Grok

```
you ──▶ command bar / suggestion chips
            │
            ▼
      /api/chat ──▶ Grok (xAI Responses API)
            │         ├─ web_search · x_search (server-side, Yale-pinned)
            │         ├─ read_inbox()  ← org emails      [Scout]
            │         ├─ get_events()  ← events.yale.edu [Vista]
            │         └─ get_dining()  ← Nutrislice      [Chef]
            ▼
      render_cards() — strict JSON schema, 5 card types
            ▼
      SQLite ──▶ live 3D map + card rail + activity ticker
```

- **Grok is the brain.** Every card and every extraction is Grok doing agentic tool-calling; its built-in server-side X and web search is why this took four hours, not four weeks.
- **Observability is first-class.** Every tool call is logged and streamed. Each answer comes with a receipt — *"✓ Campus calendar — 30 tonight · ✓ Your emails — 2 deadlines found"* — and every card opens to its raw source. Nothing exists on the board without one.
- **Grok Bot in the pipeline.** The email corpus was collected by a Grok Bot sweeping the author's inbox for org mail.

Stack: Next.js · TypeScript · Tailwind · MapLibre GL (3D) · SQLite · xAI Responses API · built in Cursor running Grok.

## Screenshots — Grok end to end

Grok wasn't just the model in the product; it was the whole pipeline: Grok answered every query, Grok (in Cursor) wrote the code, and a Grok Bot collected the email corpus.

<img width="643" height="375" alt="image" src="https://github.com/user-attachments/assets/5eab37cc-ff30-477e-b907-78725ba9edbd" />
<img width="643" height="375" alt="image" src="https://github.com/user-attachments/assets/66233e60-d652-449e-9acf-f19c88892099" />
<img width="643" height="375" alt="image" src="https://github.com/user-attachments/assets/b151c7d9-e388-4ac2-b35d-fb37d8641314" />
<img width="643" height="375" alt="image" src="https://github.com/user-attachments/assets/2e615c06-9347-4e98-9110-bc17db7bbe1f" />

## Running it

```bash
npm install
echo "XAI_API_KEY=your-key" > .env.local
cp emails/samples/*.txt emails/
npm run dev
```

Scout reads `.eml`, `.txt`, and `.html` files in the top of `emails/`. The copy puts the committed samples where Scout can see them. Real emails dropped in that same folder are gitignored. `npm run dev` is the dev script in `package.json`.

## Next

1. **Your inbox, with permission** — your mailing lists already describe your campus life; Eli reads them as you.
2. **Proactive Eli** — a Grok Bot routine that texts you each morning: tonight's thing, the closing deadline, the free food.
3. **Every system, one more tool** — the whole student-built stack becomes tools the layer reasons over.

The infrastructure exists. Now it can think.

## Credits

Architecture pattern (bots operating a live surface) inspired by [Hyperpolymath](https://github.com/filippo-fonseca/hyperpolymath-v3) by Filippo Fonseca. Data: Yale's public events calendar, Yale Hospitality menus, and the mailing lists of Yale's student organizations. Built by David Antwi, Yale EECS '28.
