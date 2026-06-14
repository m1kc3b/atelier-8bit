/* ─────────────────────────────────────────────────────────────
   Chuck IDE — core/challenge-manager.ts  (version WASM)
   ───────────────────────────────────────────────────────────── */

import { bus }  from './bus.js';
import type { Emulator } from './emulator.js';
import {
  type Challenge,
  type ChallengesFile,
  type ValidationResult,
  type AssertionFailure,
  type Assertion,
} from '../types/challenge.js';
import type { ContentItem, ContentFile, ChallengeItem, ContentBlock } from '../types/content.ts';

const STORAGE_PREFIX     = 'chuck_day_';
const DEFAULT_MAX_CYCLES = 100_000;
const IDE_FREE_MODE      = 'chuck:ide-free' as const;

const FLAGS: Record<string, number> = {
  N: 0b1000_0000, V: 0b0100_0000, B: 0b0001_0000,
  D: 0b0000_1000, I: 0b0000_0100, Z: 0b0000_0010, C: 0b0000_0001,
};

export class ChallengeManager {
  private _challenges:  Map<number, Challenge>    = new Map();
  private _contentItems:Map<number, ContentItem>  = new Map();
  private _current:     Challenge | null          = null;
  private _currentItem: ContentItem | null        = null;
  private _unsubs:      Array<() => void>         = [];
  private _emulator:    Emulator | null           = null;

  // ── Initialisation ────────────────────────────────────────

  async init(emulator: Emulator): Promise<void> {
    this._emulator = emulator;
    await Promise.all([
      this._loadChallenges(),
      this._loadContent(),
    ]);
    this._bindBus();

    const id = this._getIdFromUrl();
    if (id !== null) {
      this._loadById(id);
    } else {
      bus.emit('chuck:log', {
        text:  'Mode libre — ?challenge=1 pour les défis, ?lesson=100 pour la formation.',
        level: 'dim',
      });
      (bus as any).emit(IDE_FREE_MODE, undefined);
    }
  }

  destroy(): void { this._unsubs.forEach(fn => fn()); }

  get current(): Challenge | null      { return this._current; }
  get currentItem(): ContentItem | null { return this._currentItem; }

  // ── Chargement ────────────────────────────────────────────

  private async _loadChallenges(): Promise<void> {
    try {
      const res  = await fetch('/challenges.json');
      const data = (await res.json()) as ChallengesFile;
      for (const c of data.challenges) this._challenges.set(c.id, c);
    } catch (e) {
      bus.emit('chuck:log', { text: `challenges.json : ${(e as Error).message}`, level: 'err' });
    }
  }

  private async _loadContent(): Promise<void> {
    try {
      const res  = await fetch('/content.json');
      const data = (await res.json()) as ContentFile;
      for (const item of data.items) this._contentItems.set(item.id, item);
    } catch (e) {
      bus.emit('chuck:log', { text: `content.json : ${(e as Error).message}`, level: 'err' });
    }
  }

  // ── Navigation ────────────────────────────────────────────

  private _getIdFromUrl(): number | null {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('challenge') ?? params.get('lesson');
    if (!raw) return null;
    const id = parseInt(raw, 10);
    return isNaN(id) ? null : id;
  }

  private _loadById(id: number): void {
    // Chercher d'abord dans les défis, puis dans le contenu
    const challenge = this._challenges.get(id);
    if (challenge) {
      this._loadChallenge(id); return;
    }
    const item = this._contentItems.get(id);
    if (item) {
      this._loadContentItem(item); return;
    }
    bus.emit('chuck:log', { text: `Item #${id} introuvable.`, level: 'err' });
  }

  private _loadChallenge(id: number): void {
    const challenge = this._challenges.get(id);
    if (!challenge) return;
    this._current = challenge;

    // Convertit en ContentItem pour le panneau générique
    const item = challengeToContentItem(challenge);
    this._currentItem = item;
    const saved = this._loadFromStorage(id);
    bus.emit('chuck:challenge-loaded', {
      challenge,
      code:        saved ?? challenge.template,
      fromStorage: saved !== null,
    });
  }

  private _loadContentItem(item: ContentItem): void {
    this._current     = null;
    this._currentItem = item;
    bus.emit('chuck:content-loaded' as any, { item });
  }

  // ── localStorage ─────────────────────────────────────────

  private _storageKey(id: number) { return `${STORAGE_PREFIX}${id}`; }

  private _loadFromStorage(id: number): string | null {
    try { return localStorage.getItem(this._storageKey(id)); } catch { return null; }
  }

  saveToStorage(id: number, code: string): void {
    try { localStorage.setItem(this._storageKey(id), code); } catch {}
  }

  // ── Validation ────────────────────────────────────────────

