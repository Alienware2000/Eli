import type { Card, EventCard, OppCard, PlanCard } from "@/lib/types";
import { cardTiming, matchesFilter } from "@/lib/timing";
import { venues, walkMinutes } from "@/lib/venues";

export const HEADS_UP_ID = "heads-up";

function closeness(card: Card): number {
  if (!card.venue || !venues[card.venue]) return 999;
  const venue = venues[card.venue];
  return walkMinutes(venue.lat, venue.lng);
}

function startMinutes(card: EventCard): number {
  const timing = cardTiming(card);
  const rank = timing === "now" ? 0 : timing === "soon" ? 1 : timing === "later" ? 2 : 3;
  return rank * 10000 + closeness(card);
}

function deadlineDistance(card: OppCard): number {
  const text = card.deadline.toLowerCase();
  const weekday = text.match(/\b(sun|mon|tue|wed|thu|fri|sat)/);
  const date = text.match(/\b(\d{1,2})\b/);
  const today = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    day: "numeric",
  }).format(new Date());
  if (date) {
    let delta = Number(date[1]) - Number(today);
    if (delta < 0) delta += 31;
    return delta;
  }
  if (weekday) {
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const now = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
    })
      .format(new Date())
      .slice(0, 3)
      .toLowerCase();
    const delta = (days.indexOf(weekday[1]) - days.indexOf(now) + 7) % 7;
    return delta;
  }
  return 99;
}

function line(time: string, what: string, where: string) {
  return { time, what: what.slice(0, 80), where: where.slice(0, 80) };
}

export function headsUp(cards: Card[]): PlanCard {
  const events = cards.filter(
    (card): card is EventCard => card.type === "event" && matchesFilter(card, "tonight"),
  );
  const free = events
    .filter((card) => card.freeFood && cardTiming(card) !== "ended")
    .sort((a, b) => closeness(a) - closeness(b) || startMinutes(a) - startMinutes(b));
  const food = free[0];
  const best = events
    .filter((card) => card.id !== food?.id)
    .sort((a, b) => startMinutes(a) - startMinutes(b))[0] ?? events[0];
  const deadline = cards
    .filter((card): card is OppCard => card.type === "opp")
    .sort((a, b) => deadlineDistance(a) - deadlineDistance(b))[0];

  return {
    id: HEADS_UP_ID,
    type: "plan",
    title: "Heads up",
    ts: "2026-11-17T21:59:00.000Z",
    source: "eli: composed from the board",
    steps: [
      best
        ? line("Tonight", best.title, best.where)
        : line("Tonight", "Quiet on the calendar", "Yale"),
      deadline
        ? line("Deadline", deadline.title, deadline.deadline)
        : line("Deadline", "Nothing due on the board", "Yale"),
      food
        ? line("Free food", food.title, food.where)
        : line("Free food", "Nothing free posted", "Yale"),
    ],
  };
}
