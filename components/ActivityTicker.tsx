"use client";

import { useEffect, useState } from "react";
import { WorkDrawer } from "@/components/WorkDrawer";
import { logLine } from "@/lib/activityLog";
import type { Activity } from "@/lib/types";

export function ActivityTicker({ activity }: { activity: Activity[] }) {
  const [open, setOpen] = useState(false);
  const lines = activity.slice(-3).map(logLine);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="ticker-wrap">
      {open && <WorkDrawer activity={activity} />}
      <div
        role="button"
        tabIndex={0}
        className={`ticker${open ? " is-open" : ""}`}
        aria-expanded={open}
        aria-live="polite"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          setOpen((value) => !value);
        }}
      >
        {lines.length === 0 ? (
          <p className="ticker-line is-newest">Eli → listening</p>
        ) : (
          lines.map((line, index) => (
            <p
              key={line.id}
              className={`ticker-line ${index === lines.length - 1 ? "is-newest" : ""}`}
            >
              <strong>{line.worker}</strong>
              <span> → {line.result}</span>
            </p>
          ))
        )}
      </div>
    </div>
  );
}
