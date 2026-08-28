"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Nav item with an active state: current section gets full ink + underline. */
export function NavLink({
  href,
  exact = false,
  children,
}: {
  href: string;
  exact?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
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
