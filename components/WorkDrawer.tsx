"use client";

import { useEffect, useRef, useState } from "react";
import { latestReceipt, logLine, workerPulse } from "@/lib/activityLog";
import type { Activity } from "@/lib/types";

export function WorkDrawer({ activity }: { activity: Activity[] }) {
  const [now, setNow] = useState(() => Date.now());
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const el = panel.current;
    const board = el?.closest(".board");
    if (!el || !board || !(board instanceof HTMLElement)) return;
    const sync = () => board.style.setProperty("--drawer-h", `${el.offsetHeight}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => {
      observer.disconnect();
      board.style.removeProperty("--drawer-h");
    };
  }, []);

  const receipt = latestReceipt(activity);
  const workers = workerPulse(activity, now);
  const rows = [...activity].reverse().map(logLine);
  const count = receipt.lines.length;

  return (
    <div className="work-drawer" role="dialog" aria-label="What Eli checked" ref={panel}>
      {count === 0 ? (
        <p className="receipt-head">Eli is listening</p>
      ) : (
        <>
          <p className="receipt-head">
            Eli checked {count} {count === 1 ? "source" : "sources"}
            <span> · {receipt.time}</span>
          </p>
          <ul className="receipt-list">
            {receipt.lines.map((line) => (
              <li key={line.key} className="receipt-line">
                <span className={`receipt-mark${line.ok ? "" : " is-off"}`} aria-hidden="true">
                  {line.ok ? "✓" : "×"}
                </span>
                <span>
                  {line.label} — {line.detail}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {rows.length > 0 && (
        <div className="log-table">
          <div className="worker-row">
            {workers.map((worker) => (
              <p key={worker.name} className="worker">
                <span className={`worker-dot${worker.fresh ? " is-live" : ""}`} aria-hidden="true" />
                <strong>{worker.name}</strong>
                <span>{worker.lastRun}</span>
                <span>{worker.items === "—" ? "no run" : `${worker.items} found`}</span>
              </p>
            ))}
          </div>
          <div className="log-row log-head" aria-hidden="true">
            <span>time</span>
            <span>worker</span>
            <span>action</span>
            <span>result</span>
            <span>duration</span>
          </div>
          {rows.map((row) => (
            <div key={row.id} className="log-row">
              <span>{row.time}</span>
              <span className="log-worker">{row.worker}</span>
              <span>{row.action}</span>
              <span className="log-result">{row.result}</span>
              <span className="log-duration">{row.duration}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
