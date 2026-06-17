/* ─────────────────────────────────────────────────────────────
   Chuck IDE — core/storage/storage-service.ts
   Point d'entrée unique pour toute persistance de données.

   Usage dans les autres modules :
     import { storage } from '../core/storage/storage-service.js';

   Pour basculer sur l'API quand le backend est prêt :
     → changer STORAGE_MODE = 'api' ci-dessous.
   ───────────────────────────────────────────────────────────── */

import type { IStorageService } from './types.js';
import { LocalStorageAdapter }  from './local-storage-adapter.js';
// import { ApiStorageAdapter } from './api-storage-adapter.js'; // décommenter pour la Phase 2

// ── Configuration ─────────────────────────────────────────────

/**
 * 'local' : tout en localStorage (Phase 1, aujourd'hui)
 * 'api'   : localStorage + API REST (Phase 2, backend prêt)
 */
const STORAGE_MODE: 'local' | 'api' = 'local';

// ── Singleton ─────────────────────────────────────────────────

function createStorage(): IStorageService {
  if (STORAGE_MODE === 'api') {
    // return new ApiStorageAdapter();
    console.warn('[StorageService] Mode API non encore activé, fallback local.');
  }
  return new LocalStorageAdapter();
}

/**
 * Instance unique du service de stockage.
 * Importez toujours cette constante, jamais les adapters directement.
 */
export const storage: IStorageService = createStorage();

// ── Re-exports pour commodité ─────────────────────────────────
export type { IStorageService, UserProgress, UserSession, ChallengeProgress, Medal } from './types.js';