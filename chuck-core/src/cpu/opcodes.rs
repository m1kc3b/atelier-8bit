// chuck-core/src/cpu/opcodes.rs
//
// Table complète des opcodes officiels du MOS 6502.
// Source de référence : http://www.6502.org/tutorials/6502opcodes.html
//                       + NesDev wiki
//
// Chaque entrée : (mnémonique, mode d'adressage, taille en octets, cycles de base)
// Les cycles sont approximatifs — les page-cross et branch-taken s'ajoutent à l'exécution.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AddrMode {
    Imp,   // Implicite            — 1 octet
    Acc,   // Accumulateur         — 1 octet  (ASL A)
    Imm,   // Immédiat             — 2 octets (#$xx)
    Zp,    // Zero Page            — 2 octets ($xx)
    Zpx,   // Zero Page,X          — 2 octets ($xx,X)
    Zpy,   // Zero Page,Y          — 2 octets ($xx,Y)
    Abs,   // Absolu               — 3 octets ($xxxx)
    Abx,   // Absolu,X             — 3 octets ($xxxx,X)
    Aby,   // Absolu,Y             — 3 octets ($xxxx,Y)
    Ind,   // Indirect             — 3 octets (($xxxx))
    Inx,   // (Indirect,X) = pre   — 2 octets (($xx,X))
    Iny,   // (Indirect),Y = post  — 2 octets (($xx),Y)
    Rel,   // Relatif              — 2 octets (branch)
    Xxx,   // Illégal / non utilisé
}

#[derive(Clone, Copy, Debug)]
pub struct OpcodeEntry {
    pub mnem:   &'static str,
    pub mode:   AddrMode,
    pub size:   u8,   // octets totaux (opcode inclus)
    pub cycles: u8,   // cycles de base
}

const fn e(mnem: &'static str, mode: AddrMode, size: u8, cycles: u8) -> OpcodeEntry {
    OpcodeEntry { mnem, mode, size, cycles }
}

const ILL: OpcodeEntry = e("???", AddrMode::Xxx, 1, 2);

