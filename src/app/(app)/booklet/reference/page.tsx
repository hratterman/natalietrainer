import Link from "next/link";
import { referenceSections } from "@/lib/booklet/engine";

export const dynamic = "force-dynamic";

const DECK_NOTES: Record<string, string | null> = {
  technical: null,
  fit: "These need YOUR stories — memorizing the guide's sample answers verbatim would sound canned. Use them as structure, then build your own with the coach.",
  experience:
    "Same rule: these only work with your own deals and experiences. The guide shows the expected structure.",
};

const DECK_HEADINGS: Record<string, string> = {
  technical: "Technical canon — drilled to cold",
  fit: "Fit & background — personalize, don't memorize",
  experience: "Transaction experience — personalize, don't memorize",
};

export default function BookletReferencePage() {
  const sections = referenceSections();

  if (sections.length === 0) {
    return (
      <div className="mx-auto max-w-xl card card-pad text-center">
        <p className="text-sm text-ink-600">The question guide isn&apos;t loaded yet.</p>
        <Link href="/booklet" className="btn btn-secondary btn-sm mt-3">
          Back to the Booklet
        </Link>
      </div>
    );
  }

  const decks: ("technical" | "fit" | "experience")[] = ["technical", "fit", "experience"];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">Reference</h1>
        <p className="mt-1 text-sm text-ink-600">
          Every question in the guide with its canonical answer. Reading is not studying — the
          queue is where it sticks — but this is the place to look something up.
        </p>
      </div>

      {decks.map((deck) => {
        const deckSections = sections.filter((s) => s.deck === deck);
        if (deckSections.length === 0) return null;
        return (
          <section key={deck}>
            <h2 className="text-lg font-semibold text-ink-900">{DECK_HEADINGS[deck]}</h2>
            {DECK_NOTES[deck] && (
              <p className="mt-1 rounded-control border border-warn/30 bg-warn-tint px-3 py-2 text-xs text-warn">
                {DECK_NOTES[deck]}
              </p>
            )}
            <div className="mt-3 space-y-3">
              {deckSections.map((section) => (
                <details key={section.sectionId} className="card overflow-hidden">
                  <summary className="cursor-pointer select-none px-5 py-3 text-sm font-semibold text-ink-900 hover:bg-surface-2">
                    {section.sectionName}
                    <span className="ml-2 text-xs font-normal text-ink-400">
                      {section.items.length} question{section.items.length === 1 ? "" : "s"}
                    </span>
                  </summary>
                  <div className="divide-y divide-line border-t border-line">
                    {section.items.map((item) => (
                      <div key={item.id} className="px-5 py-4">
                        <p className="text-sm font-medium text-ink-900">{item.question}</p>
                        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-600">
                          {item.answer}
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
