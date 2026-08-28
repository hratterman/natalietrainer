import type { Area } from "../types";

export const rx: Area = {
  id: "rx",
  name: "Restructuring & Distressed",
  tier: 2,
  weight: 3,
  subtopics: [
    {
      id: "rx.waterfall",
      name: "Waterfalls & the Fulcrum",
      archetypes: [
        {
          id: "rx.waterfall.recovery",
          name: "Recovery waterfall with numbers",
          description:
            "The signature RX exercise: given a capital structure (secured, unsecured, sub notes, equity) and a distressed enterprise value, run the waterfall — who is covered, who is impaired, who gets zero. Identify the fulcrum security (the class where value runs out — the one that converts to equity in a restructuring) and explain why distressed investors hunt for it. Vary the EV to move the fulcrum between classes at difficulty 5.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "The EV estimate rises $150 — where does the fulcrum move?",
            "Why does the fulcrum class end up owning the company?",
            "What does the fully-covered class care about in the negotiation?",
          ],
          answerFormat: "walkthrough",
          sampleQuestion:
            "A company has $400 of secured debt, $300 of unsecured notes, $100 of subordinated notes, and equity. The business is worth $550. Run the waterfall: recoveries by class, the fulcrum security, and what each class is fighting for in the restructuring.",
        },
        {
          id: "rx.waterfall.valuation-fight",
          name: "The valuation fight",
          description:
            "Why valuation is the central dispute in restructurings: junior classes argue for high EV (they're in the money), seniors argue low (take the company cheap). Connect to plan confirmation and cramdown intuition. Difficulty 4-5: given two EV estimates, articulate each class's argument and what evidence (comps, DCF in distress, market prices of the debt) each side leans on.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Which class wants the high valuation and why?",
            "How do market prices of the bonds inform the fight?",
            "What's wrong with running a normal DCF on a distressed company?",
          ],
          answerFormat: "walkthrough",
        },
      ],
    },
    {
      id: "rx.process",
      name: "Process: In & Out of Court",
      archetypes: [
        {
          id: "rx.process.options",
          name: "Out-of-court vs Chapter 11",
          description:
            "The restructuring toolkit: out-of-court exchanges/amend-and-extend (fast, cheap, but holdout problem) vs Chapter 11 (automatic stay, DIP financing priority, 363 asset sales, plan + cramdown to bind holdouts, but expensive and slow) vs prepackaged/pre-negotiated filings as the hybrid. Difficulty 4: given a situation (liquidity runway, creditor fragmentation, operational vs balance-sheet problem), recommend the path.",
          difficultyRange: [2, 4],
          followUpAxes: [
            "What is the holdout problem and how does Chapter 11 solve it?",
            "Why is DIP financing attractive to lenders?",
            "When is a 363 sale better than a plan of reorganization?",
          ],
          answerFormat: "walkthrough",
        },
        {
          id: "rx.process.distress-signs",
          name: "Distress diagnostics & runway",
          description:
            "Spotting distress early: liquidity runway math (cash + revolver availability vs burn and maturities), maturity walls, springing covenants, vendor terms tightening, debt trading levels as the market's verdict. Difficulty 4: given a liquidity schedule, compute months of runway and identify the trigger event. Distinguish operational distress (fix the business) from balance-sheet distress (fix the capital structure).",
          difficultyRange: [2, 4],
          followUpAxes: [
            "Compute the runway from these numbers.",
            "Operational or balance-sheet distress here — and why does it matter?",
            "What do the bonds trading at 60 tell you that the financials don't?",
          ],
          answerFormat: "walkthrough",
        },
      ],
    },
  ],
};
