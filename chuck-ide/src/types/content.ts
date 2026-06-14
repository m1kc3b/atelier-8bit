/* ─────────────────────────────────────────────────────────────
   Chuck IDE — types/content.ts
   Système de contenu générique pour le panneau latéral.
   Un "item" peut être un défi, une leçon, un conseil, une référence.
   ───────────────────────────────────────────────────────────── */

import type { Assertion } from './challenge.js';

// ── Blocs de contenu ─────────────────────────────────────────
// Un item est composé d'une séquence de blocs rendus dans l'ordre.

export interface BlockTheory {
  kind:    'theory';
  title?:  string;      // titre optionnel (rendu en h3)
  content: string;      // Markdown
}

export interface BlockCode {
  kind:    'code';
  lang?:   'asm' | 'js' | 'text';
  label?:  string;      // légende optionnelle sous le bloc
  content: string;      // code brut
}

export interface BlockMission {
  kind:    'mission';
  title?:  string;      // défaut : "Mission"
  content: string;      // Markdown
}

export interface BlockTip {
  kind:    'tip';
  content: string;      // Markdown — court
}

export interface BlockWarning {
  kind:    'warning';
  content: string;      // Markdown — court
}

export interface BlockRef {
  kind:   'ref';
  icon?:  string;        // emoji ou texte, défaut "📖"
  label:  string;        // ex: "Zaks ch.2 p.33"
  detail?: string;       // ligne secondaire
  url?:   string;        // lien externe optionnel
}

export interface BlockConcepts {
  kind:  'concepts';
  items: string[];       // liste de badges
}

export interface BlockTable {
  kind:    'table';
  headers: string[];
  rows:    (string | number)[][];
}

export interface BlockImage {
  kind:  'image';
  src:   string;
  alt:   string;
  caption?: string;
}

export interface BlockDivider {
  kind: 'divider';
}

export interface BlockHints {
  kind:  'hints';
  items: string[];       // textes des indices (révélables un par un)
}

export type ContentBlock =
  | BlockTheory
  | BlockCode
  | BlockMission
  | BlockTip
  | BlockWarning
  | BlockRef
  | BlockConcepts
  | BlockTable
  | BlockImage
  | BlockDivider
  | BlockHints;

// ── Types d'items ─────────────────────────────────────────────

/** Défi interactif : a un template, des assertions, un bouton Valider */
export interface ChallengeItem {
  type:        'challenge';
  id:          number;
  arena?:      number;
  arena_name?: string;
  title:       string;
  subtitle?:   string;
  blocks:      ContentBlock[];
  // Champs spécifiques au défi
  template:    string;             // code pré-rempli dans l'éditeur
  assertions:  Assertion[];
  maxCycles?:  number;
  meta?: {
    estimatedMinutes?: number;
    concepts?:         string[];
    zaks?: { chapter: string; page: number; topic: string };
  };
}

/** Leçon pure : lecture seule */
export interface LessonItem {
  type:      'lesson';
  id:        number;
  title:     string;
  subtitle?: string;
  blocks:    ContentBlock[];
  meta?: {
    estimatedMinutes?: number;
    concepts?:         string[];
  };
}

/** Conseil court */
export interface TipItem {
  type:      'tip';
  id:        number;
  title:     string;
  blocks:    ContentBlock[];
}

/** Référence externe (lien, doc, vidéo) */
export interface ReferenceItem {
  type:      'reference';
  id:        number;
  title:     string;
  blocks:    ContentBlock[];
  url?:      string;
}

export type ContentItem =
  | ChallengeItem
  | LessonItem
  | TipItem
  | ReferenceItem;

// ── Fichier JSON racine ───────────────────────────────────────

export interface ContentFile {
  version: string;
  items:   ContentItem[];
}

// ── Helpers de type ───────────────────────────────────────────

export function isChallenge(item: ContentItem): item is ChallengeItem {
  return item.type === 'challenge';
}

export function hasValidation(item: ContentItem): item is ChallengeItem {
  return isChallenge(item);
}
