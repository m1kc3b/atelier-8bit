/* ─────────────────────────────────────────────────────────────
   Chuck IDE — core/challenge-manager.ts  (version WASM)
   ───────────────────────────────────────────────────────────── */

import { bus } from "./bus.js";
import type { Emulator } from "./emulator.js";
import {
  type Challenge,
  type ChallengesFile,
  type ValidationResult,
  type AssertionFailure,
  type Assertion,
  type ChallengeListItem,
} from "../types/challenge.js";
import type {
  ContentItem,
  ChallengeItem,
  ContentBlock,
} from "../types/content.js";
import { storage } from "./storage/storage-service.js";
import type { ChallengeProgress, Medal } from "./storage/types.js";
import { challengesService } from "./challenges/challenges-service.js";

const DEFAULT_MAX_CYCLES = 100_000;
const IDE_FREE_MODE = "chuck:ide-free" as const;
// const FREE_CHALLENGES = 3; // défis 1-3 accessibles sans restriction

/** Les étapes du parcours guidé "Coder Pong" sont stockées dans la même
 *  table `challenges` côté Supabase (arena_name = 'Projet Pong', locked = true),
 *  avec des ids ≥ PONG_ID_MIN. Elles sont exemptées de la gating séquentielle
 *  globale et du compteur des défis classiques (cf. mémo projet). */
export const PONG_ID_MIN = 1000;

const FLAGS: Record<string, number> = {
  N: 0b1000_0000,
  V: 0b0100_0000,
  B: 0b0001_0000,
  D: 0b0000_1000,
  I: 0b0000_0100,
  Z: 0b0000_0010,
  C: 0b0000_0001,
};

export class ChallengeManager {
  private _challenges: Map<number, Challenge> = new Map();
  private _contentItems: Map<number, ContentItem> = new Map();
  private _current: Challenge | null = null;
  private _currentItem: ContentItem | null = null;
  private _unsubs: Array<() => void> = [];
  private _emulator: Emulator | null = null;

  // ── Initialisation ────────────────────────────────────────

  async init(emulator: Emulator): Promise<void> {
    this._emulator = emulator;
    await Promise.all([this._loadChallenges(), this._loadContent()]);
    this._bindBus();

    const urlId = this._getIdFromUrl();
    if (urlId !== null) {
      // _loadById redirige automatiquement si l'id est inaccessible
      this._loadById(urlId, false);
    } else if (new URLSearchParams(window.location.search).has("challenge")) {
      // ?challenge sans valeur valide → challenge courant
      this._loadById(this.currentChallenge(), false);
    } else {
      bus.emit("chuck:log", {
        text: "Mode libre.",
        level: "dim",
      });
      (bus as any).emit(IDE_FREE_MODE, undefined);
    }
  }

  destroy(): void {
    this._unsubs.forEach((fn) => fn());
  }

  get current(): Challenge | null {
    return this._current;
  }
  get currentItem(): ContentItem | null {
    return this._currentItem;
  }

  // ── Chargement ────────────────────────────────────────────

  private async _loadChallenges(): Promise<void> {
    try {
      const list = await challengesService.getAll();
      for (const c of list) this._challenges.set(c.id, c);
    } catch (e) {
      bus.emit("chuck:log", {
        text: `Chargement des défis : ${(e as Error).message}`,
        level: "err",
      });
    }
  }

  private async _loadContent(): Promise<void> {
    try {
      const list = await challengesService.getAll();
      for (const c of list) this._challenges.set(c.id, c);
      bus.emit("chuck:challenges-count" as any, {
        count: list.filter((c) => c.id < PONG_ID_MIN).length,
      });
      this._emitChallengesList();
      this._emitPongSteps();
    } catch (e) {
      bus.emit("chuck:log", {
        text: `Chargement des défis : ${(e as Error).message}`,
        level: "err",
      });
    }
  }

  // ── Navigation ────────────────────────────────────────────

  private _getIdFromUrl(): number | null {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("challenge") ?? params.get("lesson");
    if (!raw) return null;
    const id = parseInt(raw, 10);
    return isNaN(id) ? null : id;
  }

