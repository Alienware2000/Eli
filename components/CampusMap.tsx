"use client";

import { useEffect, useRef, useState } from "react";
import {
  AttributionControl,
  LngLatBounds,
  Map as MlMap,
  Marker,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type FilterSpecification,
  type MapLibreEvent,
} from "maplibre-gl";

setWorkerUrl("/maplibre-gl-worker.mjs");
import type { Card } from "@/lib/types";
import { cardTiming } from "@/lib/timing";
import { venues, walkMinutes } from "@/lib/venues";
import "maplibre-gl/dist/maplibre-gl.css";

const STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const CENTER: [number, number] = [-72.9274, 41.3111];
const YOU: [number, number] = [-72.925, 41.3113];

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

type Handlers = {
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
};

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function popupHtml(title: string, time: string, line: string, minutes: number): string {
  return `<p class="pop-title">${esc(title)}</p>${
    time ? `<p class="pop-time">${esc(time)}</p>` : ""
  }${line ? `<p class="pop-line">${esc(line)}</p>` : ""}<p class="pop-walk">~${minutes} min walk</p>`;
}

function markerHtml(dot: string | null, label: string | undefined, hot: boolean): string {
  const pin = dot
    ? `<span class="mark-pin ${dot}${hot ? " pin-hot" : ""}"></span>`
    : "";
  const text = label ? `<span class="college-label">${esc(label)}</span>` : "";
  return `<span class="pin-stack">${pin}${text}</span>`;
}

function quietLabels(map: MlMap) {
  for (const layer of map.getStyle()?.layers ?? []) {
    if (layer.type !== "symbol") continue;
    const id = layer.id.toLowerCase();
    const sourceLayer = "source-layer" in layer ? String(layer["source-layer"]).toLowerCase() : "";
    const poi = sourceLayer === "pois" || /poi|park|playground|housenumber/.test(id);
    if (poi && !id.startsWith("water")) map.setLayoutProperty(layer.id, "visibility", "none");
  }
  for (const id of ["watername_lake", "watername_lake_pois", "watername_lake_line"]) {
    if (!map.getLayer(id)) continue;
    const current = map.getFilter(id);
    const drop: FilterSpecification = [
      "!",
      ["in", ["get", "kind"], ["literal", ["fountain", "basin", "playground"]]],
    ];
    map.setFilter(id, (current ? ["all", current, drop] : drop) as FilterSpecification);
  }
}

