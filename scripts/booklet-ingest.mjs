#!/usr/bin/env node
/**
 * Ingest the "400 Questions" interview guide (.docx) into the local booklet
 * canon the app reads at runtime.
 *
 *   npm run booklet:ingest -- /path/to/400QuestionIBBible.docx
 *
 * Output: data/booklet.json (gitignored — the guide is copyrighted, and this
 * repo is public, so the canon text must never be committed).
 *
 * No dependencies: `unzip` extracts word/document.xml and a small
 * paragraph-level parser walks the WordprocessingML. The parser targets the
 * structure of this specific guide (2nd edition): Heading1 = part,
 * Heading2 = category, numbered Heading5 = question, body text = answer.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const outFlag = args.indexOf("--out");
const outPath = outFlag !== -1 ? args.splice(outFlag, 2)[1] : path.join("data", "booklet.json");
const docxPath = args[0];
if (!docxPath) {
  console.error("Usage: npm run booklet:ingest -- /path/to/guide.docx [--out data/booklet.json]");
  process.exit(2);
}

const xml = execFileSync("unzip", ["-p", docxPath, "word/document.xml"], {
  maxBuffer: 64 * 1024 * 1024,
  encoding: "utf8",
});

// ---- WordprocessingML → paragraphs ----------------------------------------

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Runs of a paragraph's XML → plain text (tabs and breaks become whitespace). */
function paragraphText(pXml) {
  let out = "";
  const re = /<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g;
  let m;
  while ((m = re.exec(pXml)) !== null) {
    if (m[1] !== undefined) out += decodeEntities(m[1]);
    else if (m[0] === "<w:tab/>") out += "\t";
    else out += "\n";
  }
  return out;
}

function paragraphMeta(pXml) {
  const styleMatch = /<w:pStyle w:val="([^"]+)"/.exec(pXml);
  return { style: styleMatch ? styleMatch[1] : "", numbered: pXml.includes("<w:numPr>") };
}

/**
 * Walk the body sequentially, yielding paragraphs and tables in order.
 * Tables contain their own w:p elements, so a flat w:p scan would
 * double-count — instead we jump over each whole <w:tbl> block.
 */
function* blocks(bodyXml) {
  let i = 0;
  for (;;) {
    const p = bodyXml.indexOf("<w:p", i);
    const t = bodyXml.indexOf("<w:tbl>", i);
    if (p === -1 && t === -1) return;
    if (t !== -1 && (p === -1 || t < p)) {
      // Matching close, tolerating nested tables.
      let depth = 0;
      let j = t;
      for (;;) {
        const open = bodyXml.indexOf("<w:tbl>", j + 1);
        const close = bodyXml.indexOf("</w:tbl>", j + 1);
        if (close === -1) throw new Error("unbalanced <w:tbl>");
        if (open !== -1 && open < close) {
          depth += 1;
          j = open;
        } else if (depth > 0) {
          depth -= 1;
          j = close;
        } else {
          j = close;
          break;
        }
      }
      const end = j + "</w:tbl>".length;
      yield { kind: "table", xml: bodyXml.slice(t, end) };
      i = end;
    } else {
      // <w:p ...> ... </w:p> or self-closing <w:p/>; w:p never nests.
      const selfClose = /^<w:p[^>]*\/>/.exec(bodyXml.slice(p));
      let end;
      if (selfClose) {
        end = p + selfClose[0].length;
      } else {
        const close = bodyXml.indexOf("</w:p>", p);
        if (close === -1) throw new Error("unbalanced <w:p>");
        end = close + "</w:p>".length;
      }
      yield { kind: "p", xml: bodyXml.slice(p, end) };
      i = end;
    }
  }
}

function tableText(tblXml) {
  const rows = [];
  const rowRe = /<w:tr(?: [^>]*)?>([\s\S]*?)<\/w:tr>/g;
  let r;
  while ((r = rowRe.exec(tblXml)) !== null) {
    const cells = [];
    const cellRe = /<w:tc(?: [^>]*)?>([\s\S]*?)<\/w:tc>/g;
    let c;
    while ((c = cellRe.exec(r[1])) !== null) {
      // Cells can hold several paragraphs; keep a space between them (the
      // injected break is inside the run scan, unlike a bare space).
      cells.push(
        paragraphText(c[1].replace(/<\/w:p>/g, "<w:br/></w:p>"))
          .replace(/\s+/g, " ")
          .trim(),
      );
    }
    rows.push(cells.join(" | "));
  }
  return rows.join("\n");
}

