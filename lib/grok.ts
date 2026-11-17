import { insertCard, logActivity, parseCard } from "@/lib/db";
import { venueKeyFor } from "@/lib/venues";
import { getDining, getEvents, readInbox } from "@/lib/tools";

const MODEL = "grok-4.7";
const ENDPOINT = "https://api.x.ai/v1/responses";

const stringOrNull = { type: ["string", "null"] };

const eventCard = {
  type: "object",
  additionalProperties: false,
  properties: {
    type: { const: "event" },
    title: { type: "string" },
    when: { type: "string" },
    where: { type: "string" },
    blurb: { type: "string" },
    freeFood: { type: "boolean" },
    source: { type: "string" },
    venue: stringOrNull,
    link: stringOrNull,
  },
  required: ["type", "title", "when", "where", "blurb", "freeFood", "source", "venue", "link"],
};

const foodCard = {
  type: "object",
  additionalProperties: false,
  properties: {
    type: { const: "food" },
    title: { type: "string" },
    hall: { type: "string" },
    when: { type: "string" },
    items: { type: "array", items: { type: "string" } },
    source: { type: "string" },
    venue: stringOrNull,
  },
  required: ["type", "title", "hall", "when", "items", "source", "venue"],
};

const pulseCard = {
  type: "object",
  additionalProperties: false,
  properties: {
    type: { const: "pulse" },
    title: { type: "string" },
    text: { type: "string" },
    citations: { type: "array", items: { type: "string" } },
    source: { type: "string" },
    venue: stringOrNull,
  },
  required: ["type", "title", "text", "citations", "source", "venue"],
};

const planCard = {
  type: "object",
  additionalProperties: false,
  properties: {
    type: { const: "plan" },
    title: { type: "string" },
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          time: { type: "string" },
          what: { type: "string" },
          where: { type: "string" },
        },
        required: ["time", "what", "where"],
      },
    },
    source: { type: "string" },
    venue: stringOrNull,
  },
  required: ["type", "title", "steps", "source", "venue"],
};

const oppCard = {
  type: "object",
  additionalProperties: false,
  properties: {
    type: { const: "opp" },
    title: { type: "string" },
    org: { type: "string" },
    deadline: { type: "string" },
    blurb: { type: "string" },
    source: { type: "string" },
    venue: stringOrNull,
    link: stringOrNull,
  },
  required: ["type", "title", "org", "deadline", "blurb", "source", "venue", "link"],
};

const tools = [
  {
    type: "web_search",
    filters: {
      allowed_domains: [
        "yale.edu",
        "events.yale.edu",
        "yaleconnect.yale.edu",
        "yaledailynews.com",
      ],
    },
  },
  { type: "x_search" },
  {
    type: "function",
    name: "read_inbox",
    description:
      "Scout. Read the local panlist and club emails exported into emails/. Returns subject and body text. No mailbox login.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function",
    name: "get_events",
    description:
      "Vista. Fetch Yale's public events calendar for the next 7 days. Each event may include a venue key for the map.",
    parameters: {
      type: "object",
      properties: {
        when: {
          type: "string",
          description: "Optional hint such as tonight or this week. The feed is always the next 7 days.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_dining",
    description:
      "Chef. Yale dining halls from Nutrislice: hours, whether a meal is open now, and today's dinner items. Pass a hall name or omit it for every hall.",
    parameters: {
      type: "object",
      properties: {
        hall: { type: "string", description: "Optional hall name or slug, such as Timothy Dwight." },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "render_cards",
    strict: true,
    description:
      "Put cards on Eli's board. Call this once when you have enough to answer. venue is a venues.json key copied from tool results, or null. summary is one spoken line for the chat.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: { type: "string" },
        cards: {
          type: "array",
          items: { oneOf: [eventCard, foodCard, pulseCard, planCard, oppCard] },
        },
      },
      required: ["summary", "cards"],
    },
  },
];

type OutputItem = {
  type: string;
  id?: string;
  name?: string;
  arguments?: string | Record<string, unknown>;
  call_id?: string;
  content?: string | Array<{ type?: string; text?: string }>;
};

type XaiResponse = {
  id?: string;
  output?: OutputItem[];
  error?: { message?: string };
};

function systemPrompt(): string {
  const when = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
  return [
    "You are Eli, Yale's campus agent. Speak like a friendly upperclassman: colleges by name, butteries, panlists.",
    `Right now in New Haven: ${when}.`,
    "read_inbox is Scout, get_events is Vista, get_dining is Chef. web_search and x_search are you.",
    "For what is happening on campus, call read_inbox and get_events before you answer. Call get_dining when food, dining, or a free-food night matters.",
    "Lead with what Scout found in the panlists. Calendar events come second, in the summary and in the cards.",
    "Then call render_cards once. Put panlist cards before events.yale.edu cards. An inbox card's source must start with \"panlist:\" and include the subject.",
    "Only include cards you can source. Copy venue from tool results when it is a key, otherwise null.",
    "freeFood is true only when the source mentions free food, pizza, boba, snacks, refreshments, or dinner provided.",
    "summary is one line. No slogans.",
  ].join(" ");
}

async function xai(body: Record<string, unknown>, apiKey: string): Promise<XaiResponse> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: MODEL, tools, ...body }),
    signal: AbortSignal.timeout(90000),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error("xAI response failed", response.status, text.slice(0, 700));
    throw new Error(`xAI ${response.status}`);
  }
  return JSON.parse(text) as XaiResponse;
}