/// Table indexée par opcode (256 entrées).
pub static OPCODE_TABLE: [OpcodeEntry; 256] = {
    use AddrMode::*;
    let mut t = [ILL; 256];

    // ── ADC ───────────────────────────────────────────────────────
    t[0x69] = e("ADC", Imm, 2, 2);
    t[0x65] = e("ADC", Zp,  2, 3);
    t[0x75] = e("ADC", Zpx, 2, 4);
    t[0x6D] = e("ADC", Abs, 3, 4);
    t[0x7D] = e("ADC", Abx, 3, 4); // +1 si page cross
    t[0x79] = e("ADC", Aby, 3, 4); // +1 si page cross
    t[0x61] = e("ADC", Inx, 2, 6);
    t[0x71] = e("ADC", Iny, 2, 5); // +1 si page cross

    // ── AND ───────────────────────────────────────────────────────
    t[0x29] = e("AND", Imm, 2, 2);
    t[0x25] = e("AND", Zp,  2, 3);
    t[0x35] = e("AND", Zpx, 2, 4);
    t[0x2D] = e("AND", Abs, 3, 4);
    t[0x3D] = e("AND", Abx, 3, 4);
    t[0x39] = e("AND", Aby, 3, 4);
    t[0x21] = e("AND", Inx, 2, 6);
    t[0x31] = e("AND", Iny, 2, 5);

    // ── ASL ───────────────────────────────────────────────────────
    t[0x0A] = e("ASL", Acc, 1, 2);
    t[0x06] = e("ASL", Zp,  2, 5);
    t[0x16] = e("ASL", Zpx, 2, 6);
    t[0x0E] = e("ASL", Abs, 3, 6);
    t[0x1E] = e("ASL", Abx, 3, 7);

    // ── Branches ──────────────────────────────────────────────────
    t[0x90] = e("BCC", Rel, 2, 2); // +1 si pris, +1 si page cross
    t[0xB0] = e("BCS", Rel, 2, 2);
    t[0xF0] = e("BEQ", Rel, 2, 2);
    t[0x30] = e("BMI", Rel, 2, 2);
    t[0xD0] = e("BNE", Rel, 2, 2);
    t[0x10] = e("BPL", Rel, 2, 2);
    t[0x50] = e("BVC", Rel, 2, 2);
    t[0x70] = e("BVS", Rel, 2, 2);

    // ── BIT ───────────────────────────────────────────────────────
    t[0x24] = e("BIT", Zp,  2, 3);
    t[0x2C] = e("BIT", Abs, 3, 4);

    // ── BRK ───────────────────────────────────────────────────────
    t[0x00] = e("BRK", Imp, 1, 7);

    // ── CMP ───────────────────────────────────────────────────────
    t[0xC9] = e("CMP", Imm, 2, 2);
    t[0xC5] = e("CMP", Zp,  2, 3);
    t[0xD5] = e("CMP", Zpx, 2, 4);
    t[0xCD] = e("CMP", Abs, 3, 4);
    t[0xDD] = e("CMP", Abx, 3, 4);
    t[0xD9] = e("CMP", Aby, 3, 4);
    t[0xC1] = e("CMP", Inx, 2, 6);
    t[0xD1] = e("CMP", Iny, 2, 5);

    // ── CPX ───────────────────────────────────────────────────────
    t[0xE0] = e("CPX", Imm, 2, 2);
    t[0xE4] = e("CPX", Zp,  2, 3);
    t[0xEC] = e("CPX", Abs, 3, 4);

    // ── CPY ───────────────────────────────────────────────────────
    t[0xC0] = e("CPY", Imm, 2, 2);
    t[0xC4] = e("CPY", Zp,  2, 3);
    t[0xCC] = e("CPY", Abs, 3, 4);

    // ── DEC ───────────────────────────────────────────────────────
    t[0xC6] = e("DEC", Zp,  2, 5);
    t[0xD6] = e("DEC", Zpx, 2, 6);
    t[0xCE] = e("DEC", Abs, 3, 6);
    t[0xDE] = e("DEC", Abx, 3, 7);

    // ── DEX / DEY ─────────────────────────────────────────────────
    t[0xCA] = e("DEX", Imp, 1, 2);
    t[0x88] = e("DEY", Imp, 1, 2);

    // ── EOR ───────────────────────────────────────────────────────
    t[0x49] = e("EOR", Imm, 2, 2);
    t[0x45] = e("EOR", Zp,  2, 3);
    t[0x55] = e("EOR", Zpx, 2, 4);
    t[0x4D] = e("EOR", Abs, 3, 4);
    t[0x5D] = e("EOR", Abx, 3, 4);
    t[0x59] = e("EOR", Aby, 3, 4);
    t[0x41] = e("EOR", Inx, 2, 6);
    t[0x51] = e("EOR", Iny, 2, 5);

    // ── INC ───────────────────────────────────────────────────────
    t[0xE6] = e("INC", Zp,  2, 5);
    t[0xF6] = e("INC", Zpx, 2, 6);
    t[0xEE] = e("INC", Abs, 3, 6);
    t[0xFE] = e("INC", Abx, 3, 7);

    // ── INX / INY ─────────────────────────────────────────────────
    t[0xE8] = e("INX", Imp, 1, 2);
    t[0xC8] = e("INY", Imp, 1, 2);

    // ── JMP ───────────────────────────────────────────────────────
    t[0x4C] = e("JMP", Abs, 3, 3);
    t[0x6C] = e("JMP", Ind, 3, 5);

    // ── JSR ───────────────────────────────────────────────────────
    t[0x20] = e("JSR", Abs, 3, 6);

    // ── LDA ───────────────────────────────────────────────────────
    t[0xA9] = e("LDA", Imm, 2, 2);
    t[0xA5] = e("LDA", Zp,  2, 3);
    t[0xB5] = e("LDA", Zpx, 2, 4);
    t[0xAD] = e("LDA", Abs, 3, 4);
    t[0xBD] = e("LDA", Abx, 3, 4);
    t[0xB9] = e("LDA", Aby, 3, 4);
    t[0xA1] = e("LDA", Inx, 2, 6);
    t[0xB1] = e("LDA", Iny, 2, 5);

    // ── LDX ───────────────────────────────────────────────────────
    t[0xA2] = e("LDX", Imm, 2, 2);
    t[0xA6] = e("LDX", Zp,  2, 3);
    t[0xB6] = e("LDX", Zpy, 2, 4);
    t[0xAE] = e("LDX", Abs, 3, 4);
    t[0xBE] = e("LDX", Aby, 3, 4);

    // ── LDY ───────────────────────────────────────────────────────
    t[0xA0] = e("LDY", Imm, 2, 2);
    t[0xA4] = e("LDY", Zp,  2, 3);
    t[0xB4] = e("LDY", Zpx, 2, 4);
    t[0xAC] = e("LDY", Abs, 3, 4);
    t[0xBC] = e("LDY", Abx, 3, 4);

    // ── LSR ───────────────────────────────────────────────────────
    t[0x4A] = e("LSR", Acc, 1, 2);
    t[0x46] = e("LSR", Zp,  2, 5);
    t[0x56] = e("LSR", Zpx, 2, 6);
    t[0x4E] = e("LSR", Abs, 3, 6);
    t[0x5E] = e("LSR", Abx, 3, 7);

    // ── NOP ───────────────────────────────────────────────────────
    t[0xEA] = e("NOP", Imp, 1, 2);

    // ── ORA ───────────────────────────────────────────────────────
    t[0x09] = e("ORA", Imm, 2, 2);
    t[0x05] = e("ORA", Zp,  2, 3);
    t[0x15] = e("ORA", Zpx, 2, 4);
    t[0x0D] = e("ORA", Abs, 3, 4);
    t[0x1D] = e("ORA", Abx, 3, 4);
    t[0x19] = e("ORA", Aby, 3, 4);
    t[0x01] = e("ORA", Inx, 2, 6);
    t[0x11] = e("ORA", Iny, 2, 5);

    // ── PHA / PHP / PLA / PLP ─────────────────────────────────────
    t[0x48] = e("PHA", Imp, 1, 3);
    t[0x08] = e("PHP", Imp, 1, 3);
    t[0x68] = e("PLA", Imp, 1, 4);
    t[0x28] = e("PLP", Imp, 1, 4);

    // ── ROL ───────────────────────────────────────────────────────
    t[0x2A] = e("ROL", Acc, 1, 2);
    t[0x26] = e("ROL", Zp,  2, 5);
    t[0x36] = e("ROL", Zpx, 2, 6);
    t[0x2E] = e("ROL", Abs, 3, 6);
    t[0x3E] = e("ROL", Abx, 3, 7);

    // ── ROR ───────────────────────────────────────────────────────
    t[0x6A] = e("ROR", Acc, 1, 2);
    t[0x66] = e("ROR", Zp,  2, 5);
    t[0x76] = e("ROR", Zpx, 2, 6);
    t[0x6E] = e("ROR", Abs, 3, 6);
    t[0x7E] = e("ROR", Abx, 3, 7);

    // ── RTI / RTS ─────────────────────────────────────────────────
    t[0x40] = e("RTI", Imp, 1, 6);
    t[0x60] = e("RTS", Imp, 1, 6);

    // ── SBC ───────────────────────────────────────────────────────
    t[0xE9] = e("SBC", Imm, 2, 2);
    t[0xE5] = e("SBC", Zp,  2, 3);
    t[0xF5] = e("SBC", Zpx, 2, 4);
    t[0xED] = e("SBC", Abs, 3, 4);
    t[0xFD] = e("SBC", Abx, 3, 4);
    t[0xF9] = e("SBC", Aby, 3, 4);
    t[0xE1] = e("SBC", Inx, 2, 6);
    t[0xF1] = e("SBC", Iny, 2, 5);

    // ── Flags ─────────────────────────────────────────────────────
    t[0x38] = e("SEC", Imp, 1, 2);
    t[0x18] = e("CLC", Imp, 1, 2);
    t[0xF8] = e("SED", Imp, 1, 2);
    t[0xD8] = e("CLD", Imp, 1, 2);
    t[0x78] = e("SEI", Imp, 1, 2);
    t[0x58] = e("CLI", Imp, 1, 2);
    t[0xB8] = e("CLV", Imp, 1, 2);

    // ── STA ───────────────────────────────────────────────────────
    t[0x85] = e("STA", Zp,  2, 3);
    t[0x95] = e("STA", Zpx, 2, 4);
    t[0x8D] = e("STA", Abs, 3, 4);
    t[0x9D] = e("STA", Abx, 3, 5);
    t[0x99] = e("STA", Aby, 3, 5);
    t[0x81] = e("STA", Inx, 2, 6);
    t[0x91] = e("STA", Iny, 2, 6);

    // ── STX ───────────────────────────────────────────────────────
    t[0x86] = e("STX", Zp,  2, 3);
    t[0x96] = e("STX", Zpy, 2, 4);
    t[0x8E] = e("STX", Abs, 3, 4);

    // ── STY ───────────────────────────────────────────────────────
    t[0x84] = e("STY", Zp,  2, 3);
    t[0x94] = e("STY", Zpx, 2, 4);
    t[0x8C] = e("STY", Abs, 3, 4);

    // ── Transferts ────────────────────────────────────────────────
    t[0xAA] = e("TAX", Imp, 1, 2);
    t[0xA8] = e("TAY", Imp, 1, 2);
    t[0xBA] = e("TSX", Imp, 1, 2);
    t[0x8A] = e("TXA", Imp, 1, 2);
    t[0x9A] = e("TXS", Imp, 1, 2);
    t[0x98] = e("TYA", Imp, 1, 2);
    
    // ── Opcodes non documentés (illégaux NMOS) ────────────────────
    // Activés volontairement comme idiomes d'optimisation cachés.
    // NE PAS exposer dans l'autocomplétion ni la doc publique.
    t[0xA7] = e("LAX", Zp,  2, 3);   // A = X = M
    t[0xAF] = e("LAX", Abs, 3, 4);
    t[0xB3] = e("LAX", Iny, 2, 5);   // +1 si page cross
    t[0x87] = e("SAX", Zp,  2, 3);   // M = A & X (aucun flag)
    t[0x8F] = e("SAX", Abs, 3, 4);
    t[0xC7] = e("DCP", Zp,  2, 5);   // M = M-1 puis CMP A
    t[0xCF] = e("DCP", Abs, 3, 6);
    t[0xE7] = e("ISC", Zp,  2, 5);   // M = M+1 puis SBC A
    t[0xEF] = e("ISC", Abs, 3, 6);

    t
};