  private _loadById(id: number, pushHistory = false): void {
    // ── Étapes du parcours guidé Pong (id ≥ 1000) — gating dédiée ──
    if (this._isPongStepId(id)) {
      if (!this._challenges.has(id)) {
        bus.emit("chuck:log", { text: `Étape Pong #${id} introuvable.`, level: "err" });
        return;
      }
      if (!this.isPongStepAccessible(id)) {
        const current = this._currentPongStepId();
        bus.emit("chuck:log", {
          text: `🔒 Étape verrouillée — termine d'abord l'étape précédente.`,
          level: "err",
        });
        if (current !== null) {
          this._loadPongStep(current, false);
          this._syncUrl(current, false);
        }
        return;
      }
      this._loadPongStep(id, pushHistory);
      this._syncUrl(id, pushHistory);
      return;
    }

    // ── Leçons / contenu (id ≥ 100) — pas de garde séquentielle ──
    if (id >= 100) {
      const item = this._contentItems.get(id);
      if (item) {
        this._loadContentItem(item);
        return;
      }
      bus.emit("chuck:log", { text: `Item #${id} introuvable.`, level: "err" });
      return;
    }

    // ── Challenges : vérification séquentielle ────────────────────
    if (!this._challenges.has(id)) {
      bus.emit("chuck:log", { text: `Défi #${id} introuvable.`, level: "err" });
      return;
    }

    if (!this.isAccessible(id)) {
      // Redirection silencieuse vers le challenge courant
      const current = this.currentChallenge();
      bus.emit("chuck:log", {
        text: `🔒 Défi ${id} verrouillé — valide d'abord le défi ${id - 1}.`,
        level: "err",
      });
      this._loadChallenge(current);
      this._syncUrl(current, false); // replaceState — pas de nouvelle entrée historique
      return;
    }

    this._loadChallenge(id);
    this._syncUrl(id, pushHistory);
  }

  // Méthode utilitaire — centralise la mise à jour de l'URL
  private _syncUrl(id: number, push: boolean): void {
    const url = new URL(window.location.href);
    url.searchParams.delete("challenge");
    url.searchParams.delete("lesson");
    url.searchParams.set("challenge", String(id));
    if (push) {
      window.history.pushState({}, "", url.toString());
    } else {
      window.history.replaceState({}, "", url.toString());
    }
  }

  private _loadChallenge(id: number): void {
    const challenge = this._challenges.get(id);
    if (!challenge) return;
    this._current = challenge;
    const item = challengeToContentItem(challenge);
    this._currentItem = item;
    const saved = storage.loadCode(id);
    const medal = storage.getMedal(id);
    bus.emit("chuck:challenge-loaded", {
      challenge,
      code: saved ?? challenge.template,
      fromStorage: saved !== null,
      medal: medal ?? undefined,
    });
    this._emitChallengesList();
  }

  // ── Pong (Étape 3 du funnel) ────────────────────────────────

  /** Liste des défis "Projet Pong" (id ≥ PONG_ID_MIN), triés par id croissant. */
  private _pongSteps(): Challenge[] {
    return Array.from(this._challenges.values())
      .filter((c) => c.id >= PONG_ID_MIN)
      .sort((a, b) => a.id - b.id);
  }

  private _isPongStepId(id: number): boolean {
    return id >= PONG_ID_MIN && this._challenges.has(id);
  }

  private _isLastPongStep(id: number): boolean {
    const steps = this._pongSteps();
    const last = steps[steps.length - 1];
    return !!last && last.id === id;
  }

  /** Étape Pong accessible : la 1ère l'est toujours, les suivantes
   *  nécessitent que l'étape précédente (pas le défi classique précédent)
   *  ait été validée. Exempté de la gating séquentielle globale. */
  isPongStepAccessible(id: number): boolean {
    const steps = this._pongSteps();
    const idx = steps.findIndex((c) => c.id === id);
    if (idx <= 0) return true;
    const prev = steps[idx - 1];
    return !!prev && storage.isCompleted(prev.id);
  }

  /** Première étape non validée, ou la dernière si tout est complété. */
  private _currentPongStepId(): number | null {
    const steps = this._pongSteps();
    if (steps.length === 0) return null;
    for (const c of steps) {
      if (!storage.isCompleted(c.id)) return c.id;
    }
    return steps[steps.length - 1]!.id;
  }

  private _loadPongStep(id: number, pushHistory: boolean): void {
    const challenge = this._challenges.get(id);
    if (!challenge) return;
    const steps = this._pongSteps();
    const stepIndex = steps.findIndex((c) => c.id === id) + 1;
    const stepCount = steps.length;

    this._current = challenge;
    this._currentItem = pongStepToContentItem(challenge, stepIndex, stepCount);

    const saved = storage.loadCode(id);
    const medal = storage.getMedal(id);
    bus.emit("chuck:challenge-loaded", {
      challenge,
      code: saved ?? challenge.template,
      fromStorage: saved !== null,
      medal: medal ?? undefined,
      pong: { stepIndex, stepCount },
    });
    this._emitPongSteps();
    void pushHistory; // la sync URL est gérée par l'appelant (_loadById)
  }

