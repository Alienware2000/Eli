"use client";

import { useEffect, useRef, useState } from "react";
import { HEADS_UP_ID } from "@/lib/brief";
import type { Card } from "@/lib/types";
import { matchesFilter, type BoardFilter } from "@/lib/timing";

const FILTERS: Array<{ id: BoardFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "tonight", label: "Tonight" },
  { id: "food", label: "Free food" },
  { id: "open", label: "Open now" },
  { id: "deadlines", label: "Deadlines" },
];

const LABELS: Record<Card["type"], string> = {
  event: "Event",
  food: "Dining",
  pulse: "Pulse",
  plan: "Plan",
  opp: "Deadline",
};

type SourceView =
  | { kind: "email"; text: string }
  | { kind: "url"; href: string; label: string }
  | { kind: "text"; text: string };

export function CardRail({
  cards,
  ready,
  error,
  selectedId,
  hoveredId,
  filter,
  onFilter,
  onSelect,
  onHover,
}: {
  cards: Card[];
  ready: boolean;
  error: boolean;
  selectedId: string | null;
  hoveredId: string | null;
  filter: BoardFilter;
  onFilter: (filter: BoardFilter) => void;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const seen = useRef(new Set<string>());
  const [fresh, setFresh] = useState(new Set<string>());
  const [openId, setOpenId] = useState<string | null>(null);
  const brief = cards.find((card) => card.id === HEADS_UP_ID);
  const visible = cards.filter((card) => card.id !== HEADS_UP_ID && matchesFilter(card, filter));

  useEffect(() => {
    const arrived: string[] = [];
    for (const card of cards) {
      if (!seen.current.has(card.id)) arrived.push(card.id);
    }
    if (seen.current.size === 0) {
      for (const id of arrived) seen.current.add(id);
      return;
    }
    if (arrived.length === 0) return;
    for (const id of arrived) seen.current.add(id);
    setFresh(new Set(arrived));
  }, [cards]);

  useEffect(() => {
    if (!selectedId) return;
    document.getElementById(`card-${selectedId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [selectedId]);

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-white/7 bg-base">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-mono text-[13px] tracking-wide text-ink">Right now</h2>
          <p className="font-mono text-[11px] text-muted">{visible.length}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`chip ${filter === item.id ? "is-on" : ""}`}
              onClick={() => onFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pt-1 pb-40">
        {!ready && !error && <p className="text-[13px] text-muted">sniffing the panlists…</p>}
        {error && cards.length === 0 && (
          <p className="text-[13px] text-muted">Lost that one in the stacks. Try again.</p>
        )}
        {ready && visible.length === 0 && (
          <p className="text-[13px] text-muted">Quiet night at Yale. Ask me what&apos;s coming.</p>
        )}
        {brief && (
          <CardArticle
            card={brief}
            fresh={fresh.has(brief.id)}
            selected={selectedId === brief.id || hoveredId === brief.id}
            open={openId === brief.id}
            onSelect={onSelect}
            onHover={onHover}
            onToggle={() => setOpenId((current) => (current === brief.id ? null : brief.id))}
          />
        )}
        {visible.map((card) => (
          <CardArticle
            key={card.id}
            card={card}
            fresh={fresh.has(card.id)}
            selected={selectedId === card.id || hoveredId === card.id}
            open={openId === card.id}
            onSelect={onSelect}
            onHover={onHover}
            onToggle={() => setOpenId((current) => (current === card.id ? null : card.id))}
          />
        ))}
      </div>
    </aside>
  );
}

function CardArticle({
  card,
  fresh,
  selected,
  open,
  onSelect,
  onHover,
  onToggle,
}: {
  card: Card;
  fresh: boolean;
  selected: boolean;
  open: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onToggle: () => void;
}) {
  return (
    <article
      id={`card-${card.id}`}
      className={`card px-4 py-3.5 ${card.id === HEADS_UP_ID ? "card-brief" : ""} ${
        fresh ? "card-settle" : ""
      } ${selected ? "is-open" : ""}`}
      onMouseEnter={() => onHover(card.id)}
      onMouseLeave={() => onHover(null)}
    >
      <button
        type="button"
        onClick={() => {
          onSelect(card.id);
          onToggle();
        }}
        className="block w-full text-left"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] tracking-[0.16em] text-muted uppercase">
            {card.id === HEADS_UP_ID ? "Eli" : LABELS[card.type]}
          </span>
          {card.type === "event" && card.freeFood && (
            <span className="font-mono text-[10px] tracking-wide text-amber uppercase">Free food</span>
          )}
        </div>
        <h3 className="mt-2 text-[15px] leading-snug font-medium text-ink">{card.title}</h3>
        <CardBody card={card} />
        <p className="source-block">
          <span className="tracking-[0.14em] uppercase">Source</span>
          <span className="mt-1 block">{card.source}</span>
        </p>
      </button>
      {open && <Receipt id={card.id} />}
    </article>
  );
}

function Receipt({ id }: { id: string }) {
  const [receipt, setReceipt] = useState<SourceView | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/receipt?id=${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("receipt");
        return response.json() as Promise<SourceView>;
      })
      .then((data) => {
        if (!cancelled) setReceipt(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (failed) return <p className="receipt">Lost that one in the stacks. Try again.</p>;
  if (!receipt) return <p className="receipt">pulling the source…</p>;
  if (receipt.kind === "url") {
    return (
      <p className="receipt">
        <a href={receipt.href} target="_blank" rel="noreferrer">
          {receipt.href}
        </a>
        <span className="mt-1 block">{receipt.label}</span>
      </p>
    );
  }
  return <p className="receipt">{receipt.kind === "email" ? receipt.text : receipt.text}</p>;
}

function CardBody({ card }: { card: Card }) {
  if (card.type === "event") {
    return (
      <>
        <p className="mt-1.5 font-mono text-[12px] text-accent">
          {card.when} · {card.where}
        </p>
        <p className="mt-2 text-[13px] leading-5 text-muted">{card.blurb}</p>
      </>
    );
  }
  if (card.type === "food") {
    return (
      <>
        <p className="mt-1.5 font-mono text-[12px] text-accent">
          {card.hall} · {card.when}
        </p>
        <p className="mt-2 text-[13px] leading-5 text-muted">{card.items.join(" · ")}</p>
      </>
    );
  }
  if (card.type === "pulse") {
    return <p className="mt-2 text-[13px] leading-5 text-muted">{card.text}</p>;
  }
  if (card.type === "opp") {
    return (
      <>
        <p className="mt-1.5 font-mono text-[12px] text-accent">
          {card.org} · {card.deadline}
        </p>
        <p className="mt-2 text-[13px] leading-5 text-muted">{card.blurb}</p>
      </>
    );
  }
  return (
    <ol className="mt-3 space-y-2 border-l border-white/10 pl-3">
      {card.steps.map((step) => (
        <li key={`${step.time}-${step.what}`}>
          <p className="font-mono text-[11px] text-accent">{step.time}</p>
          <p className="text-[13px] text-ink">{step.what}</p>
          <p className="text-[12px] text-muted">{step.where}</p>
        </li>
      ))}
    </ol>
  );
}
