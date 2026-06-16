// chuck-core/src/cpu/mod.rs

pub mod addressing;
pub mod execute;
pub mod opcodes;

use crate::memory::Memory;

// ── Vecteurs d'interruption ────────────────────────────────────────────────
pub const VEC_NMI:   u16 = 0xFFFA;
pub const VEC_RESET: u16 = 0xFFFC;
pub const VEC_IRQ:   u16 = 0xFFFE;

// ── Status Register bits ───────────────────────────────────────────────────
pub mod flags {
    pub const N: u8 = 0b1000_0000; // Negative
    pub const V: u8 = 0b0100_0000; // oVerflow
    pub const U: u8 = 0b0010_0000; // Unused (toujours 1)
    pub const B: u8 = 0b0001_0000; // Break
    pub const D: u8 = 0b0000_1000; // Decimal (BCD)
    pub const I: u8 = 0b0000_0100; // Interrupt disable
    pub const Z: u8 = 0b0000_0010; // Zero
    pub const C: u8 = 0b0000_0001; // Carry
}

// ── État du CPU exporté vers JS ────────────────────────────────────────────
#[derive(Clone, Debug, Default)]
pub struct CpuState {
    pub a:      u8,
    pub x:      u8,
    pub y:      u8,
    pub pc:     u16,
    pub sp:     u8,
    pub p:      u8,   // status register
    pub cycles: u64,
}

impl CpuState {
    pub fn flag(&self, bit: u8) -> bool { self.p & bit != 0 }
}

// ── Résultats d'exécution ──────────────────────────────────────────────────
#[derive(Debug)]
pub struct RunResult {
    pub cycles:  u64,
    pub halted:  bool,  // BRK rencontré
    pub state:   CpuState,
}

#[derive(Debug)]
pub struct StepResult {
    pub cycles:   u64,
    pub halted:   bool,
    pub state:    CpuState,
    pub disasm:   String,  // "LDA #$42" pour la console debug
}

// ── CPU principal ──────────────────────────────────────────────────────────
pub struct Cpu {
    pub a:      u8,
    pub x:      u8,
    pub y:      u8,
    pub pc:     u16,
    pub sp:     u8,
    pub p:      u8,
    pub cycles: u64,
}

impl Default for Cpu {
    fn default() -> Self { Self::new() }
}

impl Cpu {
    pub fn new() -> Self {
        Self { a: 0, x: 0, y: 0, pc: 0xE000, sp: 0xFD, p: flags::U | flags::I, cycles: 0 }
    }

    /// Reset hardware : lit le vecteur RESET ($FFFC/$FFFD) → $E000
    pub fn reset(&mut self, mem: &mut Memory) {
        let vec = mem.peek16(VEC_RESET);
        // La ROM place $E000 dans le vecteur RESET
        // Si le vecteur est 0 (mémoire non initialisée), on démarre à $E000 par défaut
        self.pc     = if vec != 0 { vec } else { 0xE000 };
        self.sp     = 0xFD;
        self.a      = 0;
        self.x      = 0;
        self.y      = 0;
        self.p      = flags::U | flags::I;
        self.cycles = 7; // le reset coûte 7 cycles
    }

    /// Déclenche une interruption NMI (VBlank).
    /// Sauvegarde PC et P sur la pile, saute vers le vecteur NMI ($FFFA/$FFFB).
    /// La NMI n'est pas masquable (ignore le flag I).
    pub fn trigger_nmi(&mut self, mem: &mut Memory) {
        // Sauvegarder PC et P sur la pile
        self.push16(mem, self.pc);
        let p = self.p & !flags::B | flags::U;
        self.push(mem, p);
        // Désactiver les IRQ pendant le handler
        self.set_flag(flags::I, true);
        // Lire le vecteur NMI
        let vec = mem.peek16(VEC_NMI);
        self.pc     = vec;
        self.cycles += 7;
    }

    /// Déclenche une interruption IRQ (timer).
    /// Ignorée si le flag I est positionné.
    pub fn trigger_irq(&mut self, mem: &mut Memory) {
        if self.get_flag(flags::I) { return; }
        self.push16(mem, self.pc);
        let p = self.p & !flags::B | flags::U;
        self.push(mem, p);
        self.set_flag(flags::I, true);
        let vec = mem.peek16(VEC_IRQ);
        self.pc     = vec;
        self.cycles += 7;
    }

