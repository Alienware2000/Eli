"use client";

import { useEffect, useRef, useState } from "react";

export function Intro({ onDone }: { onDone: () => void }) {
  const [letters, setLetters] = useState(0);
  const [tagline, setTagline] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const done = useRef(false);
  const fading = useRef(false);
  const skipTimer = useRef<number | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finish = () => {
      if (done.current) return;
      done.current = true;
      onDone();
    };
    const timers = [
      window.setTimeout(() => setLetters(reduce ? 3 : 1), reduce ? 0 : 280),
      window.setTimeout(() => setLetters(reduce ? 3 : 2), reduce ? 0 : 620),
      window.setTimeout(() => setLetters(3), reduce ? 0 : 980),
      window.setTimeout(() => setTagline(true), reduce ? 0 : 1200),
      window.setTimeout(() => {
        fading.current = true;
        setLeaving(true);
      }, 2500),
      window.setTimeout(finish, 2900),
    ];
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      if (skipTimer.current != null) window.clearTimeout(skipTimer.current);
    };
  }, [onDone]);

  function skip() {
    if (done.current || fading.current) return;
    fading.current = true;
    setLeaving(true);
    skipTimer.current = window.setTimeout(() => {
      if (done.current) return;
      done.current = true;
      onDone();
    }, 400);
  }

  return (
    <button
      type="button"
      onClick={skip}
      className={`intro${leaving ? " is-leaving" : ""}`}
      aria-label="Skip the intro"
    >
      <p className="text-6xl font-semibold tracking-[0.28em] text-ink">
        {"ELI".slice(0, letters)}
        <span className="type-caret" aria-hidden="true" />
      </p>
      <p
        className={`mt-4 text-sm tracking-wide text-muted transition-opacity duration-500 ${
          tagline ? "opacity-100" : "opacity-0"
        }`}
      >
        Yale, right now.
      </p>
    </button>
  );
}
