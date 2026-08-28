/**
 * The mark: three ascending bars in an oxford-blue square — mastery stepping
 * up. Same glyph as src/app/icon.svg; keep them in sync.
 */
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden
      className="shrink-0"
    >
      <rect width="32" height="32" rx="7" fill="var(--color-primary)" />
      <rect x="7" y="17" width="4.5" height="8" rx="1.2" fill="#ffffff" opacity="0.55" />
      <rect x="13.75" y="12" width="4.5" height="13" rx="1.2" fill="#ffffff" opacity="0.78" />
      <rect x="20.5" y="7" width="4.5" height="18" rx="1.2" fill="#ffffff" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      <span className="text-[15px] font-bold tracking-tight text-ink-900">
        Natalie<span className="text-primary">Trainer</span>
      </span>
    </span>
  );
}
