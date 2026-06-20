/* ─────────────────────────────────────────────────────────────
   Chuck IDE — types/challenge.ts
   Types TypeScript pour challenges.json.
   ───────────────────────────────────────────────────────────── */

   import type { Medal } from '../core/storage/types.js';

// ── Condition de validation ───────────────────────────────────

/** Vérifie la valeur d'un registre après exécution */
export interface RegisterAssertion {
  type:     'register';
  register: 'A' | 'X' | 'Y' | 'PC' | 'SP' | 'P';
  value:    number;       // valeur attendue (ex: 0x42)
  /** Message affiché en cas d'échec. Si absent, un message générique est généré. */
  failMsg?: string;
}

/** Vérifie la valeur d'une adresse mémoire après exécution */
export interface MemoryAssertion {
  type:     'memory';
  address:  number;       // ex: 0x0010
  value:    number;
  failMsg?: string;
}

/** Vérifie qu'un flag du registre P est dans l'état attendu */
export interface FlagAssertion {
  type:    'flag';
  flag:    'C' | 'Z' | 'N' | 'V' | 'I' | 'D' | 'B';
  set:     boolean;       // true = flag doit être à 1
  failMsg?: string;
}

/** Vérifie qu'une zone mémoire contient une séquence d'octets */
export interface SequenceAssertion {
  type:    'sequence';
  address: number;
  values:  number[];      // octets attendus consécutifs
  failMsg?: string;
}

export type Assertion =
  | RegisterAssertion
  | MemoryAssertion
  | FlagAssertion
  | SequenceAssertion;

// ── Structure d'un défi ───────────────────────────────────────

export interface ChallengeHint {
  /** Texte de l'indice (révélé progressivement) */
  text:     string;
  /** Coût en points si l'indice est utilisé (optionnel) */
  cost?:    number;
}

export interface ChallengeMeta {
  /** Référence au livre de Rodnay Zaks "Programming the 6502" */
  zaks?: {
    chapter: string;  // ex: "Chapitre 3"
    page:    number;  // ex: 87
    topic:   string;  // ex: "Adressage indirect indexé"
  };
  /** Concepts 6502 abordés dans ce défi */
  concepts?: string[];  // ex: ["LDA", "STA", "boucle"]
  /** Durée estimée en minutes */
  estimatedMinutes?: number;
}

export interface Challenge {
  /** Identifiant unique — correspond au paramètre URL ?challenge=X */
  id:          number;
  /** Numéro d'arène */
  arena?:      number;
  /** Nom de l'arène */
  arena_name?: string;
  /** Défi verrouillé — nécessite email pour accéder */
  locked?:     boolean;
  /** Titre court affiché dans le panneau */
  title:       string;
  /** Description Markdown de la consigne */
  description: string;
  /** Code de départ injecté dans l'éditeur */
  template:    string;
  /** Assertions à valider */
  assertions:  Assertion[];
  /** Nombre max de cycles CPU avant timeout */
  maxCycles?:  number;
  /** Indices progressifs */
  hints?:      ChallengeHint[];
  /** Métadonnées pédagogiques */
  meta?:       ChallengeMeta;
}

// ── Structure de challenges.json ──────────────────────────────

export interface ChallengesFile {
  version:    string;       // ex: "1.0.0"
  challenges: Challenge[];
}

// ── Résultat de validation ────────────────────────────────────

export interface ValidationResult {
  success:   boolean;
  /** Assertions qui ont échoué */
  failures:  AssertionFailure[];
  /** Nombre de cycles CPU utilisés */
  cycles:    number;
  /** true si le CPU n'a pas atteint BRK dans maxCycles */
  timeout:   boolean;
}

export interface AssertionFailure {
  assertion: Assertion;
  expected:  number | boolean;
  actual:    number | boolean;
  message:   string;
}

export interface ChallengeListItem {
  id:                number;
  title:             string;
  arenaName?:        string;
  estimatedMinutes?: number;
  /** Verrouillé car le défi précédent n'est pas encore validé */
  sequentialLocked:  boolean;
  /** Accessible séquentiellement mais nécessite un email (palier "Challenge 4") */
  emailLocked:       boolean;
  completed:         boolean;
  medal:             Medal | null;
  /** true si c'est le prochain défi à faire */
  current:           boolean;
}

// ── Étapes du parcours guidé Pong (Étape 3 du funnel) ──────────
// Mêmes défis (table `challenges`, ids ≥ 1000) mais exemptés de la
// gating séquentielle globale et du compteur des défis classiques.

export interface PongStepListItem {
  id:           number;
  /** Position 1-based parmi les étapes Pong (pas l'id brut) */
  stepIndex:    number;
  stepCount:    number;
  title:        string;
  completed:    boolean;
  medal:        Medal | null;
  /** Accessible si l'étape précédente est validée (ou si c'est la 1ère) */
  accessible:   boolean;
  current:      boolean;
}