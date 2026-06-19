/* ─────────────────────────────────────────────────────────────
   Chuck IDE — tests/challenge-manager.test.ts

   Tests du système de défis :
   - Accès séquentiel (défi N nécessite N-1 validé)
   - Calcul des médailles selon hintsUsed
   - Vérification des assertions (register, memory, flag, sequence)
   - lastAccessible()
   - saveCompleted() et getMedal()
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect, beforeEach } from 'vitest';

// ── Types ─────────────────────────────────────────────────────

type Medal = '🥇' | '🥈' | '🥉';
type MedalData = { medal: Medal; hintsUsed: number };
type CompletedMap = Record<number, MedalData>;

const FREE_CHALLENGES = 3;
const COMPLETED_KEY   = 'chuck8_completed';

// ── Reproduction de la logique du ChallengeManager ───────────

function loadCompleted(): CompletedMap {
  try {
    return JSON.parse(localStorage.getItem(COMPLETED_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveCompleted(map: CompletedMap): void {
  localStorage.setItem(COMPLETED_KEY, JSON.stringify(map));
}

function isAccessible(id: number): boolean {
  if (id <= FREE_CHALLENGES) return true;
  const completed = loadCompleted();
  return !!(completed[id - 1]);
}

function lastAccessible(): number {
  const completed = loadCompleted();
  let last = FREE_CHALLENGES;
  while (completed[last] && last < 30) last++;
  return last;
}

function computeMedal(hintsUsed: number): Medal {
  return hintsUsed === 0 ? '🥇' : hintsUsed === 1 ? '🥈' : '🥉';
}

function doSaveCompleted(id: number, hintsUsed: number): void {
  const map = loadCompleted();
  map[id] = { medal: computeMedal(hintsUsed), hintsUsed };
  saveCompleted(map);
}

function getMedal(id: number): MedalData | null {
  return loadCompleted()[id] ?? null;
}

// ── Assertions ───────────────────────────────────────────────

type CpuState  = { A: number; X: number; Y: number; PC: number; SP: number; P: number };
type MemView   = Uint8Array;

const FLAGS: Record<string, number> = {
  N: 0x80, V: 0x40, B: 0x10, D: 0x08, I: 0x04, Z: 0x02, C: 0x01,
};

interface RegisterAssertion { type: 'register'; register: string; value: number; failMsg?: string; }
interface MemoryAssertion   { type: 'memory';   address:  number; value: number; failMsg?: string; }
interface FlagAssertion     { type: 'flag';     flag:     string; set:   boolean; failMsg?: string; }
interface SequenceAssertion { type: 'sequence'; address:  number; values: number[]; failMsg?: string; }

type Assertion = RegisterAssertion | MemoryAssertion | FlagAssertion | SequenceAssertion;

interface AssertionFailure { assertion: Assertion; expected: unknown; actual: unknown; message: string; }

function checkAssertion(
  assertion: Assertion,
  state: CpuState,
  memView: MemView,
): AssertionFailure | null {
  switch (assertion.type) {
    case 'register': {
      const reg: Record<string, number> = {
        A: state.A, X: state.X, Y: state.Y, PC: state.PC, SP: state.SP, P: state.P,
      };
      const actual = reg[assertion.register] ?? 0;
      if (actual === assertion.value) return null;
      return {
        assertion,
        expected: assertion.value,
        actual,
        message: assertion.failMsg ?? `${assertion.register} : attendu $${assertion.value.toString(16).toUpperCase()}, obtenu $${actual.toString(16).toUpperCase()}`,
      };
    }
    case 'memory': {
      const actual = memView[assertion.address] ?? 0;
      if (actual === assertion.value) return null;
      return { assertion, expected: assertion.value, actual, message: assertion.failMsg ?? `addr check failed` };
    }
    case 'flag': {
      const mask   = FLAGS[assertion.flag] ?? 0;
      const actual = (state.P & mask) !== 0;
      if (actual === assertion.set) return null;
      return { assertion, expected: assertion.set, actual, message: assertion.failMsg ?? `Flag ${assertion.flag} attendu ${assertion.set}` };
    }
    case 'sequence': {
      for (let i = 0; i < assertion.values.length; i++) {
        const expected = assertion.values[i]!;
        const actual   = memView[assertion.address + i] ?? 0;
        if (actual !== expected)
          return { assertion, expected, actual, message: assertion.failMsg ?? `seq mismatch at ${i}` };
      }
      return null;
    }
  }
}

// ─────────────────────────────────────────────────────────────

beforeEach(() => localStorage.clear());

// ── Tests accès séquentiel ────────────────────────────────────

describe('ChallengeManager — accès séquentiel', () => {

  it('défis 1, 2, 3 sont accessibles sans rien valider', () => {
    [1, 2, 3].forEach(id => expect(isAccessible(id)).toBe(true));
  });

  it('défi 4 est inaccessible sans avoir validé le 3', () => {
    expect(isAccessible(4)).toBe(false);
  });

  it('défi 4 devient accessible après avoir validé le 3', () => {
    doSaveCompleted(3, 0);
    expect(isAccessible(4)).toBe(true);
  });

  it('défi 5 reste inaccessible si seulement le 3 est validé', () => {
    doSaveCompleted(3, 0);
    expect(isAccessible(5)).toBe(false);
  });

  it('défi 5 accessible après 3 et 4 validés', () => {
    doSaveCompleted(3, 0);
    doSaveCompleted(4, 0);
    expect(isAccessible(5)).toBe(true);
  });

  it('défi 10 nécessite 3+4+5+6+7+8+9 validés', () => {
    expect(isAccessible(10)).toBe(false);
    [3, 4, 5, 6, 7, 8, 9].forEach(id => doSaveCompleted(id, 0));
    expect(isAccessible(10)).toBe(true);
  });

  it('gap dans la séquence : isAccessible vérifie seulement id-1, pas toute la chaîne', () => {
    // isAccessible(id) vérifie uniquement completed[id-1].
    // Si on force un saveCompleted(5) sans avoir validé le 4, le 6 devient
    // accessible — c'est voulu : la protection est dans l'UI (on ne peut pas
    // accéder au 5 sans le 4), pas dans isAccessible() elle-même.
    doSaveCompleted(3, 0);
    doSaveCompleted(5, 0); // force : normalement impossible via l'UI
    // Le 6 est accessible car completed[5] existe
    expect(isAccessible(6)).toBe(true);
    // Mais le 4 reste inaccessible (completed[3] existe, completed[4] n'existe pas)
    // → isAccessible(5) vérifie completed[4] → false
    // Attends : on a justement forcé completed[5] donc isAccessible(6) = true.
    // Ce test documente le comportement réel : pas de vérification de chaîne complète.
    expect(isAccessible(4)).toBe(true);  // completed[3] existe → 4 accessible
    expect(isAccessible(5)).toBe(false); // completed[4] absent → 5 inaccessible via UI
  });
});

// ── Tests lastAccessible() ────────────────────────────────────

describe('ChallengeManager — lastAccessible()', () => {

  it('sans aucun validé → lastAccessible = 3 (FREE_CHALLENGES)', () => {
    expect(lastAccessible()).toBe(3);
  });

  it('après validation du 3 → lastAccessible = 4', () => {
    doSaveCompleted(3, 0);
    expect(lastAccessible()).toBe(4);
  });

  it('après 3 et 4 validés → lastAccessible = 5', () => {
    doSaveCompleted(3, 0);
    doSaveCompleted(4, 0);
    expect(lastAccessible()).toBe(5);
  });

  it('progression complète 3→10 → lastAccessible = 11', () => {
    [3, 4, 5, 6, 7, 8, 9, 10].forEach(id => doSaveCompleted(id, 0));
    expect(lastAccessible()).toBe(11);
  });
});

// ── Tests médailles ───────────────────────────────────────────

describe('ChallengeManager — calcul médailles', () => {

  it('0 indice → 🥇',    () => expect(computeMedal(0)).toBe('🥇'));
  it('1 indice → 🥈',    () => expect(computeMedal(1)).toBe('🥈'));
  it('2 indices → 🥉',   () => expect(computeMedal(2)).toBe('🥉'));
  it('3 indices → 🥉',   () => expect(computeMedal(3)).toBe('🥉'));
  it('10 indices → 🥉',  () => expect(computeMedal(10)).toBe('🥉'));

  it('saveCompleted enregistre la bonne médaille', () => {
    doSaveCompleted(1, 0);
    expect(getMedal(1)?.medal).toBe('🥇');

    doSaveCompleted(2, 1);
    expect(getMedal(2)?.medal).toBe('🥈');

    doSaveCompleted(3, 2);
    expect(getMedal(3)?.medal).toBe('🥉');
  });

  it('re-validation améliore la médaille (🥉 → 🥇)', () => {
    doSaveCompleted(1, 3); // 🥉 première fois
    expect(getMedal(1)?.medal).toBe('🥉');

    doSaveCompleted(1, 0); // 🥇 deuxième tentative
    expect(getMedal(1)?.medal).toBe('🥇');
  });

  it('getMedal(id) retourne null si jamais validé', () => {
    expect(getMedal(99)).toBeNull();
  });

  it('getMedal(id) retourne le hintsUsed correct', () => {
    doSaveCompleted(5, 2);
    expect(getMedal(5)?.hintsUsed).toBe(2);
  });
});

// ── Tests _checkAssertion ─────────────────────────────────────

describe('ChallengeManager — assertion register', () => {

  const baseState: CpuState = { A: 0x42, X: 0x00, Y: 0x00, PC: 0x0600, SP: 0xFF, P: 0x00 };
  const mem = new Uint8Array(65536);

  it("A=0x42 valide l'assertion A=0x42", () => {
    const a: RegisterAssertion = { type: 'register', register: 'A', value: 0x42 };
    expect(checkAssertion(a, baseState, mem)).toBeNull();
  });

  it("A=0x42 échoue l'assertion A=0x01", () => {
    const a: RegisterAssertion = { type: 'register', register: 'A', value: 0x01 };
    const f = checkAssertion(a, baseState, mem);
    expect(f).not.toBeNull();
    expect(f!.actual).toBe(0x42);
    expect(f!.expected).toBe(0x01);
  });

  it("message d'échec générique contient le nom du registre", () => {
    const a: RegisterAssertion = { type: 'register', register: 'X', value: 0xFF };
    const f = checkAssertion(a, baseState, mem);
    expect(f!.message).toContain('X');
  });

  it('failMsg custom utilisé si fourni', () => {
    const a: RegisterAssertion = { type: 'register', register: 'A', value: 0xFF, failMsg: 'Erreur custom !' };
    const f = checkAssertion(a, baseState, mem);
    expect(f!.message).toBe('Erreur custom !');
  });
});

describe('ChallengeManager — assertion memory', () => {

  const state: CpuState = { A: 0, X: 0, Y: 0, PC: 0x0600, SP: 0xFF, P: 0x00 };

  it('adresse correcte → null', () => {
    const mem = new Uint8Array(65536);
    mem[0x0010] = 0xAB;
    const a: MemoryAssertion = { type: 'memory', address: 0x0010, value: 0xAB };
    expect(checkAssertion(a, state, mem)).toBeNull();
  });

  it('mauvaise valeur → failure avec expected/actual', () => {
    const mem = new Uint8Array(65536);
    mem[0x0010] = 0x00;
    const a: MemoryAssertion = { type: 'memory', address: 0x0010, value: 0xFF };
    const f = checkAssertion(a, state, mem);
    expect(f).not.toBeNull();
    expect(f!.expected).toBe(0xFF);
    expect(f!.actual).toBe(0x00);
  });

  it('vérification zone VRAM texte $4800', () => {
    const mem = new Uint8Array(65536);
    mem[0x4800] = 0x41; // 'A'
    const a: MemoryAssertion = { type: 'memory', address: 0x4800, value: 0x41 };
    expect(checkAssertion(a, state, mem)).toBeNull();
  });
});

describe('ChallengeManager — assertion flag', () => {

  const mem = new Uint8Array(65536);

  it('flag Z set, P avec bit 1 → null', () => {
    const state: CpuState = { A: 0, X: 0, Y: 0, PC: 0x0600, SP: 0xFF, P: 0b00000010 };
    const a: FlagAssertion = { type: 'flag', flag: 'Z', set: true };
    expect(checkAssertion(a, state, mem)).toBeNull();
  });

  it('flag Z attendu mais non set → failure', () => {
    const state: CpuState = { A: 1, X: 0, Y: 0, PC: 0x0600, SP: 0xFF, P: 0x00 };
    const a: FlagAssertion = { type: 'flag', flag: 'Z', set: true };
    expect(checkAssertion(a, state, mem)).not.toBeNull();
  });

  it('flag C non set, assertion set=false → null', () => {
    const state: CpuState = { A: 0, X: 0, Y: 0, PC: 0x0600, SP: 0xFF, P: 0x00 };
    const a: FlagAssertion = { type: 'flag', flag: 'C', set: false };
    expect(checkAssertion(a, state, mem)).toBeNull();
  });

  it('flag N (négatif) set → N=0x80', () => {
    const state: CpuState = { A: 0, X: 0, Y: 0, PC: 0x0600, SP: 0xFF, P: 0x80 };
    const a: FlagAssertion = { type: 'flag', flag: 'N', set: true };
    expect(checkAssertion(a, state, mem)).toBeNull();
  });
});

describe('ChallengeManager — assertion sequence', () => {

  const state: CpuState = { A: 0, X: 0, Y: 0, PC: 0x0600, SP: 0xFF, P: 0x00 };

  it('séquence correcte → null', () => {
    const mem = new Uint8Array(65536);
    mem[0x0010] = 0x01;
    mem[0x0011] = 0x02;
    mem[0x0012] = 0x03;
    const a: SequenceAssertion = { type: 'sequence', address: 0x0010, values: [0x01, 0x02, 0x03] };
    expect(checkAssertion(a, state, mem)).toBeNull();
  });

  it('séquence incorrecte au 2e octet → failure', () => {
    const mem = new Uint8Array(65536);
    mem[0x0010] = 0x01;
    mem[0x0011] = 0xFF; // mauvais
    const a: SequenceAssertion = { type: 'sequence', address: 0x0010, values: [0x01, 0x02] };
    const f = checkAssertion(a, state, mem);
    expect(f).not.toBeNull();
    expect(f!.expected).toBe(0x02);
    expect(f!.actual).toBe(0xFF);
  });

  it('séquence vide → toujours null (rien à vérifier)', () => {
    const mem = new Uint8Array(65536);
    const a: SequenceAssertion = { type: 'sequence', address: 0x0000, values: [] };
    expect(checkAssertion(a, state, mem)).toBeNull();
  });
});

// ── Tests résultats de validation ────────────────────────────

describe('ChallengeManager — résultat de validation', () => {

  interface ValidationResult {
    success:  boolean;
    failures: AssertionFailure[];
    cycles:   number;
    timeout:  boolean;
  }

  function validate(
    assertions: Assertion[],
    state: CpuState,
    mem: MemView,
    cycles = 100,
    timeout = false,
  ): ValidationResult {
    const failures: AssertionFailure[] = [];
    for (const a of assertions) {
      const f = checkAssertion(a, state, mem);
      if (f) failures.push(f);
    }
    return { success: failures.length === 0 && !timeout, failures, cycles, timeout };
  }

  it('toutes assertions passent → success=true', () => {
    const state: CpuState = { A: 0x42, X: 0, Y: 0, PC: 0x0600, SP: 0xFF, P: 0 };
    const mem   = new Uint8Array(65536);
    const assertions: Assertion[] = [
      { type: 'register', register: 'A', value: 0x42 },
    ];
    const result = validate(assertions, state, mem);
    expect(result.success).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it('une assertion échoue → success=false avec failures', () => {
    const state: CpuState = { A: 0x00, X: 0, Y: 0, PC: 0x0600, SP: 0xFF, P: 0 };
    const mem   = new Uint8Array(65536);
    const assertions: Assertion[] = [
      { type: 'register', register: 'A', value: 0x42 },
    ];
    const result = validate(assertions, state, mem);
    expect(result.success).toBe(false);
    expect(result.failures).toHaveLength(1);
  });

  it('timeout → success=false même si assertions ok', () => {
    const state: CpuState = { A: 0x42, X: 0, Y: 0, PC: 0x0600, SP: 0xFF, P: 0 };
    const mem   = new Uint8Array(65536);
    const assertions: Assertion[] = [
      { type: 'register', register: 'A', value: 0x42 },
    ];
    const result = validate(assertions, state, mem, 100_000, true);
    expect(result.success).toBe(false);
    expect(result.timeout).toBe(true);
  });

  it('plusieurs assertions : première échoue, seconde passe → 1 failure', () => {
    const state: CpuState = { A: 0x00, X: 0xFF, Y: 0, PC: 0x0600, SP: 0xFF, P: 0 };
    const mem   = new Uint8Array(65536);
    const assertions: Assertion[] = [
      { type: 'register', register: 'A', value: 0x42 }, // échec
      { type: 'register', register: 'X', value: 0xFF }, // succès
    ];
    const result = validate(assertions, state, mem);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]!.assertion).toMatchObject({ register: 'A' });
  });
});