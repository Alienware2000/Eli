"use client";

import { useEffect, useRef, useState } from "react";
import type { Card } from "@/lib/types";

type Message = {
  role: "you" | "eli";
  text: string;
  steps?: string[];
};

const FALLBACK = "Lost that one in the stacks. Try again.";

function joinChat(current: string, next: string): string {
  if (!current) return next;
  if (!next) return current;
  if (/[.!?]["']?$/.test(current) && /^[A-Za-z]/.test(next)) return `${current} ${next}`;
  return current + next;
}

const REST_PLACEHOLDER = "Ask about a college, a deadline, a buttery…";
const HOW_PLACEHOLDER = "how do I drop a class, book a room, find my dean…";

function hourChip(date: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      hourCycle: "h23",
    }).format(date),
  );
  if (hour >= 5 && hour < 12) return "What's for lunch?";
  if (hour >= 12 && hour < 17) return "What's happening tonight?";
  if (hour >= 17 && hour < 21) return "What's still open?";
  return "What's tomorrow?";
}

function headsUpChip(card: Card | undefined): string {
  if (!card || card.type !== "plan") return "What's happening tonight?";
  const deadline = card.steps.find((step) => step.time === "Deadline");
  const food = card.steps.find((step) => step.time === "Free food");
  const due = deadline != null && !/nothing due/i.test(deadline.what);
  const liveFood = food != null && !/nothing free/i.test(food.what);
  if (due) return "What's due this week?";
  if (liveFood) return "Where's free food right now?";
  return "What's happening tonight?";
}

function visibleChips(chips: string[], placeholder: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const chip of chips) {
    if (chip === placeholder || seen.has(chip)) continue;
    seen.add(chip);
    out.push(chip);
  }
  return out;
}

export function ChatDock({ headsUp }: { headsUp?: Card }) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [how, setHow] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);

  async function send(text?: string) {
    const message = (text ?? draft).trim();
    if (!message || busy) return;
    setDraft("");
    setHow(false);
    setBusy(true);
    setMessages((current) => [
      ...current,
      { role: "you", text: message },
      { role: "eli", text: "", steps: [] },
    ]);
    const steps: string[] = [];
    let reply = "";
    const paint = () => {
      setMessages((current) => {
        const next = [...current];
        const last = next[next.length - 1];
        if (last?.role === "eli") next[next.length - 1] = { role: "eli", text: reply, steps: [...steps] };
        return next;
      });
    };
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!response.body) throw new Error("empty");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let event: { type?: string; text?: string };
          try {
            event = JSON.parse(line) as { type?: string; text?: string };
          } catch {
            continue;
          }
          if (event.type === "progress" && event.text) steps.push(event.text);
          else if (event.type === "delta" && event.text) reply = joinChat(reply, event.text);
          else if (event.type === "done" && !reply.trim() && event.text) reply = event.text;
          paint();
        }
      }
      if (!reply.trim()) reply = FALLBACK;
      paint();
    } catch {
      reply = FALLBACK;
      paint();
    } finally {
      setBusy(false);
    }
  }

  const lastYou = [...messages].reverse().find((message) => message.role === "you");
  const lastEli = [...messages].reverse().find((message) => message.role === "eli");
  const shownPlaceholder = how ? HOW_PLACEHOLDER : REST_PLACEHOLDER;
  const chips = visibleChips(
    [headsUpChip(headsUp), now ? hourChip(now) : "What's happening tonight?", "What am I missing this week?"],
    shownPlaceholder,
  );

  function askHow() {
    if (busy) return;
    setHow(true);
    inputRef.current?.focus();
  }

  return (
    <div className="dock">
    <form
      className="command"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      {(lastYou || lastEli || busy) && (
        <div ref={logRef} className="command-log space-y-1.5 border-b border-white/[0.07] px-4 py-3">
          {lastYou && (
            <p className="text-[13px] leading-5 text-muted">
              <span className="mr-2 text-[11px] text-muted">You</span>
              {lastYou.text}
            </p>
          )}
          {lastEli?.steps?.map((step, index) => (
            <p key={`${index}-${step}`} className="text-[13px] leading-5 text-ink">
              {step}
            </p>
          ))}
          {lastEli?.text ? (
            <p className="whitespace-pre-wrap text-[13px] leading-6 text-ink">
              <span className="mr-2 text-[11px] text-muted">Eli</span>
              {lastEli.text}
              {busy && <span className="type-caret" aria-hidden="true" />}
            </p>
          ) : (
            busy &&
            (lastEli?.steps?.length ?? 0) === 0 && (
              <p className="text-[13px] leading-5 text-muted">Checking…</p>
            )
          )}
        </div>
      )}
      <div className="command-input flex items-center gap-2 px-4 py-3">
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={shownPlaceholder}
          aria-label="Message Eli"
          disabled={busy}
          className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-muted disabled:opacity-60"
        />
      </div>
    </form>
    <div className="suggest">
      {chips.map((chip) => (
        <button key={chip} type="button" className="ask" disabled={busy} onClick={() => send(chip)}>
          {chip}
        </button>
      ))}
      <button type="button" className="ask" disabled={busy} onClick={askHow}>
        How do I…?
      </button>
    </div>
    </div>
  );
}
