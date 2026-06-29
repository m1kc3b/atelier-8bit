/* ─────────────────────────────────────────────────────────────
   Chuck IDE — features/defis/defi-manager.ts
   Orchestration du « Défi du mois » (Arène mensuelle).

   Couche feature : aucune manipulation du DOM. Communique uniquement
   par le bus. Charge le défi + le classement à l'entrée du mode défi,
   relaie la soumission au backend (scoring déterministe serveur), puis
   ré-émet le classement mis à jour.
   ───────────────────────────────────────────────────────────── */

import { bus } from '../../core/bus.js';
import { defisService } from './defis-service.js';
import { authService } from '../auth/auth-service.js';
import type { Defi } from '../../types/defi.js';

export class DefiManager {
  private _unsubs: Array<() => void> = [];
  private _current: Defi | null = null;
  private _loading = false;

  init(): void {
    this._unsubs.push(
      // Entrée dans le mode « Défi du mois » : charge énoncé + classement.
      bus.on('chuck:ide-defi', () => {
        void this._loadDefiAndRanking();
      }),
      // Demande explicite de rafraîchissement (ex. après nav interne).
      bus.on('chuck:defis-requested', () => {
        void this._loadDefiAndRanking();
      }),
      // Soumission d'une solution au scoring serveur.
      bus.on('chuck:defi-submit', ({ source }) => {
        void this._submit(source);
      }),
    );
  }

  destroy(): void {
    this._unsubs.forEach((fn) => fn());
    this._unsubs = [];
  }

  get current(): Defi | null {
    return this._current;
  }

  // ── Chargement ────────────────────────────────────────────

  private async _loadDefiAndRanking(): Promise<void> {
    if (this._loading) return;
    this._loading = true;
    try {
      const defi = await defisService.getCurrentDefi();
      this._current = defi;
      bus.emit('chuck:defi-loaded', { defi });

      if (defi) {
        await this._emitRanking(defi.id);
      } else {
        bus.emit('chuck:defi-ranking', { entries: [] });
      }
    } finally {
      this._loading = false;
    }
  }

  private async _emitRanking(defiId: string): Promise<void> {
    const meId = authService.getUser()?.id;
    const entries = await defisService.getRanking(defiId, meId);
    bus.emit('chuck:defi-ranking', { entries });
  }

  // ── Soumission ────────────────────────────────────────────

  private async _submit(source: string): Promise<void> {
    const defi = this._current;
    if (!defi) {
      bus.emit('chuck:defi-submitted', {
        result: { accepted: false, error: 'Aucun défi actif.' },
      });
      return;
    }
    if (!authService.isAuthenticated()) {
      bus.emit('chuck:defi-submitted', {
        result: {
          accepted: false,
          error: 'Connecte-toi pour soumettre une solution.',
        },
      });
      return;
    }
    if (!source.trim()) {
      bus.emit('chuck:defi-submitted', {
        result: { accepted: false, error: 'Le code est vide.' },
      });
      return;
    }

    const result = await defisService.submit(defi.id, source);
    bus.emit('chuck:defi-submitted', { result });

    // Soumission acceptée → le classement a potentiellement bougé (relatif).
    if (result.accepted) {
      bus.emit('chuck:log', {
        text:
          `✓ Soumission acceptée — rang ${result.rank ?? '?'}` +
          (result.cycles != null ? ` (${result.cycles} cycles` : '') +
          (result.bytes != null ? `, ${result.bytes} o)` : result.cycles != null ? ')' : ''),
        level: 'ok',
      });
      await this._emitRanking(defi.id);
    } else if (result.error) {
      bus.emit('chuck:log', { text: `✗ ${result.error}`, level: 'err' });
    }
  }
}

export const defiManager = new DefiManager();