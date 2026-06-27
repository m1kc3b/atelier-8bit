/* features/content/content-mappers.ts — adaptateurs Challenge → ContentItem.
   Source unique partagée par ChallengeManager et <chuck-side-panel>. Pure, sans DOM. */

import type { Challenge } from "../../types/challenge.js";
import type {
  ContentBlock,
  ChallengeItem,
  TrackStepItem,
} from "../../types/content.js";

export function challengeToContentItem(c: Challenge): ChallengeItem {
  const blocks: ContentBlock[] = [];

  if (c.description) {
    blocks.push({ kind: "theory", content: c.description });
  }
  if ((c.meta as any)?.zaks) {
    const z = (c.meta as any).zaks;
    blocks.push({
      kind: "ref",
      icon: "📖",
      label: `${z.chapter}, p. ${z.page}`,
      detail: z.topic,
    });
  }
  if (c.meta?.concepts?.length) {
    blocks.push({ kind: "concepts", items: c.meta.concepts });
  }
  if (c.hints?.length) {
    blocks.push({ kind: "hints", items: c.hints.map((h: any) => h.text ?? h) });
  }

  return {
    type: "challenge",
    id: c.id,
    arena: (c as any).arena,
    arena_name: (c as any).arena_name,
    title: c.title,
    blocks,
    template: c.template ?? "",
    assertions: c.assertions ?? [],
    maxCycles: c.maxCycles,
    meta: c.meta as any,
  };
}

/** Adaptateur Challenge (étape de parcours) → TrackStepItem.
 *  Mêmes blocs pédagogiques qu'un défi classique, mais type 'track-step'
 *  pour un affichage et une navigation dédiés dans <chuck-side-panel>. */
export function trackStepToContentItem(
  c: Challenge,
  trackId: string,
  stepIndex: number,
  stepCount: number,
): TrackStepItem {
  const blocks: ContentBlock[] = [];

  if (c.description) {
    blocks.push({ kind: "theory", content: c.description });
  }
  if (c.meta?.concepts?.length) {
    blocks.push({ kind: "concepts", items: c.meta.concepts });
  }
  if (c.hints?.length) {
    blocks.push({ kind: "hints", items: c.hints.map((h: any) => h.text ?? h) });
  }

  return {
    type: "track-step",
    id: c.id,
    trackId,
    title: c.title,
    subtitle: c.arena_name,
    blocks,
    stepIndex,
    stepCount,
  };
}
