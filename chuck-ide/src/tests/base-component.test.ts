/* ─────────────────────────────────────────────────────────────
   Tests — features/challenges/challenge-manager.ts
   Cœur métier : chargement, gating séquentiel, gating de parcours,
   validation (succès / échec assertions / timeout / erreur d'assemblage),
   émission de la roadmap, complétion + médailles.

   Inclut les TESTS DE NON-RÉGRESSION des trois bugs corrigés :
     #1  _emitTrackSteps n'émettait jamais chuck:track-steps (roadmap muette)
     #2  timeout ne loggait aucune ligne d'erreur (console silencieuse)
     #3  init() sur ?challenge=X chargeait la donnée mais ne naviguait pas
         (deep-link + retour OAuth cassés)

   Les collaborateurs (storage, services, superAdmin, authService) sont des
   singletons importés : on les mocke via Proxy pour différer l'accès jusqu'à
   l'exécution (lazy) des factories vi.mock hoistées.
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* ── Mocks des collaborateurs ─────────────────────────────────── */

// storage : progression en mémoire, pilotable par test.
const store = {
  completed: new Set<number>(),
  medals: new Map<number, string>(),
  unlocked: false,
};
const storageMock = {
  isCompleted: vi.fn((id: number) => store.completed.has(id)),
  getMedal: vi.fn((id: number) => store.medals.get(id) ?? null),
  getAllProgress: vi.fn(() => ({})),
  isUnlocked: vi.fn(() => store.unlocked),
  saveCompletion: vi.fn((id: number, medal: string) => {
    store.completed.add(id);
    store.medals.set(id, medal);
    return { challengeId: id, completedAt: 'now', medal, hintsUsed: 0 };
  }),
};

// Données de test : challenges fondamentaux + étapes de parcours.
const data = {
  challenges: [] as any[],
  steps: [] as any[],
  tracks: [] as any[],
};
const challengesServiceMock = { getAll: vi.fn(async () => data.challenges) };
const tracksServiceMock = {
  getAllSteps: vi.fn(async () => data.steps),
  getTrackByName: vi.fn((name: string) => data.tracks.find((t) => t.name === name) ?? null),
  getTrackById: vi.fn((id: string) => data.tracks.find((t) => t.id === id) ?? null),
};

const superAdminMock = { active: false, onChange: vi.fn(() => () => {}) };
const authServiceMock = { isAuthenticated: vi.fn(() => true) };

vi.mock('../infra/storage/storage-service.js', () => ({
  storage: new Proxy({}, { get: (_t, p) => (storageMock as any)[p] }),
}));
vi.mock('../features/challenges/challenges-service.js', () => ({
  challengesService: new Proxy({}, { get: (_t, p) => (challengesServiceMock as any)[p] }),
}));
vi.mock('../features/challenges/tracks-service.js', () => ({
  tracksService: new Proxy({}, { get: (_t, p) => (tracksServiceMock as any)[p] }),
}));
vi.mock('../core/super-admin.js', () => ({
  superAdmin: new Proxy({}, { get: (_t, p) => (superAdminMock as any)[p] }),
}));
vi.mock('../features/auth/auth-service.js', () => ({
  supabase: {},
  authService: new Proxy({}, { get: (_t, p) => (authServiceMock as any)[p] }),
}));

import { bus } from '../core/bus.js';
import { ChallengeManager } from '../features/challenges/challenge-manager.js';

/* ── Fake Emulator ────────────────────────────────────────────── */

interface FakeRun {
  ok?: boolean;
  errMsg?: string;
  errLine?: number;
  state?: Partial<{ A: number; X: number; Y: number; PC: number; SP: number; P: number }>;
  memView?: Uint8Array;
  cycles?: number;
  halted?: boolean;
}
function fakeEmulator(run: FakeRun = {}) {
  return {
    runHeadless: vi.fn(() => ({
      ok: run.ok ?? true,
      errMsg: run.errMsg ?? '',
      errLine: run.errLine ?? -1,
      state: { A: 0, X: 0, Y: 0, PC: 0, SP: 0xff, P: 0, ...run.state },
      memView: run.memView ?? new Uint8Array(0x10000),
      cycles: run.cycles ?? 10,
      halted: run.halted ?? true,
    })),
  } as any;
}

/* ── Helpers de scénario ──────────────────────────────────────── */

function foundation(id: number, over: Partial<any> = {}) {
  return {
    id, title: `Défi ${id}`, description: '', template: `; défi ${id}`,
    assertions: [], hints: [], locked: false, arena_name: undefined, ...over,
  };
}
function trackStep(id: number, stepIndex: number, over: Partial<any> = {}) {
  return {
    id, title: `Étape ${stepIndex}`, description: '', template: `; step ${id}`,
    assertions: [], hints: [], locked: true, arena_name: 'Projet Pong', stepIndex, ...over,
  };
}

