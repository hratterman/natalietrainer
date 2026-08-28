import { Suspense } from "react";
import { AREAS } from "@/content/taxonomy";
import { PERSONAS } from "@/lib/llm/personas";
import { SetupForm, type SetupTaxonomy } from "./SetupForm";

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
    <Suspense>
      <SetupForm taxonomy={taxonomy} />
    </Suspense>
  );
}
