import type { Archetype, Area, Subtopic } from "../types";
import { accounting } from "./accounting";
import { evValue } from "./ev-value";
import { valuation } from "./valuation";
import { dcf } from "./dcf";
import { mna } from "./mna";
import { lbo } from "./lbo";
import { capmarkets } from "./capmarkets";
import { credit } from "./credit";
import { rx } from "./rx";
import { markets } from "./markets";
import { mental } from "./mental";
import { behavioral } from "./behavioral";

/** Every area in the canon, tier-1 (core) first. */
export const AREAS: Area[] = [
  accounting,
  evValue,
  valuation,
  dcf,
  mna,
  lbo,
  capmarkets,
  credit,
  rx,
  markets,
  mental,
  behavioral,
];

export type SubtopicRef = { area: Area; subtopic: Subtopic };
export type ArchetypeRef = SubtopicRef & { archetype: Archetype };

const subtopicIndex = new Map<string, SubtopicRef>();
const archetypeIndex = new Map<string, ArchetypeRef>();
for (const area of AREAS) {
  for (const subtopic of area.subtopics) {
    subtopicIndex.set(subtopic.id, { area, subtopic });
    for (const archetype of subtopic.archetypes) {
      archetypeIndex.set(archetype.id, { area, subtopic, archetype });
    }
  }
}

export function getArea(areaId: string): Area | undefined {
  return AREAS.find((a) => a.id === areaId);
}

export function getSubtopic(subtopicId: string): SubtopicRef | undefined {
  return subtopicIndex.get(subtopicId);
}

export function getArchetype(archetypeId: string): ArchetypeRef | undefined {
  return archetypeIndex.get(archetypeId);
}

export function allSubtopics(): SubtopicRef[] {
  return [...subtopicIndex.values()];
}

export function allArchetypes(): ArchetypeRef[] {
  return [...archetypeIndex.values()];
}
