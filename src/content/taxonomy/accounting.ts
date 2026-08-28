import type { Area } from "../types";

export const accounting: Area = {
  id: "acct",
  name: "Accounting & 3-Statement Mechanics",
  tier: 1,
  weight: 10,
  subtopics: [
    {
      id: "acct.linkages",
      name: "Statement Linkages & Cash Flow Walks",
      archetypes: [
        {
          id: "acct.linkages.three-statements-link",
          name: "How the three statements link",
          description:
            "Explain how the income statement, balance sheet, and cash flow statement connect: net income to retained earnings and to the top of the CFS, ending cash tying to the balance sheet, non-cash addbacks, working capital bridging. Vary by asking the walk in different directions (start from the balance sheet, start from cash) and by asking which single statement the candidate would pick to evaluate a company and why (CFS is the classic answer — probe the reasoning).",
          difficultyRange: [1, 3],
          followUpAxes: [
            "Which statement would you look at first if you could only pick one, and why?",
            "Where exactly does net income appear on the other two statements?",
            "Why do we add back non-cash charges on the CFS?",
          ],
          answerFormat: "walkthrough",
        },
        {
          id: "acct.linkages.revenue-to-cash",
          name: "Revenue-to-cash walk",
          description:
            "Walk from a revenue or expense line down to the actual cash impact, passing through accruals: e.g. book $100 of credit sales, collect only $70 this period — trace income statement, receivables, and CFS. Vary the accrual involved (receivables, deferred revenue, accrued expenses, prepaid expenses) and the collection/payment timing.",
          difficultyRange: [2, 4],
          followUpAxes: [
            "What happens next period when the remaining cash is collected?",
            "How would this look under cash-basis accounting?",
            "What does a growing gap between net income and operating cash flow tell you?",
          ],
          answerFormat: "walkthrough",
        },
        {
          id: "acct.linkages.indirect-vs-direct",
          name: "Indirect vs direct cash flow statement",
          description:
            "Explain the indirect method (start at net income, add back non-cash, adjust for working capital) versus the direct method, and why practice overwhelmingly uses indirect. Push into reconstructing a simple CFS from an income statement and two balance sheets — the candidate must derive working capital changes with correct signs.",
          difficultyRange: [2, 4],
          followUpAxes: [
            "Given these two balance sheets, what was cash flow from operations?",
            "Why does an increase in accounts receivable reduce operating cash flow?",
            "Where does interest expense show up on the CFS?",
          ],
          answerFormat: "walkthrough",
        },
      ],
    },
    {
      id: "acct.cascades",
      name: "3-Statement Change Cascades",
      archetypes: [
        {
          id: "acct.cascades.dep-change",
          name: "Depreciation change cascade",
          description:
            "The classic: a depreciation change flows through all three statements with taxes. Base case at difficulty 3 ('depreciation up $10, 25% tax rate — walk all three statements'). At 4–5, add twists: book vs tax depreciation diverging (creates/unwinds a DTL), a mid-year change, or asking for the cumulative effect after two years. Always require exact numbers on every affected line and the final cash and equity ties.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "What if the depreciation is not tax-deductible?",
            "Which statement do you start with, and why?",
            "What is the net change in cash, and why is it positive?",
            "Now book depreciation stays flat but tax depreciation accelerates — what changes?",
          ],
          answerFormat: "walkthrough",
          sampleQuestion:
            "Depreciation goes up by $10, but for tax purposes depreciation is unchanged. 25% tax rate. Walk me through all three statements, including any deferred tax items, and tell me the net change in cash.",
        },
        {
          id: "acct.cascades.inventory-writedown",
          name: "Inventory purchase and write-down",
          description:
            "Multi-period inventory cascade: purchase inventory (vary the financing mix — all cash, part debt, on payables), then in a later period write some of it down or sell it. Candidate must walk each period separately and keep the balance sheet balanced through both. Difficulty 5 uses a split financing mix plus a partial write-down plus the eventual sale of the remainder.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Is the write-down tax-deductible, and what changes if not?",
            "Walk the second period again assuming the inventory is sold instead of written down.",
            "What happens to the payable when it's finally paid?",
          ],
          answerFormat: "walkthrough",
          sampleQuestion:
            "In Q1 you buy $100 of inventory, paying 50% cash and financing 50% with debt. In Q2 you write down half of the inventory. 25% tax rate. Walk me through all three statements in both quarters.",
        },
        {
          id: "acct.cascades.pik-interest",
          name: "PIK interest accrual",
          description:
            "Accrue paid-in-kind interest: interest expense hits the income statement but no cash leaves; the debt balance grows instead. Walk all three statements. Vary the amount, tax rate, and at higher difficulty combine with cash interest on another tranche or ask for the effect at eventual repayment.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Why does cash go up in the period you accrue PIK interest?",
            "What happens when the PIK note is finally repaid in cash?",
            "How does PIK affect leverage ratios over time?",
          ],
          answerFormat: "walkthrough",
          sampleQuestion:
            "You accrue $10 of PIK interest this year. 25% tax rate. Walk me through all three statements, and explain why cash moves in the direction it does.",
        },
        {
          id: "acct.cascades.asset-sale-gain",
          name: "Asset sale with gain or loss",
          description:
            "Sell a fixed asset above or below book value: gain/loss on the income statement, taxes on the gain, removal of the asset from the balance sheet, and the CFS treatment (back out the gain from operations; full proceeds in investing). Vary book value, sale price (gain vs loss), and tax rate. Difficulty 5: candidate must explain why the gain is subtracted in CFO yet the full proceeds appear in CFI, and reconcile total cash.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Why do you subtract the gain in cash flow from operations?",
            "What is the total net change in cash, and how does it split between CFO and CFI?",
            "Rerun it assuming the asset sells below book value.",
          ],
          answerFormat: "walkthrough",
          sampleQuestion:
            "You sell equipment with a book value of $80 for $100 cash. 25% tax rate. Walk me through all three statements and give me the exact net change in cash.",
        },
        {
          id: "acct.cascades.deferred-revenue",
          name: "Deferred revenue over time",
          description:
            "Customer prepays for a multi-period contract: cash arrives up front, revenue is recognized over time. Walk the statements at signing and again after part of the contract has been delivered. Push on the tax treatment (cash taxation up front can create a DTA at difficulty 5) and on why deferred revenue is a liability.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Why is deferred revenue a liability if it's 'good news'?",
            "What do the statements look like after three months?",
            "What happens if the customer cancels and gets a partial refund?",
          ],
          answerFormat: "walkthrough",
          sampleQuestion:
            "A customer prepays $120 for a 12-month subscription on January 1. Walk me through all three statements on day one, and then again at March 31.",
        },
        {
          id: "acct.cascades.stock-comp",
          name: "Stock-based compensation cascade",
          description:
            "SBC expense: non-cash expense on the income statement, added back on the CFS, equity increases via APIC. Walk all three statements. At higher difficulty probe the tension: 'if it's added back, is it a real expense?' and dilution implications, plus the tax nuance that book SBC expense and the tax deduction (at vesting/exercise) can differ.",
          difficultyRange: [2, 5],
          followUpAxes: [
            "If SBC is added back on the CFS, why do investors care about it?",
            "How does SBC affect the share count and valuation?",
            "Where does the offsetting entry to the expense sit on the balance sheet?",
          ],
          answerFormat: "walkthrough",
        },
      ],
    },
    {
      id: "acct.wc",
      name: "Working Capital",
      archetypes: [
        {
          id: "acct.wc.nwc-changes",
          name: "Net working capital changes and cash",
          description:
            "Given a set of working capital line movements (receivables, inventory, payables, accrued liabilities), compute the net cash impact with correct signs and explain the intuition (asset up = cash out; liability up = cash in). Difficulty 4: several simultaneous movements with a net answer under time pressure; also probe what changes in NWC mean in a DCF's free cash flow.",
          difficultyRange: [2, 4],
          followUpAxes: [
            "Which direction does each item move cash, and why?",
            "How does this net change show up in unlevered free cash flow?",
            "What does persistently rising NWC as a % of revenue suggest?",
          ],
          answerFormat: "walkthrough",
          sampleQuestion:
            "During the year, receivables rise $20, inventory falls $10, and payables rise $30. What is the net cash impact from working capital, and walk me through the sign of each piece?",
        },
        {
          id: "acct.wc.cash-conversion",
          name: "Cash conversion cycle",
          description:
            "DSO, DIO, DPO and the cash conversion cycle: compute the CCC from given figures, interpret it, and reason about levers to shorten it. Vary industry context and ask what changes when a company stretches payables or factors receivables.",
          difficultyRange: [2, 4],
          followUpAxes: [
            "Compute the CCC from these numbers and interpret it.",
            "What are the risks of stretching payables to improve the cycle?",
            "How would factoring receivables show up on the statements?",
          ],
          answerFormat: "walkthrough",
        },
        {
          id: "acct.wc.negative-nwc",
          name: "Negative working capital business models",
          description:
            "Why some businesses (subscriptions, retailers like Amazon, insurers) run negative working capital and why that can be a source of financing as they grow. Candidate should connect deferred revenue/float to cash generation and identify when negative NWC becomes a risk (shrinking revenue).",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Why does growth generate cash for this kind of business?",
            "What happens to cash flow if revenue starts shrinking?",
            "Name a business model where negative working capital is structural.",
          ],
          answerFormat: "walkthrough",
        },
      ],
    },
    {
      id: "acct.deftax",
      name: "Deferred Taxes & NOLs",
      archetypes: [
        {
          id: "acct.deftax.dta-dtl",
          name: "DTA vs DTL creation",
          description:
            "What creates deferred tax liabilities (book income > tax income now, e.g. accelerated tax depreciation) versus deferred tax assets (tax income > book income now, e.g. NOLs, warranty reserves, some SBC). Candidate walks a concrete example through the statements showing the deferred item's creation and unwind over time.",
          difficultyRange: [2, 5],
          followUpAxes: [
            "Walk me through the DTL unwinding in later years.",
            "Give another common source of a DTA besides NOLs.",
            "Why is a DTL not simply 'debt' in the EV bridge?",
          ],
          answerFormat: "walkthrough",
          sampleQuestion:
            "Book depreciation is $10/year straight-line, but tax depreciation is $25 in year 1 then $5 and $0. 25% tax rate. Walk me through the deferred tax entries in year 1 and how they reverse.",
        },
        {
          id: "acct.deftax.nol-usage",
          name: "NOL usage walk",
          description:
            "A company with accumulated net operating losses turns profitable: walk how the NOL (a DTA) offsets cash taxes, the difference between book tax expense and cash taxes paid, and how the DTA burns down. Difficulty 5 adds a valuation allowance or Section 382-style limitation intuition after a change of control (relevant to M&A).",
          difficultyRange: [3, 5],
          followUpAxes: [
            "What is the difference between book taxes and cash taxes here?",
            "How would an acquirer think about the target's NOLs?",
            "What is a valuation allowance and when is one recorded?",
          ],
          answerFormat: "walkthrough",
        },
      ],
    },
    {
      id: "acct.advanced",
      name: "Advanced Accounting Topics",
      archetypes: [
        {
          id: "acct.advanced.cap-vs-expense",
          name: "Capitalize vs expense",
          description:
            "Compare capitalizing a cost (asset, depreciated over time) with expensing it immediately: effects on each statement in year 1 and later years, and on margins, EBITDA, and cash taxes. Difficulty 4–5: quantify both paths side by side over two years and discuss why management might prefer one (and how analysts adjust, e.g. capitalized software).",
          difficultyRange: [2, 5],
          followUpAxes: [
            "Which path shows higher net income in year 1, and when does it flip?",
            "Which shows higher EBITDA, and is that 'real'?",
            "How do cash taxes differ between the two paths?",
          ],
          answerFormat: "walkthrough",
        },
        {
          id: "acct.advanced.leases",
          name: "Lease accounting (ASC 842)",
          description:
            "Operating vs finance leases under ASC 842: right-of-use asset and lease liability at signing, income statement geography (single lease expense vs depreciation + interest), CFS placement, and effects on EBITDA and leverage metrics. Walk the balance sheet at signing and the statements in year 1 for each type. Probe comparability adjustments (why analysts add leases to EV or use EBITDAR).",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Why is EBITDA higher under a finance lease than an operating lease?",
            "How do leases enter the enterprise value bridge?",
            "What changed versus the old off-balance-sheet treatment, and why?",
          ],
          answerFormat: "walkthrough",
        },
        {
          id: "acct.advanced.goodwill-impairment",
          name: "Goodwill and impairment walk",
          description:
            "Where goodwill comes from (purchase price over fair value of net identifiable assets), why it isn't amortized, the impairment test intuition, and a full 3-statement walk of an impairment charge (non-cash, usually non-tax-deductible). Difficulty 5 pairs the impairment with the market's reaction question: 'is an impairment cash-relevant, and why might the stock fall anyway?'",
          difficultyRange: [2, 5],
          followUpAxes: [
            "Is the impairment tax-deductible, and what does that change?",
            "Why doesn't goodwill get amortized like other intangibles?",
            "What does a big impairment tell you about the original deal?",
          ],
          answerFormat: "walkthrough",
          sampleQuestion:
            "A company writes off $50 of goodwill from an old acquisition; the write-off is not tax-deductible. Walk me through all three statements.",
        },
        {
          id: "acct.advanced.consolidation-nci",
          name: "Equity method vs consolidation vs NCI",
          description:
            "Ownership accounting thresholds: minority passive (<20%, investment), equity method (~20–50%, one-line pickup), and consolidation (>50%, full statements plus noncontrolling interest). Candidate explains where each shows up on the statements and, at difficulty 4–5, walks a concrete example: consolidate an 80%-owned sub and show where the 20% NCI sits on the income statement and balance sheet — connecting to why NCI is added to enterprise value.",
          difficultyRange: [3, 5],
          followUpAxes: [
            "Why is NCI added in the enterprise value bridge?",
            "How does equity-method income appear in EBITDA, and is that a comparability problem?",
            "What changes on the statements when you cross from 50% to 51% ownership?",
          ],
          answerFormat: "walkthrough",
        },
      ],
    },
  ],
};
