import { Suspense } from "react";
import type { Metadata } from "next";
import { Spinner } from "@/components/ui/Spinner";
import { AREAS } from "@/content/taxonomy";
import { PERSONAS } from "@/lib/llm/personas";
import { voiceAvailable } from "@/lib/voice/openai";
import { SetupForm, type SetupTaxonomy } from "./SetupForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New session" };

export default function NewSessionPage() {
  const taxonomy: SetupTaxonomy = {
    areas: AREAS.map((a) => ({
      id: a.id,
      name: a.name,
      tier: a.tier,
      subtopics: a.subtopics.map((s) => ({ id: s.id, name: s.name })),
    })),
    personas: PERSONAS.map((p) => ({ id: p.id, name: p.name, blurb: p.blurb })),
  };
  return (
    <Suspense
      fallback={
        <div className="flex justify-center pt-24">
          <Spinner label="Loading…" />
        </div>
      }
    >
      <SetupForm taxonomy={taxonomy} voiceAvailable={voiceAvailable()} />
    </Suspense>
  );
}