  /** Émet la liste des étapes Pong pour l'écran "🏓 Coder Pong". */
  private _emitPongSteps(): void {
    const steps = this._pongSteps();
    const currentId = this._currentPongStepId();
    const items: import("../types/challenge.js").PongStepListItem[] = steps.map(
      (c, i) => ({
        id: c.id,
        stepIndex: i + 1,
        stepCount: steps.length,
        title: c.title,
        completed: storage.isCompleted(c.id),
        medal: storage.getMedal(c.id),
        accessible: this.isPongStepAccessible(c.id),
        current: c.id === currentId,
      }),
    );
    bus.emit("chuck:pong-steps", { items });
  }

  private _loadContentItem(item: ContentItem): void {
    this._current = null;
    this._currentItem = item;
    bus.emit("chuck:content-loaded" as any, { item });
  }

  // ── localStorage ─────────────────────────────────────────
  saveToStorage(id: number, code: string): void {
    storage.saveCode(id, code);
  }

  getCompleted(): Record<number, ChallengeProgress> {
    return storage.getAllProgress();
  }

  getMedal(id: number): Medal | null {
    return storage.getMedal(id);
  }

  /** Dernier défi accessible */
  /** Dernier défi accessible */
  isAccessible(id: number): boolean {
    if (id <= 1) return true;
    return storage.isCompleted(id - 1);
  }

  /** Émet la liste complète des défis pour l'écran "Les Challenges" */
  private _emitChallengesList(): void {
    const currentId = this.currentChallenge();
    const items: ChallengeListItem[] = Array.from(this._challenges.values())
      .filter((c) => c.id < PONG_ID_MIN)
      .sort((a, b) => a.id - b.id)
      .map((c) => {
        const sequentialLocked = !this.isAccessible(c.id);
        const emailLocked =
          !!c.locked && !storage.isUnlocked() && !sequentialLocked;
        return {
          id: c.id,
          title: c.title,
          arenaName: c.arena_name,
          estimatedMinutes: c.meta?.estimatedMinutes,
          sequentialLocked,
          emailLocked,
          completed: storage.isCompleted(c.id),
          medal: storage.getMedal(c.id),
          current: c.id === currentId,
        };
      });
    bus.emit("chuck:challenges-list", { items });
  }

  /**
   * Retourne l'id du challenge courant à afficher :
   * le premier challenge non encore complété.
   * Si tout est complété, retourne le dernier challenge disponible.
   * N'inclut jamais les étapes Pong (id ≥ PONG_ID_MIN).
   */
  currentChallenge(): number {
    const regularIds = Array.from(this._challenges.keys()).filter(
      (id) => id < PONG_ID_MIN,
    );
    const maxId = Math.max(...regularIds, 1);
    for (let id = 1; id <= maxId; id++) {
      if (!storage.isCompleted(id)) return id;
    }
    return maxId; // tous complétés → afficher le dernier
  }

  saveCompleted(id: number, hintsUsed: number): void {
    const medal: Medal = hintsUsed === 0 ? "🥇" : hintsUsed === 1 ? "🥈" : "🥉";
    storage.saveCompletion(id, medal, hintsUsed);
    bus.emit("chuck:challenge-completed" as any, { id, medal, hintsUsed });
    if (this._isPongStepId(id)) {
      this._emitPongSteps();
    } else {
      this._emitChallengesList();
    }
  }

  // ── Validation ────────────────────────────────────────────

