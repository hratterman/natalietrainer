import type { Area } from "../types";

export const mna: Area = {
  id: "mna",
  name: "M&A",
  tier: 1,
  weight: 9,
  subtopics: [
    {
      id: "mna.accretion",
      name: "Accretion / Dilution",
      archetypes: [
        {
          id: "mna.accretion.pe-ladder",
          name: "The financing-mix ladder",
          description:
            "The marquee M&A archetype. Start with all-stock: acquirer P/E vs target P/E decides accretion (buying a higher P/E with stock dilutes). Then recompute the same deal financed with balance-sheet cash (cost = foregone after-tax interest income) and with debt (cost = after-tax interest expense). Candidate computes pro-forma EPS at each step with real numbers. Difficulty 5 mixes financing (e.g. 50/25/25) and adds a premium, requiring the full cost-of-financing hierarchy: after-tax cost of debt vs foregone cash yield vs the inverse of the acquirer's P/E (cost of stock).",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Recompute with cash financing — why does the answer flip?",
            "Rank the three financing costs for this acquirer and derive the cheapest mix.",
            "At what premium does the deal go from accretive to dilutive?",
          ],
          answerFormat: "walkthrough",
          sampleQuestion:
            "An acquirer trading at 15x P/E buys a target at 20x P/E in an all-stock deal — accretive or dilutive, and why? Now the acquirer instead pays 100% cash off its balance sheet, where cash earns 4% pre-tax, tax rate 25%. Recompute. Now 100% debt at 6% — recompute again and rank the three options.",
        },
        {
          id: "mna.accretion.breakeven",
          name: "Breakeven math",
          description:
            "Breakeven analytics around a deal: the maximum premium payable before dilution, the synergies required to offset a given dilution, the breakeven P/E of financing (cost of financing vs target's earnings yield). Candidate solves for the breakeven algebraically with clean numbers under time pressure. Difficulty 5 combines premium and synergy breakevens in one scenario.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Solve for the synergies needed to make this exactly neutral.",
            "What's the intuition for comparing financing cost to the target's earnings yield?",
            "Does breakeven accretion mean the deal creates zero value?",
          ],
          answerFormat: "walkthrough",
          sampleQuestion:
            "Acquirer buys a target with $50 of net income for $1,000, all debt at 6%, tax rate 25%. How much pre-tax synergy is needed for the deal to be EPS-neutral in year one? Walk me through it.",
        },
        {
          id: "mna.accretion.accretive-not-value",
          name: "Accretion vs value creation",
          description:
            "Why accretion is not value creation: EPS math ignores what you paid relative to intrinsic value. Construct examples of accretive-but-value-destroying deals (cheap debt buying overpriced assets) and dilutive-but-value-creating deals (high-multiple strategic asset). Candidate must articulate what EPS accretion actually measures and what a board should look at instead (ROIC vs cost of capital on the price paid, NPV of synergies vs premium).",
          difficultyRange: [4, 5],
          followUpAxes: [
            "Construct a deal that is accretive yet destroys value.",
            "What metric would you show the board instead of EPS accretion?",
            "Why does the market sometimes punish accretive deals on announcement?",
          ],
          answerFormat: "walkthrough",
        },
      ],
    },
    {
      id: "mna.purchacct",
      name: "Purchase Accounting",
      archetypes: [
        {
          id: "mna.purchacct.goodwill",
          name: "Goodwill and write-ups",
          description:
            "Compute goodwill: equity purchase price minus fair value of net identifiable assets, with asset write-ups reducing goodwill and the DTL created on write-ups (in a stock deal the tax basis doesn't step up, so future book depreciation exceeds tax depreciation) adding back to it. Candidate does the arithmetic and — the difficulty-5 core — explains *why* the write-up DTL exists and how it unwinds. Include the goodwill-is-a-plug intuition and what large goodwill implies.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Why does the write-up create a DTL — walk the logic.",
            "How does that DTL unwind over time?",
            "What does it mean if goodwill is most of the purchase price?",
          ],
          answerFormat: "walkthrough",
          sampleQuestion:
            "Acquirer pays $1,000 for a target with book equity of $400. PP&E is written up by $100 and identifiable intangibles of $200 are created; tax rate 25%; stock deal with no tax basis step-up. Walk me to goodwill, including any deferred taxes created.",
        },
        {
          id: "mna.purchacct.proforma-drag",
          name: "Pro-forma earnings drag",
          description:
            "The recurring pro-forma hits from purchase accounting: incremental intangible amortization from created intangibles, extra depreciation from PP&E write-ups, the deferred revenue haircut wiping out acquired-deferred-revenue earnings in year one, and transaction/financing fees. Candidate quantifies the combined EPS drag for a given deal and distinguishes cash vs non-cash items (why 'cash EPS' gets quoted).",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Which of these hits are cash vs non-cash?",
            "Why does the deferred revenue haircut exist at all?",
            "How would management present around this drag (cash EPS), and is that fair?",
          ],
          answerFormat: "walkthrough",
        },
      ],
    },
    {
      id: "mna.structures",
      name: "Deal Structures & Consideration",
      archetypes: [
        {
          id: "mna.structures.stock-vs-asset",
          name: "Stock sale vs asset sale",
          description:
            "Compare stock purchases (buy the entity, inherit liabilities, no basis step-up) with asset purchases (pick assets, leave liabilities, step-up gives tax-deductible D&A — buyer-friendly) and the seller's double-tax problem in asset sales of C-corps. Include 338(h)(10)/336(e) intuition: stock sale legally, asset sale for tax. Candidate should reason about who prefers what and how price bridges the gap.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Why do buyers prefer asset deals — quantify the step-up's value.",
            "Why do sellers resist, and how does price compensate?",
            "What does a 338(h)(10) election accomplish and when is it available?",
          ],
          answerFormat: "walkthrough",
        },
        {
          id: "mna.structures.exchange-ratios",
          name: "Exchange ratios, collars, earnouts",
          description:
            "Stock-deal mechanics: fixed exchange ratio (seller bears price risk) vs fixed value/floating ratio (buyer bears share-count risk), collars bounding the outcome, walk-away rights; earnouts and CVRs bridging valuation gaps. Difficulty 4–5: given an announcement and subsequent buyer share price move, compute what the seller actually receives under each structure.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Buyer's stock falls 15% before close — what does the seller get under each structure?",
            "Who asks for a collar and why?",
            "When is an earnout the right bridge, and what fights does it cause later?",
          ],
          answerFormat: "walkthrough",
        },
      ],
    },
    {
      id: "mna.synergies",
      name: "Synergies & Merger Math",
      archetypes: [
        {
          id: "mna.synergies.valuation",
          name: "Valuing and crediting synergies",
          description:
            "Cost vs revenue synergies (credibility hierarchy — cost synergies bankable, revenue synergies discounted), phasing and costs-to-achieve, capitalizing a synergy stream into value (after-tax synergies at a multiple or perpetuity), and the negotiation question of who captures synergies — why premia hand much of the value to sellers. Candidate values a synergy stream and compares it to the premium paid.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Value $50 of run-rate pre-tax cost synergies for me right now.",
            "Why are revenue synergies discounted by the market?",
            "The premium is $600 — did the buyer keep any synergy value?",
          ],
          answerFormat: "walkthrough",
        },
        {
          id: "mna.synergies.model-mechanics",
          name: "Merger model mechanics",
          description:
            "The merger model's plumbing: sources & uses (consideration, refinanced debt, fees, minimum cash), building the pro-forma balance sheet (combine, adjust for purchase accounting, new financing), contribution analysis (relative P&L contribution vs ownership split), and pro-forma credit stats. Difficulty 4–5: given a term sheet, assemble sources & uses and pro-forma leverage from scratch.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Build the sources & uses from this term sheet.",
            "What does contribution analysis tell you that valuation doesn't?",
            "Where do transaction fees land on the pro-forma statements?",
          ],
          answerFormat: "walkthrough",
        },
      ],
    },
    {
      id: "mna.process",
      name: "Process & Judgment",
      archetypes: [
        {
          id: "mna.process.sellside",
          name: "Sell-side process design",
          description:
            "Broad auction vs targeted process vs bilateral negotiation: speed, confidentiality, price tension, break risk tradeoffs. The standard timeline (teaser, NDA, CIM, first-round bids, management presentations, final bids, exclusivity) and what bankers actually do at each stage. Difficulty 4: recommend a process for a specific seller situation and defend it.",
          difficultyRange: [2, 4],
          followUpAxes: [
            "When is a broad auction the wrong call?",
            "What creates price tension in a two-party process?",
            "What's in a CIM, and what deliberately isn't?",
          ],
          answerFormat: "walkthrough",
        },
        {
          id: "mna.process.fairness-defense",
          name: "Fairness opinions & takeover defenses",
          description:
            "What a fairness opinion is and why boards want one; hostile situations and defenses (poison pill, staggered board, white knight, Pac-Man) with the intuition for each; why hostile deals are rare in practice. Candidate should be able to explain a defense mechanism's actual dilution math at difficulty 4–5.",
          difficultyRange: [2, 4],
          followUpAxes: [
            "Walk me through how a poison pill actually dilutes the acquirer.",
            "Why does a board get a fairness opinion — who is it protecting?",
            "Name a famous hostile deal and what happened.",
          ],
          answerFormat: "walkthrough",
        },
      ],
    },
  ],
};