/** Réinitialise l'URL (jsdom) pour tester la navigation. */
function setUrl(search: string) {
  window.history.replaceState({}, '', `/${search}`);
}

const flush = () => new Promise((r) => setTimeout(r, 0));

/* ── Setup ────────────────────────────────────────────────────── */

let mgr: ChallengeManager;

beforeEach(() => {
  vi.clearAllMocks();
  store.completed.clear();
  store.medals.clear();
  store.unlocked = false;
  superAdminMock.active = false;
  authServiceMock.isAuthenticated.mockReturnValue(true);
  data.challenges = [];
  data.steps = [];
  data.tracks = [];
  setUrl('');
});

afterEach(() => {
  // Le bus est un singleton partagé : sans destroy(), les abonnements
  // s'accumulent d'un test à l'autre.
  mgr?.destroy();
});

/* ── isAccessible : gating séquentiel des fondations ──────────── */

describe('ChallengeManager.isAccessible (gating séquentiel)', () => {
  beforeEach(() => { mgr = new ChallengeManager(); });

  it('le défi 1 est toujours accessible', () => {
    expect(mgr.isAccessible(1)).toBe(true);
  });

  it('le défi N est verrouillé tant que N-1 n’est pas validé', () => {
    expect(mgr.isAccessible(3)).toBe(false);
  });

  it('le défi N s’ouvre quand N-1 est validé', () => {
    store.completed.add(2);
    expect(mgr.isAccessible(3)).toBe(true);
  });

  it('super-admin court-circuite tout verrou', () => {
    superAdminMock.active = true;
    expect(mgr.isAccessible(99)).toBe(true);
  });
});

/* ── Chargement + gating de parcours ──────────────────────────── */

describe('ChallengeManager — parcours guidés', () => {
  beforeEach(async () => {
    data.tracks = [{ id: 'pong', name: 'Projet Pong', position: 1, icon: '🏓', subtitle: 'Construis Pong' }];
    data.steps = [trackStep(10, 0), trackStep(11, 1), trackStep(12, 2)];
    tracksServiceMock.getTrackByName.mockImplementation(
      (name: string) => data.tracks.find((t) => t.name === name) ?? null,
    );
    mgr = new ChallengeManager();
    // ?parcours=10 force _ensureLoaded() → _challenges est peuplé (sinon le
    // mode libre laisse la map vide et trackOf() ne trouve rien).
    setUrl('?parcours=10');
    await mgr.init(fakeEmulator());
    await flush();
  });

  it('la 1ère étape est toujours accessible', () => {
    expect(mgr.isTrackStepAccessible(10)).toBe(true);
  });

  it('une étape suivante est verrouillée tant que la précédente n’est pas validée', () => {
    expect(mgr.isTrackStepAccessible(11)).toBe(false);
  });

  it('une étape s’ouvre quand la précédente est validée', () => {
    store.completed.add(10);
    expect(mgr.isTrackStepAccessible(11)).toBe(true);
  });

  it('super-admin ouvre toutes les étapes', () => {
    superAdminMock.active = true;
    expect(mgr.isTrackStepAccessible(12)).toBe(true);
  });
});

/* ── #1 NON-RÉGRESSION : la roadmap est bien émise ────────────── */

describe('ChallengeManager — émission de la roadmap (bug #1)', () => {
  beforeEach(() => {
    data.tracks = [{ id: 'pong', name: 'Projet Pong', position: 1, icon: '🏓', subtitle: 'Sub' }];
    data.steps = [trackStep(10, 0), trackStep(11, 1)];
    tracksServiceMock.getTrackByName.mockImplementation(
      (name: string) => data.tracks.find((t) => t.name === name) ?? null,
    );
  });

  it('émet chuck:track-steps avec trackId, trackName, config et items au chargement d’une étape', async () => {
    const roster = vi.fn();
    bus.on('chuck:track-steps', roster);

    mgr = new ChallengeManager();
    setUrl('?parcours=10');
    await mgr.init(fakeEmulator());
    await flush();

    expect(roster).toHaveBeenCalled();
    const payload = roster.mock.calls.at(-1)![0];
    expect(payload.trackId).toBe('pong');
    expect(payload.trackName).toBe('Projet Pong');
    expect(payload.config).toEqual({ icon: '🏓', subtitle: 'Sub' });
    expect(payload.items).toHaveLength(2);
    expect(payload.items[0]).toMatchObject({ id: 10, stepIndex: 1, stepCount: 2, accessible: true });
    expect(payload.items[1]).toMatchObject({ id: 11, stepIndex: 2, accessible: false });
  });

  it('ré-émet la roadmap quand le flag super-admin bascule', async () => {
    let changeCb: () => void = () => {};
    superAdminMock.onChange.mockImplementation(((cb: () => void) => { changeCb = cb; return () => {}; }) as any);

    mgr = new ChallengeManager();
    setUrl('?parcours=10'); // force _ensureLoaded() → _challenges peuplé
    await mgr.init(fakeEmulator());
    await flush();

    const roster = vi.fn();
    bus.on('chuck:track-steps', roster);
    changeCb(); // simule le bascule super-admin
    await flush();

    expect(roster).toHaveBeenCalled();
  });
});

