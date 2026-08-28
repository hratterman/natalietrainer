import { Spinner } from "@/components/ui/Spinner";

export default function Loading() {
  return (
    <div className="flex justify-center pt-24">
      <Spinner label="Loading…" />
    </div>
  );
}