    // ── Flags helpers ──────────────────────────────────────────────────────

    #[inline] pub fn get_flag(&self, bit: u8) -> bool { self.p & bit != 0 }

    #[inline]
    pub fn set_flag(&mut self, bit: u8, v: bool) {
        if v { self.p |= bit; } else { self.p &= !bit; }
    }

    /// Positionne N et Z en fonction d'une valeur
    #[inline]
    pub fn set_nz(&mut self, val: u8) {
        self.set_flag(flags::N, val & 0x80 != 0);
        self.set_flag(flags::Z, val == 0);
    }

    // ── Stack ──────────────────────────────────────────────────────────────

    #[inline]
    pub fn push(&mut self, mem: &mut Memory, val: u8) {
        mem.stack_write(self.sp, val);
        self.sp = self.sp.wrapping_sub(1);
    }

    #[inline]
    pub fn pop(&mut self, mem: &mut Memory) -> u8 {
        self.sp = self.sp.wrapping_add(1);
        mem.stack_read(self.sp)
    }

    pub fn push16(&mut self, mem: &mut Memory, val: u16) {
        self.push(mem, (val >> 8) as u8);
        self.push(mem, (val & 0xFF) as u8);
    }

    pub fn pop16(&mut self, mem: &mut Memory) -> u16 {
        let lo = self.pop(mem) as u16;
        let hi = self.pop(mem) as u16;
        (hi << 8) | lo
    }

    // ── État exportable ────────────────────────────────────────────────────

    /// Remet les registres à l'état initial sans toucher à la mémoire
    pub fn reset_registers(&mut self) {
        self.a      = 0;
        self.x      = 0;
        self.y      = 0;
        self.sp     = 0xFD;
        self.p      = flags::U | flags::I;
        self.cycles = 0;
    }

    pub fn state(&self) -> CpuState {
        CpuState {
            a:      self.a,
            x:      self.x,
            y:      self.y,
            pc:     self.pc,
            sp:     self.sp,
            p:      self.p | flags::U, // bit U toujours 1
            cycles: self.cycles,
        }
    }

    // ── Exécution ──────────────────────────────────────────────────────────

    /// Lance N cycles max. Retourne quand BRK, NMI, ou cycles épuisés.
    pub fn run(&mut self, mem: &mut Memory, max_cycles: u64) -> RunResult {
        let start  = self.cycles;
        let mut halted = false;

        while self.cycles - start < max_cycles {
            // Vérifier reset logiciel
            if mem.io.pending_reset {
                mem.io.pending_reset = false;
                self.reset(mem);
                break;
            }

            // Vérifier NMI (VBlank)
            if mem.io.pending_nmi {
                mem.io.clear_vblank();
                self.trigger_nmi(mem);
                // Après trigger_nmi, on continue l'exécution dans le handler
            }

            let halted_now = execute::step(self, mem);
            if halted_now {
                halted = true;
                break;
            }
        }
        RunResult { cycles: self.cycles - start, halted, state: self.state() }
    }

    /// Exécute une seule instruction.
    pub fn step(&mut self, mem: &mut Memory) -> StepResult {
        let before_pc = self.pc;
        let disasm    = self.disassemble_at(mem, before_pc);
        let halted    = execute::step(self, mem);
        StepResult { cycles: self.cycles, halted, state: self.state(), disasm }
    }

    /// Désassemble l'instruction à `addr` sans modifier l'état.
    pub fn disassemble_at(&self, mem: &Memory, addr: u16) -> String {
        use opcodes::OPCODE_TABLE;
        let byte = mem.peek(addr);
        let entry = &OPCODE_TABLE[byte as usize];
        if entry.mnem == "???" { return format!("??? (${:02X})", byte); }

        match entry.size {
            1 => entry.mnem.to_string(),
            2 => {
                let b1 = mem.peek(addr.wrapping_add(1));
                addressing::format_operand(entry.mode, b1, 0, addr)
                    .map_or_else(|| entry.mnem.to_string(),
                                 |op| format!("{} {}", entry.mnem, op))
            }
            _ => {
                let b1 = mem.peek(addr.wrapping_add(1));
                let b2 = mem.peek(addr.wrapping_add(2));
                addressing::format_operand(entry.mode, b1, b2, addr)
                    .map_or_else(|| entry.mnem.to_string(),
                                 |op| format!("{} {}", entry.mnem, op))
            }
        }
    }
}