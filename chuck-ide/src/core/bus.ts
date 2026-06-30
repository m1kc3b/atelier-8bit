/* ─────────────────────────────────────────────────────────────
   Chuck IDE — core/bus.ts
   Event Bus typé — communication découplée entre modules.

   Utilise les CustomEvent natifs du navigateur sur un
   EventTarget dédié (pas le document global, évite les fuites).
   ───────────────────────────────────────────────────────────── */

export type ModalView = 'welcome' | 'challenges' | 'help';

/* ── Types des événements ────────────────────────────────────── */
export interface CpuState {
  A:  number;
  X:  number;
  Y:  number;
  P:  number;   // Processor Status
  PC: number;
  SP: number;
}

export interface AssembleResult {
  ok:    boolean;
  bytes: number;
  buf:   number[];
  line?: number;
  err?:  string;
}

export interface ChuckEventMap {
  // ── Commandes UI → Émulateur ────────────────────────────
  'chuck:assemble':   { source: string };
  'chuck:run':        undefined;
  'chuck:stop':       undefined;
  'chuck:step':       undefined;
  'chuck:reset':      undefined;
  'chuck:goto':       { address: number };
  'chuck:hexdump':    undefined;
  'chuck:disassemble':undefined;
  'chuck:speed':      { value: number };    // 1–100 %
  'chuck:debug':      { enabled: boolean };
  'chuck:breakpoint': { line: number; active: boolean };

  // ── Clavier écran → émulateur ───────────────────────────
  // Émis par chuck-display (canvas focalisé), consommé par Emulator.
  // `code`/`key` sont les champs natifs KeyboardEvent ; l'Emulator
  // dérive ascii/raw/manette à partir d'eux.
  'chuck:screen-key':  {
    down: boolean;
    code: string;
    key:  string;
    shift: boolean;
    ctrl:  boolean;
    alt:   boolean;
  };

  // ── Émulateur → UI ──────────────────────────────────────
  'chuck:cpu-updated':  CpuState;
  'chuck:cpu-reset':    CpuState;
  'chuck:cpu-halted':   CpuState;
  'chuck:cpu-error':    { msg: string };
  'chuck:assembled':    AssembleResult;
  'chuck:assemble-err': { line: number; err: string };

  // ── Console ─────────────────────────────────────────────
  'chuck:log':     { text: string; level: 'info' | 'ok' | 'err' | 'hex' | 'dim' | 'mode' };

  // ── Éditeur ─────────────────────────────────────────────
  'chuck:code-changed':  undefined;
  'chuck:cursor-moved':  { line: number; col: number };

  // ── UI state ────────────────────────────────────────────
  'chuck:toolbar-state': { state: ToolbarState };

  // ── Mémoire — lecture à la demande ──────────────────────
  'chuck:memory-read':   { address: number; length: number };
  'chuck:memory-data':   { address: number; bytes: Uint8Array };
  'chuck:ram-snapshot':   { bytes: Uint8Array };

  // ── Aide / Formation ────────────────────────────────────
  'chuck:open-help':    { lessonId?: number };  // ouvre la modale aide
  'chuck:challenge-loaded':  {
    challenge: import('../types/challenge.js').Challenge;
    code: string;
    medal?: string;
    /** Renseigné uniquement quand le défi chargé est une étape de parcours */
    track?: { trackId: string; stepIndex: number; stepCount: number };
  };
  'chuck:challenge-success': { result: import('../types/challenge.js').ValidationResult; medal?: string };
  'chuck:challenge-failed':  { result: import('../types/challenge.js').ValidationResult };
  'chuck:validate':          { source: string; hintsUsed?: number };
  'chuck:goto-challenge':    { id: number };
  /** Navigation « étape suivante » d'un parcours, résolue par le manager
   *  dans l'ordre step_index (les ids de track_steps ne sont PAS contigus,
   *  donc id+1 ne marche pas). */
  'chuck:goto-next-track-step': { fromId: number };
  'chuck:challenges-list':   { items: import('../types/challenge.js').ChallengeListItem[] };

