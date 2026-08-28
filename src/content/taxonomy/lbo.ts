import type { Area } from "../types";

export const lbo: Area = {
  id: "lbo",
  name: "LBO",
  tier: 1,
  weight: 9,
  subtopics: [
    {
      id: "lbo.intuition",
      name: "LBO Intuition & Drivers",
      archetypes: [
        {
          id: "lbo.intuition.leverage-returns",
          name: "Why leverage amplifies returns",
          description:
            "Demonstrate with numbers why debt magnifies equity returns: same asset, same exit, different financing — compute MOIC with 0%, 50%, 70% debt. Then the honest counterpart: leverage equally magnifies downside and adds fixed obligations. The house-with-a-mortgage analogy is fine but the candidate must do the arithmetic. Difficulty 4–5 adds the nuance that debt paydown is itself a return source even with zero growth.",
          difficultyRange: [2, 5],
          followUpAxes: [
            "Rerun the numbers with EBITDA down 20% at exit — what happens to each case?",
            "If leverage boosts returns, why not use 99% debt?",
            "Show me a positive return with zero EBITDA growth and zero multiple expansion.",
          ],
          answerFormat: "walkthrough",
          sampleQuestion:
            "You buy a $100 asset and sell it for $120 in five years. Compute your MOIC if you fund it with all equity, then with 50% debt, then with 70% debt (assume debt is interest-only and repaid at exit). What does this tell you — and what's the catch?",
        },
        {
          id: "lbo.intuition.ideal-target",
          name: "Ideal LBO target",
          description:
            "The characteristics that make a good LBO candidate — stable predictable cash flows, low capex needs, strong market position, deleveraging capacity, cost/operational improvement levers, viable exit paths, undervalued entry — and, per characteristic, *why* it matters to the leverage math. Difficulty 4: present two candidate companies and have the candidate pick and defend, or identify why a beloved growth company is a poor LBO.",
          difficultyRange: [2, 4],
          followUpAxes: [
            "Why does capex intensity matter so much to a sponsor?",
            "Between these two businesses, which is the better LBO and why?",
            "Can a cyclical business ever be a good LBO target?",
          ],
          answerFormat: "walkthrough",
        },
        {
          id: "lbo.intuition.value-attribution",
          name: "Value creation attribution",
          description:
            "Decompose an LBO's equity return into EBITDA growth, multiple expansion, and deleveraging (cash generation/debt paydown). Given entry/exit EBITDA, multiples, and debt levels, attribute the value created to each lever with numbers. Difficulty 5: discuss which sources are 'earned' vs market beta, and how attribution shapes how LPs judge a GP.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Attribute this deal's return across the three levers with numbers.",
            "Which lever is most within the sponsor's control?",
            "Why do LPs discount returns driven by multiple expansion?",
          ],
          answerFormat: "walkthrough",
        },
      ],
    },
    {
      id: "lbo.paper",
      name: "Paper LBO",
      archetypes: [
        {
          id: "lbo.paper.full",
          name: "Full paper LBO",
          description:
            "The flagship timed exercise. Generate clean round numbers: entry EBITDA and multiple, leverage (turns of EBITDA), EBITDA growth rate, a simple FCF-conversion assumption for debt paydown (e.g. ~50% of EBITDA after interest, taxes, capex), exit multiple and year. Candidate computes: entry TEV and equity check, exit EBITDA (mental compounding), exit TEV, remaining net debt after cumulative paydown, exit equity, MOIC, and approximate IRR using the standard anchors (2.0x over 5 years ≈ 15%, 2.5x ≈ 20%, 3.0x ≈ 25%; doubling in 3 years ≈ 26%). Numbers must stay mental-math friendly. Vary every input between instances; occasionally make the exit multiple lower than entry to test composure.",
          difficultyRange: [4, 5],
          followUpAxes: [
            "What's the IRR if the same MOIC takes seven years instead of five?",
            "Which single assumption is your return most sensitive to?",
            "Rerun exit at one turn lower multiple — MOIC now?",
          ],
          answerFormat: "walkthrough",
          sampleQuestion:
            "A sponsor buys a company with $100 of EBITDA at 10x, funding it with 5x of debt. EBITDA grows 10% a year for five years; roughly half of EBITDA each year goes to paying down debt. Exit at 10x in year five. Talk me through to MOIC and approximate IRR — no calculator.",
        },
        {
          id: "lbo.paper.fragments",
          name: "Paper LBO fragments",
          description:
            "Isolated pieces of the paper LBO done fast: compound $100 EBITDA at 10% for 5 years in your head; convert a MOIC and horizon to approximate IRR; compute the equity check from TEV and leverage; cumulative debt paydown from an annual FCF number. Ideal for rapid-fire. Each instance is one computation with one clean answer.",
          difficultyRange: [3, 4],
          followUpAxes: [
            "Now do it over a different horizon.",
            "What's the rule-of-thumb linking MOIC and IRR you just used?",
            "Sanity-check that with the rule of 72.",
          ],
          answerFormat: "numeric",
        },
      ],
    },
    {
      id: "lbo.debt",
      name: "Debt Instruments & Terms",
      archetypes: [
        {
          id: "lbo.debt.stack",
          name: "The debt stack",
          description:
            "The LBO capital structure from top to bottom: revolver, term loan A/B, senior secured notes, senior unsecured/subordinated notes, mezzanine/PIK, preferred, common. For each layer: relative pricing, security, amortization behavior (TLA amortizes, TLB nominal 1% with cash sweep, bonds bullet), floating vs fixed, call protection. Difficulty 4–5: given a sources & uses, order the stack, price it sensibly relative to a base rate, and explain who buys each layer.",
          difficultyRange: [2, 5],
          followUpAxes: [
            "Why is the revolver priced tightest despite being drawn last?",
            "TLB vs high-yield bond — pick one for this deal and defend it.",
            "What is call protection and why do bond buyers demand it?",
          ],
          answerFormat: "walkthrough",
        },
        {
          id: "lbo.debt.covenants",
          name: "Covenants & credit terms",
          description:
            "Maintenance covenants (tested quarterly — leverage/coverage ceilings, now mostly in revolvers: 'cov-lite') vs incurrence covenants (tested on actions — bonds), typical covenant packages, EBITDA definitional games (addbacks), baskets and carve-outs. Difficulty 4–5: given deteriorating numbers, identify when each covenant type trips and what happens next (waiver, amendment, default).",
          difficultyRange: [3, 5],
          followUpAxes: [
            "EBITDA falls 25% — which covenants trip first and what happens?",
            "Why did the market move to cov-lite, and who bears that risk?",
            "What are EBITDA addbacks and why do lenders fight over the definition?",
          ],
          answerFormat: "walkthrough",
        },
      ],
    },
    {
      id: "lbo.returns",
      name: "Returns Math & Sensitivities",
      archetypes: [
        {
          id: "lbo.returns.irr-moic",
          name: "IRR vs MOIC tension",
          description:
            "The time dimension: same MOIC over different horizons gives very different IRRs (2.5x over 3 years ≈ 36% vs over 5 years ≈ 20%). Candidate computes both directions (MOIC+time→IRR, IRR+time→MOIC) with anchor approximations, and reasons about when a GP prefers a quick 2x versus a slow 3x — including fund-level incentives (IRR optics, capital redeployment risk, carry timing).",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Same 2.5x in 3 years vs 5 years — approximate both IRRs.",
            "Which would the LP prefer, and is that the same as the GP?",
            "Why do GPs use subscription lines, and what does it do to IRR?",
          ],
          answerFormat: "walkthrough",
          sampleQuestion:
            "Your fund can sell a portfolio company today for a 2.0x after three years, or hold two more years for an expected 2.8x. Approximate the IRR of each path and tell me which you'd take — and whether your LPs would agree.",
        },
        {
          id: "lbo.returns.recap-sensitivity",
          name: "Dividend recaps & leverage sensitivity",
          description:
            "A dividend recapitalization: re-lever mid-hold to pay the sponsor a dividend — mechanics, effect on IRR (up: early cash back) vs MOIC (roughly flat to slightly up), and the risk transfer to creditors. More broadly: how adding a turn of leverage at entry shifts the return distribution — higher expected IRR, fatter left tail. Difficulty 5 quantifies a recap's IRR impact on a concrete timeline.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Quantify roughly what the recap does to IRR on this timeline.",
            "Who loses when a recap goes wrong?",
            "Why does more leverage raise expected IRR but not obviously expected value?",
          ],
          answerFormat: "walkthrough",
        },
      ],
    },
    {
      id: "lbo.model",
      name: "LBO Model Mechanics",
      archetypes: [
        {
          id: "lbo.model.sources-uses",
          name: "Sources & uses and the equity check",
          description:
            "Assemble sources & uses for a buyout: purchase of equity, refinance of existing debt, fees, minimum cash on sources side funded by each debt tranche and the sponsor equity plug. Candidate builds it from a term sheet and derives the equity check and opening balance sheet. Difficulty 4–5 adds management rollover and OID/financing fees treatment.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Where does management rollover show up, and what does it do to the sponsor's check?",
            "How are financing fees treated on the opening balance sheet and over time?",
            "Why is there a minimum cash line in uses?",
          ],
          answerFormat: "walkthrough",
        },
        {
          id: "lbo.model.debt-schedule",
          name: "Debt schedule & circularity",
          description:
            "The debt schedule's order of operations: cash available for debt paydown → mandatory amortization → cash sweep by seniority → revolver as the plug (draws when short, repays first when flush). The interest-circularity problem (interest depends on debt balances; balances depend on paydown; paydown depends on cash after interest) and its fixes (average-balance convention, iteration, or circularity switch). Difficulty 5: walk a year of the schedule with numbers including a revolver draw.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Walk one year of this schedule with actual numbers.",
            "Where exactly is the circularity, and how do models break it?",
            "When does the revolver draw, and what repays first the next year?",
          ],
          answerFormat: "walkthrough",
        },
      ],
    },
  ],
};
