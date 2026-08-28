export function Spinner({ label, inline = false }: { label: string; inline?: boolean }) {
  return (
    <span
      className={`${inline ? "inline-flex" : "flex justify-center"} items-center gap-2 text-sm text-ink-600`}
    >
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line-strong border-t-primary" />
      {label}
    </span>
  );
}