/* ── #3 NON-RÉGRESSION : deep-link navigue réellement ─────────── */

describe('ChallengeManager.init — deep-link (bug #3)', () => {
  it('?challenge=1 charge ET navigue vers le défi (émet challenge-loaded)', async () => {
    data.challenges = [foundation(1), foundation(2)];
    const loaded = vi.fn();
    bus.on('chuck:challenge-loaded', loaded);

    mgr = new ChallengeManager();
    setUrl('?challenge=1');
    await mgr.init(fakeEmulator());
    await flush();

    expect(loaded).toHaveBeenCalled();
    expect(loaded.mock.calls.at(-1)![0].challenge.id).toBe(1);
  });

  it('?parcours=10 navigue vers l’étape de parcours demandée', async () => {
    data.tracks = [{ id: 'pong', name: 'Projet Pong', position: 1, icon: null, subtitle: null }];
    data.steps = [trackStep(10, 0), trackStep(11, 1)];
    tracksServiceMock.getTrackByName.mockImplementation(
      (name: string) => data.tracks.find((t) => t.name === name) ?? null,
    );
    const loaded = vi.fn();
    bus.on('chuck:challenge-loaded', loaded);

    mgr = new ChallengeManager();
    setUrl('?parcours=10');
    await mgr.init(fakeEmulator());
    await flush();

    expect(loaded).toHaveBeenCalled();
    const payload = loaded.mock.calls.at(-1)![0];
    expect(payload.challenge.id).toBe(10);
    expect(payload.track).toMatchObject({ trackId: 'pong', stepIndex: 1, stepCount: 2 });
  });

  it('sans paramètre d’URL : passe en mode libre', async () => {
    const free = vi.fn();
    bus.on('chuck:ide-free', free);
    mgr = new ChallengeManager();
    setUrl('');
    await mgr.init(fakeEmulator());
    expect(free).toHaveBeenCalled();
  });
});

/* ── Validation ───────────────────────────────────────────────── */

