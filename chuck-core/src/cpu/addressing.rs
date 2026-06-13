// chuck-core/src/cpu/addressing.rs
//
// Résolution des adresses effectives pour les 13 modes d'adressage du 6502.
// Chaque fonction retourne l'adresse effective ET indique si un page-cross
// s'est produit (ce qui coûte un cycle supplémentaire).

use crate::memory::Memory;
use super::Cpu;
use super::opcodes::AddrMode;

/// Résultat du calcul d'adresse
#[derive(Debug, Clone, Copy)]
pub struct Operand {
    pub addr:      u16,
    pub value:     u8,
    pub page_cross: bool,
}

/// Calcule l'adresse effective et lit la valeur pour un mode donné.
/// Pour les modes Imp/Acc, retourne addr=0 / value=A.
pub fn resolve(cpu: &mut Cpu, mem: &mut Memory, mode: AddrMode) -> Operand {
    match mode {
        AddrMode::Imp => Operand { addr: 0, value: 0, page_cross: false },

        AddrMode::Acc => Operand { addr: 0, value: cpu.a, page_cross: false },

        AddrMode::Imm => {
            let addr = cpu.pc;
            cpu.pc = cpu.pc.wrapping_add(1);
            let value = mem.read(addr);
            Operand { addr, value, page_cross: false }
        }

        AddrMode::Zp => {
            let addr = mem.read(cpu.pc) as u16;
            cpu.pc = cpu.pc.wrapping_add(1);
            let value = mem.read(addr);
            Operand { addr, value, page_cross: false }
        }

        AddrMode::Zpx => {
            let base = mem.read(cpu.pc);
            cpu.pc = cpu.pc.wrapping_add(1);
            // Wrapping sur la zero page (pas de carry vers la page 1)
            let addr = base.wrapping_add(cpu.x) as u16;
            let value = mem.read(addr);
            Operand { addr, value, page_cross: false }
        }

        AddrMode::Zpy => {
            let base = mem.read(cpu.pc);
            cpu.pc = cpu.pc.wrapping_add(1);
            let addr = base.wrapping_add(cpu.y) as u16;
            let value = mem.read(addr);
            Operand { addr, value, page_cross: false }
        }

        AddrMode::Abs => {
            let lo   = mem.read(cpu.pc) as u16;
            let hi   = mem.read(cpu.pc.wrapping_add(1)) as u16;
            cpu.pc   = cpu.pc.wrapping_add(2);
            let addr = (hi << 8) | lo;
            let value = mem.read(addr);
            Operand { addr, value, page_cross: false }
        }

        AddrMode::Abx => {
            let lo   = mem.read(cpu.pc) as u16;
            let hi   = mem.read(cpu.pc.wrapping_add(1)) as u16;
            cpu.pc   = cpu.pc.wrapping_add(2);
            let base = (hi << 8) | lo;
            let addr = base.wrapping_add(cpu.x as u16);
            let page_cross = (base & 0xFF00) != (addr & 0xFF00);
            let value = mem.read(addr);
            Operand { addr, value, page_cross }
        }

        AddrMode::Aby => {
            let lo   = mem.read(cpu.pc) as u16;
            let hi   = mem.read(cpu.pc.wrapping_add(1)) as u16;
            cpu.pc   = cpu.pc.wrapping_add(2);
            let base = (hi << 8) | lo;
            let addr = base.wrapping_add(cpu.y as u16);
            let page_cross = (base & 0xFF00) != (addr & 0xFF00);
            let value = mem.read(addr);
            Operand { addr, value, page_cross }
        }

        AddrMode::Ind => {
            // Uniquement utilisé par JMP ($xxxx)
            let lo  = mem.read(cpu.pc) as u16;
            let hi  = mem.read(cpu.pc.wrapping_add(1)) as u16;
            cpu.pc  = cpu.pc.wrapping_add(2);
            let ptr = (hi << 8) | lo;
            // Bug hardware du 6502 : si ptr = $xxFF, hi vient de $xx00
            let addr = mem.read16_page_bug(ptr);
            Operand { addr, value: 0, page_cross: false }
        }

        AddrMode::Inx => {
            // ($zp,X) : lit le vecteur à (zp + X) en zero page
            let zp   = mem.read(cpu.pc);
            cpu.pc   = cpu.pc.wrapping_add(1);
            let ptr  = zp.wrapping_add(cpu.x) as u16;
            let lo   = mem.read(ptr) as u16;
            let hi   = mem.read((ptr.wrapping_add(1)) & 0x00FF) as u16;
            let addr = (hi << 8) | lo;
            let value = mem.read(addr);
            Operand { addr, value, page_cross: false }
        }

        AddrMode::Iny => {
            // ($zp),Y : lit le vecteur à $zp, ajoute Y
            let zp   = mem.read(cpu.pc) as u16;
            cpu.pc   = cpu.pc.wrapping_add(1);
            let lo   = mem.read(zp) as u16;
            let hi   = mem.read((zp.wrapping_add(1)) & 0x00FF) as u16;
            let base = (hi << 8) | lo;
            let addr = base.wrapping_add(cpu.y as u16);
            let page_cross = (base & 0xFF00) != (addr & 0xFF00);
            let value = mem.read(addr);
            Operand { addr, value, page_cross }
        }

        AddrMode::Rel => {
            // Offset signé relatif au PC suivant l'instruction
            let offset = mem.read(cpu.pc) as i8;
            cpu.pc = cpu.pc.wrapping_add(1);
            let target = cpu.pc.wrapping_add(offset as u16);
            let page_cross = (cpu.pc & 0xFF00) != (target & 0xFF00);
            Operand { addr: target, value: 0, page_cross }
        }

        AddrMode::Xxx => Operand { addr: 0, value: 0, page_cross: false },
    }
}

