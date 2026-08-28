import Link from "next/link";
import { CenterCard } from "@/components/ui/CenterCard";

export default function NotFound() {
  return (
    <CenterCard title="Page not found" subtitle="That link doesn't point anywhere anymore.">
      <Link href="/" className="btn btn-primary">
        Back to dashboard
      </Link>
    </CenterCard>
  );
}
