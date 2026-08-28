import type { Area } from "../types";

export const credit: Area = {
  id: "cr",
  name: "Debt & Credit Analysis",
  tier: 2,
  weight: 4,
  subtopics: [
    {
      id: "cr.ratios",
      name: "Credit Ratios & Capacity",
      archetypes: [
        {
          id: "cr.ratios.core-metrics",
          name: "Leverage and coverage metrics",
          description:
            "The core credit stack: gross/net leverage (debt/EBITDA), interest coverage (EBITDA/interest, EBITDA−capex/interest), FCF/debt. Compute each from given figures and interpret against rough rating bands (IG roughly <3x, HY 4-6x+, varying by sector stability). Difficulty 4: given a P&L and debt schedule, compute the full ratio set fast and state whether the credit is IG or HY and why sector matters.",
          difficultyRange: [2, 4],
          followUpAxes: [
            "Compute net leverage and coverage from these numbers.",
            "Why can a utility carry more leverage than a retailer at the same rating?",
            "Which single metric would you weight most for this borrower?",
          ],
          answerFormat: "walkthrough",
          sampleQuestion:
            "A company has $200 EBITDA, $50 capex, $900 total debt, $100 cash, and pays 8% average interest. Compute net leverage, interest coverage, and EBITDA-minus-capex coverage — then tell me: investment grade or high yield, and what else you'd want to know.",
        },
        {
          id: "cr.ratios.debt-capacity",
          name: "Debt capacity analysis",
          description:
            "How much debt can this business carry? Work from EBITDA stability, FCF conversion, and coverage constraints to a supportable debt quantum: e.g. 'lenders want 2x coverage minimum — at 8% rates, what leverage does $100 of EBITDA support?' Difficulty 4-5 adds cyclicality stress (EBITDA down 30% in a downturn — does the structure survive?) and the maturity-wall dimension.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Stress EBITDA down 30% — which constraint breaks first?",
            "Back out the maximum leverage that keeps 2x coverage at these rates.",
            "How does capex intensity change the answer?",
          ],
          answerFormat: "walkthrough",
        },
      ],
    },
    {
      id: "cr.structure",
      name: "Seniority & Structure",
      archetypes: [
        {
          id: "cr.structure.seniority",
          name: "Ranking the capital structure",
          description:
            "Order a real capital structure by priority: secured (first/second lien) vs unsecured vs subordinated, structural subordination (opco vs holdco debt — why holdco lenders recover less), contractual subordination, and guarantees (upstream/downstream) as fixes. Difficulty 5: given an org chart with debt at different entities, rank expected recoveries and explain each layer's position.",
          difficultyRange: [2, 5],
          followUpAxes: [
            "Why does holdco debt recover less than opco debt — mechanically?",
            "What does an upstream guarantee change here?",
            "Rank these five instruments for me in a default.",
          ],
          answerFormat: "walkthrough",
          sampleQuestion:
            "OpCo has $500 of secured debt and $200 unsecured; HoldCo, which owns OpCo, has $300 of notes with no guarantees. The enterprise is worth $800 in a default. Walk me through who gets what and why.",
        },
        {
          id: "cr.structure.hy-vs-ig",
          name: "High yield vs investment grade",
          description:
            "The two credit worlds: covenant packages (incurrence vs maintenance), call protection (HY callable after non-call period, IG make-whole), disclosure and buyer bases, spread behavior (HY trades more like equity in stress). Explain why the line at BBB-/BB+ matters so much (forced selling, index eligibility, cost cliff). Difficulty 4: implications of a fallen-angel downgrade for the issuer's stack.",
          difficultyRange: [2, 4],
          followUpAxes: [
            "What actually happens to an issuer's bonds the day it loses IG?",
            "Why do HY bonds carry call protection but loans mostly don't?",
            "When do HY spreads behave like equity, and why?",
          ],
          answerFormat: "walkthrough",
        },
      ],
    },
  ],
};
