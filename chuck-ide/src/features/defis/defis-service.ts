import { supabase } from '../auth/auth-service.js';
import type {
  Defi,
  RankingEntry,
  SubmissionResult,
} from '../../types/defi.js';

/**
 * Accès aux données de l'Arène mensuelle — tables `defis`, `defi_rankings`
 * (vue/materialized), et Edge Function `submit-defi` pour le scoring.
 *
 * Principes (alignés sur le reste du projet) :
 *  - supabase-js résout TOUJOURS en { data, error } et ne throw pas : on
 *    inspecte `res.error`, jamais de `.catch()` qui avalerait l'erreur.
 *  - Le SCORING est serveur (Worker/Edge Function exécutant chuck-core/WASM
 *    sur des cas de test cachés + seed) : le front ne mesure ni cycles ni
 *    octets et ne décide jamais d'un rang. Il envoie le source, lit le verdict.
 *  - Le classement est RELATIF (recalculé quand un record tombe) : on ne met
 *    rien en cache au-delà d'un appel — chaque ouverture relit le classement.
 */
class DefisService {
  /** Cache du défi courant (l'énoncé du mois ne change pas en session). */
  private _currentDefi: Defi | null = null;
  private _currentDefiLoaded = false;

  /** Défi mensuel actif (le plus récent dont la fenêtre est ouverte).
   *  Renvoie null si aucun défi n'est publié. */
  async getCurrentDefi(): Promise<Defi | null> {
    if (this._currentDefiLoaded) return this._currentDefi;

    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('defis_public')
      .select('*')
      .lte('opens_at', nowIso)
      .order('month', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('[DefisService] Échec du chargement du défi :', error);
      return null;
    }
    this._currentDefiLoaded = true;
    if (!data) {
      this._currentDefi = null;
      return null;
    }

    this._currentDefi = {
      id: data.id,
      month: data.month,
      title: data.title,
      instructions: data.instructions ?? '',
      template: data.template ?? undefined,
      opensAt: data.opens_at ?? undefined,
      closesAt: data.closes_at ?? undefined,
    };
    return this._currentDefi;
  }

  /**
   * Classement du défi `defiId`, trié par score décroissant.
   * `meUserId` (optionnel) marque la ligne du joueur courant (isMe) pour le
   * surlignage UI. Lit la vue serveur `defi_rankings` (déjà ordonnée + rang
   * calculé côté SQL window function).
   */
  async getRanking(
    defiId: string,
    meUserId?: string,
  ): Promise<RankingEntry[]> {
    const { data, error } = await supabase
      .from('defi_rankings')
      .select('rank, user_id, display_name, score, cycles, bytes, prestige')
      .eq('defi_id', defiId)
      .order('rank', { ascending: true })
      .limit(100);

    if (error || !data) {
      console.warn('[DefisService] Échec du chargement du classement :', error);
      return [];
    }

    return data.map((row): RankingEntry => ({
      rank: row.rank,
      userId: row.user_id,
      displayName: row.display_name ?? 'Anonyme',
      score: typeof row.score === 'number' ? row.score : Number(row.score) || 0,
      cycles: row.cycles ?? undefined,
      bytes: row.bytes ?? undefined,
      prestige: row.prestige ?? false,
      isMe: meUserId != null && row.user_id === meUserId,
    }));
  }

  /**
   * Soumet une solution au backend pour scoring déterministe.
   * Le source est assemblé + exécuté sur les cas de test cachés CÔTÉ SERVEUR
   * (Edge Function `submit-defi`). Le front ne fait que transmettre et lire
   * le verdict — il ne calcule jamais le score lui-même.
   *
   * supabase.functions.invoke résout en { data, error } : on inspecte error.
   */
  async submit(defiId: string, source: string): Promise<SubmissionResult> {
    const { data, error } = await supabase.functions.invoke('submit-defi', {
      body: { defiId, source },
    });

    if (error) {
      // Erreur réseau / fonction indisponible — message générique.
      return {
        accepted: false,
        error: error.message ?? 'Soumission impossible pour le moment.',
      };
    }

    // La fonction renvoie déjà un SubmissionResult ; on le normalise au cas où.
    const r = (data ?? {}) as Partial<SubmissionResult>;
    return {
      accepted: r.accepted === true,
      rank: r.rank,
      score: r.score,
      cycles: r.cycles,
      bytes: r.bytes,
      error: r.error,
    };
  }

  /** Invalide le cache du défi (ex. changement de mois). */
  clearCache(): void {
    this._currentDefi = null;
    this._currentDefiLoaded = false;
  }
}

export const defisService = new DefisService();