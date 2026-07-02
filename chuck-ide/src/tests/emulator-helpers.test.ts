/* ─────────────────────────────────────────────────────────────
   Tests — infra/wasm/emulator.ts (helpers purs)
   Couvre : maskDisasm (masquage des opcodes cachés/prestige, bypass
   super-admin, insensibilité à la casse et à l'indentation, opcodes
   légaux intacts) et cleanAsmError (tokens Rust → lisible, reformulations).
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const superAdminMock = { active: false };
vi.mock('../core/super-admin', () => ({
  superAdmin: new Proxy({}, { get: (_t, p) => (superAdminMock as any)[p] }),
}));

import { maskDisasm, cleanAsmError, HIDDEN_MNEMONICS } from '../infra/wasm/emulator.js';

beforeEach(() => {
  superAdminMock.active = false;
});

describe('maskDisasm', () => {
  it('masque un opcode illégal NMOS', () => {
    expect(maskDisasm('LAX $10')).toBe('??? (instruction non documentée)');
  });

  it('masque les opcodes secrets MUL et MCP', () => {
    expect(maskDisasm('MUL')).toContain('???');
    expect(maskDisasm('MCP $20')).toContain('???');
  });

  it('laisse intacts les opcodes légaux', () => {
    expect(maskDisasm('LDA #$2A')).toBe('LDA #$2A');
    expect(maskDisasm('JMP $E000')).toBe('JMP $E000');
  });

  it('est insensible à la casse et à l’indentation', () => {
    expect(maskDisasm('  lax $10')).toContain('???');
    expect(maskDisasm('\tSaX $ff')).toContain('???');
  });

  it('super-admin voit le désassemblage complet (aucun masquage)', () => {
    superAdminMock.active = true;
    expect(maskDisasm('LAX $10')).toBe('LAX $10');
    expect(maskDisasm('MUL')).toBe('MUL');
  });

  it('masque tous les mnémoniques de la liste cachée', () => {
    for (const m of HIDDEN_MNEMONICS) {
      expect(maskDisasm(`${m} $00`)).toContain('???');
    }
  });

  it('ligne vide reste inchangée', () => {
    expect(maskDisasm('')).toBe('');
  });
});

describe('cleanAsmError', () => {
  it('remplace les tokens Rust par des symboles lisibles', () => {
    expect(cleanAsmError('Some(Colon)')).toBe('":"');
    expect(cleanAsmError('Some(Hash)')).toBe('"#"');
    expect(cleanAsmError('Some(Comma)')).toBe('","');
  });

  it('extrait le contenu d’un Ident et d’un Number', () => {
    expect(cleanAsmError('Some(Ident(LOOP))')).toBe('"LOOP"');
    expect(cleanAsmError('Some(Number(42))')).toBe('42');
  });

  it('traduit None et les fins de flux', () => {
    expect(cleanAsmError('None')).toBe('fin de fichier');
    expect(cleanAsmError('Some(Eof)')).toBe('fin de fichier');
    expect(cleanAsmError('Some(Newline)')).toBe('fin de ligne');
  });

  it('reformule les messages courants en français', () => {
    expect(cleanAsmError('Unexpected token')).toBe('Élément inattendu');
    expect(cleanAsmError('Undefined label')).toBe('Label inconnu');
    expect(cleanAsmError('Duplicate label')).toBe('Label déjà défini');
    expect(cleanAsmError('Unknown mnemonic')).toBe('Mnémonique inconnu');
  });

  it('gère "Expected X, got" avec capture', () => {
    expect(cleanAsmError('Expected operand, got')).toBe('Attendu operand, trouvé');
  });

  it('fallback générique pour un Some(...) non listé', () => {
    expect(cleanAsmError('Some(Weird)')).toBe('"Weird"');
  });

  it('laisse un message déjà propre inchangé', () => {
    expect(cleanAsmError('Erreur simple')).toBe('Erreur simple');
  });
});