describe('ChallengeManager.validate', () => {
  async function loadFoundation(challenge: any, emu = fakeEmulator()) {
    data.challenges = [challenge];
    mgr = new ChallengeManager();
    setUrl(`?challenge=${challenge.id}`);
    await mgr.init(emu);
    await flush();
    return emu;
  }

  it('succès : émet challenge-success + log ok et enregistre la complétion', async () => {
    const success = vi.fn();
    const log = vi.fn();
    bus.on('chuck:challenge-success', success);
    bus.on('chuck:log', log);

    await loadFoundation(
      foundation(1, { assertions: [{ type: 'register', register: 'A', value: 0x2a }] }),
      fakeEmulator({ state: { A: 0x2a }, halted: true }),
    );
    bus.emit('chuck:validate', { source: 'LDA #$2A\nBRK' });
    await flush();

    expect(success).toHaveBeenCalled();
    expect(storageMock.saveCompletion).toHaveBeenCalledWith(1, '🥇', 0);
    expect(log.mock.calls.some(([a]) => a.level === 'ok')).toBe(true);
  });

  it('médaille selon les indices : 0→🥇, 1→🥈, 2→🥉', async () => {
    await loadFoundation(foundation(1), fakeEmulator({ halted: true }));
    bus.emit('chuck:validate', { source: 'BRK', hintsUsed: 2 });
    await flush();
    expect(storageMock.saveCompletion).toHaveBeenCalledWith(1, '🥉', 2);
  });

  it('échec d’assertion : émet challenge-failed avec le détail', async () => {
    const failed = vi.fn();
    bus.on('chuck:challenge-failed', failed);

    await loadFoundation(
      foundation(1, { assertions: [{ type: 'register', register: 'A', value: 0x2a }] }),
      fakeEmulator({ state: { A: 0x00 }, halted: true }),
    );
    bus.emit('chuck:validate', { source: 'BRK' });
    await flush();

    expect(failed).toHaveBeenCalled();
    const result = failed.mock.calls.at(-1)![0].result;
    expect(result.success).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].actual).toBe(0x00);
  });

  it('erreur d’assemblage : échec avec message L<line>', async () => {
    const failed = vi.fn();
    bus.on('chuck:challenge-failed', failed);

    await loadFoundation(
      foundation(1),
      fakeEmulator({ ok: false, errMsg: 'opcode inconnu', errLine: 3 }),
    );
    bus.emit('chuck:validate', { source: 'XYZ' });
    await flush();

    expect(failed).toHaveBeenCalled();
    expect(failed.mock.calls.at(-1)![0].result.failures[0].message).toContain('L3');
  });

  it('#2 timeout : échec ET log d’erreur explicite (non-régression)', async () => {
    const failed = vi.fn();
    const log = vi.fn();
    bus.on('chuck:challenge-failed', failed);
    bus.on('chuck:log', log);

    // halted=false → le CPU n'a pas atteint BRK ; aucune assertion en échec.
    await loadFoundation(foundation(1), fakeEmulator({ halted: false, cycles: 100000 }));
    bus.emit('chuck:validate', { source: 'JMP $E000' }); // boucle infinie
    await flush();

    expect(failed).toHaveBeenCalled();
    expect(failed.mock.calls.at(-1)![0].result.timeout).toBe(true);
    // Le log ne doit PAS être silencieux : une ligne d'erreur mentionnant le timeout.
    const errLine = log.mock.calls.find(([a]) => a.level === 'err');
    expect(errLine).toBeTruthy();
    expect(errLine![0].text.toLowerCase()).toContain('timeout');
  });

  it('vérifie les assertions mémoire et flag', async () => {
    const success = vi.fn();
    bus.on('chuck:challenge-success', success);

    const mem = new Uint8Array(0x10000);
    mem[0x0200] = 0x99;
    await loadFoundation(
      foundation(1, {
        assertions: [
          { type: 'memory', address: 0x0200, value: 0x99 },
          { type: 'flag', flag: 'Z', set: true },
        ],
      }),
      fakeEmulator({ state: { P: 0b0000_0010 }, memView: mem, halted: true }), // Z=1
    );
    bus.emit('chuck:validate', { source: 'BRK' });
    await flush();

    expect(success).toHaveBeenCalled();
  });

  it('ne valide rien s’il n’y a pas de défi courant', async () => {
    const failed = vi.fn();
    const success = vi.fn();
    bus.on('chuck:challenge-failed', failed);
    bus.on('chuck:challenge-success', success);

    data.challenges = [foundation(1)];
    mgr = new ChallengeManager();
    setUrl('');
    await mgr.init(fakeEmulator()); // mode libre → _current reste null
    bus.emit('chuck:validate', { source: 'BRK' });
    await flush();

    expect(failed).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
  });
});

/* ── currentChallenge : premier non complété ──────────────────── */

describe('ChallengeManager.currentChallenge', () => {
  beforeEach(() => { data.challenges = [foundation(1), foundation(2), foundation(3)]; });

  it('retourne le premier défi non complété', async () => {
    store.completed.add(1);
    mgr = new ChallengeManager();
    setUrl('?challenge=1'); // force _ensureLoaded()
    await mgr.init(fakeEmulator());
    await flush();
    expect(mgr.currentChallenge()).toBe(2);
  });

  it('retourne le dernier si tout est complété', async () => {
    [1, 2, 3].forEach((id) => store.completed.add(id));
    mgr = new ChallengeManager();
    setUrl('?challenge=1');
    await mgr.init(fakeEmulator());
    await flush();
    expect(mgr.currentChallenge()).toBe(3);
  });

  it('ignore les étapes de parcours dans le calcul', async () => {
    data.tracks = [{ id: 'pong', name: 'Projet Pong', position: 1, icon: null, subtitle: null }];
    data.steps = [trackStep(10, 0)];
    tracksServiceMock.getTrackByName.mockImplementation(
      (name: string) => data.tracks.find((t) => t.name === name) ?? null,
    );
    mgr = new ChallengeManager();
    setUrl('?challenge=1');
    await mgr.init(fakeEmulator());
    await flush();
    expect(mgr.currentChallenge()).toBe(1); // pas 10
  });
});

/* ── Liste des challenges (émission + verrous) ────────────────── */

describe('ChallengeManager — liste des challenges', () => {
  it('émet la liste avec les verrous séquentiels calculés', async () => {
    data.challenges = [foundation(1), foundation(2), foundation(3)];
    store.completed.add(1);
    const list = vi.fn();
    bus.on('chuck:challenges-list', list);

    mgr = new ChallengeManager();
    await mgr.init(fakeEmulator());
    bus.emit('chuck:tutos-requested', undefined);
    await flush();

    expect(list).toHaveBeenCalled();
    const items = list.mock.calls.at(-1)![0].items;
    expect(items.find((i: any) => i.id === 2).sequentialLocked).toBe(false); // 1 validé
    expect(items.find((i: any) => i.id === 3).sequentialLocked).toBe(true);  // 2 pas validé
  });
});