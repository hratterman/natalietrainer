import type { Area } from "../types";

export const mental: Area = {
  id: "mm",
  name: "Brain Teasers & Mental Math",
  tier: 2,
  weight: 3,
  subtopics: [
    {
      id: "mm.arithmetic",
      name: "Finance Mental Math",
      archetypes: [
        {
          id: "mm.arithmetic.quick-calcs",
          name: "Quick finance arithmetic",
          description:
            "Single-shot computations with clean numbers, answerable in under 45 seconds: percent changes and reversals (down 20% then up 20%), multiple/earnings-yield conversions (a 12.5x P/E is what earnings yield?), margin math, breakevens, quick after-tax adjustments, weighted averages (blended cost of capital from two tranches). Every instance must have one exact numeric answer stated in expectedKeyPoints.",
          difficultyRange: [2, 4],
          followUpAxes: [
            "Now reverse it — what gets you back to where you started?",
            "Do the same at a different rate.",
          ],
          answerFormat: "numeric",
          sampleQuestion:
            "A stock trades at a 12.5x P/E. What is its earnings yield? And if the P/E rises to 20x, what is it then?",
        },
        {
          id: "mm.arithmetic.compounding",
          name: "Compounding & rule of 72",
          description:
            "Growth and discounting in your head: rule of 72 applications (how long to double at 9%?), compounding estimates ($100 at 10% for 5 years ≈ 161), reverse compounding (what rate doubles money in 4 years?), MOIC-to-IRR conversions using the standard anchors. Clean numbers only; the exact expected answer (with acceptable tolerance) goes in expectedKeyPoints.",
          difficultyRange: [2, 4],
          followUpAxes: [
            "Sanity-check that with the rule of 72.",
            "Now run it over a different horizon.",
          ],
          answerFormat: "numeric",
          sampleQuestion:
            "Money triples over six years. Using approximations, what annual return is that? Sanity-check your answer two ways.",
        },
      ],
    },
    {
      id: "mm.estimation",
      name: "Estimation & Logic",
      archetypes: [
        {
          id: "mm.estimation.market-sizing",
          name: "Market sizing",
          description:
            "Fermi estimates graded on structure: pick a defensible decomposition (population → penetration → frequency → price), keep the arithmetic clean, sanity-check the result against a known anchor. Classic instances: US coffee shop revenue, number of gas stations, golf balls in the air on a Saturday. The grader rewards explicit assumptions and a stated final number over precision.",
          difficultyRange: [2, 4],
          followUpAxes: [
            "Which assumption is your answer most sensitive to?",
            "Sanity-check your result against something you know.",
          ],
          answerFormat: "short",
          sampleQuestion:
            "Estimate the annual revenue of all US coffee shops. Talk me through your decomposition, then give me one number.",
        },
        {
          id: "mm.estimation.probability-logic",
          name: "Probability & logic teasers",
          description:
            "The finance-interview teaser canon: expected value bets (roll a die, get paid the face — fair price?), simple conditional probability, coin sequences, the two-envelope style traps, clock-hand angles, and classic logic puzzles (burning ropes, gallon jugs). Instances must be self-contained with a single defensible answer in expectedKeyPoints, graded on the reasoning path as much as the result.",
          difficultyRange: [2, 5],
          followUpAxes: [
            "How much would you pay to play, and why that number?",
            "Now add one twist — does your answer change?",
          ],
          answerFormat: "short",
          sampleQuestion:
            "I roll a fair six-sided die and pay you its face value in dollars. What's the fair price to play? Now I let you re-roll once if you don't like the first roll — what's it worth now? Walk me through it.",
        },
      ],
    },
  ],
};
