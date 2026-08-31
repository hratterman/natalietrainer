import { getTodayQueue } from "@/lib/booklet/engine";
import { BookletRunner } from "@/components/booklet/BookletRunner";

export const dynamic = "force-dynamic";

export default function BookletSessionPage() {
  return <BookletRunner initial={getTodayQueue()} />;
}
