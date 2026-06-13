// chuck-core/src/cpu/execute.rs
//
// Dispatch et exécution de chaque opcode.
// Retourne true si BRK a été rencontré (fin du programme).

use crate::memory::Memory;
use super::{Cpu, flags};
use super::opcodes::{OPCODE_TABLE, AddrMode};
use super::addressing::{resolve, Operand};

/// Exécute l'instruction au PC courant. Retourne true si BRK.
pub fn step(cpu: &mut Cpu, mem: &mut Memory) -> bool {
    let opcode = mem.read(cpu.pc);
    cpu.pc = cpu.pc.wrapping_add(1);

    let entry = &OPCODE_TABLE[opcode as usize];
    let mode  = entry.mode;
    let base_cycles = entry.cycles as u64;

    // Résoudre l'opérande (avance PC selon la taille)
    let op = resolve(cpu, mem, mode);

    let extra = dispatch(cpu, mem, opcode, mode, op);
    cpu.cycles += base_cycles + extra;

    opcode == 0x00 // BRK
}

/// Exécute l'opcode et retourne les cycles supplémentaires (page cross, branch taken).
fn dispatch(cpu: &mut Cpu, mem: &mut Memory, opcode: u8, mode: AddrMode, op: Operand) -> u64 {
    match opcode {

        // ── LDA ─────────────────────────────────────────────────────────
        0xA9 | 0xA5 | 0xB5 | 0xAD | 0xBD | 0xB9 | 0xA1 | 0xB1 => {
            cpu.a = op.value;
            cpu.set_nz(cpu.a);
            if op.page_cross { 1 } else { 0 }
        }

        // ── LDX ─────────────────────────────────────────────────────────
        0xA2 | 0xA6 | 0xB6 | 0xAE | 0xBE => {
            cpu.x = op.value;
            cpu.set_nz(cpu.x);
            if op.page_cross { 1 } else { 0 }
        }

        // ── LDY ─────────────────────────────────────────────────────────
        0xA0 | 0xA4 | 0xB4 | 0xAC | 0xBC => {
            cpu.y = op.value;
            cpu.set_nz(cpu.y);
            if op.page_cross { 1 } else { 0 }
        }

        // ── STA ─────────────────────────────────────────────────────────
        0x85 | 0x95 | 0x8D | 0x9D | 0x99 | 0x81 | 0x91 => {
            mem.write(op.addr, cpu.a);
            0
        }

        // ── STX ─────────────────────────────────────────────────────────
        0x86 | 0x96 | 0x8E => {
            mem.write(op.addr, cpu.x);
            0
        }

        // ── STY ─────────────────────────────────────────────────────────
        0x84 | 0x94 | 0x8C => {
            mem.write(op.addr, cpu.y);
            0
        }

        // ── Transferts ──────────────────────────────────────────────────
        0xAA => { cpu.x = cpu.a; cpu.set_nz(cpu.x); 0 } // TAX
        0xA8 => { cpu.y = cpu.a; cpu.set_nz(cpu.y); 0 } // TAY
        0x8A => { cpu.a = cpu.x; cpu.set_nz(cpu.a); 0 } // TXA
        0x98 => { cpu.a = cpu.y; cpu.set_nz(cpu.a); 0 } // TYA
        0x9A => { cpu.sp = cpu.x; 0 }                    // TXS — ne modifie pas N/Z
        0xBA => { cpu.x = cpu.sp; cpu.set_nz(cpu.x); 0 } // TSX

        // ── Stack ────────────────────────────────────────────────────────
        0x48 => { cpu.push(mem, cpu.a); 0 }  // PHA
        0x08 => {                              // PHP
            let p = cpu.p | flags::B | flags::U;
            cpu.push(mem, p);
            0
        }
        0x68 => {                              // PLA
            cpu.a = cpu.pop(mem);
            cpu.set_nz(cpu.a);
            0
        }
        0x28 => {                              // PLP
            cpu.p = (cpu.pop(mem) & !flags::B) | flags::U;
            0
        }

        // ── ADC ──────────────────────────────────────────────────────────
        0x69 | 0x65 | 0x75 | 0x6D | 0x7D | 0x79 | 0x61 | 0x71 => {
            let a = cpu.a as u16;
            let m = op.value as u16;
            let c = if cpu.get_flag(flags::C) { 1u16 } else { 0 };

            let result = if cpu.get_flag(flags::D) {
                // Mode décimal BCD
                let lo = (a & 0x0F) + (m & 0x0F) + c;
                let mut hi = (a >> 4) + (m >> 4) + if lo > 9 { 1 } else { 0 };
                let lo = if lo > 9 { lo - 10 } else { lo };
                let carry_out = hi > 9;
                if carry_out { hi -= 10; }
                let bcd = (hi << 4) | (lo & 0x0F);
                cpu.set_flag(flags::C, carry_out);
                cpu.a = bcd as u8;
                cpu.set_nz(cpu.a);
                return if op.page_cross { 1 } else { 0 };
            } else {
                a + m + c
            };

            cpu.set_flag(flags::C, result > 0xFF);
            cpu.set_flag(flags::V, !(a ^ m) & (a ^ result) & 0x80 != 0);
            cpu.a = result as u8;
            cpu.set_nz(cpu.a);
            if op.page_cross { 1 } else { 0 }
        }

        // ── SBC ──────────────────────────────────────────────────────────
        0xE9 | 0xE5 | 0xF5 | 0xED | 0xFD | 0xF9 | 0xE1 | 0xF1 => {
            let a = cpu.a as u16;
            let m = op.value as u16;
            let c = if cpu.get_flag(flags::C) { 1u16 } else { 0 };

            if cpu.get_flag(flags::D) {
                // Mode décimal BCD
                let lo = (a & 0x0F).wrapping_sub(m & 0x0F).wrapping_sub(1 - c);
                let borrow_lo = lo > 9;
                let lo = if borrow_lo { lo.wrapping_add(10) } else { lo };
                let hi_a = a >> 4;
                let hi_m = m >> 4;
                let hi = hi_a.wrapping_sub(hi_m).wrapping_sub(if borrow_lo { 1 } else { 0 });
                let borrow_hi = hi > 9;
                let hi = if borrow_hi { hi.wrapping_add(10) } else { hi };
                cpu.set_flag(flags::C, !borrow_hi);
                cpu.a = ((hi << 4) | (lo & 0x0F)) as u8;
                cpu.set_nz(cpu.a);
                return if op.page_cross { 1 } else { 0 };
            }

            // SBC binaire = ADC avec complément de m
            let result = a.wrapping_add(!m & 0xFF).wrapping_add(c);
            cpu.set_flag(flags::C, result > 0xFF);
            cpu.set_flag(flags::V, (a ^ m) & (a ^ result) & 0x80 != 0);
            cpu.a = result as u8;
            cpu.set_nz(cpu.a);
            if op.page_cross { 1 } else { 0 }
        }

        // ── AND ──────────────────────────────────────────────────────────
        0x29 | 0x25 | 0x35 | 0x2D | 0x3D | 0x39 | 0x21 | 0x31 => {
            cpu.a &= op.value;
            cpu.set_nz(cpu.a);
            if op.page_cross { 1 } else { 0 }
        }

        // ── ORA ──────────────────────────────────────────────────────────
        0x09 | 0x05 | 0x15 | 0x0D | 0x1D | 0x19 | 0x01 | 0x11 => {
            cpu.a |= op.value;
            cpu.set_nz(cpu.a);
            if op.page_cross { 1 } else { 0 }
        }

        // ── EOR ──────────────────────────────────────────────────────────
        0x49 | 0x45 | 0x55 | 0x4D | 0x5D | 0x59 | 0x41 | 0x51 => {
            cpu.a ^= op.value;
            cpu.set_nz(cpu.a);
            if op.page_cross { 1 } else { 0 }
        }

        // ── BIT ──────────────────────────────────────────────────────────
        0x24 | 0x2C => {
            let v = op.value;
            cpu.set_flag(flags::Z, cpu.a & v == 0);
            cpu.set_flag(flags::N, v & 0x80 != 0);
            cpu.set_flag(flags::V, v & 0x40 != 0);
            0
        }

        // ── ASL ──────────────────────────────────────────────────────────
        0x0A => {
            cpu.set_flag(flags::C, cpu.a & 0x80 != 0);
            cpu.a <<= 1;
            cpu.set_nz(cpu.a);
            0
        }
        0x06 | 0x16 | 0x0E | 0x1E => {
            let v = op.value;
            cpu.set_flag(flags::C, v & 0x80 != 0);
            let result = v << 1;
            mem.write(op.addr, result);
            cpu.set_nz(result);
            0
        }

        // ── LSR ──────────────────────────────────────────────────────────
        0x4A => {
            cpu.set_flag(flags::C, cpu.a & 0x01 != 0);
            cpu.a >>= 1;
            cpu.set_nz(cpu.a);
            0
        }
        0x46 | 0x56 | 0x4E | 0x5E => {
            let v = op.value;
            cpu.set_flag(flags::C, v & 0x01 != 0);
            let result = v >> 1;
            mem.write(op.addr, result);
            cpu.set_nz(result);
            0
        }

        // ── ROL ──────────────────────────────────────────────────────────
        0x2A => {
            let old_c = if cpu.get_flag(flags::C) { 1u8 } else { 0 };
            cpu.set_flag(flags::C, cpu.a & 0x80 != 0);
            cpu.a = (cpu.a << 1) | old_c;
            cpu.set_nz(cpu.a);
            0
        }
        0x26 | 0x36 | 0x2E | 0x3E => {
            let old_c = if cpu.get_flag(flags::C) { 1u8 } else { 0 };
            let v = op.value;
            cpu.set_flag(flags::C, v & 0x80 != 0);
            let result = (v << 1) | old_c;
            mem.write(op.addr, result);
            cpu.set_nz(result);
            0
        }

        // ── ROR ──────────────────────────────────────────────────────────
        0x6A => {
            let old_c = if cpu.get_flag(flags::C) { 0x80u8 } else { 0 };
            cpu.set_flag(flags::C, cpu.a & 0x01 != 0);
            cpu.a = (cpu.a >> 1) | old_c;
            cpu.set_nz(cpu.a);
            0
        }
        0x66 | 0x76 | 0x6E | 0x7E => {
            let old_c = if cpu.get_flag(flags::C) { 0x80u8 } else { 0 };
            let v = op.value;
            cpu.set_flag(flags::C, v & 0x01 != 0);
            let result = (v >> 1) | old_c;
            mem.write(op.addr, result);
            cpu.set_nz(result);
            0
        }

        // ── INC ──────────────────────────────────────────────────────────
        0xE6 | 0xF6 | 0xEE | 0xFE => {
            let result = op.value.wrapping_add(1);
            mem.write(op.addr, result);
            cpu.set_nz(result);
            0
        }

        // ── DEC ──────────────────────────────────────────────────────────
        0xC6 | 0xD6 | 0xCE | 0xDE => {
            let result = op.value.wrapping_sub(1);
            mem.write(op.addr, result);
            cpu.set_nz(result);
            0
        }

        // ── INX / INY / DEX / DEY ────────────────────────────────────────
        0xE8 => { cpu.x = cpu.x.wrapping_add(1); cpu.set_nz(cpu.x); 0 }
        0xC8 => { cpu.y = cpu.y.wrapping_add(1); cpu.set_nz(cpu.y); 0 }
        0xCA => { cpu.x = cpu.x.wrapping_sub(1); cpu.set_nz(cpu.x); 0 }
        0x88 => { cpu.y = cpu.y.wrapping_sub(1); cpu.set_nz(cpu.y); 0 }

        // ── CMP ──────────────────────────────────────────────────────────
        0xC9 | 0xC5 | 0xD5 | 0xCD | 0xDD | 0xD9 | 0xC1 | 0xD1 => {
            do_compare(cpu, cpu.a, op.value);
            if op.page_cross { 1 } else { 0 }
        }

        // ── CPX ──────────────────────────────────────────────────────────
        0xE0 | 0xE4 | 0xEC => { do_compare(cpu, cpu.x, op.value); 0 }

        // ── CPY ──────────────────────────────────────────────────────────
        0xC0 | 0xC4 | 0xCC => { do_compare(cpu, cpu.y, op.value); 0 }

        // ── Branches ─────────────────────────────────────────────────────
        0x90 => branch(cpu, !cpu.get_flag(flags::C), op), // BCC
        0xB0 => branch(cpu,  cpu.get_flag(flags::C), op), // BCS
        0xF0 => branch(cpu,  cpu.get_flag(flags::Z), op), // BEQ
        0x30 => branch(cpu,  cpu.get_flag(flags::N), op), // BMI
        0xD0 => branch(cpu, !cpu.get_flag(flags::Z), op), // BNE
        0x10 => branch(cpu, !cpu.get_flag(flags::N), op), // BPL
        0x50 => branch(cpu, !cpu.get_flag(flags::V), op), // BVC
        0x70 => branch(cpu,  cpu.get_flag(flags::V), op), // BVS

        // ── Flags ────────────────────────────────────────────────────────
        0x38 => { cpu.set_flag(flags::C, true);  0 } // SEC
        0x18 => { cpu.set_flag(flags::C, false); 0 } // CLC
        0xF8 => { cpu.set_flag(flags::D, true);  0 } // SED
        0xD8 => { cpu.set_flag(flags::D, false); 0 } // CLD
        0x78 => { cpu.set_flag(flags::I, true);  0 } // SEI
        0x58 => { cpu.set_flag(flags::I, false); 0 } // CLI
        0xB8 => { cpu.set_flag(flags::V, false); 0 } // CLV

        // ── JMP ──────────────────────────────────────────────────────────
        0x4C => { cpu.pc = op.addr; 0 }                // JMP abs
        0x6C => { cpu.pc = op.addr; 0 }                // JMP ind (bug déjà géré dans addressing)

        // ── JSR ──────────────────────────────────────────────────────────
        0x20 => {
            // Pousse PC-1 (l'adresse de la dernière instruction de l'appel)
            cpu.push16(mem, cpu.pc.wrapping_sub(1));
            cpu.pc = op.addr;
            0
        }

        // ── RTS ──────────────────────────────────────────────────────────
        0x60 => {
            let ret = cpu.pop16(mem);
            cpu.pc = ret.wrapping_add(1);
            0
        }

        // ── RTI ──────────────────────────────────────────────────────────
        0x40 => {
            cpu.p = (cpu.pop(mem) & !flags::B) | flags::U;
            cpu.pc = cpu.pop16(mem);
            0
        }

        // ── NOP ──────────────────────────────────────────────────────────
        0xEA => 0,

        // ── BRK ──────────────────────────────────────────────────────────
        0x00 => {
            // Dans l'IDE, BRK arrête le programme sans IRQ
            // (comportement simplifié pour les débutants)
            cpu.set_flag(flags::B, true);
            0
        }

        // Opcode illégal / non supporté : NOP silencieux
        _ => 0,
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

#[inline]
fn do_compare(cpu: &mut Cpu, reg: u8, val: u8) {
    let result = (reg as u16).wrapping_sub(val as u16);
    cpu.set_flag(flags::C, reg >= val);
    cpu.set_flag(flags::Z, reg == val);
    cpu.set_flag(flags::N, result & 0x80 != 0);
}

#[inline]
fn branch(cpu: &mut Cpu, condition: bool, op: Operand) -> u64 {
    if condition {
        cpu.pc = op.addr;
        1 + if op.page_cross { 1 } else { 0 }
    } else {
        0
    }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use crate::{Cpu, Memory};
    use crate::cpu::flags;

    /// Assemble du code minimal et l'exécute jusqu'à BRK.
    fn run(prog: &[u8]) -> (Cpu, Memory) {
        let mut cpu = Cpu::new();
        let mut mem = Memory::new();
        mem.write_slice(0x0600, prog);
        cpu.reset(&mut mem);
        cpu.pc = 0x0600;
        cpu.run(&mut mem, 10_000);
        (cpu, mem)
    }

    #[test]
    fn lda_imm() {
        // LDA #$42 ; BRK
        let (cpu, _) = run(&[0xA9, 0x42, 0x00]);
        assert_eq!(cpu.a, 0x42);
        assert!(!cpu.get_flag(flags::Z));
        assert!(!cpu.get_flag(flags::N));
    }

    #[test]
    fn lda_sets_zero_flag() {
        let (cpu, _) = run(&[0xA9, 0x00, 0x00]);
        assert_eq!(cpu.a, 0x00);
        assert!(cpu.get_flag(flags::Z));
    }

    #[test]
    fn lda_sets_negative_flag() {
        let (cpu, _) = run(&[0xA9, 0x80, 0x00]);
        assert!(cpu.get_flag(flags::N));
    }

    #[test]
    fn tax_txa() {
        // LDA #$55; TAX; LDA #$00; TXA; BRK
        let (cpu, _) = run(&[0xA9, 0x55, 0xAA, 0xA9, 0x00, 0x8A, 0x00]);
        assert_eq!(cpu.a, 0x55);
        assert_eq!(cpu.x, 0x55);
    }

    #[test]
    fn adc_no_carry() {
        // CLC; LDA #$10; ADC #$20; BRK
        let (cpu, _) = run(&[0x18, 0xA9, 0x10, 0x69, 0x20, 0x00]);
        assert_eq!(cpu.a, 0x30);
        assert!(!cpu.get_flag(flags::C));
        assert!(!cpu.get_flag(flags::V));
    }

    #[test]
    fn adc_carry_out() {
        // CLC; LDA #$FF; ADC #$01; BRK
        let (cpu, _) = run(&[0x18, 0xA9, 0xFF, 0x69, 0x01, 0x00]);
        assert_eq!(cpu.a, 0x00);
        assert!(cpu.get_flag(flags::C));
        assert!(cpu.get_flag(flags::Z));
    }

    #[test]
    fn adc_overflow_positive_to_negative() {
        // CLC; LDA #$7F; ADC #$01 → $80 — overflow car deux positifs → négatif
        let (cpu, _) = run(&[0x18, 0xA9, 0x7F, 0x69, 0x01, 0x00]);
        assert_eq!(cpu.a, 0x80);
        assert!(cpu.get_flag(flags::V));
        assert!(cpu.get_flag(flags::N));
    }

    #[test]
    fn sbc_no_borrow() {
        // SEC; LDA #$10; SBC #$05; BRK
        let (cpu, _) = run(&[0x38, 0xA9, 0x10, 0xE9, 0x05, 0x00]);
        assert_eq!(cpu.a, 0x0B);
        assert!(cpu.get_flag(flags::C));  // C=1 → pas d'emprunt
    }

    #[test]
    fn sbc_overflow() {
        // SEC; LDA #$80; SBC #$01 → $7F — overflow car négatif → positif
        let (cpu, _) = run(&[0x38, 0xA9, 0x80, 0xE9, 0x01, 0x00]);
        assert_eq!(cpu.a, 0x7F);
        assert!(cpu.get_flag(flags::V));
    }

    #[test]
    fn and_mask() {
        // LDA #$FF; AND #$0F; BRK
        let (cpu, _) = run(&[0xA9, 0xFF, 0x29, 0x0F, 0x00]);
        assert_eq!(cpu.a, 0x0F);
    }

    #[test]
    fn asl_accumulator() {
        // LDA #$41; ASL; BRK   — $41 = 0100_0001 → $82 = 1000_0010
        let (cpu, _) = run(&[0xA9, 0x41, 0x0A, 0x00]);
        assert_eq!(cpu.a, 0x82);
        assert!(!cpu.get_flag(flags::C)); // bit 7 de $41 = 0
    }

    #[test]
    fn asl_sets_carry() {
        // LDA #$80; ASL; BRK
        let (cpu, _) = run(&[0xA9, 0x80, 0x0A, 0x00]);
        assert_eq!(cpu.a, 0x00);
        assert!(cpu.get_flag(flags::C));
        assert!(cpu.get_flag(flags::Z));
    }

    #[test]
    fn rol_through_carry() {
        // SEC; LDA #$00; ROL; BRK   — Carry en bit 0
        let (cpu, _) = run(&[0x38, 0xA9, 0x00, 0x2A, 0x00]);
        assert_eq!(cpu.a, 0x01);
    }

    #[test]
    fn ror_through_carry() {
        // SEC; LDA #$00; ROR; BRK   — Carry en bit 7
        let (cpu, _) = run(&[0x38, 0xA9, 0x00, 0x6A, 0x00]);
        assert_eq!(cpu.a, 0x80);
        assert!(cpu.get_flag(flags::N));
    }

    #[test]
    fn inx_wraps() {
        // LDX #$FF; INX; BRK
        let (cpu, _) = run(&[0xA2, 0xFF, 0xE8, 0x00]);
        assert_eq!(cpu.x, 0x00);
        assert!(cpu.get_flag(flags::Z));
    }

    #[test]
    fn cmp_equal() {
        // LDA #$42; CMP #$42; BRK
        let (cpu, _) = run(&[0xA9, 0x42, 0xC9, 0x42, 0x00]);
        assert!(cpu.get_flag(flags::Z));
        assert!(cpu.get_flag(flags::C));
        assert!(!cpu.get_flag(flags::N));
    }

    #[test]
    fn cmp_less_than() {
        // LDA #$10; CMP #$20; BRK
        let (cpu, _) = run(&[0xA9, 0x10, 0xC9, 0x20, 0x00]);
        assert!(!cpu.get_flag(flags::C)); // A < M → C=0
        assert!(!cpu.get_flag(flags::Z));
    }

    #[test]
    fn beq_taken() {
        // LDA #$00; BEQ +2; LDA #$FF; BRK; BRK
        // Si BEQ pris : saute LDA #$FF, A reste $00
        let prog = [0xA9, 0x00, 0xF0, 0x02, 0xA9, 0xFF, 0x00, 0x00];
        let (cpu, _) = run(&prog);
        assert_eq!(cpu.a, 0x00);
    }

    #[test]
    fn bne_not_taken() {
        // LDA #$00; BNE +2; LDA #$55; BRK
        // Z=1 → BNE non pris → LDA #$55 exécuté
        let prog = [0xA9, 0x00, 0xD0, 0x02, 0xA9, 0x55, 0x00];
        let (cpu, _) = run(&prog);
        assert_eq!(cpu.a, 0x55);
    }

    #[test]
    fn jsr_rts() {
        // Programme à $0600 :
        //   JSR $0607   (3 octets)  → [0x20, 0x07, 0x06]
        //   LDA #$BB    (2 octets)  → [0xA9, 0xBB]
        //   BRK         (1 octet)   → [0x00]
        // Sous-routine à $0607 :
        //   LDA #$AA                → [0xA9, 0xAA]
        //   RTS                     → [0x60]
        let prog = [
            0x20, 0x07, 0x06, // JSR $0607
            0xA9, 0xBB,        // LDA #$BB
            0x00,              // BRK
            0x00,              // padding
            0xA9, 0xAA,        // LDA #$AA (sous-routine)
            0x60,              // RTS
        ];
        let (cpu, _) = run(&prog);
        // Après JSR : A=$AA. Après retour et LDA #$BB : A=$BB.
        assert_eq!(cpu.a, 0xBB);
    }

    #[test]
    fn pha_pla() {
        // LDA #$42; PHA; LDA #$00; PLA; BRK
        let (cpu, _) = run(&[0xA9, 0x42, 0x48, 0xA9, 0x00, 0x68, 0x00]);
        assert_eq!(cpu.a, 0x42);
    }

    #[test]
    fn bit_sets_flags() {
        // LDA #$C0; BIT $10; BRK  avec mem[$10] = $FF
        // Z = (A & M) == 0 → ($C0 & $FF = $C0) ≠ 0 → Z=0
        // N = bit 7 de M = 1
        // V = bit 6 de M = 1
        let mut cpu = Cpu::new();
        let mut mem = Memory::new();
        let prog = [0xA9, 0xC0, 0x24, 0x10, 0x00]; // BIT zp
        mem.write_slice(0x0600, &prog);
        mem.write_raw(0x0010, 0xFF);
        cpu.pc = 0x0600;
        cpu.run(&mut mem, 100);
        assert!(!cpu.get_flag(flags::Z));
        assert!(cpu.get_flag(flags::N));
        assert!(cpu.get_flag(flags::V));
    }

    #[test]
    fn sta_abs() {
        // LDA #$99; STA $0300; BRK
        let prog = [0xA9, 0x99, 0x8D, 0x00, 0x03, 0x00];
        let (_, mem) = run(&prog);
        assert_eq!(mem.peek(0x0300), 0x99);
    }

    #[test]
    fn inc_dec_memory() {
        // INC $10 ; DEC $10 ; BRK  avec mem[$10] = $05
        let mut cpu = Cpu::new();
        let mut mem = Memory::new();
        let prog = [0xE6, 0x10, 0xC6, 0x10, 0x00];
        mem.write_slice(0x0600, &prog);
        mem.write_raw(0x0010, 0x05);
        cpu.pc = 0x0600;
        cpu.run(&mut mem, 100);
        assert_eq!(mem.peek(0x0010), 0x05); // +1 -1 = retour à 5
    }

    #[test]
    fn stack_pointer_wraps() {
        // Pousse 256 fois — SP doit enrouler
        let mut cpu = Cpu::new();
        let mut mem = Memory::new();
        cpu.pc = 0x0600;
        let sp_start = cpu.sp;
        for _ in 0..256 {
            cpu.push(&mut mem, 0xAA);
        }
        // SP doit être revenu à sa valeur initiale
        assert_eq!(cpu.sp, sp_start);
    }

    #[test]
    fn loop_countdown() {
        // LDX #$05; DEX; BNE -2; BRK
        // BNE -2 → l'offset depuis PC+2 doit ramener à DEX
        // DEX est à $0601, l'instruction BNE est à $0602, PC après BNE = $0604
        // On veut aller à $0601 : offset = $0601 - $0604 = -3 = $FD
        let prog = [
            0xA2, 0x05, // LDX #$05  @$0600
            0xCA,       // DEX       @$0602
            0xD0, 0xFD, // BNE $0602 @$0603
            0x00,       // BRK       @$0605
        ];
        let (cpu, _) = run(&prog);
        assert_eq!(cpu.x, 0x00);
        assert!(cpu.get_flag(flags::Z));
    }
}