/// Formate l'opérande pour le désassembleur.
/// b1/b2 = octets après l'opcode, pc = adresse de l'instruction.
pub fn format_operand(mode: AddrMode, b1: u8, b2: u8, pc: u16) -> Option<String> {
    use AddrMode::*;
    match mode {
        Imp | Acc | Xxx => None,
        Imm  => Some(format!("#${:02X}", b1)),
        Zp   => Some(format!("${:02X}", b1)),
        Zpx  => Some(format!("${:02X},X", b1)),
        Zpy  => Some(format!("${:02X},Y", b1)),
        Abs  => Some(format!("${:04X}", u16::from_le_bytes([b1, b2]))),
        Abx  => Some(format!("${:04X},X", u16::from_le_bytes([b1, b2]))),
        Aby  => Some(format!("${:04X},Y", u16::from_le_bytes([b1, b2]))),
        Ind  => Some(format!("(${:04X})", u16::from_le_bytes([b1, b2]))),
        Inx  => Some(format!("(${:02X},X)", b1)),
        Iny  => Some(format!("(${:02X}),Y", b1)),
        Rel  => {
            // Calcule l'adresse absolue cible pour l'affichage
            let offset = b1 as i8;
            let target = pc.wrapping_add(2).wrapping_add(offset as u16);
            Some(format!("${:04X}", target))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cpu::Cpu;
    use crate::memory::Memory;

    fn cpu_at(pc: u16) -> Cpu {
        let mut c = Cpu::new();
        c.pc = pc;
        c
    }

    #[test]
    fn imm_reads_next_byte() {
        let mut cpu = cpu_at(0x0600);
        let mut mem = Memory::new();
        mem.write_raw(0x0600, 0x42);
        let op = resolve(&mut cpu, &mut mem, AddrMode::Imm);
        assert_eq!(op.value, 0x42);
        assert_eq!(cpu.pc, 0x0601);
    }

    #[test]
    fn zp_reads_zero_page() {
        let mut cpu = cpu_at(0x0600);
        let mut mem = Memory::new();
        mem.write_raw(0x0600, 0x10); // zp addr
        mem.write_raw(0x0010, 0xAB); // valeur
        let op = resolve(&mut cpu, &mut mem, AddrMode::Zp);
        assert_eq!(op.addr, 0x0010);
        assert_eq!(op.value, 0xAB);
    }

    #[test]
    fn zpx_wraps_at_page_boundary() {
        let mut cpu = cpu_at(0x0600);
        cpu.x = 0xFF;
        let mut mem = Memory::new();
        mem.write_raw(0x0600, 0x80); // base = $80
        mem.write_raw(0x007F, 0x55); // $80 + $FF = $17F → wrap → $7F
        let op = resolve(&mut cpu, &mut mem, AddrMode::Zpx);
        assert_eq!(op.addr, 0x007F);
        assert_eq!(op.value, 0x55);
    }

    #[test]
    fn abx_page_cross_detected() {
        let mut cpu = cpu_at(0x0600);
        cpu.x = 0x10;
        let mut mem = Memory::new();
        mem.write_raw(0x0600, 0xF5); // lo
        mem.write_raw(0x0601, 0x02); // hi → base = $02F5
        mem.write_raw(0x0305, 0x77); // $02F5 + $10 = $0305 (page cross !)
        let op = resolve(&mut cpu, &mut mem, AddrMode::Abx);
        assert_eq!(op.addr, 0x0305);
        assert_eq!(op.value, 0x77);
        assert!(op.page_cross);
    }

    #[test]
    fn ind_jmp_page_bug() {
        let mut cpu = cpu_at(0x0600);
        let mut mem = Memory::new();
        // JMP ($01FF)
        mem.write_raw(0x0600, 0xFF); // lo du vecteur
        mem.write_raw(0x0601, 0x01); // hi du vecteur → ptr = $01FF
        mem.write_raw(0x01FF, 0x40); // lo de l'adresse cible
        mem.write_raw(0x0200, 0x99); // ne doit PAS être lu
        mem.write_raw(0x0100, 0x80); // hi (bug hardware)
        let op = resolve(&mut cpu, &mut mem, AddrMode::Ind);
        assert_eq!(op.addr, 0x8040, "Bug JMP indirect : hi devrait venir de $0100");
    }

    #[test]
    fn inx_indirect() {
        // ($10,X) avec X=4 : lit vecteur à $14/$15
        let mut cpu = cpu_at(0x0600);
        cpu.x = 0x04;
        let mut mem = Memory::new();
        mem.write_raw(0x0600, 0x10); // zp = $10
        mem.write_raw(0x0014, 0x00); // lo vecteur
        mem.write_raw(0x0015, 0x03); // hi vecteur → $0300
        mem.write_raw(0x0300, 0xCC); // valeur
        let op = resolve(&mut cpu, &mut mem, AddrMode::Inx);
        assert_eq!(op.addr, 0x0300);
        assert_eq!(op.value, 0xCC);
    }

    #[test]
    fn iny_indirect() {
        // ($20),Y avec Y=5 : lit vecteur à $20/$21, ajoute Y
        let mut cpu = cpu_at(0x0600);
        cpu.y = 0x05;
        let mut mem = Memory::new();
        mem.write_raw(0x0600, 0x20); // zp = $20
        mem.write_raw(0x0020, 0x00); // lo vecteur
        mem.write_raw(0x0021, 0x02); // hi vecteur → $0200
        mem.write_raw(0x0205, 0xBB); // $0200 + 5 = $0205
        let op = resolve(&mut cpu, &mut mem, AddrMode::Iny);
        assert_eq!(op.addr, 0x0205);
        assert_eq!(op.value, 0xBB);
    }

    #[test]
    fn iny_page_cross() {
        let mut cpu = cpu_at(0x0600);
        cpu.y = 0x10;
        let mut mem = Memory::new();
        mem.write_raw(0x0600, 0x20);
        mem.write_raw(0x0020, 0xF5); // lo vecteur → base = $02F5
        mem.write_raw(0x0021, 0x02);
        mem.write_raw(0x0305, 0x11); // $02F5 + $10 = $0305
        let op = resolve(&mut cpu, &mut mem, AddrMode::Iny);
        assert!(op.page_cross);
        assert_eq!(op.addr, 0x0305);
    }

    #[test]
    fn rel_positive_offset() {
        let mut cpu = cpu_at(0x0600);
        let mut mem = Memory::new();
        mem.write_raw(0x0600, 0x05); // offset +5
        let op = resolve(&mut cpu, &mut mem, AddrMode::Rel);
        // PC après lecture = $0601, target = $0601 + 5 = $0606
        assert_eq!(op.addr, 0x0606);
    }

    #[test]
    fn rel_negative_offset() {
        let mut cpu = cpu_at(0x0610);
        let mut mem = Memory::new();
        mem.write_raw(0x0610, 0xFB); // -5 en i8
        let op = resolve(&mut cpu, &mut mem, AddrMode::Rel);
        // PC après lecture = $0611, target = $0611 - 5 = $060C
        assert_eq!(op.addr, 0x060C);
    }
}
