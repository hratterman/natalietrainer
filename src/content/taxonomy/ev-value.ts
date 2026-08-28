import type { Area } from "../types";

export const evValue: Area = {
  id: "ev",
  name: "Enterprise & Equity Value",
  tier: 1,
  weight: 9,
  subtopics: [
    {
      id: "ev.bridge",
      name: "The EV ↔ Equity Value Bridge",
      archetypes: [
        {
          id: "ev.bridge.definitions",
          name: "EV vs equity value conceptually",
          description:
            "What enterprise value and equity value each represent (value of core operations to all capital providers vs value to shareholders), why cash is subtracted and debt added, and which metrics pair with which. Vary by asking capital-structure-neutrality probes: 'does EV change when the stock price moves?' (yes — through equity value) and 'is EV truly capital-structure independent?' (in theory; taxes and distress say not exactly).",
          difficultyRange: [1, 4],
          followUpAxes: [
            "Why do we subtract cash in the bridge?",
            "Does enterprise value change when the share price moves?",
            "Is EV really capital-structure neutral? Argue both sides.",
          ],
          answerFormat: "walkthrough",
        },
        {
          id: "ev.bridge.transactions",
          name: "Transaction effects on EV and equity value",
          description:
            "Given a corporate action, state exactly what happens to enterprise value and equity value: raising debt, raising equity, paying a dividend, buying back stock, spending cash on capex or an acquisition. The classic ladder: 'raise $200 of debt — EV? equity value? Now spend it on a factory — what changes?' At difficulty 5, chain 3+ actions and require the candidate to track both values and explain why operations-value only moves when the market re-rates the assets.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Now spend the cash — what changes and what doesn't?",
            "Why did EV stay flat when debt was raised?",
            "Which of these actions changes the value of core operations?",
          ],
          answerFormat: "walkthrough",
          sampleQuestion:
            "A company raises $200 of debt. What happens to enterprise value and equity value? It then spends the $200 building a new factory. Now what happens? Finally it issues $100 of stock and uses it to pay down debt — walk me through each step.",
        },
        {
          id: "ev.bridge.items",
          name: "Bridge items: NCI, preferred, pensions, leases",
          description:
            "The full bridge beyond net debt: noncontrolling interest, preferred stock, underfunded pensions, operating leases, restricted cash, equity investments/associates. For each item the candidate must state the direction and the *why* (consistency between numerator claims and denominator earnings). Difficulty 5: give a messy balance sheet and require assembling the complete bridge, defending each inclusion.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Why exactly is NCI added — what's the consistency argument?",
            "When would you not subtract all cash (restricted or trapped cash)?",
            "If you add leases to EV, what must you do to the denominator?",
          ],
          answerFormat: "walkthrough",
        },
        {
          id: "ev.bridge.negative-ev",
          name: "Negative enterprise value",
          description:
            "Can enterprise value be negative? How (cash exceeds market cap plus debt), what it implies, when it appears (deep value, biotech shells, distress fears, pre-2000s Japan), and whether you would buy such a company. Push the candidate on why the market might rationally price a company below net cash (cash burn, governance, trapped cash).",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Would you buy a negative-EV company? What's the catch?",
            "What kinds of companies actually trade at negative EV?",
            "Can equity value ever be negative? Why not?",
          ],
          answerFormat: "walkthrough",
        },
      ],
    },
    {
      id: "ev.dilution",
      name: "Share Counts & Dilution",
      archetypes: [
        {
          id: "ev.dilution.tsm",
          name: "Treasury stock method",
          description:
            "Compute diluted shares using the treasury stock method with concrete numbers: options with given strikes vs current price, which tranches are in the money, proceeds buying back shares at market. Difficulty 4–5: multiple tranches, some out of the money, done quickly and correctly; then compute diluted equity value.",
          difficultyRange: [2, 5],
          followUpAxes: [
            "Which tranches count, and why do the out-of-the-money ones drop?",
            "Recompute at a higher share price — what changes?",
            "Why does the treasury stock method understate 'true' dilution?",
          ],
          answerFormat: "walkthrough",
          sampleQuestion:
            "A company trades at $20 with 100 shares outstanding. It has 10 options struck at $10 and 10 options struck at $25. Walk me through the diluted share count under the treasury stock method and give me diluted equity value.",
        },
        {
          id: "ev.dilution.rsus-converts",
          name: "RSUs and convertibles in the count",
          description:
            "How RSUs (add in full once vested/expected) and convertible bonds (if-converted vs treating as debt, depending on in/out of the money) enter the diluted count. Difficulty 5: a mixed stack — options, RSUs, and a convert — with a conversion price near the money; candidate must decide each instrument's treatment and produce one number.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "When do you treat the convert as debt vs as shares?",
            "If you convert the bond, what else must you remove from the bridge?",
            "How do unvested RSUs differ from options here?",
          ],
          answerFormat: "walkthrough",
          sampleQuestion:
            "Stock at $30. 100 basic shares, 10 options struck at $20, 5 RSUs, and a $150 convertible with a $25 conversion price. Walk me to the fully diluted share count and diluted equity value, explaining each instrument's treatment.",
        },
      ],
    },
  ],
};
