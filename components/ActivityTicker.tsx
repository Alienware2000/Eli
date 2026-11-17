"use client";

import type { Activity } from "@/lib/types";

export function ActivityTicker({ activity }: { activity: Activity[] }) {
  const lines = activity.slice(-3);
  if (lines.length === 0) {
    return (
      <div className="ticker">
        <p className="ticker-line is-newest">Eli · listening</p>
      </div>
    );
  }

  return (
    <div className="ticker" aria-live="polite">
      {lines.map((line, index) => (
        <p key={line.id} className={`ticker-line ${index === lines.length - 1 ? "is-newest" : ""}`}>
          <strong>{line.bot}</strong>
          <span> · {line.text}</span>
        </p>
      ))}
    </div>
  );
}
