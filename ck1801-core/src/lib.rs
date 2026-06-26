// ck1801-core — Cœur émulateur de l'ISA CK-1801 (Chuck-8).
//
// Implémentation normative de CK-1801_reference.md v2.0-FINAL.
// Cette étape : cœur CPU + ALU + mémoire + table d'opcodes générée + tests.
// (Assembleur, WASM, périphériques : étapes ultérieures.)

pub mod alu;
pub mod asm;
pub mod cpu;
pub mod isa;
pub mod memory;

pub use cpu::Cpu;
pub use isa::Reg;
pub use memory::Memory;

/// Machine complète : CPU + mémoire. Façade pratique pour le harnais de test.
pub struct Machine {
    pub cpu: Cpu,
    pub mem: Memory,
}

impl Default for Machine {
    fn default() -> Self {
        Self::new()
    }
}

impl Machine {
    pub fn new() -> Self {
        Machine {
            cpu: Cpu::new(),
            mem: Memory::new(),
        }
    }

    /// Charge un programme à l'adresse donnée et pointe PC dessus (bypass RESET).
    pub fn load_at(&mut self, addr: u16, code: &[u8]) {
        self.mem.load(addr, code);
        self.cpu.pc = addr;
    }

    /// Exécute jusqu'à `max_steps` instructions ou arrêt (HLT terminal).
    /// Retourne le nombre d'instructions exécutées.
    pub fn run_steps(&mut self, max_steps: usize) -> usize {
        let mut n = 0;
        while n < max_steps {
            if self.cpu.step(&mut self.mem) {
                n += 1;
                break;
            }
            n += 1;
        }
        n
    }
}
