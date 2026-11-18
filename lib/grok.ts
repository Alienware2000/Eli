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
      "Put cards on the board. The board is the answer. summary is the chat pointer: at most 3 short sentences, no dates, places, or deadlines narrated in prose. Deadlines are opp cards, events are event cards, hours-and-place facts are pulse cards. Two or more dated items means cards are required.",
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

export type EliUpdate = { type: "progress"; text: string } | { type: "delta"; text: string };

function progressLine(name: string | undefined, result: unknown): string | null {
  if (name === "get_events" && Array.isArray(result)) {
    const tonight = result.filter(
      (item) => item && typeof item === "object" && Boolean((item as { today?: boolean }).today),
    ).length;
    const marked = result.some(
      (item) => item && typeof item === "object" && "today" in (item as object),
    );
    if (result.length === 0 || (marked && tonight === 0)) return "✓ Campus calendar — nothing tonight";
    return marked
      ? `✓ Campus calendar — ${tonight} tonight`
      : `✓ Campus calendar — ${result.length} events`;
  }
  if (name === "get_dining" && Array.isArray(result)) {
    const open = result.filter(
      (item) => item && typeof item === "object" && Boolean((item as { openNow?: boolean }).openNow),
    ).length;
    return `✓ Dining halls — ${open === 1 ? "1 open now" : `${open} open now`}`;
  }
  if (name === "read_inbox" && Array.isArray(result)) {
    if (result.length === 0) return "✓ Your emails — nothing new today";
    const deadlines = result.filter((item) => {
      if (!item || typeof item !== "object") return false;
      const record = item as { subject?: unknown; body?: unknown };
      const text = `${typeof record.subject === "string" ? record.subject : ""} ${
        typeof record.body === "string" ? record.body : ""
      }`;
      return /deadline|\bdue\b|apply|application|audition/i.test(text);
    }).length;
    if (deadlines > 0) {
      return `✓ Your emails — ${deadlines === 1 ? "1 deadline found" : `${deadlines} deadlines found`}`;
    }
    return `✓ Your emails — ${result.length === 1 ? "1 new" : `${result.length} new`}`;
  }
  if (name === "web_search") return "✓ Yale web — searched";
  if (name === "x_search") return "✓ X — searched";
  return null;
}

function tell(onEvent: ((update: EliUpdate) => void) | undefined, text: string | null) {
  if (text) onEvent?.({ type: "progress", text });
}

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
    "You are Eli, Yale's campus agent. Speak like a friendly upperclassman: colleges by name, butteries, panlists, suites, Cross Campus, the shuttle.",
    `Right now in New Haven: ${when}.`,
    "The board is the answer. The chat is only a short pointer to the board.",
    "Chat summary hard rules: at most 3 short sentences, conversational, no wall of text, never repeat a point.",
    "Any item with a date, a place, or a deadline is not narrated in prose. It becomes a card via render_cards. Deadlines become opp cards. Events become event cards. A fact with hours and a place, such as registrar help at Poorvu 9:30–11:30, becomes a pulse card.",
    "If an answer would contain 2 or more dated items, cards are mandatory and prose summaries of those items are forbidden.",
    "The chat line only points. Example: Registration windows are the clock this week — I've pinned the dates and the registrar's help hours to the board.",
    "Named workers: read_inbox is Scout, get_events is Vista, get_dining is Chef. web_search and x_search are you, Eli.",
    "Broad questions — what's happening tonight, what am I missing this week, anything about the whole campus — are a full sweep. Do not stop after one tool.",
    "On a broad question, consult Scout, Vista, and Chef before any answer. Add web_search or x_search when something people are saying, or a public page, is not already in those three. Live search is in addition to the sweep, never a substitute for it.",
    "If the turn already includes a finished Scout, Vista, and Chef sweep, do not call those three again. Use the results. If Scout returned any emails, the panlist is not empty. Card the ones with dates, deadlines, or places, and put those panlist cards first.",
    "Compose at the end: call render_cards once. An inbox card's source must start with \"panlist:\" and include the subject.",
    "Only include cards you can source. Copy venue from tool results when it is a key, otherwise null.",
    "freeFood is true only when the source mentions free food, pizza, boba, snacks, refreshments, or dinner provided.",
  ].join(" ");
}

