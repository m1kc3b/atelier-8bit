/* ─────────────────────────────────────────────────────────────
   Chuck IDE — core/storage/storage-service.ts
   Point d'entrée unique pour toute persistance de progression.

   Usage : import { storage } from '../core/storage/storage-service.js';
   ───────────────────────────────────────────────────────────── */

import type { IStorageService } from './types.js';
import { SupabaseStorageAdapter } from './supabase-storage-adapter.js';

/**
 * Instance unique du service de stockage.
 * localStorage sert de cache, Supabase de source de vérité (write-through
 * à la complétion). Importez toujours cette constante.
 */
export const storage: IStorageService = new SupabaseStorageAdapter();

// ── Re-exports pour commodité ─────────────────────────────────
export type { IStorageService, UserProgress, UserSession, ChallengeProgress, Medal } from './types.js';