"use client";

import { useEffect, useState } from "react";
import { Mark } from "@/components/Mark";
import { sweepClock } from "@/lib/activityLog";
import type { LiveCounts } from "@/lib/types";

export function Header({ counts }: { counts: LiveCounts | null }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const time = now
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      }).format(now)
    : "—";

  const emails = counts ? String(counts.emails) : "—";
  const events = counts ? String(counts.events) : "—";
  const halls = counts ? String(counts.halls) : "—";
  const sweep = sweepClock(counts?.lastSweep ?? null);

  return (
    <header className="flex items-center justify-between gap-4 border-b border-white/7 px-5 py-3">
      <div className="flex shrink-0 items-center gap-3">
        <Mark className="h-8 w-8" />
        <h1 className="text-[15px] font-semibold tracking-[0.18em] text-ink">ELI</h1>
      </div>
      <p className="status-strip">
        {emails} emails · {events} events · {halls} halls · last sweep {sweep}
      </p>
      <div className="shrink-0 text-right text-[12px] text-muted">
        <p className="font-mono text-ink tabular-nums">{time}</p>
        <p className="mt-0.5">Powered by Grok</p>
      </div>
    </header>
  );
}
