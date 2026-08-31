import Link from "next/link";
import { getCanon } from "@/lib/booklet/canon";
import { getTodayQueue } from "@/lib/booklet/engine";
import { BookletRunner } from "@/components/booklet/BookletRunner";

export const dynamic = "force-dynamic";

export default function BookletSessionPage() {
  if (!getCanon()) {
    return (
      <div className="mx-auto max-w-xl card card-pad text-center">
        <p className="text-sm text-ink-600">The question guide isn&apos;t loaded yet.</p>
        <Link href="/booklet" className="btn btn-secondary btn-sm mt-3">
          Back to the Booklet
        </Link>
      </div>
    );
  }
  const queue = getTodayQueue();
  return <BookletRunner initial={queue} />;
}