  // ── Parcours guidés (tutos gratuits, gate GitHub) ───────────
  'chuck:track-steps': {
    trackId: string;
    trackName: string;
    config: import('../features/challenges/tracks-service.js').TrackConfig;
    items: import('../types/challenge.js').TrackStepListItem[];
  };
  /** Fin d'un parcours : la DERNIÈRE étape vient d'être validée. Déclenche
   *  l'écran de célébration de parcours. Aucune dimension d'achat : tous les
   *  parcours sont gratuits (accès gated par le compte GitHub uniquement). */
  'chuck:track-completed': {
    trackId: string;
    trackName: string;
  };
  /** Demande de (ré)ouverture de l'écran de fin de parcours (ex. « revoir la
   *  célébration »). Le manager résout le nom et ré-émet chuck:track-completed. */
  'chuck:track-completed-request': { trackId: string };
  /** Fin des fondations : le DERNIER challenge classique vient d'être validé.
   *  Déclenche la célébration spéciale (pop-up confettis + Pong) qui invite à
   *  démarrer le parcours Pong. `firstPongStepId` est l'id de l'étape 1 du
   *  parcours Pong (résolu par le manager, jamais codé en dur). */
  'chuck:foundations-completed': {
    lastChallengeId: number;
    firstPongStepId: number | null;
  };

  // ── Défi du mois (Arène mensuelle) ──────────────────────────
  /** Données du défi courant pour le side-panel (énoncé visible). null =
   *  aucun défi publié. Émis par le defi-manager après chargement DB. */
  'chuck:defi-loaded': {
    defi: import('../types/defi.js').Defi | null;
  };
  /** Classement du défi courant (relatif, recalculé serveur). */
  'chuck:defi-ranking': {
    entries: import('../types/defi.js').RankingEntry[];
  };
  /** Intention de soumettre la solution courante au scoring serveur.
   *  Émis par le side-panel (bouton « Soumettre »), traité par le manager. */
  'chuck:defi-submit': { source: string };
  /** Verdict serveur après soumission (accepté + rang, ou erreur). */
  'chuck:defi-submitted': {
    result: import('../types/defi.js').SubmissionResult;
  };

  // ── Navigation / Funnel (accueil → 3 sections) ──────────────
  'chuck:view-changed':      { view: 'atelier' | 'challenges' | 'defis' };

  // ── Tracking funnel (cf. core/funnel-tracker.ts) ────────────
  'chuck:funnel-step': {
    step: import('../infra/tracking/funnel-tracker.js').FunnelStep;
    meta?: Record<string, unknown>;
  };

  // ── Onboarding ──────────────────────────────
  'chuck:start-tour': undefined;

  // ── Auth ────────────────────────────────────
  /** Demande de connexion GitHub (gate). `reason` ne sert qu'à choisir la copy
   *  de la modale ; l'accès est toujours « compte GitHub gratuit ». */
  'chuck:require-auth': { reason: 'save' | 'new-project' | 'challenge' | 'defis' };
  'chuck:load-project':  { id: string; name: string; code: string };
  'chuck:signed-out':    undefined;
  'chuck:open-account': undefined;

  // ── Navigation modale générique ─────────────────────────────
  'chuck:ide-free':     undefined;
  /** 3e choix « Défi du mois » : va directement à l'IDE + side-panel
   *  (instructions en haut / leaderboard en bas), sans roadmap. */
  'chuck:ide-defi':     undefined;
  'chuck:modal-show':   { view: ModalView; params?: Record<string, unknown>; gate?: boolean };
  /** Repli depuis une célébration : rouvre la modale d'accueil. */
  'chuck:open-welcome': undefined;
  'chuck:modal-back':   undefined;
  'chuck:modal-opened': undefined;
  'chuck:modal-closed': undefined;
  'chuck:modal-close':  undefined;

  'chuck:tutos-requested': undefined;
  'chuck:defis-requested': undefined;

}

export type ChuckEventName = keyof ChuckEventMap;
export type ToolbarState   = 'idle' | 'assembled' | 'running' | 'paused' | 'debugging';

/* ── Bus singleton ───────────────────────────────────────────── */
export class EventBus {
  private readonly target = new EventTarget();

  emit<K extends ChuckEventName>(
    event: K,
    detail: ChuckEventMap[K],
  ): void {
    this.target.dispatchEvent(
      new CustomEvent(event, { detail, bubbles: false }),
    );
  }

  on<K extends ChuckEventName>(
    event: K,
    handler: (detail: ChuckEventMap[K]) => void,
  ): () => void {
    const listener = (e: Event) =>
      handler((e as CustomEvent<ChuckEventMap[K]>).detail);
    this.target.addEventListener(event, listener);
    // Retourne une fonction de désinscription
    return () => this.target.removeEventListener(event, listener);
  }

  once<K extends ChuckEventName>(
    event: K,
    handler: (detail: ChuckEventMap[K]) => void,
  ): void {
    const unsub = this.on(event, (d) => { handler(d); unsub(); });
  }
}

export const bus = new EventBus();