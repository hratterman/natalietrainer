import type { Area } from "../types";

export const valuation: Area = {
  id: "val",
  name: "Valuation: Comps & Precedents",
  tier: 1,
  weight: 8,
  subtopics: [
    {
      id: "val.multiples",
      name: "Multiples Mechanics",
      archetypes: [
        {
          id: "val.multiples.consistency",
          name: "Numerator/denominator consistency",
          description:
            "The rule that the numerator's claim must match the denominator's claim: EV pairs with pre-interest metrics (EBITDA, EBIT, revenue), equity value pairs with post-interest metrics (net income, book equity). Ask why EV/net-income or P/EBITDA are broken, and at higher difficulty give a subtly inconsistent multiple and make the candidate spot and fix it (e.g. EV/levered FCF).",
          difficultyRange: [1, 4],
          followUpAxes: [
            "Why exactly is EV/net income wrong — who gets what cash flow?",
            "Is price-to-sales ever defensible? When?",
            "Fix this multiple so it's consistent, two different ways.",
          ],
          answerFormat: "walkthrough",
          sampleQuestion:
            "Why can't you use EV/net income as a multiple? And if I insisted on using net income, what numerator would make it consistent?",
        },
        {
          id: "val.multiples.divergence",
          name: "Why identical companies trade differently",
          description:
            "Two companies in the same industry with similar financials trade at different EV/EBITDA multiples — enumerate real reasons: growth, margins/returns on capital, risk, capital intensity, accounting differences (leases, capitalization), one-time items in the denominator, liquidity, control/holding discounts. Difficulty 5 frames it as 'multiples are shorthand for a DCF' and asks the candidate to map each driver to its DCF analog.",
          difficultyRange: [2, 5],
          followUpAxes: [
            "Map each reason you gave to what it means in DCF terms.",
            "Which of those differences would you adjust for, and which are real?",
            "If growth explains it, roughly how much premium does 2% extra growth justify?",
          ],
          answerFormat: "walkthrough",
        },
        {
          id: "val.multiples.ebitda-flaws",
          name: "EBITDA's flaws and alternatives",
          description:
            "Why EBITDA is used (capital-structure and D&A neutral proxy for operating cash flow) and where it misleads: ignores capex, working capital, SBC, lease geography post-ASC 842. Candidate should name situations where EBITDA badly overstates cash generation (capex-heavy industries) and propose alternatives (EBITDA − capex, EBIT, unlevered FCF, EBITDAR). Negative-EBITDA companies: what multiples remain (revenue, gross profit, per-user/unit metrics) and their dangers.",
          difficultyRange: [2, 5],
          followUpAxes: [
            "Give an industry where EV/EBITDA badly misleads and why.",
            "What do you use when EBITDA is negative, and what's the risk?",
            "Is EBITDA − capex better? What does it still miss?",
          ],
          answerFormat: "walkthrough",
        },
        {
          id: "val.multiples.industry",
          name: "Industry-specific multiples",
          description:
            "Multiples that dominate specific sectors and why: P/B and P/TBV for banks (balance-sheet businesses; why EV metrics break for banks), EV/EBITDAR for airlines/retail leases, EV/production or reserves for E&P, price-per-subscriber or EV/ARR for telecom/SaaS, FFO/AFFO multiples for REITs, EV per bed/room for hospitals/hotels. Candidate must justify why the standard metric fits the economics of the sector.",
          difficultyRange: [2, 4],
          followUpAxes: [
            "Why do EV multiples break for banks specifically?",
            "What is the risk of valuing on EV/ARR alone?",
            "Pick the right multiple for this business and defend it.",
          ],
          answerFormat: "walkthrough",
        },
      ],
    },
    {
      id: "val.comps",
      name: "Comps & Precedent Transactions",
      archetypes: [
        {
          id: "val.comps.building",
          name: "Building and using a comp set",
          description:
            "How to select comparable companies (business model, size, growth, margins, geography), scrub the metrics (calendarize, remove one-timers, normalize for leases/SBC), and apply the range to the target — including why you use a range rather than the mean and when to look at medians vs quartiles. Difficulty 4: hand the candidate a flawed comp set and have them critique it.",
          difficultyRange: [2, 4],
          followUpAxes: [
            "What adjustments would you make to this EBITDA before comping it?",
            "Median or mean — which and why?",
            "Which single comp would you throw out of this set, and why?",
          ],
          answerFormat: "walkthrough",
        },
        {
          id: "val.comps.precedents",
          name: "Precedents vs trading comps",
          description:
            "Why precedent transactions typically show higher multiples than trading comps: control premium, synergies baked into price, competitive processes, different market windows. When precedents mislead (stale vintage, different rate environments, scarcity value). Difficulty 5: candidate ranks expected valuation outputs across methodologies for a specific target and defends the ordering.",
          difficultyRange: [2, 5],
          followUpAxes: [
            "Why would a buyer pay the control premium — what do they get?",
            "When would precedents actually come in *below* trading comps?",
            "How stale is too stale for a precedent deal?",
          ],
          answerFormat: "walkthrough",
        },
      ],
    },
    {
      id: "val.framework",
      name: "Methodology Frameworks",
      archetypes: [
        {
          id: "val.framework.football-field",
          name: "Football field reasoning",
          description:
            "Rank the standard methodologies (trading comps, precedents, DCF, LBO analysis) by the values they typically produce for a given company and defend the ordering: LBO as a floor (financial buyer's max price at required returns), precedents high (control + synergies), DCF wide (assumption-driven). Difficulty 5: give a scenario where the typical ordering inverts (e.g. depressed public markets, DCF below comps) and make the candidate reason through it.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Why is an LBO analysis usually the floor?",
            "Construct a scenario where the DCF is the *lowest* output.",
            "Which method would you weight most for this specific company?",
          ],
          answerFormat: "walkthrough",
          sampleQuestion:
            "Rank comps, precedents, DCF, and LBO analysis from lowest to highest implied value for a typical company — and then give me a realistic situation where that ordering breaks.",
        },
        {
          id: "val.framework.sotp",
          name: "Sum-of-the-parts",
          description:
            "When SOTP is the right tool (conglomerates, mixed-economics segments), mechanics (segment EBITDA × segment-appropriate multiples, minus corporate costs, net debt), and the conglomerate discount — why the sum often exceeds the traded price and what catalysts close the gap. Difficulty 4–5 includes handling unallocated corporate overhead and cross-holdings.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "How do you treat corporate overhead in an SOTP?",
            "Why does the market apply a conglomerate discount?",
            "What catalysts would close the SOTP gap?",
          ],
          answerFormat: "walkthrough",
        },
        {
          id: "val.framework.when-methods-fail",
          name: "When standard methods fail",
          description:
            "Valuation for hard cases: pre-revenue companies (option-style, comparable funding rounds), banks (dividend discount, P/TBV vs ROTE), highly cyclical businesses (normalized mid-cycle earnings), companies in distress (asset value, liquidation). The candidate must pick and defend an approach for a curveball company.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Why does a standard DCF break for this company?",
            "What would you anchor on instead, and what's the biggest risk in it?",
            "How do you sanity-check a valuation with no earnings?",
          ],
          answerFormat: "walkthrough",
        },
      ],
    },
  ],
};
