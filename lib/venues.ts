import raw from "@/data/venues.json";

export type Venue = {
  name: string;
  lat: number;
  lng: number;
};

export const venues: Record<string, Venue> = {};

for (const [key, value] of Object.entries(raw)) {
  if (!value || typeof value !== "object") continue;
  if (!("name" in value) || !("lat" in value) || !("lng" in value)) continue;
  venues[key] = value as Venue;
}

export function venueKeyFor(label: string | undefined | null): string | undefined {
  if (!label) return undefined;
  const text = label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!text) return undefined;
  if (venues[label]) return label;
  const dashed = text.replace(/ /g, "-");
  if (venues[dashed]) return dashed;
  for (const [key, venue] of Object.entries(venues)) {
    const name = venue.name.toLowerCase();
    const keyWords = key.replace(/-/g, " ");
    if (text === keyWords || text.includes(keyWords) || name.includes(text) || text.includes(name)) {
      return key;
    }
    const paren = name.match(/\(([^)]+)\)/);
    if (paren && text === paren[1].toLowerCase()) return key;
  }
  return undefined;
}

export function nearestVenue(lat: number, lng: number, maxMeters = 400): string | undefined {
  let bestKey: string | undefined;
  let best = Infinity;
  for (const [key, venue] of Object.entries(venues)) {
    const meters = distanceMeters(lat, lng, venue.lat, venue.lng);
    if (meters < best) {
      best = meters;
      bestKey = key;
    }
  }
  return bestKey && best <= maxMeters ? bestKey : undefined;
}

export function walkMinutes(lat: number, lng: number): number {
  const meters = distanceMeters(lat, lng, 41.3113, -72.925);
  return Math.max(1, Math.round(meters / 80));
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radius = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(a));
}
