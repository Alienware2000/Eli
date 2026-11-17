import type { Card } from "@/lib/types";

export type Timing = "now" | "soon" | "open" | "later" | "ended";
export type BoardFilter = "all" | "tonight" | "food" | "open" | "deadlines";

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function newHavenClock() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );
  const weekday = (parts.weekday ?? "Tue").slice(0, 3).toLowerCase();
  return {
    weekday,
    minutes: Number(parts.hour ?? "0") * 60 + Number(parts.minute ?? "0"),
  };
}

function clockMinutes(hour: number, minute: number, meridiem: string): number {
  let h = hour % 12;
  if (meridiem.toLowerCase().startsWith("p")) h += 12;
  if (hour === 12 && meridiem.toLowerCase().startsWith("a")) h = 0;
  return h * 60 + minute;
}

function cleanMeridiem(value: string | undefined): string {
  return (value ?? "").replace(/\./g, "").toLowerCase();
}

export function cardTiming(card: Card): Timing {
  const when = (
    card.type === "event" || card.type === "food" || card.type === "opp"
      ? card.type === "opp"
        ? card.deadline
        : card.when
      : ""
  ).toLowerCase();
  const clock = newHavenClock();
  const mentioned = DAYS.find((day) => new RegExp(`\\b${day}`).test(when));
  if (mentioned && mentioned !== clock.weekday) return "later";
  if (/happening now/.test(when)) return "now";
  if (card.type === "food" && /open now/.test(when)) return "open";

  const range =
    when.match(
      /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\s*[–—-]\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/i,
    ) ?? null;
  if (range) {
    const endMeridiem = cleanMeridiem(range[6]);
    const startMeridiem = cleanMeridiem(range[3]) || endMeridiem;
    const start = clockMinutes(Number(range[1]), Number(range[2] ?? "0"), startMeridiem);
    const end = clockMinutes(Number(range[4]), Number(range[5] ?? "0"), endMeridiem);
    if (clock.minutes >= start && clock.minutes < end) return card.type === "food" ? "open" : "now";
    if (clock.minutes < start && start - clock.minutes <= 120) return "soon";
    if (clock.minutes >= end) return "ended";
    return "later";
  }

  const until = when.match(/until\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/i);
  if (until) {
    const end = clockMinutes(Number(until[1]), Number(until[2] ?? "0"), cleanMeridiem(until[3]));
    if (clock.minutes < end) return card.type === "food" ? "open" : "now";
    return "ended";
  }

  const single = when.match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/i);
  if (single) {
    const start = clockMinutes(Number(single[1]), Number(single[2] ?? "0"), cleanMeridiem(single[3]));
    if (clock.minutes < start && start - clock.minutes <= 120) return "soon";
    if (clock.minutes < start) return "later";
    if (clock.minutes - start <= 120) return card.type === "food" ? "open" : "now";
    return "ended";
  }

  return card.type === "food" ? "open" : "later";
}

export function matchesFilter(card: Card, filter: BoardFilter): boolean {
  if (filter === "all") return true;
  if (filter === "food") return card.type === "event" && card.freeFood;
  if (filter === "deadlines") return card.type === "opp";
  if (filter === "open") return card.type === "food" && cardTiming(card) !== "ended";
  if (card.type !== "event" && card.type !== "food") return false;
  const when = (card.type === "event" ? card.when : card.when).toLowerCase();
  const today = newHavenClock().weekday;
  const mentioned = DAYS.find((day) => new RegExp(`\\b${day}`).test(when));
  if (mentioned && mentioned !== today) return false;
  return cardTiming(card) !== "ended";
}