function isBroadQuery(message: string): boolean {
  const text = message.toLowerCase().replace(/’/g, "'");
  if (/\bnear\b/.test(text)) return false;
  return /what(?:'s| is) happening|what am i missing|what(?:'s| is) going on|on campus|\btonight\b|this week/.test(
    text,
  );
}

type Sweep = {
  inbox: unknown[];
  events: unknown[];
  dining: unknown[];
};

function fitList(rows: unknown[], max: number): string {
  if (JSON.stringify(rows).length <= max) return JSON.stringify(rows);
  let count = rows.length;
  while (count > 1 && JSON.stringify(rows.slice(0, count)).length > max) count -= 1;
  return JSON.stringify(rows.slice(0, count));
}

function sweepNote(sweep: Sweep): string {
  const inboxCount = sweep.inbox.length;
  return [
    "Full sweep is already done. Do not call read_inbox, get_events, or get_dining again.",
    inboxCount === 0
      ? "Scout read_inbox returned no emails."
      : `Scout read_inbox returned ${inboxCount} emails. The panlist is not empty. Card every email that has a date, a deadline, or a place.`,
    `Scout read_inbox: ${fitList(sweep.inbox, 28000)}`,
    `Vista get_events: ${fitList(sweep.events, 20000)}`,
    `Chef get_dining: ${fitList(sweep.dining, 12000)}`,
    "Call web_search or x_search only if what people are saying, or a public page, is still missing. Then call render_cards once.",
    "Chat summary: at most 3 short sentences, and it must not retell the dates. Those belong on cards.",
  ].join("\n");
}

export function shapeReply(raw: string): string {
  const spaced = raw.replace(/([.!?])(?=[A-Za-z])/g, "$1 ").replace(/[ \t]+\n/g, "\n").trim();
  const sentences: string[] = [];
  for (const chunk of spaced.split(/\n+/)) {
    for (const sentence of chunk.split(/(?<=[.!?])\s+/)) {
      const line = sentence.trim();
      if (!line) continue;
      sentences.push(line);
      if (sentences.length === 3) return sentences.join("\n");
    }
  }
  return sentences.join("\n");
}

function textDelta(event: Record<string, unknown>): string | null {
  if (event.type !== "response.output_text.delta") return null;
  if (typeof event.delta === "string") return event.delta;
  if (event.delta && typeof event.delta === "object") {
    const nested = (event.delta as { text?: unknown }).text;
    if (typeof nested === "string") return nested;
  }
  return null;
}

