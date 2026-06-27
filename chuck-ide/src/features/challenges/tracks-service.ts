import { supabase } from '../auth/auth-service.js';
import type { Challenge } from '../../types/challenge.js';

/**
 * Accès aux parcours guidés — tables `tracks` + `track_steps`.
 *
 * Chaque étape de parcours est convertie en `Challenge` pour que TOUT
 * l'aval (challenge-manager, side-panel, validation) continue de
 * fonctionner sans modification. La distinction « étape de parcours »
 * reste portée par `arena_name`, désormais alimenté par le nom de la
 * track plutôt que par une colonne sur `challenges`.
 *
 * Conséquence : `isPongArena(c)` (c.arena_name === 'Projet Pong') reste
 * valide pour les étapes de la track 'pong', sans toucher ses 6 sites
 * d'appel. Le hack historique `id ≥ 1000` n'est plus nécessaire.
 */

/** Une ligne d'offre premium affichée dans le paywall (offer-card). */
export interface TrackPerk {
  ico: string;
  text: string;
}

/**
 * Configuration d'un parcours : frontière gratuit/premium + présentation.
 * Tout ce qui était figé en dur pour Pong (3 étapes gratuites, 99 €, copy
 * de l'offre, header) vit désormais ici, par parcours.
 */
export interface TrackConfig {
  /** Nb d'étapes gratuites (lead magnet). Au-delà : premium. */
  freeSteps: number;
  /** Prix premium en centimes. null = parcours 100 % gratuit (pas de paywall). */
  priceCents: number | null;
  /** Code devise ISO (affichage), ex. 'EUR'. */
  currency: string;
  /** Nom de l'offre premium, ex. 'Pong Avancé'. */
  premiumName: string | null;
  /** Phrase d'accroche du paywall. */
  premiumTagline: string | null;
  /** Lignes de l'offer-card. */
  premiumPerks: TrackPerk[];
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
  free_steps: number | null;
  price_cents: number | null;
  currency: string | null;
  premium_name: string | null;
  premium_tagline: string | null;
  premium_perks: unknown;
  icon: string | null;
  subtitle: string | null;
}

/** Config par défaut quand une colonne est nulle (parcours non configuré). */
const DEFAULT_TRACK_CONFIG: TrackConfig = {
  freeSteps: 3,
  priceCents: null,
  currency: "EUR",
  premiumName: null,
  premiumTagline: null,
  premiumPerks: [],
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
      freeSteps: row.free_steps ?? DEFAULT_TRACK_CONFIG.freeSteps,
      priceCents: row.price_cents ?? DEFAULT_TRACK_CONFIG.priceCents,
      currency: row.currency ?? DEFAULT_TRACK_CONFIG.currency,
      premiumName: row.premium_name ?? DEFAULT_TRACK_CONFIG.premiumName,
      premiumTagline: row.premium_tagline ?? DEFAULT_TRACK_CONFIG.premiumTagline,
      premiumPerks: Array.isArray(row.premium_perks)
        ? (row.premium_perks as TrackPerk[])
        : DEFAULT_TRACK_CONFIG.premiumPerks,
      icon: row.icon ?? DEFAULT_TRACK_CONFIG.icon,
      subtitle: row.subtitle ?? DEFAULT_TRACK_CONFIG.subtitle,
    }));
    return this._tracksCache;
  }

  /**
   * Toutes les étapes de parcours, converties en `Challenge`.
   * `arena_name` = nom de la track (ex. 'Projet Pong').
   * Triées par (track position, step_index) puis renvoyées à plat.
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
    // arena_name a été résolu en nom ; on refiltre via le cache des tracks
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