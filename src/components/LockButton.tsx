"use client";

import { useRouter } from "next/navigation";
import { LockIcon } from "./ui/icons";

/** Signs out (clears the PIN cookie) and returns to the login screen. */
export function LockButton() {
  const router = useRouter();
  async function lock() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }
  return (
    <button
      type="button"
      data-testid="lock"
      onClick={() => void lock()}
      className="btn btn-ghost btn-sm"
      title="Lock the app (PIN required to get back in)"
    >
      <LockIcon />
      Lock
    </button>
  );
}
