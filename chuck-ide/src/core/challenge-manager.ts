/* ─────────────────────────────────────────────────────────────
   Chuck IDE — core/challenge-manager.ts  (version WASM)
   ───────────────────────────────────────────────────────────── */

import { bus } from "./bus.js";
import type { Emulator } from "./emulator.js";
import {
  type Challenge,
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
import { tracksService } from "./challenges/tracks-service.js";
import type { TrackMeta, TrackConfig } from "./challenges/tracks-service.js";
import { productAccess } from "./product-access.js";
import { superAdmin } from "./super-admin.js";

const DEFAULT_MAX_CYCLES = 100_000;
const IDE_FREE_MODE = "chuck:ide-free" as const;
// const FREE_CHALLENGES = 3; // défis 1-3 accessibles sans restriction

/** True si le challenge appartient à un parcours guidé (a une arène nommée
 *  correspondant à une track connue). La frontière gratuit/premium et le prix
 *  sont portés par la track (cf. tracks-service), plus aucune constante globale. */
function trackOf(c: Challenge | undefined): TrackMeta | null {
  if (!c || !c.arena_name) return null;
  return tracksService.getTrackByName(c.arena_name);
}

function isTrackStep(c: Challenge | undefined): boolean {
  return trackOf(c) !== null;
}

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
    } else if (this._hasTrackParam()) {
      // ?challenge / ?parcours sans valeur valide → challenge courant
      this._loadById(this.currentChallenge(), false);
    } else {
      bus.emit(IDE_FREE_MODE, undefined);
      bus.emit("chuck:log", {
        text: "Mode libre.",
        level: "mode",
      });
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
      const [challenges, steps] = await Promise.all([
        challengesService.getAll(),
        tracksService.getAllSteps(),
      ]);
      for (const c of challenges) this._challenges.set(c.id, c);
      for (const s of steps) this._challenges.set(s.id, s);
    } catch (e) {
      bus.emit("chuck:log", {
        text: `Chargement des défis : ${(e as Error).message}`,
        level: "err",
      });
    }
  }

  private async _loadContent(): Promise<void> {
    try {
      const [challenges, steps] = await Promise.all([
        challengesService.getAll(),
        tracksService.getAllSteps(),
      ]);
      for (const c of challenges) this._challenges.set(c.id, c);
      for (const s of steps) this._challenges.set(s.id, s);
      bus.emit("chuck:challenges-count" as any, {
        count: challenges.length,
      });
      this._emitChallengesList();
      this._emitAllTrackSteps();
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
    const raw =
      params.get("challenge") ??
      params.get("parcours") ??
      params.get("lesson");
    if (!raw) return null;
    const id = parseInt(raw, 10);
    return isNaN(id) ? null : id;
  }

  private _hasTrackParam(): boolean {
    const params = new URLSearchParams(window.location.search);
    return (
      params.has("challenge") ||
      params.has("parcours") ||
      params.has("lesson")
    );
  }

  private _loadById(id: number, pushHistory = false): void {
    // ── Étapes de parcours (détectées par arena_name) — gating dédiée ──
    if (this._isTrackStepId(id)) {
      if (!this._challenges.has(id)) {
        bus.emit("chuck:log", { text: `Étape #${id} introuvable.`, level: "err" });
        return;
      }
      const arenaName = this._challenges.get(id)!.arena_name!;
      if (!this.isTrackStepAccessible(id)) {
        const current = this._currentTrackStepId(arenaName);
        bus.emit("chuck:log", {
          text: `🔒 Étape verrouillée — termine d'abord l'étape précédente.`,
          level: "err",
        });
        if (current !== null) {
          this._loadTrackStep(current, false);
          this._syncUrl(current, false);
        }
        return;
      }
      this._loadTrackStep(id, pushHistory);
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

  // Méthode utilitaire — centralise la mise à jour de l'URL.
  // Les étapes de parcours (Pong, Snake…) utilisent ?parcours=X ;
  // les challenges classiques utilisent ?challenge=X.
  private _syncUrl(id: number, push: boolean): void {
    const url = new URL(window.location.href);
    url.searchParams.delete("challenge");
    url.searchParams.delete("lesson");
    url.searchParams.delete("parcours");
    const param = this._isTrackStepId(id) ? "parcours" : "challenge";
    url.searchParams.set(param, String(id));
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

  // ── Parcours guidés (généralisé depuis Pong) ────────────────

  /** Émet le roster de chaque parcours (init / refresh global). */
  private _emitAllTrackSteps(): void {
    const seen = new Set<string>();
    for (const c of this._challenges.values()) {
      const track = trackOf(c);
      if (!track || seen.has(track.id)) continue;
      seen.add(track.id);
      this._emitTrackSteps(track);
    }
  }

  /** Liste des étapes d'un parcours (par nom d'arène), triées par id. */
  private _trackStepsByName(arenaName: string): Challenge[] {
    return Array.from(this._challenges.values())
      .filter((c) => c.arena_name === arenaName)
      .sort((a, b) => (a.stepIndex ?? a.id) - (b.stepIndex ?? b.id));
  }

  private _isTrackStepId(id: number): boolean {
    return isTrackStep(this._challenges.get(id));
  }

  /** True si `id` est la DERNIÈRE étape gratuite de son parcours (fin du lead
   *  magnet). C'est là qu'on déclenche le mur premium + funnel basic-completed.
   *  Si le parcours a moins de freeSteps étapes, c'est sa dernière étape. */
  private _isLastFreeStep(id: number): boolean {
    const track = trackOf(this._challenges.get(id));
    if (!track) return false;
    const steps = this._trackStepsByName(track.name);
    if (steps.length === 0) return false;
    const freeIdx = Math.min(track.freeSteps, steps.length) - 1;
    return steps[freeIdx]?.id === id;
  }

  /** Étape de parcours accessible : la 1ère l'est toujours, les suivantes
   *  nécessitent que l'étape précédente ait été validée. Exempté de la gating
   *  séquentielle globale. Les étapes premium (index > freeSteps) nécessitent
   *  en plus l'achat du parcours. */
  isTrackStepAccessible(id: number): boolean {
    const track = trackOf(this._challenges.get(id));
    if (!track) return false;
    const steps = this._trackStepsByName(track.name);
    const idx = steps.findIndex((c) => c.id === id);
    if (idx < 0) return false;

    // Palier premium : au-delà des étapes gratuites, accès réservé aux acheteurs.
    if (
      !superAdmin.active &&
      track.priceCents != null &&
      idx + 1 > track.freeSteps &&
      !productAccess.hasPurchasedSync(track.id)
    ) {
      return false;
    }

    if (idx === 0) return true;
    const prev = steps[idx - 1];
    return !!prev && storage.isCompleted(prev.id);
  }

  /** True si l'étape est verrouillée SPÉCIFIQUEMENT par le mur premium (par
   *  opposition au verrou séquentiel). Permet à l'UI de montrer le mur d'achat. */
  isTrackStepPremiumLocked(id: number): boolean {
    const track = trackOf(this._challenges.get(id));
    if (!track || track.priceCents == null) return false;
    const steps = this._trackStepsByName(track.name);
    const idx = steps.findIndex((c) => c.id === id);
    if (idx < 0) return false;
    return !superAdmin.active && idx + 1 > track.freeSteps && !productAccess.hasPurchasedSync(track.id);
  }

  /** Première étape non validée d'un parcours, ou la dernière si tout est fait. */
  private _currentTrackStepId(arenaName: string): number | null {
    const steps = this._trackStepsByName(arenaName);
    if (steps.length === 0) return null;
    for (const c of steps) {
      if (!storage.isCompleted(c.id)) return c.id;
    }
    return steps[steps.length - 1]!.id;
  }

  private _loadTrackStep(id: number, pushHistory: boolean): void {
    const challenge = this._challenges.get(id);
    if (!challenge) return;
    const track = trackOf(challenge);
    if (!track) return;
    const steps = this._trackStepsByName(track.name);
    const stepIndex = steps.findIndex((c) => c.id === id) + 1;
    const stepCount = steps.length;

    this._current = challenge;
    this._currentItem = trackStepToContentItem(challenge, track.id, stepIndex, stepCount);

    const saved = storage.loadCode(id);
    const medal = storage.getMedal(id);
    bus.emit("chuck:challenge-loaded", {
      challenge,
      code: saved ?? challenge.template,
      fromStorage: saved !== null,
      medal: medal ?? undefined,
      track: { trackId: track.id, stepIndex, stepCount },
    });
    this._emitTrackSteps(track);
    if (stepIndex === 1) {
      bus.emit("chuck:funnel-step", {
        step: "pong-basic-started",
        meta: { stepId: id, trackId: track.id },
      });
    }
    void pushHistory; // la sync URL est gérée par l'appelant (_loadById)
  }

  /** Émet la liste des étapes d'un parcours pour l'écran roadmap. */
  private _emitTrackSteps(track: TrackMeta): void {
    const steps = this._trackStepsByName(track.name);
    const currentId = this._currentTrackStepId(track.name);
    const items: import("../types/challenge.js").TrackStepListItem[] = steps.map(
      (c, i) => ({
        id: c.id,
        stepIndex: i + 1,
        stepCount: steps.length,
        title: c.title,
        completed: storage.isCompleted(c.id),
        medal: storage.getMedal(c.id),
        accessible: this.isTrackStepAccessible(c.id),
        premiumLocked: this.isTrackStepPremiumLocked(c.id),
        current: c.id === currentId,
      }),
    );
    const config: TrackConfig = track;
    bus.emit("chuck:track-steps", { trackId: track.id, trackName: track.name, config, items });
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
      .filter((c) => !isTrackStep(c))
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
   * N'inclut jamais les étapes de parcours (filtrées par arena_name).
   */
  currentChallenge(): number {
    const regularIds = Array.from(this._challenges.values())
      .filter((c) => !isTrackStep(c))
      .map((c) => c.id);
    if (regularIds.length === 0) return 1;
    const maxId = Math.max(...regularIds);
    const sorted = regularIds.sort((a, b) => a - b);
    for (const id of sorted) {
      if (!storage.isCompleted(id)) return id;
    }
    return maxId;
  }

  saveCompleted(id: number, hintsUsed: number): void {
    const medal: Medal = hintsUsed === 0 ? "🥇" : hintsUsed === 1 ? "🥈" : "🥉";
    storage.saveCompletion(id, medal, hintsUsed);
    bus.emit("chuck:challenge-completed" as any, { id, medal, hintsUsed });
    if (this._isTrackStepId(id)) {
      const track = trackOf(this._challenges.get(id));
      if (track) this._emitTrackSteps(track);
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
      if (this._isTrackStepId(challenge.id) && this._isLastFreeStep(challenge.id)) {
        const track = trackOf(challenge)!;
        bus.emit("chuck:funnel-step", {
          step: "pong-basic-completed",
          meta: { stepId: challenge.id, trackId: track.id },
        });
        // Mur premium : affiché à la fin des étapes gratuites (lead magnet
        // consommé, raison de payer encore intacte — cf. stratégie §2).
        // N'apparaît pas pour un parcours gratuit (priceCents == null), ni
        // si l'utilisateur a déjà acheté l'accès avancé.
        if (
          !superAdmin.active &&
          track.priceCents != null &&
          !productAccess.hasPurchasedSync(track.id)
        ) {
          bus.emit("chuck:track-completed", {
            trackId: track.id,
            config: track,
            trackName: track.name,
          });
        }
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
      bus.on("chuck:goto-next-track-step", ({ fromId }) => {
        // Résout l'étape suivante dans l'ordre du parcours (pas id+1 : les
        // ids de track_steps ne sont pas contigus).
        const track = trackOf(this._challenges.get(fromId));
        if (!track) return;
        const steps = this._trackStepsByName(track.name);
        const idx = steps.findIndex((c) => c.id === fromId);
        const next = idx >= 0 ? steps[idx + 1] : undefined;
        if (next) this._loadById(next.id, true);
      }),
      bus.on("chuck:track-completed-request", ({ trackId }) => {
        const track = tracksService.getTrackById(trackId);
        if (!track) return;
        bus.emit("chuck:track-completed", {
          trackId: track.id,
          config: track,
          trackName: track.name,
        });
      }),
      bus.on("chuck:ide-free", () => {
        // Sortie d'un défi / Pong vers le mode libre : on oublie l'item courant
        // pour que validation, autosave et assemblage ne ciblent plus l'ancien id.
        this._current = null;
        this._currentItem = null;
        // Nettoie l'URL (?challenge / ?lesson) pour ne pas recharger un défi au refresh.
        const url = new URL(window.location.href);
        url.searchParams.delete("challenge");
        url.searchParams.delete("lesson");
        window.history.replaceState({}, "", url.toString());
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

/** Adaptateur Challenge (étape de parcours) → TrackStepItem.
 *  Mêmes blocs pédagogiques qu'un défi classique, mais type 'track-step'
 *  pour un affichage et une navigation dédiés dans <chuck-side-panel>. */
function trackStepToContentItem(
  c: Challenge,
  trackId: string,
  stepIndex: number,
  stepCount: number,
): import("../types/content.js").TrackStepItem {
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