  validate(source: string, hintsUsed = 0): void {
    if (!this._current || !this._emulator) return;
    const challenge = this._current;
    const maxCycles = challenge.maxCycles ?? DEFAULT_MAX_CYCLES;
    const run = this._emulator.runHeadless(source, maxCycles);

    if (!run.ok) {
      const failure: AssertionFailure = {
        assertion: { type: "register", register: "A", value: 0 },
        expected: 0,
        actual: 0,
        message: `Erreur d'assemblage L${run.errLine} : ${run.errMsg}`,
      };
      bus.emit("chuck:challenge-failed", {
        result: {
          success: false,
          failures: [failure],
          cycles: 0,
          timeout: false,
        },
      });
      return;
    }

    const timeout = !run.halted;
    const failures: AssertionFailure[] = [];
    for (const assertion of challenge.assertions) {
      const f = this._checkAssertion(assertion, run.state, run.memView);
      if (f) failures.push(f);
    }

    const success = failures.length === 0 && !timeout;
    const result: ValidationResult = {
      success,
      failures,
      cycles: run.cycles,
      timeout,
    };

    if (success) {
      this.saveCompleted(challenge.id, hintsUsed);
      bus.emit("chuck:challenge-success", {
        result,
        medal: storage.getMedal(challenge.id) ?? undefined,
      });
      bus.emit("chuck:log", {
        text: `✓ Défi réussi en ${run.cycles} cycle(s) !`,
        level: "ok",
      });
      if (this._isPongStepId(challenge.id) && this._isLastPongStep(challenge.id)) {
        bus.emit("chuck:pong-completed", { stepCount: this._pongSteps().length });
      }
    } else {
      bus.emit("chuck:challenge-failed", { result });
      for (const f of failures)
        bus.emit("chuck:log", { text: `✗ ${f.message}`, level: "err" });
    }
  }

  private _checkAssertion(
    assertion: Assertion,
    state: {
      A: number;
      X: number;
      Y: number;
      PC: number;
      SP: number;
      P: number;
    },
    memView: Uint8Array,
  ): AssertionFailure | null {
    switch (assertion.type) {
      case "register": {
        const reg: Record<string, number> = {
          A: state.A,
          X: state.X,
          Y: state.Y,
          PC: state.PC,
          SP: state.SP,
        };
        const actual = reg[assertion.register] ?? 0;
        if (actual === assertion.value) return null;
        return {
          assertion,
          expected: assertion.value,
          actual,
          message:
            assertion.failMsg ??
            `${assertion.register} : attendu $${h(assertion.value)}, obtenu $${h(actual)}`,
        };
      }
      case "memory": {
        const actual = memView[assertion.address] ?? 0;
        if (actual === assertion.value) return null;
        return {
          assertion,
          expected: assertion.value,
          actual,
          message:
            assertion.failMsg ??
            `$${addr(assertion.address)} : attendu $${h(assertion.value)}, obtenu $${h(actual)}`,
        };
      }
      case "flag": {
        const mask = FLAGS[assertion.flag] ?? 0;
        const actual = (state.P & mask) !== 0;
        if (actual === assertion.set) return null;
        return {
          assertion,
          expected: assertion.set,
          actual,
          message:
            assertion.failMsg ??
            `Flag ${assertion.flag} : attendu ${assertion.set ? "1" : "0"}`,
        };
      }
      case "sequence": {
        for (let i = 0; i < assertion.values.length; i++) {
          const expected = assertion.values[i]!;
          const actual = memView[assertion.address + i] ?? 0;
          if (actual !== expected)
            return {
              assertion,
              expected,
              actual,
              message:
                assertion.failMsg ??
                `Séquence $${addr(assertion.address + i)} : attendu $${h(expected)}, obtenu $${h(actual)}`,
            };
        }
        return null;
      }
    }
  }

  // ── Bus ───────────────────────────────────────────────────

  private _bindBus(): void {
    this._unsubs.push(
      bus.on("chuck:autosave", ({ id, code }) => this.saveToStorage(id, code)),
      bus.on("chuck:validate", ({ source, hintsUsed }) =>
        this.validate(source, hintsUsed ?? 0),
      ),
      bus.on("chuck:goto-challenge", ({ id }) => {
        this._loadById(id, true);
      }),
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────
const h = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
const addr = (n: number) => n.toString(16).padStart(4, "0").toUpperCase();

// ── Adaptateur Challenge → ContentItem ───────────────────────
function challengeToContentItem(c: Challenge): ChallengeItem {
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

/** Adaptateur Challenge (arène "Projet Pong") → PongStepItem.
 *  Mêmes blocs pédagogiques qu'un défi classique, mais type 'pong-step'
 *  pour un affichage et une navigation dédiés dans <chuck-side-panel>. */
function pongStepToContentItem(
  c: Challenge,
  stepIndex: number,
  stepCount: number,
): import("../types/content.js").PongStepItem {
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
    type: "pong-step",
    id: c.id,
    title: c.title,
    subtitle: c.arena_name,
    blocks,
    stepIndex,
    stepCount,
  };
}
