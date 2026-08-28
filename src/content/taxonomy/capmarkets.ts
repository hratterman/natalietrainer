import type { Area } from "../types";

export const capmarkets: Area = {
  id: "cm",
  name: "Capital Markets & Securities",
  tier: 2,
  weight: 4,
  subtopics: [
    {
      id: "cm.ecm",
      name: "Equity Capital Markets & IPOs",
      archetypes: [
        {
          id: "cm.ecm.ipo-process",
          name: "IPO process end-to-end",
          description:
            "Walk the IPO process: selecting bookrunners, S-1 drafting, testing-the-waters, roadshow, bookbuilding, pricing night, greenshoe mechanics, lockups and the post-lockup supply event. Push on the judgment calls: how the price range is set, why IPOs are deliberately underpriced (the 'pop'), what the greenshoe actually does mathematically at difficulty 4-5.",
          difficultyRange: [2, 4],
          followUpAxes: [
            "Walk me through exactly how the greenshoe stabilizes the price.",
            "Who wins and who loses from a big first-day pop?",
            "Why might a company choose a direct listing instead?",
          ],
          answerFormat: "walkthrough",
          sampleQuestion:
            "Your client prices its IPO at $20 and the stock closes day one at $28. The CEO is thrilled. Should she be? Walk me through who won and who lost, and how the greenshoe played into pricing.",
        },
        {
          id: "cm.ecm.followons",
          name: "Follow-ons, blocks, converts",
          description:
            "The ECM product shelf: marketed follow-ons vs overnight blocks vs ATM programs — speed vs discount tradeoffs and when each fits; convertible bonds — why issuers like them (lower coupon, premium conversion price), how to think of them as bond plus call option, and the dilution/hedging dynamics (call spreads). At difficulty 4: given an issuer situation, pick the product and defend the choice with the discount/risk math.",
          difficultyRange: [2, 4],
          followUpAxes: [
            "Why does a block trade price at a discount, and who bears the risk?",
            "Decompose a convertible into its two components for me.",
            "When is an ATM the right tool, and what's its limitation?",
          ],
          answerFormat: "walkthrough",
        },
      ],
    },
    {
      id: "cm.bonds",
      name: "Bonds & Rates Math",
      archetypes: [
        {
          id: "cm.bonds.price-yield",
          name: "Price-yield mechanics",
          description:
            "Bond math under pressure: why price and yield move inversely, coupon vs current yield vs YTM (and their ordering for premium/discount bonds), pull-to-par. Generate concrete instances: 'a 5% coupon bond trades at 90 — is YTM above or below 5%, and roughly where?' Difficulty 4 asks for approximate YTM reasoning without a calculator.",
          difficultyRange: [2, 4],
          followUpAxes: [
            "Order coupon, current yield, and YTM for this bond and explain why.",
            "What happens to the price as maturity approaches with no default?",
            "Approximate the YTM for me — talk through the estimate.",
          ],
          answerFormat: "walkthrough",
          sampleQuestion:
            "A 10-year bond with a 5% annual coupon trades at 90. Without a calculator: is its yield to maturity above or below 5%? Roughly where? And rank its coupon rate, current yield, and YTM.",
        },
        {
          id: "cm.bonds.duration",
          name: "Duration & convexity intuition",
          description:
            "Interest-rate sensitivity: which bonds move more when rates change (longer maturity, lower coupon, lower yield → higher duration) and why, in cash flow terms. The classic: 'rates rise 100bps — which falls more, the 2-year or the 10-year? The 10% coupon or the zero?' Convexity as the bonus concept at difficulty 4: why price rises from falling rates exceed price drops from rising rates.",
          difficultyRange: [2, 4],
          followUpAxes: [
            "Why does a lower coupon mean higher duration — explain with cash flow timing.",
            "Rates rise 100bps: estimate the price move for a 7-duration bond.",
            "What is convexity doing for the bondholder here?",
          ],
          answerFormat: "walkthrough",
        },
      ],
    },
    {
      id: "cm.financing",
      name: "Financing Choices",
      archetypes: [
        {
          id: "cm.financing.debt-vs-equity",
          name: "Debt vs equity issuance",
          description:
            "A company needs capital: debt vs equity tradeoffs — cost (after-tax debt cost vs implied cost of equity), flexibility, covenants, rating impact, signaling (equity issues read as 'stock is expensive'), dilution math. Difficulty 4-5: given the company's leverage, rating headroom, and stock valuation, recommend a financing and quantify the EPS and leverage effects of each path.",
          difficultyRange: [2, 5],
          followUpAxes: [
            "Quantify the EPS impact of each path for me.",
            "What does the market infer when a company issues equity?",
            "Where does rating headroom bind this decision?",
          ],
          answerFormat: "walkthrough",
        },
        {
          id: "cm.financing.buybacks-dividends",
          name: "Buybacks vs dividends",
          description:
            "Capital return: buybacks vs dividends — tax treatment, flexibility, signaling, EPS mechanics of a buyback (when it's accretive: earnings yield vs after-tax cost of cash/debt funding it), dividend stickiness. Difficulty 4: compute the EPS effect of a leveraged buyback and debate whether it creates value or just financial engineering.",
          difficultyRange: [2, 4],
          followUpAxes: [
            "When is a buyback EPS-accretive — give the condition.",
            "Does an accretive buyback create value? Argue it.",
            "Why do markets punish dividend cuts so hard?",
          ],
          answerFormat: "walkthrough",
        },
      ],
    },
  ],
};
