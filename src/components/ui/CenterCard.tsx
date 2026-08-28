/** Centered narrow card for standalone states (voice check, errors, learn status). */
export function CenterCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card mx-auto mt-16 max-w-md p-6 text-center">
      <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-ink-400">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}
