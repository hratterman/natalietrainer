import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { NavLink } from "@/components/NavLink";

/** App shell: every signed-in page gets the nav; /login lives outside this group. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-line bg-surface-1/90 backdrop-blur">
        <nav
          data-tour="nav"
          className="mx-auto flex max-w-6xl items-center gap-7 px-6"
        >
          <Link href="/" className="py-2.5">
            <Logo />
          </Link>
          <NavLink href="/" exact>
            Dashboard
          </NavLink>
          <NavLink href="/train">Train</NavLink>
          <NavLink href="/history">History</NavLink>
          <div className="ml-auto" />
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </>
  );
}
