export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="10" fill="#1A1A1F" stroke="rgba(255,236,220,0.2)" />
      <text
        x="16"
        y="21.5"
        textAnchor="middle"
        fill="#F3ECE3"
        fontFamily="Inter, sans-serif"
        fontSize="16"
        fontWeight="600"
      >
        e
      </text>
    </svg>
  );
}