// ---- guide structure → items ----------------------------------------------

const NOISE = /breakingintowallstreet\.com|mergersandinquisitions\.com/;

/** Strip page-header URL lines that Word embeds mid-paragraph. */
function stripNoise(text) {
  return text
    .split("\n")
    .filter((line) => !NOISE.test(line))
    .join("\n")
    .trim();
}

function sectionNameFrom(heading) {
  return heading
    .replace(/Questions\s*&\s*(Suggested\s*)?Answers/i, "")
    .replace(/&\s*Suggested\s*Answers/i, "")
    .replace(/\s*[–—-]\s*(Basic|Advanced)\s*$/i, " — $1")
    .replace(/[“”]/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+—/, " —")
    .trim()
    .replace(/[\s–—-]+$/, "")
    .replace(/^Brain Teaser$/, "Brain Teasers");
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function deckFor(part) {
  if (part.startsWith("Fit")) return "fit";
  if (part.startsWith("Discussing Transaction")) return "experience";
  return "technical"; // Technical + Restructuring / Distressed M&A
}

const bodyStart = xml.indexOf("<w:body>");
const bodyEnd = xml.lastIndexOf("</w:body>");
const body = xml.slice(bodyStart, bodyEnd);

const items = [];
let part = null; // Heading1
let category = null; // Heading2
let current = null; // { sectionName, deck, question, blocks: [], prevBullet }

function flush() {
  if (!current) return;
  const answer = current.blocks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  items.push({
    sectionName: current.sectionName,
    deck: current.deck,
    question: current.question,
    answer,
  });
  current = null;
}

for (const block of blocks(body)) {
  if (block.kind === "table") {
    if (current) current.blocks.push(tableText(block.xml));
    continue;
  }
  const { style, numbered } = paragraphMeta(block.xml);
  const text = stripNoise(paragraphText(block.xml));
  if (style === "Heading1") {
    flush();
    part = text;
    category = null;
  } else if (style === "Heading2") {
    flush();
    category = text;
  } else if (style === "Heading5" && numbered) {
    flush();
    if (!part || part.startsWith("Introduction")) continue;
    const heading = category ?? part;
    current = {
      sectionName: sectionNameFrom(heading),
      deck: deckFor(part),
      question: text.replace(/\s+/g, " ").trim(),
      blocks: [],
    };
  } else if (current && text) {
    // ListParagraph bullets keep visual structure; bullets group tightly.
    if (style === "ListParagraph" && numbered) {
      const last = current.blocks[current.blocks.length - 1];
      if (last !== undefined && last.startsWith("- ")) {
        current.blocks[current.blocks.length - 1] = `${last}\n- ${text}`;
      } else {
        current.blocks.push(`- ${text}`);
      }
    } else {
      current.blocks.push(text);
    }
  }
}
flush();

// ---- ids + validation + write ---------------------------------------------

const perSection = new Map();
const finalItems = items.map((item) => {
  const sectionId = slugify(item.sectionName);
  const n = (perSection.get(sectionId) ?? 0) + 1;
  perSection.set(sectionId, n);
  return {
    id: `${sectionId}-${String(n).padStart(2, "0")}`,
    sectionId,
    sectionName: item.sectionName,
    question: item.question,
    answer: item.answer,
    deck: item.deck,
  };
});

const counts = { technical: 0, fit: 0, experience: 0 };
for (const item of finalItems) counts[item.deck] += 1;
const empties = finalItems.filter((i) => !i.answer || !i.question);
const ids = new Set(finalItems.map((i) => i.id));

console.log(`Parsed ${finalItems.length} questions`);
for (const [sectionId, n] of perSection) console.log(`  ${String(n).padStart(4)}  ${sectionId}`);
console.log(
  `Decks: technical=${counts.technical} fit=${counts.fit} experience=${counts.experience}`,
);

if (empties.length > 0 || ids.size !== finalItems.length || finalItems.length < 350) {
  console.error(
    `Ingest failed validation: ${empties.length} empty items, ` +
      `${finalItems.length - ids.size} duplicate ids, ${finalItems.length} total (expected ~398). ` +
      "Is this the right document?",
  );
  process.exit(1);
}
if (finalItems.length !== 398) {
  console.warn(`Note: expected 398 questions from the 2nd edition, got ${finalItems.length}.`);
}

const canon = {
  version: 1,
  source: "400 Investment Banking Interview Questions & Answers (2nd edition)",
  items: finalItems,
};
mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(canon, null, 1));
console.log(`Wrote ${outPath}`);
