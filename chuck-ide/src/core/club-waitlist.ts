/* ─────────────────────────────────────────────────────────────
   Chuck IDE — core/club-waitlist.ts

   STUB : la page de vente dédiée au Club Atelier 8-Bit (Étape 4
   du funnel) n'est pas encore construite — le lancement est prévu
   après la phase de constitution d'audience (cf. note de projet).

   Ce service capture quand même l'intérêt de l'utilisateur dès
   maintenant, pour ne pas perdre le signal : persistance locale +
   point d'extension unique pour brancher Buttondown / le vrai
   backend d'inscription le jour venu.
   ───────────────────────────────────────────────────────────── */

const STORAGE_KEY = "chuck8_club_waitlist";

export interface ClubWaitlistEntry {
  email:     string;
  joinedAt:  string; // ISO 8601
}

class ClubWaitlistService {
  /** true si cet email (ou un autre) a déjà été enregistré sur cet appareil. */
  hasJoined(): boolean {
    return this._read() !== null;
  }

  getEntry(): ClubWaitlistEntry | null {
    return this._read();
  }

  /**
   * Enregistre l'intérêt de l'utilisateur pour le Club.
   * TODO : remplacer par un appel au vrai backend d'inscription
   * (Buttondown ou équivalent) une fois la page de vente du Club
   * construite — cf. funnel_specs.md, Étape 4.
   */
  async join(email: string): Promise<{ ok: boolean; error?: string }> {
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return { ok: false, error: "Adresse email invalide." };
    }
    const entry: ClubWaitlistEntry = {
      email: trimmed,
      joinedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
    } catch {
      // Stockage indisponible (mode privé, quota...) — on n'échoue pas
      // l'inscription pour autant, l'essentiel est le retour ok:true.
    }
    return { ok: true };
  }

  private _read(): ClubWaitlistEntry | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as ClubWaitlistEntry) : null;
    } catch {
      return null;
    }
  }
}

export const clubWaitlist = new ClubWaitlistService();
