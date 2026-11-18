"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { ActivityTicker } from "@/components/ActivityTicker";
import { CardRail } from "@/components/CardRail";
import { ChatDock } from "@/components/ChatDock";
import { Header } from "@/components/Header";
import { Intro } from "@/components/Intro";
import { HEADS_UP_ID } from "@/lib/brief";
import type { Activity, Card, LiveCounts } from "@/lib/types";
import { matchesFilter, type BoardFilter } from "@/lib/timing";

const CampusMap = dynamic(() => import("@/components/CampusMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-base text-[13px] text-muted">
      reading campus emails…
    </div>
  ),
});

export function Picture() {
  const [cards, setCards] = useState<Card[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [counts, setCounts] = useState<LiveCounts | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [filter, setFilter] = useState<BoardFilter>("all");
  const [intro, setIntro] = useState(true);
  const [layoutNonce, setLayoutNonce] = useState(0);

  const finishIntro = useCallback(() => {
    setIntro(false);
    setLayoutNonce((nonce) => nonce + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [boardRes, activityRes] = await Promise.all([
          fetch("/api/board", { cache: "no-store" }),
          fetch("/api/activity", { cache: "no-store" }),
        ]);
        if (!boardRes.ok || !activityRes.ok) throw new Error("board");
        const board = (await boardRes.json()) as { cards?: Card[] };
        const feed = (await activityRes.json()) as {
          activity?: Activity[];
          counts?: LiveCounts | null;
        };
        if (cancelled) return;
        setCards(Array.isArray(board.cards) ? board.cards : []);
        setActivity(Array.isArray(feed.activity) ? feed.activity : []);
        setCounts(feed.counts ?? null);
        setReady(true);
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    const id = window.setInterval(load, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  function select(id: string) {
    setSelectedId(id);
  }

  const visible = cards.filter(
    (card) => card.id !== HEADS_UP_ID && matchesFilter(card, filter),
  );

  const headsUp = cards.find((card) => card.id === HEADS_UP_ID);

  return (
    <>
      <div className="board flex h-full min-h-0 flex-col text-ink" inert={intro ? true : undefined}>
      <Header counts={counts} />
      <div className="stage">
        <div className="map-pane">
          <div className="map-key" aria-hidden="true">
            <span><i className="kind-now" /> Tonight</span>
            <span><i className="kind-soon" /> Soon</span>
            <span><i className="kind-food" /> Free food</span>
            <span><i className="kind-open" /> Open now</span>
            <span><i className="kind-due" /> Deadline</span>
            <span><i className="kind-week" /> Later</span>
          </div>
          <CampusMap
            key={layoutNonce}
            cards={visible}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelect={select}
            onHover={setHoveredId}
          />
        </div>
        <CardRail
          cards={cards}
          ready={ready}
          error={error}
          selectedId={selectedId}
          hoveredId={hoveredId}
          filter={filter}
          onFilter={setFilter}
          onSelect={select}
          onHover={setHoveredId}
        />
      </div>
      <ActivityTicker activity={activity} />
      <ChatDock headsUp={headsUp} />
      </div>
      {intro && <Intro onDone={finishIntro} />}
    </>
  );
}
