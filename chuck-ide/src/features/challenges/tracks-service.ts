/* ─────────────────────────────────────────────────────────────
   Chuck IDE — fatures/challenges/tracks-services.ts  (version WASM)
   ───────────────────────────────────────────────────────────── */

import { supabase } from '../auth/auth-service.js';
import type { Challenge } from '../../types/challenge.js';

/**
 * Accès aux parcours guidés — tables `tracks` + `track_steps`.
 *
 * Chaque étape de parcours est convertie en `Challenge` pour que TOUT
 * l'aval (challenge-manager, side-panel, validation) continue de
 * fonctionner sans modification. La distinction « étape de parcours »
 * reste portée par `arena_name`, alimenté par le nom de la track.
 *
 * MODÈLE : tous les parcours sont GRATUITS. L'accès aux tutos exige un
 * compte GitHub (gate de connexion), jamais un achat. La config d'un
 * parcours est donc purement pédagogique / présentationnelle — plus
 * aucune notion de prix, d'offre premium ni d'étapes payantes.
 */

/**
 * Configuration de présentation d'un parcours (header roadmap).
 * Purement cosmétique : aucune frontière d'accès n'en dépend.
 */
export interface TrackConfig {
  /** Icône du header roadmap, ex. '🏓'. */
  icon: string | null;
  /** Sous-titre du header roadmap. */
  subtitle: string | null;
}

export interface TrackMeta extends TrackConfig {
  id: string;       // slug : 'pong', 'snake'…
  name: string;     // 'Projet Pong'
  position: number;
}

interface TrackRow {
  id: string;
  name: string;
  position: number | null;
  icon: string | null;
  subtitle: string | null;
}

/** Config par défaut quand une colonne est nulle (parcours non configuré). */
const DEFAULT_TRACK_CONFIG: TrackConfig = {
  icon: null,
  subtitle: null,
};

interface TrackStepRow {
  id: number;
  track_id: string;
  step_index: number;
  title: string;
  description: string | null;
  template: string | null;
  assertions: unknown;
  max_cycles: number | null;
  hints: unknown;
  meta: unknown;
}

class TracksService {
  private _tracksCache: TrackMeta[] | null = null;
  private _stepsCache: Challenge[] | null = null;

  /** Liste des parcours (métadonnées), triés par position. */
  async getTracks(): Promise<TrackMeta[]> {
    if (this._tracksCache) return this._tracksCache;

    const { data, error } = await supabase
      .from('tracks')
      .select('*')
      .order('position', { ascending: true });

    if (error || !data) {
      console.warn('[TracksService] Échec du chargement des parcours :', error);
      return [];
    }

    this._tracksCache = (data as TrackRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      position: row.position ?? 0,
      icon: row.icon ?? DEFAULT_TRACK_CONFIG.icon,
      subtitle: row.subtitle ?? DEFAULT_TRACK_CONFIG.subtitle,
    }));
    return this._tracksCache;
  }

  /**
   * Toutes les étapes de parcours, converties en `Challenge`.
   * `arena_name` = nom de la track (ex. 'Projet Pong').
   * Triées par step_index puis renvoyées à plat.
   */
  async getAllSteps(): Promise<Challenge[]> {
    if (this._stepsCache) return this._stepsCache;

    const tracks = await this.getTracks();
    const nameById = new Map(tracks.map((t) => [t.id, t.name]));

    const { data, error } = await supabase
      .from('track_steps')
      .select('*')
      .order('step_index', { ascending: true });

    if (error || !data) {
      console.warn('[TracksService] Échec du chargement des étapes :', error);
      return [];
    }

    this._stepsCache = (data as TrackStepRow[]).map((row) => ({
      id: row.id,
      arena: undefined,
      arena_name: nameById.get(row.track_id) ?? row.track_id,
      locked: true, // une étape de parcours n'est jamais un défi libre
      title: row.title,
      description: row.description ?? '',
      template: row.template ?? '',
      assertions: (row.assertions as Challenge['assertions']) ?? [],
      maxCycles: row.max_cycles ?? undefined,
      hints: (row.hints as Challenge['hints']) ?? [],
      meta: (row.meta as Challenge['meta']) ?? undefined,
      stepIndex: row.step_index,
    })) as Challenge[];

    return this._stepsCache;
  }

  /** Étapes d'un parcours donné (par slug), triées par step_index. */
  async getStepsByTrack(trackId: string): Promise<Challenge[]> {
    const all = await this.getAllSteps();
    const tracks = await this.getTracks();
    const name = tracks.find((t) => t.id === trackId)?.name;
    if (!name) return [];
    return all.filter((c) => c.arena_name === name);
  }

  /** Lookup synchrone d'un parcours par son nom d'arène (cache requis).
   *  Renvoie null tant que getTracks() n'a pas peuplé le cache. */
  getTrackByName(arenaName: string): TrackMeta | null {
    return this._tracksCache?.find((t) => t.name === arenaName) ?? null;
  }

  /** Lookup synchrone d'un parcours par slug (cache requis). */
  getTrackById(trackId: string): TrackMeta | null {
    return this._tracksCache?.find((t) => t.id === trackId) ?? null;
  }

  clearCache(): void {
    this._tracksCache = null;
    this._stepsCache = null;
  }
}

export const tracksService = new TracksService();