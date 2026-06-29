/* ─────────────────────────────────────────────────────────────
   Chuck IDE — types/defi.ts
   Types du « Défi du mois » (Arène mensuelle) + classement.

   Le SCORING réel (cycles, octets, cas de test cachés, seed) s'exécute
   côté serveur (Worker Cloudflare exécutant chuck-core/WASM) — cf.
   bareme_deterministe.md. Le front n'effectue AUCUN calcul de score : il
   affiche l'énoncé, soumet le source, et lit le classement renvoyé par
   le backend. Ces types décrivent donc la frontière front ↔ backend.
   ───────────────────────────────────────────────────────────── */

/** Un défi mensuel actif. L'énoncé est visible ; les cas de test, le seed
 *  et le budget de cycles restent côté serveur (jamais exposés au front). */
export interface Defi {
  /** Identifiant du défi mensuel (clé serveur). */
  id: string;
  /** Mois de l'arène, format 'YYYY-MM'. */
  month: string;
  /** Titre court affiché en tête du brief. */
  title: string;
  /** Énoncé Markdown (consigne complète, visible). */
  instructions: string;
  /** Template de départ injecté dans l'éditeur (optionnel). */
  template?: string;
  /** Date d'ouverture (ISO 8601). */
  opensAt?: string;
  /** Date de clôture (ISO 8601) — au-delà, soumissions fermées. */
  closesAt?: string;
}

/** Une ligne du classement mensuel. Le score est normalisé [0,1] et calculé
 *  côté serveur (perf_cycles·w_c + perf_octets·w_o). */
export interface RankingEntry {
  /** Rang 1-based dans le classement courant. */
  rank: number;
  /** Identifiant public du joueur (auth.users.id). */
  userId: string;
  /** Pseudo public affiché (profil public). */
  displayName: string;
  /** Score normalisé ∈ ]0,1], 1.0 = meilleur sur les deux métriques. */
  score: number;
  /** Cycles de la meilleure soumission valide du joueur (info). */
  cycles?: number;
  /** Octets de la meilleure soumission valide (info). */
  bytes?: number;
  /** true si cette ligne correspond à l'utilisateur courant (surlignage UI). */
  isMe?: boolean;
  /** Badge prestige (opcode caché employé sans le compter), cf. barème §6. */
  prestige?: boolean;
}

/** Résultat renvoyé par le backend après une soumission. */
export interface SubmissionResult {
  /** true si le programme a passé TOUS les cas de test cachés. */
  accepted: boolean;
  /** Rang obtenu après prise en compte (présent si accepted). */
  rank?: number;
  /** Score normalisé obtenu (présent si accepted). */
  score?: number;
  /** Cycles mesurés par le serveur (présent si accepted). */
  cycles?: number;
  /** Octets du binaire assemblé (présent si accepted). */
  bytes?: number;
  /** Message d'erreur lisible si refus (compilation, cas échoué…).
   *  Ne révèle jamais le cas de test précis (cf. barème §8). */
  error?: string;
}

/** Profil public d'un joueur — vitrine du compte (pseudo + palmarès défis). */
export interface PublicProfile {
  userId: string;
  /** Pseudo public, modifiable par le joueur. Défaut : login GitHub. */
  displayName: string;
  /** Bio courte optionnelle. */
  bio?: string;
  /** Nombre de défis mensuels auxquels le joueur a participé. */
  defisEntered?: number;
  /** Meilleur rang jamais atteint (1 = champion). */
  bestRank?: number;
}