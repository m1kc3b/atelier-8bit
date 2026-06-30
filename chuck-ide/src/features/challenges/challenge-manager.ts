/* ─────────────────────────────────────────────────────────────
   Chuck IDE — features/challenges/challenge-manager.ts  (version WASM)
   ───────────────────────────────────────────────────────────── */

import { bus } from "../../core/bus";
import type { Emulator } from "../../infra/wasm/emulator";
import {
  type Challenge,
  type ValidationResult,
  type AssertionFailure,
  type Assertion,
  type ChallengeListItem,
} from "../../types/challenge.js";
import type {
  ContentItem,
} from "../../types/content.js";
import { storage } from "../../infra/storage/storage-service.js";
import type { ChallengeProgress, Medal } from "../../infra/storage/types.js";
import { challengesService } from "../../features/challenges/challenges-service.js";
import { tracksService } from "../../features/challenges/tracks-service.js";
import type { TrackMeta, TrackConfig } from "../../features/challenges/tracks-service.js";
import { superAdmin } from "../../core/super-admin.js";
import { authService } from "../../features/auth/auth-service.js";
import { challengeToContentItem, trackStepToContentItem } from "../content/content-mappers.js";

const DEFAULT_MAX_CYCLES = 100_000;
const IDE_FREE_MODE = "chuck:ide-free" as const;

