"use client";

import { useEffect, useState } from "react";
import { Mark } from "@/components/Mark";

type Message = {
  role: "you" | "eli";
  text: string;
};

const LINES = ["sniffing the panlists…", "checking the butteries…", "boola boola…"];

const STARTERS = [
  "What's happening tonight?",
  "Where's free food right now?",
  "What am I missing this week?",
];

const FOLLOWUPS = [
  "Plan my evening around this",
  "What's near TD?",
  "What's still open for dinner?",
];

const PLACEHOLDERS = [
  "What's happening tonight?",
  "Where's free food?",
  "What am I missing this week?",
];

export function ChatDock() {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [placeholder, setPlaceholder] = useState(0);

  useEffect(() => {
    if (!busy) return;
    const id = window.setInterval(() => setTick((value) => value + 1), 1400);
    return () => window.clearInterval(id);
  }, [busy]);

  useEffect(() => {
    const id = window.setInterval(() => setPlaceholder((value) => value + 1), 3200);
    return () => window.clearInterval(id);
  }, []);

  async function send(text?: string) {
    const message = (text ?? draft).trim();
    if (!message || busy) return;
    setDraft("");
    setBusy(true);
    setMessages((current) => [...current, { role: "you", text: message }]);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = (await response.json()) as { summary?: string };
      const reply =
        typeof data.summary === "string" && data.summary.trim()
          ? data.summary.trim()
          : "Lost that one in the stacks. Try again.";
      setMessages((current) => [...current, { role: "eli", text: reply }]);
    } catch {
      setMessages((current) => [
        ...current,
        { role: "eli", text: "Lost that one in the stacks. Try again." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const lastYou = [...messages].reverse().find((message) => message.role === "you");
  const lastEli = [...messages].reverse().find((message) => message.role === "eli");
  const chips = lastEli ? FOLLOWUPS : STARTERS;

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
        <div className="max-h-28 space-y-1.5 overflow-y-auto border-b border-white/[0.07] px-4 py-3">
          {lastYou && (
            <p className="text-[13px] leading-5 text-muted">
              <span className="mr-2 font-mono text-[10px] tracking-wide uppercase">You</span>
              {lastYou.text}
            </p>
          )}
          {lastEli && (
            <p className="text-[13px] leading-5 text-ink">
              <span className="mr-2 font-mono text-[10px] tracking-wide text-muted uppercase">Eli</span>
              {lastEli.text}
            </p>
          )}
          {busy && (
            <p className="flex items-center gap-2 text-[13px] text-muted">
              <Mark className="mark-think h-4 w-4" />
              {LINES[tick % LINES.length]}
            </p>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 px-4 py-3">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={PLACEHOLDERS[placeholder % PLACEHOLDERS.length]}
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
    </div>
    </div>
  );
}