async function xai(
  body: Record<string, unknown>,
  apiKey: string,
  onDelta?: (text: string) => void,
): Promise<XaiResponse> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: MODEL, tools, ...body, stream: true }),
    signal: AbortSignal.timeout(90000),
  });
  if (!response.ok || !response.body) {
    const text = await response.text();
    console.error("xAI response failed", response.status, text.slice(0, 700));
    throw new Error(`xAI ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let raw = "";
  let completed: XaiResponse | null = null;

  const consume = (block: string) => {
    for (const line of block.split("\n")) {
      const trimmed = line.trim();
      const data = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
      if (!data.startsWith("{") || data === "[DONE]") continue;
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(data) as Record<string, unknown>;
      } catch {
        continue;
      }
      const delta = textDelta(event);
      if (delta) onDelta?.(delta);
      if (event.type === "response.completed") {
        const payload =
          event.response && typeof event.response === "object" ? event.response : event;
        completed = payload as XaiResponse;
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true }).replace(/\r/g, "");
    raw += chunk;
    buffer += chunk;
    let split = buffer.indexOf("\n");
    while (split !== -1) {
      consume(buffer.slice(0, split));
      buffer = buffer.slice(split + 1);
      split = buffer.indexOf("\n");
    }
  }
  if (buffer.trim()) consume(buffer);
  if (completed) return completed;
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed) as XaiResponse;
  throw new Error("xAI stream ended without a response");
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

function noteServerTools(response: XaiResponse, onEvent?: (update: EliUpdate) => void) {
  for (const item of response.output ?? []) {
    const key = item.id ?? `${item.type}:${item.call_id ?? ""}`;
    if (seenServerTools.has(key)) continue;
    if (item.type === "web_search_call" || item.type === "web_search") {
      seenServerTools.add(key);
      logActivity("Eli", "searched the Yale web");
      tell(onEvent, progressLine("web_search", null));
    } else if (item.type.includes("x_search")) {
      seenServerTools.add(key);
      logActivity("Eli", "searched X");
      tell(onEvent, progressLine("x_search", null));
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
  const started = Date.now();
  const summary = shapeReply(typeof args.summary === "string" ? args.summary : "");
  const cards = Array.isArray(args.cards) ? args.cards : [];
  let inserted = 0;
  for (const raw of cards) {
    const card = parseCard(cleanCard(raw));
    if (!card) continue;
    if (insertCard(card)) inserted += 1;
  }
  logActivity(
    "Eli",
    inserted === 1 ? "1 card on the board" : `${inserted} cards on the board`,
    Date.now() - started,
  );
  return { summary, inserted };
}

async function dispatch(call: OutputItem, sweep: Sweep | null): Promise<unknown> {
  const args = argsOf(call);
  if (sweep && call.name === "read_inbox") return sweep.inbox;
  if (sweep && call.name === "get_events") return sweep.events;
  if (sweep && call.name === "get_dining") return sweep.dining;
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

async function speak(text: string, onEvent?: (update: EliUpdate) => void) {
  if (!onEvent) return;
  const parts = text.split(/(\s+)/).filter(Boolean);
  for (const part of parts) {
    onEvent({ type: "delta", text: part });
    if (part.trim()) await new Promise((resolve) => setTimeout(resolve, 28));
  }
}

export async function runEli(
  message: string,
  onEvent?: (update: EliUpdate) => void,
): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("missing XAI_API_KEY");

  let summary = "";
  let cardSummary = "";
  let sweep: Sweep | null = null;
  const input: Array<{ role: string; content: string }> = [
    { role: "system", content: systemPrompt() },
    { role: "user", content: message },
  ];
  if (isBroadQuery(message)) {
    const [inbox, events, dining] = await Promise.all([
      readInbox().then((rows) => {
        tell(onEvent, progressLine("read_inbox", rows));
        return rows;
      }),
      getEvents().then((rows) => {
        tell(onEvent, progressLine("get_events", rows));
        return rows;
      }),
      getDining().then((rows) => {
        tell(onEvent, progressLine("get_dining", rows));
        return rows;
      }),
    ]);
    sweep = { inbox, events, dining };
    input.push({ role: "user", content: sweepNote(sweep) });
    logActivity("Eli", "composing");
  }
  let response = await xai({ input }, apiKey);

  for (let round = 0; round < 6; round++) {
    if (response.error?.message) throw new Error(response.error.message);
    noteServerTools(response, onEvent);
    const text = messageText(response);
    if (text) summary = text;
    const calls = (response.output ?? []).filter((item) => item.type === "function_call");
    if (calls.length === 0 || !response.id) break;

    const outputs = await Promise.all(
      calls.map(async (call) => {
        const result = await dispatch(call, sweep);
        const cached =
          sweep != null &&
          (call.name === "read_inbox" || call.name === "get_events" || call.name === "get_dining");
        if (!cached) tell(onEvent, progressLine(call.name, result));
        if (call.name === "render_cards" && result && typeof result === "object" && "summary" in result) {
          const line = (result as { summary?: string }).summary;
          if (line) cardSummary = line;
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

  const spoken = shapeReply(cardSummary || summary) || "Here's what I pinned to the board.";
  await speak(spoken, onEvent);
  return spoken;
}
