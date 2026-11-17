"use client";

import { useEffect, useState } from "react";
import { Mark } from "@/components/Mark";

export function Header() {
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

  return (
    <header className="flex items-center justify-between border-b border-white/7 px-5 py-3">
      <div className="flex items-center gap-3">
        <Mark className="h-8 w-8" />
        <h1 className="font-mono text-[15px] font-medium tracking-[0.22em] text-ink">ELI</h1>
      </div>
      <div className="text-right font-mono text-[12px] text-muted">
        <p className="text-ink tabular-nums">{time}</p>
        <p className="mt-0.5">Powered by Grok</p>
      </div>
    </header>
  );
}