function extrude(map: MlMap) {
  quietLabels(map);
  if (map.getLayer("eli-buildings")) return;
  const layers = map.getStyle().layers ?? [];
  const building = layers.find((layer) => layer.id === "building");
  if (!building || !("source" in building) || typeof building.source !== "string") return;
  const sourceLayer = "source-layer" in building ? building["source-layer"] : undefined;
  if (!sourceLayer) return;
  const before = layers.find((layer) => layer.type === "symbol")?.id;
  map.addLayer(
    {
      id: "eli-buildings",
      type: "fill-extrusion",
      source: building.source,
      "source-layer": sourceLayer,
      minzoom: 14,
      paint: {
        "fill-extrusion-color": "#1A2030",
        "fill-extrusion-opacity": 0.9,
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], ["get", "height"], 8],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], ["get", "min_height"], 0],
      },
    },
    before,
  );
  if (map.getLayer("building")) map.setLayoutProperty("building", "visibility", "none");
  if (map.getLayer("building-top")) map.setLayoutProperty("building-top", "visibility", "none");
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
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; popup: Popup }>());
  const seen = useRef<Set<string> | null>(null);
  const framed = useRef("");
  const handlers = useRef<Handlers>({ onSelect, onHover });
  const [ready, setReady] = useState(false);
  handlers.current = { onSelect, onHover };

  useEffect(() => {
    const node = host.current;
    if (!node || mapRef.current) return;
    const map = new MlMap({
      container: node,
      style: STYLE,
      center: CENTER,
      zoom: 15.5,
      pitch: 55,
      bearing: -17,
      minZoom: 15,
      maxZoom: 19,
      maxBounds: [
        [-72.945, 41.3],
        [-72.912, 41.322],
      ],
      attributionControl: false,
    });
    map.addControl(new AttributionControl({ compact: false }), "bottom-left");
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");

    const you = document.createElement("div");
    you.className = "eli-marker";
    you.innerHTML = `<span class="you-pin"></span>`;
    const youPopup = new Popup({ offset: 12, closeButton: true }).setHTML(
      `<p class="pop-title">You are here</p><p class="pop-time">Tsai CITY</p>`,
    );
    new Marker({ element: you, anchor: "center" })
      .setLngLat(YOU)
      .setPopup(youPopup)
      .addTo(map);

    let idleAt = performance.now();
    const touch = () => {
      idleAt = performance.now();
    };
    map.on("mousedown", touch);
    map.on("wheel", touch);
    map.on("touchstart", touch);
    map.on("dragstart", touch);
    const gesture = (event: MapLibreEvent) => {
      if (event.originalEvent) touch();
    };
    map.on("zoomstart", gesture);
    map.on("rotatestart", gesture);
    map.on("pitchstart", gesture);

    let last = performance.now();
    let frame = 0;
    const spin = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (now - idleAt >= 30000 && !map.isMoving()) {
        map.setBearing(map.getBearing() + 0.3 * dt);
      }
      frame = requestAnimationFrame(spin);
    };
    frame = requestAnimationFrame(spin);

    map.on("load", () => {
      extrude(map);
      setReady(true);
    });
    mapRef.current = map;
    return () => {
      cancelAnimationFrame(frame);
      markers.current.forEach((item) => item.marker.remove());
      markers.current.clear();
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    let frame = false;
    if (seen.current === null) {
      seen.current = new Set(cards.map((card) => card.id));
      frame = cards.some((card) => card.venue && venues[card.venue]);
    } else {
      const fresh = cards.filter((card) => !seen.current?.has(card.id));
      for (const card of cards) seen.current.add(card.id);
      frame = fresh.length > 0;
    }

    const byVenue = new Map<string, Card[]>();
    for (const card of cards) {
      if (!card.venue || !venues[card.venue]) continue;
      const list = byVenue.get(card.venue) ?? [];
      list.push(card);
      byVenue.set(card.venue, list);
    }
    const keys = new Set<string>([...Object.keys(COLLEGES), ...byVenue.keys()]);

    for (const [key, item] of markers.current) {
      if (!keys.has(key)) {
        item.marker.remove();
        markers.current.delete(key);
      }
    }

    for (const key of keys) {
      const venue = venues[key];
      if (!venue) continue;
      const here = byVenue.get(key) ?? [];
      const card = here.length > 0 ? primaryCard(here) : undefined;
      const label = COLLEGES[key];
      const hot = here.some((item) => item.id === selectedId || item.id === hoveredId);
      const html = markerHtml(card ? pinClass(card) : null, label, hot);
      const minutes = walkMinutes(venue.lat, venue.lng);
      const body = card
        ? popupHtml(card.title, whenOf(card), oneLine(card), minutes)
        : popupHtml(venue.name, "", "", minutes);
      const anchor = card ? "top" : "center";
      let record = markers.current.get(key);
      if (record && record.marker.getElement().dataset.anchor !== anchor) {
        record.marker.remove();
        markers.current.delete(key);
        record = undefined;
      }
      if (!record) {
        const element = document.createElement("div");
        element.className = "eli-marker";
        element.dataset.anchor = anchor;
        element.dataset.cardId = card?.id ?? "";
        element.addEventListener("click", () => {
          const id = element.dataset.cardId;
          if (id) handlers.current.onSelect(id);
        });
        element.addEventListener("mouseenter", () => {
          const id = element.dataset.cardId;
          if (id) handlers.current.onHover(id);
        });
        element.addEventListener("mouseleave", () => handlers.current.onHover(null));
        const popup = new Popup({ offset: 14, closeButton: true, maxWidth: "240px" });
        const marker = new Marker({ element, anchor })
          .setLngLat([venue.lng, venue.lat])
          .setPopup(popup)
          .addTo(map);
        record = { marker, popup };
        markers.current.set(key, record);
      }
      const element = record.marker.getElement();
      element.dataset.cardId = card?.id ?? "";
      if (element.dataset.html !== html) {
        element.innerHTML = html;
        element.dataset.html = html;
      }
      record.popup.setHTML(body);
    }

    if (frame && byVenue.size > 0) {
      const first = framed.current === "";
      framed.current = "set";
      const bounds = new LngLatBounds();
      for (const key of byVenue.keys()) {
        const venue = venues[key];
        if (venue) bounds.extend([venue.lng, venue.lat]);
      }
      map.fitBounds(bounds, {
        padding: { top: 48, right: 28, bottom: 148, left: 24 },
        pitch: map.getPitch() || 55,
        bearing: map.getBearing(),
        maxZoom: 16.2,
        duration: first ? 0 : 800,
      });
    }
  }, [cards, hoveredId, ready, selectedId]);

  return <div ref={host} className="campus-map h-full w-full" />;
}
