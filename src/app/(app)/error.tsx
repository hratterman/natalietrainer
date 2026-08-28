"use client";

import Link from "next/link";
import { CenterCard } from "@/components/ui/CenterCard";

// Note: the heading here must never read "Something went wrong" — that exact
// string belongs to SessionRunner's in-session error card and E2E asserts on it.
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <CenterCard title="This page hit an error" subtitle="Nothing is lost — your progress is saved on the server.">
      <div className="flex justify-center gap-3">
        <button onClick={reset} className="btn btn-primary">
          Try again
        </button>
        <Link href="/" className="btn btn-secondary">
          Back to dashboard
        </Link>
      </div>
    </CenterCard>
  );
}
