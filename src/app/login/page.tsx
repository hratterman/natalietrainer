import type { Metadata } from "next";
import { LogoMark } from "@/components/ui/Logo";
import { PinPad } from "./PinPad";

export const metadata: Metadata = { title: "Unlock" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { from } = await searchParams;
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="card w-full max-w-xs p-8 text-center">
        <div className="flex justify-center">
          <LogoMark size={44} />
        </div>
        <h1 className="mt-4 text-lg font-bold tracking-tight text-ink-900">
          Natalie<span className="text-primary">Trainer</span>
        </h1>
        <p className="mt-1 text-sm text-ink-600">Enter your PIN to start training.</p>
        <div className="mt-6">
          <PinPad from={typeof from === "string" ? from : undefined} />
        </div>
      </div>
    </div>
  );
}