/// Retourne l'opcode pour un mnémonique + mode donné, ou None si non supporté.
pub fn find_opcode(mnem: &str, mode: AddrMode) -> Option<u8> {
    for (i, entry) in OPCODE_TABLE.iter().enumerate() {
        if entry.mnem == mnem && entry.mode == mode {
            return Some(i as u8);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn table_non_vide() {
        // Quelques opcodes connus
        assert_eq!(OPCODE_TABLE[0xA9].mnem, "LDA");
        assert_eq!(OPCODE_TABLE[0xA9].mode, AddrMode::Imm);
        assert_eq!(OPCODE_TABLE[0xA9].size, 2);

        assert_eq!(OPCODE_TABLE[0x00].mnem, "BRK");
        assert_eq!(OPCODE_TABLE[0x4C].mnem, "JMP");
        assert_eq!(OPCODE_TABLE[0x20].mnem, "JSR");
        assert_eq!(OPCODE_TABLE[0x60].mnem, "RTS");
        assert_eq!(OPCODE_TABLE[0x6C].mnem, "JMP");
        assert_eq!(OPCODE_TABLE[0x6C].mode, AddrMode::Ind);
    }

    #[test]
    fn find_opcode_lda_imm() {
        assert_eq!(find_opcode("LDA", AddrMode::Imm), Some(0xA9));
        assert_eq!(find_opcode("LDA", AddrMode::Zp),  Some(0xA5));
        assert_eq!(find_opcode("LDA", AddrMode::Abs), Some(0xAD));
    }

    #[test]
    fn all_sizes_coherent() {
        // Toutes les entrées non-illégales ont une taille >= 1
        for (i, e) in OPCODE_TABLE.iter().enumerate() {
            if e.mnem != "???" {
                assert!(e.size >= 1 && e.size <= 3,
                    "Opcode ${:02X} ({}) a une taille invalide: {}", i, e.mnem, e.size);
            }
        }
    }

    #[test]
    fn sta_no_immediate() {
        // STA n'a pas de mode immédiat en 6502
        assert_eq!(find_opcode("STA", AddrMode::Imm), None);
    }

    #[test]
    fn branches_are_relative() {
        for &op in &[0x90u8, 0xB0, 0xF0, 0x30, 0xD0, 0x10, 0x50, 0x70] {
            assert_eq!(OPCODE_TABLE[op as usize].mode, AddrMode::Rel,
                "Branch ${:02X} devrait être Rel", op);
            assert_eq!(OPCODE_TABLE[op as usize].size, 2);
        }
    }
}