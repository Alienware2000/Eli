"use client";

import { MapContainer, Marker, Popup, TileLayer, ZoomControl } from "react-leaflet";
import L from "leaflet";
import type { Card } from "@/lib/types";
import { cardTiming } from "@/lib/timing";
import { venues, walkMinutes } from "@/lib/venues";
import "leaflet/dist/leaflet.css";

const COLLEGES: Record<string, string> = {
  "timothy-dwight": "TD",
  "jonathan-edwards": "JE",
  sss: "SSS",
  morse: "Morse",
  "ezra-stiles": "Stiles",
  berkeley: "Berkeley",
  branford: "Branford",
  saybrook: "Saybrook",
  davenport: "Davenport",
  pierson: "Pierson",
  trumbull: "Trumbull",
  silliman: "Silliman",
  "grace-hopper": "Hopper",
  "pauli-murray": "Pauli",
  "benjamin-franklin": "Franklin",
};

const YOU: [number, number] = [41.3113, -72.925];
const iconCache = new Map<string, L.DivIcon>();

function iconFor(className: string, label: string | undefined, hot: boolean) {
  const key = `${className}:${label ?? ""}:${hot ? "1" : "0"}`;
  const cached = iconCache.get(key);
  if (cached) return cached;
  const width = Math.max(28, (label?.length ?? 2) * 7);
  const icon = L.divIcon({
    className: "eli-pin",
    html: `<span class="pin-stack"><span class="mark-pin ${className}${hot ? " pin-hot" : ""}"></span>${
      label ? `<span class="college-label">${label}</span>` : ""
    }</span>`,
    iconSize: [width, label ? 28 : 16],
    iconAnchor: [width / 2, 8],
  });
  iconCache.set(key, icon);
  return icon;
}

function youIcon() {
  return iconForYou();
}

function iconForYou() {
  const cached = iconCache.get("you");
  if (cached) return cached;
  const icon = L.divIcon({
    className: "eli-pin",
    html: `<span class="you-pin"></span>`,
    iconSize: [8, 8],
    iconAnchor: [4, 4],
  });
  iconCache.set("you", icon);
  return icon;
}

function labelIcon(label: string) {
  const key = `label:${label}`;
  const cached = iconCache.get(key);
  if (cached) return cached;
  const width = Math.max(28, label.length * 7);
  const icon = L.divIcon({
    className: "eli-pin",
    html: `<span class="college-label">${label}</span>`,
    iconSize: [width, 14],
    iconAnchor: [width / 2, 7],
  });
  iconCache.set(key, icon);
  return icon;
}

function pinClass(card: Card): string {
  if (card.type === "event" && card.freeFood) return "pin-food";
  const timing = cardTiming(card);
  if (card.type === "food") return timing === "ended" ? "pin-ended" : timing === "open" ? "pin-open" : "pin-dot";
  if (timing === "now") return "pin-now";
  if (timing === "soon") return "pin-soon";
  if (timing === "ended") return "pin-ended";
  return "pin-dot";
}

function primaryCard(list: Card[]): Card {
  return (
    list.find((card) => card.type === "event" && card.freeFood) ??
    list.find((card) => card.type === "food" && cardTiming(card) === "open") ??
    list.find((card) => cardTiming(card) === "now") ??
    list.find((card) => cardTiming(card) === "soon") ??
    list[0]
  );
}

function oneLine(card: Card): string {
  const text =
    card.type === "event" || card.type === "opp"
      ? card.blurb
      : card.type === "food"
        ? card.items.slice(0, 3).join(", ")
        : card.type === "pulse"
          ? card.text
          : card.steps.map((step) => step.what).join(" · ");
  return text.length > 90 ? `${text.slice(0, 88)}…` : text;
}

function whenOf(card: Card): string {
  if (card.type === "event" || card.type === "food") return card.when;
  if (card.type === "opp") return card.deadline;
  if (card.type === "plan") return card.steps[0]?.time ?? "";
  return "";
}

export default function CampusMap({
  cards,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
}: {
  cards: Card[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const byVenue = new Map<string, Card[]>();
  for (const card of cards) {
    if (!card.venue || !venues[card.venue]) continue;
    const list = byVenue.get(card.venue) ?? [];
    list.push(card);
    byVenue.set(card.venue, list);
  }

  const keys = new Set<string>([...Object.keys(COLLEGES), ...byVenue.keys()]);

  return (
    <MapContainer
      center={[41.3111, -72.9274]}
      zoom={16}
      minZoom={15}
      maxZoom={19}
      zoomControl={false}
      maxBounds={[
        [41.3, -72.945],
        [41.322, -72.912],
      ]}
      maxBoundsViscosity={1}
      className="h-full w-full"
    >
      <TileLayer
        attribution="© OpenStreetMap"
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <ZoomControl position="topright" />
      <Marker position={YOU} icon={youIcon()} zIndexOffset={50}>
        <Popup>
          <p className="pop-title">You are here</p>
          <p className="pop-time">Tsai CITY</p>
        </Popup>
      </Marker>
      {[...keys].map((key) => {
        const venue = venues[key];
        if (!venue) return null;
        const here = byVenue.get(key) ?? [];
        const card = here.length > 0 ? primaryCard(here) : undefined;
        const label = COLLEGES[key];
        const hot = here.some((item) => item.id === hoveredId || item.id === selectedId);
        const icon = card ? iconFor(pinClass(card), label, hot) : labelIcon(label ?? venue.name);
        const minutes = walkMinutes(venue.lat, venue.lng);
        return (
          <Marker
            key={key}
            position={[venue.lat, venue.lng]}
            icon={icon}
            zIndexOffset={card ? 200 : 0}
            eventHandlers={{
              click: () => {
                if (card) onSelect(card.id);
              },
              mouseover: () => {
                if (card) onHover(card.id);
              },
              mouseout: () => onHover(null),
            }}
          >
            <Popup>
              {card ? (
                <>
                  <p className="pop-title">{card.title}</p>
                  <p className="pop-time">{whenOf(card)}</p>
                  <p className="pop-line">{oneLine(card)}</p>
                  <p className="pop-walk">~{minutes} min walk</p>
                </>
              ) : (
                <>
                  <p className="pop-title">{venue.name}</p>
                  <p className="pop-walk">~{minutes} min walk</p>
                </>
              )}
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