/** True si le challenge appartient à un parcours guidé (a une arène nommée
 *  correspondant à une track connue). Les parcours sont gratuits : la track
 *  ne porte plus que la structure pédagogique (cf. tracks-service). */
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

  constructor() {
    // Quand le flag super-admin bascule APRÈS le boot (login/logout en
    // cours de session), les gardes synchrones changent de résultat mais
    // rien ne re-render tout seul : on ré-émet la liste des défis et les
    // rosters de parcours. Le désabonnement est poussé dans _unsubs pour
    // être nettoyé par destroy().
    this._unsubs.push(
      superAdmin.onChange(() => {
        this._emitChallengesList();
        this._emitAllTrackSteps();
      }),
    );
  }

  // ── Initialisation ────────────────────────────────────────

  async init(emulator: Emulator): Promise<void> {
    this._emulator = emulator;
    this._bindBus();

    const urlId = this._getIdFromUrl();
    if (urlId !== null) {
      await this._ensureLoaded();
    } else if (this._hasTrackParam()) {
      await this._ensureLoaded();
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
  private _loaded = false;
  private _loadingPromise: Promise<void> | null = null;

  /** Charge challenges + steps une seule fois, à la demande.
   *  Idempotent : appels concurrents partagent la même promesse. */
  private _ensureLoaded(): Promise<void> {
    if (this._loaded) return Promise.resolve();
    if (this._loadingPromise) return this._loadingPromise;

    this._loadingPromise = (async () => {
      try {
        const [challenges, steps] = await Promise.all([
          challengesService.getAll(),
          tracksService.getAllSteps(),
        ]);
        for (const c of challenges) this._challenges.set(c.id, c);
        for (const s of steps) this._challenges.set(s.id, s);
        this._loaded = true;
      } catch (e) {
        bus.emit("chuck:log", {
          text: `Chargement des défis : ${(e as Error).message}`,
          level: "err",
        });
        this._loadingPromise = null; // permet un nouvel essai après échec
        throw e;
      }
    })();
    return this._loadingPromise;
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
    const medal = storage.getMedal(id);
    bus.emit("chuck:challenge-loaded", {
      challenge,
      code: challenge.template,
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

  /** True si `id` est le DERNIER challenge classique (hors parcours) de la
   *  série. Déterminé dynamiquement (max des ids non-track) pour survivre à
   *  l'ajout de challenges 19+ sans toucher ce code. */
  private _isLastFoundationChallenge(id: number): boolean {
    const foundationIds = Array.from(this._challenges.values())
      .filter((c) => !isTrackStep(c))
      .map((c) => c.id);
    if (foundationIds.length === 0) return false;
    return id === Math.max(...foundationIds);
  }

  /** Id de l'étape 1 du parcours Pong (la plus petite par step_index), ou null
   *  si le parcours n'est pas chargé. Jamais codé en dur (cf. ids non contigus). */
  private _firstPongStepId(): number | null {
    const track = tracksService.getTrackById("pong");
    if (!track) return null;
    const steps = this._trackStepsByName(track.name);
    return steps[0]?.id ?? null;
  }

  /** True si `id` est la DERNIÈRE étape de son parcours. C'est là qu'on
   *  déclenche l'écran de célébration de fin de parcours. */
  private _isLastTrackStep(id: number): boolean {
    const track = trackOf(this._challenges.get(id));
    if (!track) return false;
    const steps = this._trackStepsByName(track.name);
    if (steps.length === 0) return false;
    return steps[steps.length - 1]?.id === id;
  }

  /** Étape de parcours accessible : la 1ère l'est toujours, les suivantes
   *  nécessitent que l'étape précédente ait été validée. Exempté de la gating
   *  séquentielle globale. Aucun palier payant : les parcours sont gratuits
   *  (l'accès aux tutos est gated en amont par le compte GitHub). */
  isTrackStepAccessible(id: number): boolean {
    const track = trackOf(this._challenges.get(id));
    if (!track) return false;
    if (superAdmin.active) return true;
    const steps = this._trackStepsByName(track.name);
    const idx = steps.findIndex((c) => c.id === id);
    if (idx < 0) return false;

    if (idx === 0) return true;
    const prev = steps[idx - 1];
    return !!prev && storage.isCompleted(prev.id);
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

    const medal = storage.getMedal(id);
    bus.emit("chuck:challenge-loaded", {
      challenge,
      code: challenge.template,
      medal: medal ?? undefined,
      track: { trackId: track.id, stepIndex, stepCount },
    });
    this._emitTrackSteps(track);
    // Tracking funnel : entrée sur une étape de tuto.
    bus.emit("chuck:funnel-step", {
      step: "tutorial-step",
      meta: { stepId: id, trackId: track.id, stepIndex },
    });
    void pushHistory; // la sync URL est gérée par l'appelant (_loadById)
  }

  /** Émet la liste des étapes d'un parcours pour l'écran roadmap. */
  private _emitTrackSteps(track: TrackMeta): void {
    const steps = this._trackStepsByName(track.name);
    const currentId = this._currentTrackStepId(track.name);
    const items: import("../../types/challenge.js").TrackStepListItem[] = steps.map(
      (c, i) => ({
        id: c.id,
        stepIndex: i + 1,
        stepCount: steps.length,
        title: c.title,
        completed: storage.isCompleted(c.id),
        medal: storage.getMedal(c.id),
        accessible: this.isTrackStepAccessible(c.id),
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

  // ── Progression ──────────────────────────────────────────

  getCompleted(): Record<number, ChallengeProgress> {
    return storage.getAllProgress();
  }

  getMedal(id: number): Medal | null {
    return storage.getMedal(id);
  }

  /** Dernier défi accessible */
  isAccessible(id: number): boolean {
    if (superAdmin.active) return true;
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
      // Fin des fondations : si ce défi classique (hors parcours) est le dernier
      // de la série, on déclenche la célébration spéciale → invite à Pong.
      if (!this._isTrackStepId(challenge.id) && this._isLastFoundationChallenge(challenge.id)) {
        bus.emit("chuck:foundations-completed", {
          lastChallengeId: challenge.id,
          firstPongStepId: this._firstPongStepId(),
        });
      }
      if (this._isTrackStepId(challenge.id) && this._isLastTrackStep(challenge.id)) {
        const track = trackOf(challenge)!;
        // Fin de parcours : écran de célébration. Tous les parcours sont
        // gratuits — aucune condition d'achat.
        bus.emit("chuck:track-completed", {
          trackId: track.id,
          trackName: track.name,
        });
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
      bus.on("chuck:validate", ({ source, hintsUsed }) =>
        this.validate(source, hintsUsed ?? 0),
      ),
      bus.on("chuck:goto-challenge", ({ id }) => {
        // Lancement gated : sans compte, on laisse main.ts ouvrir la gate.
        if (!authService.isAuthenticated()) return;
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
          trackName: track.name,
        });
      }),
      bus.on("chuck:ide-free", () => {
        // Sortie d'un défi / Pong vers le mode libre : on oublie l'item courant
        // pour que validation et assemblage ne ciblent plus l'ancien id.
        this._current = null;
        this._currentItem = null;
        // Nettoie l'URL (?challenge / ?lesson) pour ne pas recharger un défi au refresh.
        const url = new URL(window.location.href);
        url.searchParams.delete("challenge");
        url.searchParams.delete("lesson");
        window.history.replaceState({}, "", url.toString());
      }),
      bus.on("chuck:tutos-requested", async () => {
        await this._ensureLoaded();
        this._emitChallengesList();
      }),
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────
const h = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
const addr = (n: number) => n.toString(16).padStart(4, "0").toUpperCase();