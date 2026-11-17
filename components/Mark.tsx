export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#4D7CFE" />
      <path d="M16 26 L10 12 L26 22 Z" fill="#E6E9EF" />
      <path d="M48 26 L54 12 L38 22 Z" fill="#E6E9EF" />
      <ellipse cx="32" cy="36" rx="16" ry="13" fill="#E6E9EF" />
      <ellipse cx="32" cy="42.5" rx="9" ry="7" fill="#4D7CFE" />
      <ellipse cx="32" cy="40.5" rx="3" ry="2.2" fill="#0A0C10" />
      <circle cx="25.5" cy="33" r="1.7" fill="#0A0C10" />
      <circle cx="38.5" cy="33" r="1.7" fill="#0A0C10" />
    </svg>
  );
}
