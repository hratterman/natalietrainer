import type { Area } from "../types";

export const markets: Area = {
  id: "mkt",
  name: "Markets & Current Events",
  tier: 2,
  weight: 4,
  subtopics: [
    {
      id: "mkt.macro",
      name: "Rates, the Fed & Transmission",
      archetypes: [
        {
          id: "mkt.macro.rates-transmission",
          name: "Rate moves through valuations",
          description:
            "The evergreen macro-mechanics question: walk every channel by which rising (or falling) rates hit valuations — discount rates/WACC up, multiples compress, growth stocks (long-duration cash flows) hit hardest, leverage costs rise, consumer demand cools, currency effects. Ask it concretely: 'the 10-year moves +100bps — walk me through what happens to a high-growth tech stock vs a utility, and to an LBO in progress.' The candidate supplies mechanism, not forecasts.",
          difficultyRange: [2, 5],
          followUpAxes: [
            "Why do growth stocks fall harder than value when rates rise?",
            "What happens to a deal being financed right now?",
            "Which sector is most insulated, and why?",
          ],
          answerFormat: "walkthrough",
          sampleQuestion:
            "The 10-year Treasury yield jumps 100 basis points over a quarter. Walk me through every channel that hits equity valuations — and tell me why a profitless software company falls more than a regulated utility.",
        },
        {
          id: "mkt.macro.fed-yield-curve",
          name: "Fed mechanics & the yield curve",
          description:
            "How the Fed actually operates: the policy rate and the transmission to market rates, QE/QT intuition, what the yield curve's shape means (steep = expansion expected, inverted = cuts/recession expected), why inversion predicts recessions, and what banks' borrow-short-lend-long model implies. Candidate is graded on mechanism fluency; any current levels are theirs to supply and are not graded for freshness.",
          difficultyRange: [2, 4],
          followUpAxes: [
            "Why does an inverted curve squeeze bank margins?",
            "What's the difference between the Fed cutting and QE?",
            "What does a steepening curve after inversion usually mean?",
          ],
          answerFormat: "walkthrough",
        },
      ],
    },
    {
      id: "mkt.pitch",
      name: "Stock Pitch & Market Views",
      archetypes: [
        {
          id: "mkt.pitch.stock-pitch",
          name: "Pitch me a stock",
          description:
            "The structured pitch: company one-liner, thesis in 2-3 drivers the market underappreciates, valuation with numbers (multiple vs peers or a quick DCF anchor, price target), catalysts with timing, risks and why they're survivable. The generator sets up the framework demand and lets the candidate pitch any real company she has prepared; grading is on framework rigor and internal consistency, not on agreeing with the view. Follow-ups attack the thesis like a PM would.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Why hasn't the market priced this in already?",
            "Give me the bear case — what kills the thesis?",
            "What's your valuation anchor, in numbers?",
          ],
          answerFormat: "longform",
          sampleQuestion:
            "Pitch me a stock — long or short. I want the thesis, the numbers behind your valuation, the catalysts, and the risks. You have three minutes; go.",
        },
        {
          id: "mkt.pitch.market-awareness",
          name: "Market awareness framework",
          description:
            "'What's moving markets right now?' asked as a structure test: the candidate should organize an answer across rates/inflation, growth/earnings, geopolitics/energy, and positioning — supplying her own current specifics. The grader scores organization, mechanism links between the themes, and an actual view; her factual specifics are taken as given rather than checked for freshness. Also 'where's the 10-year / S&P / oil' calibration prompts framed as ranges-and-reasoning.",
          difficultyRange: [2, 4],
          followUpAxes: [
            "Pick your most important theme — how do I trade it?",
            "Connect two of those themes for me.",
            "If you're wrong on that view, what breaks first?",
          ],
          answerFormat: "longform",
        },
      ],
    },
  ],
};
