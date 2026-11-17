"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { ActivityTicker } from "@/components/ActivityTicker";
import { CardRail } from "@/components/CardRail";
import { ChatDock } from "@/components/ChatDock";
import { Header } from "@/components/Header";
import { Intro } from "@/components/Intro";
import { HEADS_UP_ID } from "@/lib/brief";
import type { Activity, Card } from "@/lib/types";
import { matchesFilter, type BoardFilter } from "@/lib/timing";

const CampusMap = dynamic(() => import("@/components/CampusMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-base font-mono text-[13px] text-muted">
      sniffing the panlists…
    </div>
  ),
});

export function Picture() {
  const [cards, setCards] = useState<Card[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
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
        const feed = (await activityRes.json()) as { activity?: Activity[] };
        if (cancelled) return;
        setCards(Array.isArray(board.cards) ? board.cards : []);
        setActivity(Array.isArray(feed.activity) ? feed.activity : []);
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

  return (
    <div className="board flex h-full min-h-0 flex-col text-ink">
      <Header />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(300px,min(400px,38vw))]">
        <div className="relative min-h-0">
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
      <ChatDock />
      {intro && <Intro onDone={finishIntro} />}
    </div>
  );
}
