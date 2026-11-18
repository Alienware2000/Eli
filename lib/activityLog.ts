import type { Activity } from "@/lib/types";

export type LogLine = {
  id: number;
  ts: string;
  time: string;
  worker: string;
  action: string;
  result: string;
  duration: string;
};

const DURATION = /^(.*)\s\[\[(\d+(?:\.\d+)?s)\]\]$/;

function campusParts(ts: string) {
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return null;
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
}

export function logClock(ts: string): string {
  const parts = campusParts(ts);
  if (!parts?.hour || !parts.minute || !parts.second) return "—";
  return `${parts.hour}:${parts.minute}:${parts.second}`;
}

export function sweepClock(ts: string | null): string {
  if (!ts) return "—";
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function actionFor(worker: string, result: string): string {
  if (worker === "Scout") return "read_inbox";
  if (worker === "Vista") return "get_events";
  if (worker === "Chef") return "get_dining";
  const text = result.toLowerCase();
  if (text.includes("yale web") || text.includes("web_search")) return "web_search";
  if (/\bsearched x\b/.test(text) || text.includes("x_search")) return "x_search";
  if (text.includes("compos")) return "compose";
  if (text.includes("card")) return "render_cards";
  return "note";
}

function spoken(result: string): string {
  return result.replace(/panlists/gi, "campus emails").replace(/panlist/gi, "campus email");
}

export function logLine(row: Activity): LogLine {
  const timed = row.text.match(DURATION);
  const result = spoken((timed?.[1] ?? row.text).trim());
  return {
    id: row.id,
    ts: row.ts,
    time: logClock(row.ts),
    worker: row.bot,
    action: actionFor(row.bot, result),
    result,
    duration: timed?.[2] ?? "—",
  };
}

export type WorkerPulse = {
  name: "Scout" | "Vista" | "Chef";
  lastRun: string;
  items: string;
  fresh: boolean;
};

const WORKERS = ["Scout", "Vista", "Chef"] as const;

export type ReceiptLine = {
  key: string;
  ok: boolean;
  label: string;
  detail: string;
};

const RECEIPT_ORDER = ["calendar", "dining", "email", "web", "x"];
const RECEIPT_WINDOW_MS = 90 * 1000;

function humanSource(line: LogLine): ReceiptLine | null {
  const text = line.result.toLowerCase();
  if (line.worker === "Vista" || line.action === "get_events") {
    const failed = /didn't answer|didn't|couldn't/.test(text);
    const count = text.match(/(\d+)/);
    const tonight = text.includes("tonight");
    let detail = "nothing tonight";
    if (failed) detail = "didn't answer";
    else if (count && tonight) {
      detail = count[1] === "1" ? "1 event tonight" : `${count[1]} events tonight`;
    } else if (count) {
      detail = count[1] === "1" ? "1 event" : `${count[1]} events`;
    }
    return { key: "calendar", ok: !failed, label: "Campus calendar", detail };
  }
  if (line.worker === "Chef" || line.action === "get_dining") {
    const failed = /didn't answer|didn't|couldn't/.test(text);
    const count = text.match(/(\d+)/);
    let detail = "none open now";
    if (failed) detail = "didn't answer";
    else if (count) detail = count[1] === "1" ? "1 open now" : `${count[1]} open now`;
    return { key: "dining", ok: !failed, label: "Dining halls", detail };
  }
  if (line.worker === "Scout" || line.action === "read_inbox") {
    const failed = /couldn't|could not/.test(text);
    const count = text.match(/(\d+)/);
    const quiet = /quiet|nothing|no panlist|no email/.test(text) || count?.[1] === "0";
    let detail = "nothing new today";
    if (failed) detail = "couldn't read them";
    else if (!quiet && count) detail = count[1] === "1" ? "1 new today" : `${count[1]} new today`;
    return { key: "email", ok: !failed, label: "Your emails", detail };
  }
  if (line.action === "web_search" || text.includes("yale web")) {
    return { key: "web", ok: true, label: "Yale web", detail: "searched" };
  }
  if (line.action === "x_search" || /\bsearched x\b/.test(text)) {
    return { key: "x", ok: true, label: "X", detail: "searched" };
  }
  return null;
}

export function latestReceipt(activity: Activity[]): { time: string; lines: ReceiptLine[] } {
  const sources = activity
    .map((row) => {
      const line = logLine(row);
      const human = humanSource(line);
      return human ? { line, human } : null;
    })
    .filter((item): item is { line: LogLine; human: ReceiptLine } => item != null);
  if (sources.length === 0) return { time: "—", lines: [] };

  const newestFirst = [...sources].sort(
    (a, b) => Date.parse(b.line.ts) - Date.parse(a.line.ts),
  );
  const anchor = Date.parse(newestFirst[0].line.ts);
  const picked = new Map<string, ReceiptLine>();
  for (const item of newestFirst) {
    const then = Date.parse(item.line.ts);
    if (Number.isNaN(then) || anchor - then > RECEIPT_WINDOW_MS) continue;
    if (!picked.has(item.human.key)) picked.set(item.human.key, item.human);
  }
  return {
    time: sweepClock(newestFirst[0].line.ts),
    lines: RECEIPT_ORDER.flatMap((key) => {
      const line = picked.get(key);
      return line ? [line] : [];
    }),
  };
}

export function workerPulse(activity: Activity[], now = Date.now()): WorkerPulse[] {
  return WORKERS.map((name) => {
    const latest = [...activity].reverse().find((row) => row.bot === name);
    if (!latest) return { name, lastRun: "—", items: "—", fresh: false };
    const line = logLine(latest);
    const found = line.result.match(/\d+/);
    const then = Date.parse(latest.ts);
    return {
      name,
      lastRun: sweepClock(latest.ts),
      items: found ? found[0] : "0",
      fresh: !Number.isNaN(then) && now - then <= 10 * 60 * 1000,
    };
  });
}
