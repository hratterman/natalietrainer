import type { Area } from "../types";

export const behavioral: Area = {
  id: "bh",
  name: "Behavioral with Technical Follow-ups",
  tier: 2,
  weight: 4,
  subtopics: [
    {
      id: "bh.story",
      name: "Your Story Under Pressure",
      archetypes: [
        {
          id: "bh.story.resume-walk",
          name: "Resume walkthrough with probing",
          description:
            "'Walk me through your resume' — but interviewed the superday way: the interviewer picks the most finance-relevant item the candidate mentions and drills into it ('you said you built a model there — what drove the valuation?'). Generation sets up the opening ask plus instructions to probe whatever the candidate offers; grading scores narrative arc (past → why finance → why now), specificity, and how well the technical detail holds up under the drill.",
          difficultyRange: [2, 4],
          followUpAxes: [
            "Pick the most quantitative thing they mention and drill into its mechanics.",
            "Why this path and not consulting or buy-side directly?",
            "Ask for the specific number or result behind a claim.",
          ],
          answerFormat: "conversational",
          sampleQuestion:
            "Walk me through your resume — two minutes. I'll stop you where I get curious.",
        },
        {
          id: "bh.story.why-banking",
          name: "Why banking, with pushback",
          description:
            "'Why investment banking?' and 'why our bank?' asked with skeptical follow-ups: the interviewer pushes on clichés ('you'd learn a lot in consulting too — why us?'), tests whether the candidate knows what analysts actually do, and probes commitment ('the hours are brutal — what makes you sure?'). Graded on specificity (deal types, groups, named reasons) and composure under pushback, not on polish alone.",
          difficultyRange: [2, 4],
          followUpAxes: [
            "Push back on any generic reason with a credible alternative path.",
            "What does an analyst actually spend time doing in month three?",
            "Why this group specifically?",
          ],
          answerFormat: "conversational",
        },
      ],
    },
    {
      id: "bh.deals",
      name: "Deal & Market Talk",
      archetypes: [
        {
          id: "bh.deals.deal-discussion",
          name: "A deal you followed, grilled",
          description:
            "'Tell me about a recent deal you found interesting' — then the technical grilling: what multiple was paid and vs comps, how it was financed, strategic rationale, expected accretion, market reaction, would you have done it? The candidate supplies her own deal; generation sets up the ask and instructs the interviewer to grill the mechanics of whatever deal is offered for internal consistency. Grading scores whether the numbers hang together and whether she has a view.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "What multiple did that imply, and how did it compare to precedents?",
            "How was it financed, and what did that do to the acquirer's balance sheet?",
            "Would you have advised the buyer to do it? Why?",
          ],
          answerFormat: "conversational",
          sampleQuestion:
            "Tell me about a deal from the last year that you found interesting. I want the terms, the rationale, and — most importantly — your view on whether it was a good deal.",
        },
        {
          id: "bh.deals.failure-teamwork",
          name: "Fit stories with an analyst lens",
          description:
            "The standard fit set — a failure and what you learned, a team conflict, leading under deadline, handling ambiguous instructions — but probed for the traits banking screens for: ownership, attention to detail, stamina, coachability. Follow-ups push past rehearsed answers ('what exactly did YOU do?', 'what would the other person say about you?'). Graded on STAR-style structure, specificity, and self-awareness.",
          difficultyRange: [2, 4],
          followUpAxes: [
            "Separate what the team did from what you personally did.",
            "What would the person you clashed with say about you?",
            "What did you change afterward — concretely?",
          ],
          answerFormat: "conversational",
        },
      ],
    },
  ],
};
