import type { Card } from "@/lib/types";

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function startStamp(text: string): string {
  const withoutUntil = text.replace(
    /until\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?/gi,
    " ",
  );
  const match = withoutUntil.match(
    /(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)?|\b(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)/i,
  );
  if (!match || match.index == null) return norm(text);

  const hour = Number(match[1] ?? match[4]);
  const minute = match[2] ?? "00";
  let meridiem = (match[3] ?? match[5] ?? "").replace(/\./g, "").toLowerCase();
  if (!meridiem) {
    const later = withoutUntil.slice(match.index + match[0].length).match(/a\.?m\.?|p\.?m\.?/i);
    meridiem = (later?.[0] ?? "").replace(/\./g, "").toLowerCase();
  }
  const suffix = meridiem.startsWith("p") ? " pm" : meridiem.startsWith("a") ? " am" : "";
  return `${hour}:${minute.padStart(2, "0")}${suffix}`;
}

function whenOf(card: Card): string {
  if (card.type === "event" || card.type === "food") return card.when;
  if (card.type === "opp") return card.deadline;
  if (card.type === "plan") return card.steps[0]?.time ?? "";
  return "";
}

function placeOf(card: Card): string {
  if (card.type === "event") return card.where;
  if (card.type === "food") return card.hall;
  if (card.type === "opp") return card.org;
  if (card.type === "plan") return card.steps[0]?.where ?? card.venue ?? "";
  return card.venue ?? "";
}

export function cardKey(card: Card): string {
  return [norm(card.title), startStamp(whenOf(card)), norm(placeOf(card))].join("|");
}

export function isScoutCard(card: Card): boolean {
  return /panlist|\.eml\b|emails\//i.test(card.source);
}
