"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Nav item with an active state: current section gets full ink + underline. */
export function NavLink({
  href,
  match,
  exact = false,
  children,
}: {
  href: string;
  /** Path prefix that counts as "in this section" (defaults to href). */
  match?: string;
  exact?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const section = match ?? href;
  const active = exact
    ? pathname === href
    : pathname === section || pathname.startsWith(`${section}/`);
  return (
    <Link
      href={href}
      className={`relative py-3.5 text-sm transition-colors ${
        active
          ? "font-semibold text-ink-900 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
          : "text-ink-600 hover:text-ink-900"
      }`}
    >
      {children}
    </Link>
  );
}
