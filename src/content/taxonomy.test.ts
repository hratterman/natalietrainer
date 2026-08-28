import { describe, expect, it } from "vitest";
import { areaSchema } from "./types";
import { AREAS, allArchetypes, allSubtopics, getArchetype } from "./taxonomy";

describe("taxonomy integrity", () => {
  it("every area validates against the schema", () => {
    for (const area of AREAS) {
      const result = areaSchema.safeParse(area);
      expect(result.success, `area ${area.id}: ${JSON.stringify(result.error?.issues?.[0])}`).toBe(
        true,
      );
    }
  });

  it("area ids are unique", () => {
    const ids = AREAS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("subtopic ids are globally unique and prefixed with their area id", () => {
    const seen = new Set<string>();
    for (const { area, subtopic } of allSubtopics()) {
      expect(seen.has(subtopic.id), `duplicate subtopic id ${subtopic.id}`).toBe(false);
      seen.add(subtopic.id);
      expect(
        subtopic.id.startsWith(`${area.id}.`),
        `subtopic ${subtopic.id} not prefixed with area ${area.id}`,
      ).toBe(true);
    }
  });

  it("archetype ids are globally unique and prefixed with their subtopic id", () => {
    const seen = new Set<string>();
    for (const { subtopic, archetype } of allArchetypes()) {
      expect(seen.has(archetype.id), `duplicate archetype id ${archetype.id}`).toBe(false);
      seen.add(archetype.id);
      expect(
        archetype.id.startsWith(`${subtopic.id}.`),
        `archetype ${archetype.id} not prefixed with subtopic ${subtopic.id}`,
      ).toBe(true);
    }
  });

  it("difficulty ranges are ordered", () => {
    for (const { archetype } of allArchetypes()) {
      const [lo, hi] = archetype.difficultyRange;
      expect(lo <= hi, `archetype ${archetype.id} has inverted range`).toBe(true);
    }
  });

  it("every subtopic has at least 2 archetypes and every archetype at least 2 follow-up axes", () => {
    for (const { subtopic } of allSubtopics()) {
      expect(subtopic.archetypes.length).toBeGreaterThanOrEqual(2);
    }
    for (const { archetype } of allArchetypes()) {
      expect(archetype.followUpAxes.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("lookups resolve", () => {
    const ref = getArchetype("lbo.paper.full");
    expect(ref?.area.id).toBe("lbo");
    expect(ref?.subtopic.id).toBe("lbo.paper");
  });

  it("core four-plus areas are tier 1", () => {
    for (const id of ["acct", "ev", "val", "dcf", "mna", "lbo"]) {
      expect(AREAS.find((a) => a.id === id)?.tier, `area ${id} should be tier 1`).toBe(1);
    }
  });
});
