import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { headsUp } from "@/lib/brief";
import { cardKey, isScoutCard } from "@/lib/identity";
import type { Activity, Card, PlanStep } from "@/lib/types";

const dbPath = path.join(process.cwd(), "data", "eli.db");

const globalForDb = globalThis as unknown as { eliDb?: Database.Database };

function openDb(): Database.Database {
  if (globalForDb.eliDb) return globalForDb.eliDb;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 3000");
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      ts TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot TEXT NOT NULL,
      text TEXT NOT NULL,
      ts TEXT NOT NULL
    );
  `);
  globalForDb.eliDb = db;
  return db;
}

const db = openDb();

function isStr(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function strings(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((item) => typeof item === "string")) return null;
  return value;
}

function steps(value: unknown): PlanStep[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const out: PlanStep[] = [];
  for (const step of value) {
    if (!step || typeof step !== "object") return null;
    const record = step as Record<string, unknown>;
    if (!isStr(record.time) || !isStr(record.what) || !isStr(record.where)) return null;
    out.push({ time: record.time, what: record.what, where: record.where });
  }
  return out;
}

export function parseCard(input: unknown): Card | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  if (!isStr(record.title) || !isStr(record.source)) return null;

  const id = isStr(record.id) ? record.id : crypto.randomUUID();
  const ts = isStr(record.ts) ? record.ts : new Date().toISOString();
  const venue = isStr(record.venue) ? record.venue : undefined;
  const base = {
    id,
    title: record.title.trim(),
    ts,
    source: record.source.trim(),
    ...(venue ? { venue } : {}),
  };
  const link = isStr(record.link) ? record.link : undefined;

  switch (record.type) {
    case "event": {
      if (!isStr(record.when) || !isStr(record.where) || !isStr(record.blurb)) return null;
      if (typeof record.freeFood !== "boolean") return null;
      return {
        ...base,
        type: "event",
        when: record.when,
        where: record.where,
        blurb: record.blurb,
        freeFood: record.freeFood,
        ...(link ? { link } : {}),
      };
    }
    case "food": {
      if (!isStr(record.hall) || !isStr(record.when)) return null;
      const items = strings(record.items);
      if (!items) return null;
      return { ...base, type: "food", hall: record.hall, when: record.when, items };
    }
    case "pulse": {
      if (!isStr(record.text)) return null;
      const citations = strings(record.citations);
      if (!citations) return null;
      return { ...base, type: "pulse", text: record.text, citations };
    }
    case "plan": {
      const planSteps = steps(record.steps);
      if (!planSteps) return null;
      return { ...base, type: "plan", steps: planSteps };
    }
    case "opp": {
      if (!isStr(record.org) || !isStr(record.deadline) || !isStr(record.blurb)) return null;
      return {
        ...base,
        type: "opp",
        org: record.org,
        deadline: record.deadline,
        blurb: record.blurb,
        ...(link ? { link } : {}),
      };
    }
    default:
      return null;
  }
}

const SEED_CARDS: Card[] = [
  {
    id: "seed-grokathon",
    type: "event",
    title: "Grokathon build night",
    ts: "2026-11-17T22:05:00.000Z",
    source: "panlist: y/cs — subject: Grokathon tonight at Tsai CITY. Pizza on us.",
    venue: "tsai-city",
    when: "Tue 5:00–8:00pm",
    where: "Tsai CITY",
    blurb: "Four-hour build at Tsai CITY. Awards at 8:45. Pizza in the studio.",
    freeFood: true,
  },
  {
    id: "seed-jazz",
    type: "event",
    title: "Jazz on Cross Campus",
    ts: "2026-11-17T22:04:00.000Z",
    source: "events.yale.edu — Jazz on Cross Campus",
    venue: "cross-campus",
    when: "Tue 7:30pm",
    where: "Cross Campus",
    blurb: "Whiffenpoofs and friends. It moves into Woolsey if it rains.",
    freeFood: false,
  },
  {
    id: "seed-td",
    type: "food",
    title: "Timothy Dwight dinner",
    ts: "2026-11-17T22:03:00.000Z",
    source: "nutrislice: timothy-dwight / dinner",
    venue: "timothy-dwight",
    hall: "Timothy Dwight",
    when: "5:00–8:00pm",
    items: ["roast chicken", "harvest grain bowl", "apple crisp"],
  },
  {
    id: "seed-ra",
    type: "opp",
    title: "Paid research assistant, cognitive science",
    ts: "2026-11-17T22:02:00.000Z",
    source: "panlist: psych-undergrad — subject: RA opening, deadline Friday",
    venue: "sss",
    org: "Wu Lab",
    deadline: "Fri Nov 21",
    blurb: "8 hrs/week. No experience required. One paragraph on why perception.",
  },
  {
    id: "seed-pulse",
    type: "pulse",
    title: "Red Line running late after 9",
    ts: "2026-11-17T22:01:00.000Z",
    source: "yaledailynews.com",
    text: "Riders are reporting 15-minute gaps on the Red Line after 9pm. The Blue Line is the workaround up to Science Hill.",
    citations: ["https://yaledailynews.com"],
  },
  {
    id: "seed-plan",
    type: "plan",
    title: "Thursday 7–9, near Science Hill",
    ts: "2026-11-17T22:00:00.000Z",
    source: "eli: composed from Thursday events and dining hours",
    venue: "science-hill",
    steps: [
      { time: "7:00", what: "Dinner at Pauli Murray", where: "Pauli Murray College" },
      { time: "7:40", what: "Kline Tower night tour", where: "Science Hill" },
      { time: "8:30", what: "Walk back before the Red Line thins out", where: "Science Hill" },
    ],
  },
];

const SEED_ACTIVITY: Array<Omit<Activity, "id">> = [
  {
    bot: "Scout",
    text: "14 events from this week's panlists",
    ts: "2026-11-17T21:40:00.000Z",
  },
  {
    bot: "Vista",
    text: "8 events on the calendar tonight",
    ts: "2026-11-17T21:41:00.000Z",
  },
  {
    bot: "Chef",
    text: "6 halls open now",
    ts: "2026-11-17T21:42:00.000Z",
  },
  {
    bot: "Eli",
    text: "walk-up board is already up",
    ts: "2026-11-17T21:43:00.000Z",
  },
];

const seedIfEmpty = db.transaction(() => {
  const cards = db.prepare("SELECT COUNT(*) AS n FROM cards").get() as { n: number };
  if (cards.n === 0) {
    const insert = db.prepare(
      "INSERT INTO cards (id, type, payload, ts) VALUES (?, ?, ?, ?)",
    );
    for (const card of SEED_CARDS) {
      insert.run(card.id, card.type, JSON.stringify(card), card.ts);
    }
  }
  const activity = db.prepare("SELECT COUNT(*) AS n FROM activity").get() as { n: number };
  if (activity.n === 0) {
    const insert = db.prepare("INSERT INTO activity (bot, text, ts) VALUES (?, ?, ?)");
    for (const line of SEED_ACTIVITY) {
      insert.run(line.bot, line.text, line.ts);
    }
  }
});

function readCards(): Card[] {
  seedIfEmpty();
  const rows = db.prepare("SELECT payload FROM cards ORDER BY ts DESC").all() as Array<{
    payload: string;
  }>;
  const cards: Card[] = [];
  for (const row of rows) {
    try {
      const card = parseCard(JSON.parse(row.payload));
      if (card) cards.push(card);
    } catch {
      // Drop a corrupt row. The board stays up.
    }
  }
  return cards;
}

function purgeDuplicates(): void {
  const cards = readCards();
  const keep = new Map<string, Card>();
  for (const card of cards) {
    const key = cardKey(card);
    const prev = keep.get(key);
    if (!prev || card.ts > prev.ts) keep.set(key, card);
  }
  const ids = new Set([...keep.values()].map((card) => card.id));
  const remove = db.prepare("DELETE FROM cards WHERE id = ?");
  const drop = db.transaction(() => {
    for (const card of cards) {
      if (!ids.has(card.id)) remove.run(card.id);
    }
  });
  drop();
}

export function listCards(): Card[] {
  purgeDuplicates();
  const cards = readCards().sort((a, b) => {
    const scout = Number(isScoutCard(b)) - Number(isScoutCard(a));
    if (scout !== 0) return scout;
    return a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0;
  });
  return [headsUp(cards), ...cards];
}

export function getCard(id: string): Card | null {
  return readCards().find((card) => card.id === id) ?? null;
}

export function insertCard(card: Card): boolean {
  seedIfEmpty();
  const key = cardKey(card);
  const duplicate = readCards().find((existing) => existing.id !== card.id && cardKey(existing) === key);
  if (duplicate) return false;
  db.prepare(
    `INSERT INTO cards (id, type, payload, ts) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET type = excluded.type, payload = excluded.payload, ts = excluded.ts`,
  ).run(card.id, card.type, JSON.stringify(card), card.ts);
  return true;
}

export function listActivity(): Activity[] {
  seedIfEmpty();
  return db
    .prepare("SELECT id, bot, text, ts FROM activity ORDER BY id ASC")
    .all() as Activity[];
}

export function logActivity(bot: string, text: string): void {
  seedIfEmpty();
  db.prepare("INSERT INTO activity (bot, text, ts) VALUES (?, ?, ?)").run(
    bot,
    text,
    new Date().toISOString(),
  );
}
