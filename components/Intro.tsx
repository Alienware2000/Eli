"use client";

import { useEffect, useState } from "react";

export function Intro({ onDone }: { onDone: () => void }) {
  const [letters, setLetters] = useState(0);
  const [tagline, setTagline] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers = [
      window.setTimeout(() => setLetters(reduce ? 3 : 1), reduce ? 0 : 280),
      window.setTimeout(() => setLetters(reduce ? 3 : 2), reduce ? 0 : 620),
      window.setTimeout(() => setLetters(3), reduce ? 0 : 980),
      window.setTimeout(() => setTagline(true), reduce ? 0 : 1200),
      window.setTimeout(() => setLeaving(true), 2500),
      window.setTimeout(onDone, 2750),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [onDone]);

  function skip() {
    setLeaving(true);
    onDone();
  }

  return (
    <button
      type="button"
      onClick={skip}
      className={`fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center bg-base transition-opacity duration-300 ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <p className="font-mono text-6xl tracking-[0.28em] text-ink">
        {"ELI".slice(0, letters)}
        <span className="type-caret" aria-hidden="true" />
      </p>
      <p
        className={`mt-4 font-mono text-sm tracking-wide text-muted transition-opacity duration-500 ${
          tagline ? "opacity-100" : "opacity-0"
        }`}
      >
        Yale, right now.
      </p>
    </button>
  );
}