  validate(source: string): void {
    if (!this._current || !this._emulator) return;
    const challenge  = this._current;
    const maxCycles  = challenge.maxCycles ?? DEFAULT_MAX_CYCLES;
    const run        = this._emulator.runHeadless(source, maxCycles);

    if (!run.ok) {
      const failure: AssertionFailure = {
        assertion: { type: 'register', register: 'A', value: 0 },
        expected: 0, actual: 0,
        message: `Erreur d'assemblage L${run.errLine} : ${run.errMsg}`,
      };
      bus.emit('chuck:challenge-failed', {
        result: { success: false, failures: [failure], cycles: 0, timeout: false },
      });
      return;
    }

    const timeout  = !run.halted;
    const failures: AssertionFailure[] = [];
    for (const assertion of challenge.assertions) {
      const f = this._checkAssertion(assertion, run.state, run.memView);
      if (f) failures.push(f);
    }

    const success = failures.length === 0 && !timeout;
    const result: ValidationResult = { success, failures, cycles: run.cycles, timeout };

    if (success) {
      bus.emit('chuck:challenge-success', { result });
      bus.emit('chuck:log', { text: `✓ Défi réussi en ${run.cycles} cycle(s) !`, level: 'ok' });
    } else {
      bus.emit('chuck:challenge-failed', { result });
      for (const f of failures) bus.emit('chuck:log', { text: `✗ ${f.message}`, level: 'err' });
    }
  }

  private _checkAssertion(
    assertion: Assertion,
    state:     { A: number; X: number; Y: number; PC: number; SP: number; P: number },
    memView:   Uint8Array,
  ): AssertionFailure | null {
    switch (assertion.type) {
      case 'register': {
        const reg: Record<string, number> = { A: state.A, X: state.X, Y: state.Y, PC: state.PC, SP: state.SP };
        const actual = reg[assertion.register] ?? 0;
        if (actual === assertion.value) return null;
        return { assertion, expected: assertion.value, actual,
          message: assertion.failMsg ?? `${assertion.register} : attendu $${h(assertion.value)}, obtenu $${h(actual)}` };
      }
      case 'memory': {
        const actual = memView[assertion.address] ?? 0;
        if (actual === assertion.value) return null;
        return { assertion, expected: assertion.value, actual,
          message: assertion.failMsg ?? `$${addr(assertion.address)} : attendu $${h(assertion.value)}, obtenu $${h(actual)}` };
      }
      case 'flag': {
        const mask  = FLAGS[assertion.flag] ?? 0;
        const actual = (state.P & mask) !== 0;
        if (actual === assertion.set) return null;
        return { assertion, expected: assertion.set, actual,
          message: assertion.failMsg ?? `Flag ${assertion.flag} : attendu ${assertion.set ? '1':'0'}` };
      }
      case 'sequence': {
        for (let i = 0; i < assertion.values.length; i++) {
          const expected = assertion.values[i]!;
          const actual   = memView[assertion.address + i] ?? 0;
          if (actual !== expected)
            return { assertion, expected, actual,
              message: assertion.failMsg ?? `Séquence $${addr(assertion.address + i)} : attendu $${h(expected)}, obtenu $${h(actual)}` };
        }
        return null;
      }
    }
  }

  // ── Bus ───────────────────────────────────────────────────

  private _bindBus(): void {
    this._unsubs.push(
      bus.on('chuck:autosave',      ({ id, code }) => this.saveToStorage(id, code)),
      bus.on('chuck:validate',      ({ source })   => this.validate(source)),
      bus.on('chuck:goto-challenge', ({ id }) => {
        this._loadById(id);
        const url = new URL(window.location.href);
        const key = id >= 100 ? 'lesson' : 'challenge';
        url.searchParams.delete('challenge'); url.searchParams.delete('lesson');
        url.searchParams.set(key, String(id));
        window.history.pushState({}, '', url.toString());
      }),
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────
const h    = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
const addr = (n: number) => n.toString(16).padStart(4, '0').toUpperCase();

// ── Adaptateur Challenge → ContentItem ───────────────────────
function challengeToContentItem(c: Challenge): ChallengeItem {
  const blocks: ContentBlock[] = [];

  if (c.description) {
    blocks.push({ kind: 'theory', content: c.description });
  }
  if ((c.meta as any)?.zaks) {
    const z = (c.meta as any).zaks;
    blocks.push({ kind: 'ref', icon: '📖', label: `${z.chapter}, p. ${z.page}`, detail: z.topic });
  }
  if (c.meta?.concepts?.length) {
    blocks.push({ kind: 'concepts', items: c.meta.concepts });
  }
  if (c.hints?.length) {
    blocks.push({ kind: 'hints', items: c.hints.map((h: any) => h.text ?? h) });
  }

  return {
    type:       'challenge',
    id:          c.id,
    arena:      (c as any).arena,
    arena_name: (c as any).arena_name,
    title:       c.title,
    blocks,
    template:    c.template ?? '',
    assertions:  c.assertions ?? [],
    maxCycles:   c.maxCycles,
    meta:        c.meta as any,
  };
}
