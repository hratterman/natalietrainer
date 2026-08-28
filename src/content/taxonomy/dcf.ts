import type { Area } from "../types";

export const dcf: Area = {
  id: "dcf",
  name: "DCF & Cost of Capital",
  tier: 1,
  weight: 9,
  subtopics: [
    {
      id: "dcf.fcf",
      name: "Free Cash Flow Construction",
      archetypes: [
        {
          id: "dcf.fcf.ufcf-build",
          name: "Unlevered FCF derivation",
          description:
            "Build unlevered free cash flow line by line: EBIT → NOPAT (× (1−t)) → + D&A → − capex → − change in NWC. Candidate must explain *why* each adjustment exists (taxes on EBIT not EBT, D&A non-cash but tax-affecting, capex real cash, NWC ties up cash). Difficulty 4–5: compute UFCF from a messy income statement with one-time items to strip, or reconcile UFCF to levered FCF and explain what moves.",
          difficultyRange: [2, 5],
          followUpAxes: [
            "Why tax EBIT rather than pre-tax income?",
            "Why add back D&A but then subtract capex — don't they cancel?",
            "Bridge me from unlevered to levered FCF.",
          ],
          answerFormat: "walkthrough",
          sampleQuestion:
            "EBIT is $200, tax rate 25%, D&A $50, capex $70, working capital increases $20. Walk me to unlevered FCF, explaining why each line is there — then tell me what you'd also subtract to get levered FCF.",
        },
        {
          id: "dcf.fcf.drivers",
          name: "FCF driver sensitivities",
          description:
            "How value responds to changes in drivers: revenue growth vs margin vs capex intensity vs NWC efficiency. Give a change ('capex rises from 5% to 8% of revenue forever') and have the candidate reason directionally — and roughly quantitatively — about the DCF impact, including second-order effects (more capex → more future D&A → tax shield). Also the classic 'would you rather have 1% more growth or 1% more margin' style tradeoffs.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Quantify the first-year FCF impact of that change.",
            "What second-order effects show up over time?",
            "Which driver is this specific business most sensitive to?",
          ],
          answerFormat: "walkthrough",
        },
      ],
    },
    {
      id: "dcf.tv",
      name: "Terminal Value & Mechanics",
      archetypes: [
        {
          id: "dcf.tv.methods",
          name: "Gordon growth vs exit multiple",
          description:
            "The two terminal value methods, their formulas, and their failure modes: growth rates above GDP are indefensible; exit multiples import today's market mood into perpetuity. The marquee difficulty-5 move: back out the implied terminal growth rate from a chosen exit multiple (or the implied multiple from a growth rate) and judge whether it is sane. Requires the g = r − FCF/TV style inversion with actual numbers.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Back out what your exit multiple implies for terminal growth — is it defensible?",
            "Why is 5% perpetual growth a problem for a US industrial?",
            "Which method would you present to a client and why?",
          ],
          answerFormat: "walkthrough",
          sampleQuestion:
            "Your DCF uses a 12x EBITDA exit multiple. WACC is 10%. Terminal-year FCF is $80 on terminal EBITDA of $100. Back out the terminal growth rate that 12x implies and tell me whether it's reasonable.",
        },
        {
          id: "dcf.tv.midyear-mechanics",
          name: "Mid-year convention & discounting mechanics",
          description:
            "Discounting mechanics questions: why the mid-year convention exists (cash arrives throughout the year, not on Dec 31), which direction it moves value (up, roughly by (1+r)^0.5 ≈ 4–5% at typical rates), stub periods, and discounting the terminal value with the correct exponent (the classic error of discounting TV by n+1 or applying mid-year to an exit multiple TV). Difficulty 4–5 asks for the exact PV arithmetic on a short cash flow strip both ways.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Which direction does mid-year move value, and roughly how much?",
            "What exponent discounts the terminal value, and why do people get it wrong?",
            "Does mid-year convention apply to an exit-multiple terminal value?",
          ],
          answerFormat: "walkthrough",
        },
        {
          id: "dcf.tv.tv-dominance",
          name: "Terminal value dominance & sanity checks",
          description:
            "Terminal value is typically 60–80% of a DCF's value: why that is (perpetuity math), whether it invalidates the exercise, and the sanity checks bankers run (implied multiples, TV as % of EV, comparing implied terminal metrics to mature comps). Also 'when does a DCF simply not work' (banks — interest is operating; early-stage — no stable FCF; cyclicals — normalize first).",
          difficultyRange: [2, 5],
          followUpAxes: [
            "Is 75% of value in the terminal a problem? Defend both answers.",
            "Why can't you run a standard DCF on a bank?",
            "What checks would you run before showing this DCF to a client?",
          ],
          answerFormat: "walkthrough",
        },
      ],
    },
    {
      id: "dcf.wacc",
      name: "WACC & Cost of Capital",
      archetypes: [
        {
          id: "dcf.wacc.capm",
          name: "CAPM and WACC components",
          description:
            "Assemble WACC: cost of equity via CAPM (risk-free rate, beta, equity risk premium — where each number actually comes from in practice), after-tax cost of debt, market-value weights. Candidate computes a WACC from given inputs and defends the sourcing. Difficulty 4–5 probes: why market not book weights, what risk-free rate tenor, size premia, why beta measures systematic risk only.",
          difficultyRange: [2, 5],
          followUpAxes: [
            "Where would you actually get each input for a live deal?",
            "Why is cost of debt tax-adjusted but cost of equity not?",
            "Why market-value weights rather than book?",
          ],
          answerFormat: "walkthrough",
          sampleQuestion:
            "Risk-free rate 4%, beta 1.2, equity risk premium 5%, pre-tax cost of debt 6%, tax rate 25%, capital structure 70% equity / 30% debt. Walk me to WACC — and then tell me where each of those inputs would really come from.",
        },
        {
          id: "dcf.wacc.beta",
          name: "Unlevering and relevering beta",
          description:
            "The Hamada mechanics with real arithmetic: take comps' levered betas, unlever each at its capital structure (βU = βL / (1 + (1−t)·D/E)), average, relever at the target structure. Candidate must do the algebra with numbers and explain the *why*: isolating business risk from financial risk. Difficulty 5: private-company WACC end-to-end using a comp set.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Why do we unlever at all — what are we isolating?",
            "Relever at a different target structure — what happens to WACC?",
            "How would you build a WACC for a private company from scratch?",
          ],
          answerFormat: "walkthrough",
          sampleQuestion:
            "A comp has a levered beta of 1.5 with D/E of 1.0 and a 25% tax rate. Unlever it, then relever at your target's D/E of 0.5, and give me the new cost of equity with rf = 4% and ERP = 5%.",
        },
        {
          id: "dcf.wacc.leverage-curve",
          name: "WACC vs leverage",
          description:
            "Why WACC initially falls as cheap tax-advantaged debt replaces equity, then rises as distress costs and re-levered equity risk dominate — the U-shape and the notion of an optimal capital structure. Candidate should connect to Modigliani-Miller intuition (with and without taxes) and to why the cost of equity rises with leverage even as debt stays 'cheap'.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Why does cost of equity rise as you add debt?",
            "What does Modigliani-Miller say with no taxes — and what breaks it in reality?",
            "How would you find a company's optimal capital structure in practice?",
          ],
          answerFormat: "walkthrough",
        },
        {
          id: "dcf.wacc.discount-rate-matching",
          name: "Matching cash flows to discount rates",
          description:
            "The consistency rule: unlevered FCF pairs with WACC, levered FCF with cost of equity; nominal with nominal, real with real; currency of cash flows matches currency of rate. Give mismatched setups and have the candidate spot and fix them, and explain what error each mismatch produces (direction of over/under-valuation).",
          difficultyRange: [3, 5],
          followUpAxes: [
            "If you discount UFCF at cost of equity, which way is the value wrong?",
            "How do you handle a Brazilian-real cash flow stream in a USD model?",
            "When would you use APV instead of WACC?",
          ],
          answerFormat: "walkthrough",
        },
      ],
    },
  ],
};
