/* ─────────────────────────────────────────────────────────────
   Tests — features/content/content-mappers.ts
   Couvre : challengeToContentItem (blocs theory/ref(zaks)/concepts/hints,
   ordre, hints en string|{text}, passthrough template/assertions/maxCycles)
   et trackStepToContentItem (type, trackId, stepIndex/stepCount, subtitle).
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect } from 'vitest';
import { challengeToContentItem, trackStepToContentItem } from '../features/content/content-mappers.js';
import type { Challenge } from '../types/challenge.js';

function baseChallenge(over: Partial<Challenge> = {}): Challenge {
  return {
    id: 1,
    locked: false,
    title: 'Test',
    description: '',
    template: '',
    assertions: [],
    hints: [],
    ...over,
  } as Challenge;
}

describe('challengeToContentItem', () => {
  it('produit un item de type challenge avec les champs de base', () => {
    const item = challengeToContentItem(baseChallenge({ id: 42, title: 'Carry', template: 'CLC' }));
    expect(item.type).toBe('challenge');
    expect(item.id).toBe(42);
    expect(item.title).toBe('Carry');
    expect(item.template).toBe('CLC');
  });

  it('ajoute un bloc theory quand description est présente', () => {
    const item = challengeToContentItem(baseChallenge({ description: 'Charge A.' }));
    expect(item.blocks.some((b) => b.kind === 'theory')).toBe(true);
  });

  it('n’ajoute pas de bloc theory si description vide', () => {
    const item = challengeToContentItem(baseChallenge({ description: '' }));
    expect(item.blocks.some((b) => b.kind === 'theory')).toBe(false);
  });

  it('ajoute un bloc ref pour les métadonnées zaks', () => {
    const c = baseChallenge({ meta: { zaks: { chapter: 'Ch.2', page: 17, topic: 'ADC' } } as any });
    const item = challengeToContentItem(c);
    const ref = item.blocks.find((b) => b.kind === 'ref') as any;
    expect(ref).toBeTruthy();
    expect(ref.label).toBe('Ch.2, p. 17');
    expect(ref.detail).toBe('ADC');
  });

  it('ajoute un bloc concepts depuis meta.concepts', () => {
    const c = baseChallenge({ meta: { concepts: ['flags', 'carry'] } as any });
    const item = challengeToContentItem(c);
    const concepts = item.blocks.find((b) => b.kind === 'concepts') as any;
    expect(concepts.items).toEqual(['flags', 'carry']);
  });

  it('normalise les hints string et {text}', () => {
    const c = baseChallenge({ hints: [{ text: 'astuce A' } as any, 'astuce B' as any] });
    const item = challengeToContentItem(c);
    const hints = item.blocks.find((b) => b.kind === 'hints') as any;
    expect(hints.items).toEqual(['astuce A', 'astuce B']);
  });

  it('respecte l’ordre theory → ref → concepts → hints', () => {
    const c = baseChallenge({
      description: 'd',
      meta: { zaks: { chapter: 'C', page: 1, topic: 't' }, concepts: ['x'] } as any,
      hints: ['h'] as any,
    });
    const kinds = challengeToContentItem(c).blocks.map((b) => b.kind);
    expect(kinds).toEqual(['theory', 'ref', 'concepts', 'hints']);
  });

  it('passe template, assertions et maxCycles tels quels', () => {
    const c = baseChallenge({ template: 'LDA #1', assertions: [{ kind: 'register', reg: 'A', value: 1 } as any], maxCycles: 77 });
    const item = challengeToContentItem(c);
    expect(item.template).toBe('LDA #1');
    expect(item.assertions).toHaveLength(1);
    expect(item.maxCycles).toBe(77);
  });
});

describe('trackStepToContentItem', () => {
  it('produit un item track-step avec trackId, stepIndex et stepCount', () => {
    const c = baseChallenge({ id: 5, title: 'Balle', arena_name: 'Projet Pong' } as any);
    const item = trackStepToContentItem(c, 'pong', 2, 6);
    expect(item.type).toBe('track-step');
    expect(item.id).toBe(5);
    expect(item.trackId).toBe('pong');
    expect(item.stepIndex).toBe(2);
    expect(item.stepCount).toBe(6);
    expect(item.subtitle).toBe('Projet Pong');
  });

  it('inclut theory/concepts/hints mais PAS de bloc ref (pas de zaks)', () => {
    const c = baseChallenge({
      description: 'd',
      meta: { concepts: ['c'], zaks: { chapter: 'X', page: 1, topic: 't' } } as any,
      hints: ['h'] as any,
    });
    const kinds = trackStepToContentItem(c, 'pong', 0, 1).blocks.map((b) => b.kind);
    expect(kinds).toEqual(['theory', 'concepts', 'hints']);
  });
});