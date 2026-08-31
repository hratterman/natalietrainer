import type { BookletCanon } from "./types";

/**
 * Original, checked-in stand-in canon for tests and the offline e2e server
 * (`BOOKLET_FIXTURE=1`). Written from scratch — the real guide's text is
 * copyrighted and never enters the repo. Shapes mirror the real ingest:
 * same id/section conventions, technical + fit + experience decks.
 */
export const FIXTURE_CANON: BookletCanon = {
  version: 1,
  source: "Fixture canon (original content, tests only)",
  items: [
    {
      id: "accounting-basic-01",
      sectionId: "accounting-basic",
      sectionName: "Accounting — Basic",
      question: "Why can a profitable company still run out of cash?",
      answer:
        "Profit is accrual-based, cash is not. A company can book revenue it hasn't collected (growing receivables), tie cash up in inventory, or face debt maturities and capex that never touch the income statement.\n\nSo net income can be positive while operating and financing cash flows drain the balance — which is why you check the cash flow statement, not just the P&L.",
      deck: "technical",
    },
    {
      id: "accounting-basic-02",
      sectionId: "accounting-basic",
      sectionName: "Accounting — Basic",
      question: "A company prepays a full year of rent. Walk through where that shows up.",
      answer:
        "At payment: no income statement impact yet. Cash falls and a prepaid-expense asset is created on the balance sheet; the cash flow statement shows the outflow as a working-capital change.\n\nEach month after: rent expense hits the income statement, the prepaid asset amortizes down, and there is no new cash impact — the cash left on day one.",
      deck: "technical",
    },
    {
      id: "accounting-basic-03",
      sectionId: "accounting-basic",
      sectionName: "Accounting — Basic",
      question: "Inventory rises by $20 (paid in cash). What happens across the three statements?",
      answer:
        "Income statement: nothing — inventory isn't expensed until it's sold.\n\nCash flow statement: the $20 build is a use of working capital, so cash from operations falls by $20.\n\nBalance sheet: inventory up $20, cash down $20 — assets net to no change and the sheet stays balanced.",
      deck: "technical",
    },
    {
      id: "accounting-basic-04",
      sectionId: "accounting-basic",
      sectionName: "Accounting — Basic",
      question: "When do you capitalize a cost instead of expensing it?",
      answer:
        "Capitalize when the spending creates an asset with benefit beyond the current period — buying equipment, building software for internal use. It lands on the balance sheet and hits the income statement gradually through depreciation or amortization.\n\nExpense when the benefit is consumed now — salaries, marketing, repairs. Capitalizing shifts timing, not the total cost recognized over the asset's life.",
      deck: "technical",
    },
    {
      id: "valuation-basic-01",
      sectionId: "valuation-basic",
      sectionName: "Valuation — Basic",
      question: "Why is unlevered free cash flow discounted at WACC?",
      answer:
        "Unlevered FCF is the cash available to all investors — debt and equity — so it must be discounted at the blended rate all of them require, which is WACC.\n\nMatching matters: levered cash flows (to equity only) pair with the cost of equity; mixing the two double-counts or ignores the effect of leverage.",
      deck: "technical",
    },
    {
      id: "valuation-basic-02",
      sectionId: "valuation-basic",
      sectionName: "Valuation — Basic",
      question: "Two identical companies, but one carries debt. Which has the higher equity beta, and why?",
      answer:
        "The levered one. Debt makes equity returns more volatile — fixed interest amplifies swings in what's left for shareholders — so levered beta exceeds unlevered (asset) beta.\n\nThat's why comps work requires un-levering peer betas to strip their capital structures, then re-levering at the target's structure.",
      deck: "technical",
    },
    {
      id: "valuation-basic-03",
      sectionId: "valuation-basic",
      sectionName: "Valuation — Basic",
      question: "When is a DCF the wrong tool?",
      answer:
        "When cash flows can't be forecast meaningfully: early-stage companies with no stable economics, banks and insurers (leverage is their operating model, so you value equity directly), and businesses in distress where survival, not steady-state cash generation, is the question.\n\nAlso when terminal value would dominate so completely that the answer is really one assumption in disguise.",
      deck: "technical",
    },
    {
      id: "valuation-basic-04",
      sectionId: "valuation-basic",
      sectionName: "Valuation — Basic",
      question: "In a DCF, why add back D&A but then subtract capex?",
      answer:
        "D&A is a non-cash accounting charge, so it comes back. But the assets being depreciated were bought with real cash — capex — so you subtract what the company actually spends to maintain and grow the asset base.\n\nOver the long run the two should bear a sensible relationship; capex persistently below D&A in a forecast usually means the model is quietly shrinking the company.",
      deck: "technical",
    },
    {
      id: "why-banking-01",
      sectionId: "why-banking",
      sectionName: "Why Banking",
      question: "Why investment banking rather than consulting?",
      answer:
        "A strong answer is personal and specific: concrete exposure to deals or markets, wanting responsibility for numbers that close transactions rather than recommendations that may sit on a shelf, and honest awareness of the hours. Generic prestige answers fail.",
      deck: "fit",
    },
    {
      id: "discussing-transaction-experience-01",
      sectionId: "discussing-transaction-experience",
      sectionName: "Discussing Transaction Experience",
      question: "Walk me through a deal you followed recently.",
      answer:
        "Structure: one line on the parties and price; the strategic logic (why this buyer, why now); the financing mix; one number that shows you read past the headline (premium, multiple, synergy target); and your own view on whether it made sense. Must be a deal the candidate genuinely tracked.",
      deck: "experience",
    },
  ],
};