function messageText(response: XaiResponse): string {
  const lines: string[] = [];
  for (const item of response.output ?? []) {
    if (item.type !== "message" || item.content == null) continue;
    if (typeof item.content === "string") lines.push(item.content);
    else {
      for (const part of item.content) {
        if (part.text) lines.push(part.text);
      }
    }
  }
  return lines.join("\n").trim();
}

const seenServerTools = new Set<string>();

function noteServerTools(response: XaiResponse) {
  for (const item of response.output ?? []) {
    const key = item.id ?? `${item.type}:${item.call_id ?? ""}`;
    if (seenServerTools.has(key)) continue;
    if (item.type === "web_search_call" || item.type === "web_search") {
      seenServerTools.add(key);
      logActivity("Eli", "searched the Yale web");
    } else if (item.type.includes("x_search")) {
      seenServerTools.add(key);
      logActivity("Eli", "searched X");
    }
  }
}

function argsOf(call: OutputItem): Record<string, unknown> {
  if (!call.arguments) return {};
  if (typeof call.arguments === "object") return call.arguments;
  try {
    const parsed = JSON.parse(call.arguments) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function cleanCard(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const record = { ...(input as Record<string, unknown>) };
  for (const key of Object.keys(record)) {
    if (record[key] === null) delete record[key];
  }
  const hinted = venueKeyFor(typeof record.venue === "string" ? record.venue : undefined);
  if (hinted) record.venue = hinted;
  else if (typeof record.venue === "string" && !hinted) delete record.venue;
  const fromWhere = venueKeyFor(
    typeof record.where === "string"
      ? record.where
      : typeof record.hall === "string"
        ? record.hall
        : undefined,
  );
  if (!record.venue && fromWhere) record.venue = fromWhere;
  return record;
}

function renderCards(args: Record<string, unknown>): { summary: string; inserted: number } {
  const summary = typeof args.summary === "string" ? args.summary.trim() : "";
  const cards = Array.isArray(args.cards) ? args.cards : [];
  let inserted = 0;
  for (const raw of cards) {
    const card = parseCard(cleanCard(raw));
    if (!card) continue;
    if (insertCard(card)) inserted += 1;
  }
  logActivity("Eli", inserted === 1 ? "1 card on the board" : `${inserted} cards on the board`);
  return { summary, inserted };
}

async function dispatch(call: OutputItem): Promise<unknown> {
  const args = argsOf(call);
  switch (call.name) {
    case "read_inbox":
      return readInbox();
    case "get_events":
      return getEvents();
    case "get_dining":
      return getDining(typeof args.hall === "string" ? args.hall : undefined);
    case "render_cards":
      return renderCards(args);
    default:
      logActivity("Eli", `skipped unknown tool ${call.name ?? "?"}`.slice(0, 80));
      return [];
  }
}

export async function runEli(message: string): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("missing XAI_API_KEY");

  let summary = "";
  let response = await xai(
    {
      input: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: message },
      ],
    },
    apiKey,
  );

  for (let round = 0; round < 6; round++) {
    if (response.error?.message) throw new Error(response.error.message);
    noteServerTools(response);
    const text = messageText(response);
    if (text) summary = text;
    const calls = (response.output ?? []).filter((item) => item.type === "function_call");
    if (calls.length === 0 || !response.id) break;

    const outputs = await Promise.all(
      calls.map(async (call) => {
        const result = await dispatch(call);
        if (call.name === "render_cards" && result && typeof result === "object" && "summary" in result) {
          const line = (result as { summary?: string }).summary;
          if (line) summary = line;
        }
        return {
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(result).slice(0, 60000),
        };
      }),
    );
    response = await xai({ input: outputs, previous_response_id: response.id }, apiKey);
  }

  const line = summary
    .split(/\n+/)
    .map((part) => part.trim())
    .find(Boolean);
  return line || "Here's what I could pull together.";
}
