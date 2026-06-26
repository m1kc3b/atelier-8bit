// cpu.rs — Cœur d'exécution du CK-1801.
//
// Référence normative : §1 (registres), §2 (flags), §3–§12 (jeu d'instructions),
// §13 (cas limites déterministes), §14 (boot), §15 (interruptions).
//
// Invariant de sécurité (Annexe C) : AUCUN panic!/unreachable! sur entrée programme.
// Tout opcode, tout état mémoire, toute pile produit un comportement défini.

use crate::alu::{self, apply_flags};
use crate::isa::{fl, Mnemonic, Mode, OpInfo, Reg};
use crate::memory::Memory;

// Table plate générée par build.rs depuis data/opcodes.tsv (Annexe A).
include!(concat!(env!("OUT_DIR"), "/opcodes_gen.rs"));

pub const STACK_BASE: u16 = 0x0100;

// Vecteurs (§14). Ordre CK-1801 : RESET en premier (≠ 6502).
pub const VEC_RESET: u16 = 0xFFFA;
pub const VEC_VBLANK: u16 = 0xFFFC;
pub const VEC_TIMER: u16 = 0xFFFE;

/// Cadence VBlank : cycles par frame, fournie par le harnais (déterminisme HLT, §13).
/// Valeur par défaut neutre ; le harnais la fixe pour la notation.
pub const DEFAULT_VBLANK_PERIOD: u64 = 1_000;

#[derive(Clone, Debug)]
pub struct Cpu {
    pub r: [u8; 3], // R0,R1,R2 (symétriques)
    pub ix: u16,    // index unique
    pub sp: u8,     // pointeur de pile (page $01), descendant
    pub pc: u16,
    pub fl: u8, // flags (bits réservés toujours 0)
    pub cycles: u64,
    pub halted: bool,
    /// Masque IT : SEI pose le masque (IRQ timer ignorée), CLI le lève (§12/§15).
    pub irq_masked: bool,
    /// Cadence VBlank (cycles/frame) pour HLT et déclenchement VBLANK.
    pub vblank_period: u64,
    /// Cycle absolu du prochain front VBlank (ordonnancement déterministe §15.1).
    next_vblank_at: u64,
    /// Cycles accumulés vers l'expiration du timer (base TIMER_PERIOD×256, §15.1).
    timer_accum: u64,
}

impl Default for Cpu {
    fn default() -> Self {
        Self::new()
    }
}

impl Cpu {
    pub fn new() -> Self {
        Cpu {
            r: [0; 3],
            ix: 0,
            sp: 0xFF,
            pc: 0,
            fl: 0,
            cycles: 0,
            halted: false,
            irq_masked: false,
            vblank_period: DEFAULT_VBLANK_PERIOD,
            next_vblank_at: DEFAULT_VBLANK_PERIOD,
            timer_accum: 0,
        }
    }

    /// Définit la cadence VBlank (cycles/frame) et réaligne l'ordonnancement.
    /// API harnais : à appeler avant de lancer un programme noté.
    pub fn set_vblank_period(&mut self, period: u64) {
        let p = period.max(1);
        self.vblank_period = p;
        self.next_vblank_at = self.cycles.wrapping_add(p);
    }

    /// Séquence de boot RESET (§14).
    /// 1. SP←$FF ; FL←$00 ; R0=R1=R2←$00 ; IX←$0000.
    /// 2. VPU_MODE ($D000) ← 0 (mode texte).
    /// 3. PC ← mot 16 bits little-endian lu en $FFFA/$FFFB (vecteur RESET).
    pub fn reset(&mut self, mem: &mut Memory) {
        self.sp = 0xFF;
        self.fl = 0;
        self.r = [0; 3];
        self.ix = 0;
        mem.io.vpu_mode = 0; // §14.2 : mode texte au boot (registre device $D000)
        self.pc = mem.read16(VEC_RESET); // vecteur RESET little-endian
        self.cycles = 0;
        self.halted = false;
        self.irq_masked = false;
        self.next_vblank_at = self.vblank_period;
        self.timer_accum = 0;
    }

    #[inline]
    fn reg(&self, r: Reg) -> u8 {
        self.r[r as usize]
    }
    #[inline]
    fn set_reg(&mut self, r: Reg, v: u8) {
        self.r[r as usize] = v;
    }
    #[inline]
    fn get_c(&self) -> bool {
        self.fl & fl::C != 0
    }

    // ── Pile (§12, wrap + STKERR §13) ───────────────────────────────────────
    #[inline]
    fn push(&mut self, mem: &mut Memory, val: u8) {
        if self.sp == 0x00 {
            mem.raise_stkerr();
        } // débordement bas imminent → wrap
        mem.write(STACK_BASE + self.sp as u16, val);
        self.sp = self.sp.wrapping_sub(1);
    }
    #[inline]
    fn pop(&mut self, mem: &mut Memory) -> u8 {
        if self.sp == 0xFF {
            mem.raise_stkerr();
        } // sous-écoulement → wrap
        self.sp = self.sp.wrapping_add(1);
        mem.read(STACK_BASE + self.sp as u16)
    }
    #[inline]
    fn push16(&mut self, mem: &mut Memory, v: u16) {
        self.push(mem, (v >> 8) as u8); // hi d'abord → lo au sommet (little-endian au pop)
        self.push(mem, (v & 0xFF) as u8);
    }
    #[inline]
    fn pop16(&mut self, mem: &mut Memory) -> u16 {
        let lo = self.pop(mem) as u16;
        let hi = self.pop(mem) as u16;
        (hi << 8) | lo
    }

    // ── Récupération d'octets programme ─────────────────────────────────────
    #[inline]
    fn fetch8(&mut self, mem: &Memory) -> u8 {
        let b = mem.read(self.pc);
        self.pc = self.pc.wrapping_add(1);
        b
    }
    #[inline]
    fn fetch16(&mut self, mem: &Memory) -> u16 {
        let lo = self.fetch8(mem) as u16;
        let hi = self.fetch8(mem) as u16;
        (hi << 8) | lo
    }

    /// Exécute une instruction. Retourne `true` si le CPU est arrêté (HLT terminal).
    /// Ne panique jamais sur entrée programme (§13, Annexe C).
    pub fn step(&mut self, mem: &mut Memory) -> bool {
        if self.halted {
            return true;
        }

        let cycles_before = self.cycles;
        let opcode = self.fetch8(mem);
        let info: OpInfo = OPCODES[opcode as usize];

        // Slot réservé (§13) : NOP + drapeau ILL, 2 cycles.
        if matches!(info.mnem, Mnemonic::RESERVED) {
            mem.raise_ill();
            self.cycles += info.cycles as u64;
            self.service_interrupts(mem, cycles_before);
            return false;
        }

        self.exec(mem, opcode, &info);

        // Point de contrôle des interruptions, après l'instruction (§15.1).
        self.service_interrupts(mem, cycles_before);

        // Une demande de SYS_RESET ($D306) redémarre la machine à chaud.
        if mem.io.reset_requested {
            mem.io.reset_requested = false;
            self.reset(mem);
        }

        self.halted
    }

    /// Évalue et déclenche les interruptions horloge (§15.1), dans l'ordre
    /// VBLANK (non masquable) puis TIMER (masquable). `cycles_before` est le
    /// compteur de cycles avant l'instruction qui vient de s'exécuter.
    fn service_interrupts(&mut self, mem: &mut Memory, cycles_before: u64) {
        let elapsed = self.cycles.saturating_sub(cycles_before);

        // ── VBLANK ──────────────────────────────────────────────────────────
        // Un front survient à chaque frontière de vblank_period cycles. On gère
        // le cas où une instruction a franchi une (ou plusieurs) frontières.
        let period = self.vblank_period.max(1);
        let mut vblank_fired = false;
        while self.cycles >= self.next_vblank_at {
            // Frontière franchie : front VBlank.
            mem.io.tick_frame();
            mem.io.vpu_status |= 0x01; // bit0 = VBlank en cours
            self.next_vblank_at = self.next_vblank_at.wrapping_add(period);
            vblank_fired = true;
        }
        if vblank_fired {
            // Entrée VBLANK (non masquable) si handler installé.
            self.enter_interrupt(mem, VEC_VBLANK);
        }

        // ── TIMER ───────────────────────────────────────────────────────────
        if mem.io.timer_enabled() && mem.io.timer_period > 0 {
            let threshold = (mem.io.timer_period as u64) * 256;
            self.timer_accum = self.timer_accum.saturating_add(elapsed);
            if self.timer_accum >= threshold {
                self.timer_accum -= threshold;
                // Reflète la valeur courante du timer (décompte) à titre indicatif.
                mem.io.timer = mem.io.timer.wrapping_sub(1);
                if !self.irq_masked {
                    self.enter_interrupt(mem, VEC_TIMER);
                }
            }
        } else {
            // Timer désarmé : pas d'accumulation (déterminisme, période 0 = off).
            self.timer_accum = 0;
        }
    }

    fn exec(&mut self, mem: &mut Memory, opcode: u8, info: &OpInfo) {
        use Mnemonic::*;
        let mut cyc = info.cycles as u64;

        // Défense en profondeur : tout opcode défini dont un champ registre requis
        // serait invalide (ne devrait jamais arriver, la table est générée) est
        // traité comme NOP + ILL, garantissant l'absence de panic par construction
        // ET par vérification runtime (§13, Annexe C).
        if requires_dst(info.mnem) && info.dst_reg().is_none() {
            mem.raise_ill();
            self.cycles += cyc;
            return;
        }
        if requires_src(info.mnem) && info.src_reg().is_none() {
            mem.raise_ill();
            self.cycles += cyc;
            return;
        }

        match info.mnem {
            NOP => {}

            MOV => {
                if let (Some(s), Some(d)) = (info.src_reg(), info.dst_reg()) {
                    let v = self.reg(s);
                    self.set_reg(d, v); // flags inchangés
                }
            }
            XCH => {
                if let (Some(a), Some(b)) = (info.src_reg(), info.dst_reg()) {
                    let (va, vb) = (self.reg(a), self.reg(b));
                    self.set_reg(a, vb);
                    self.set_reg(b, va);
                }
            }

            LDI => {
                let imm = self.fetch8(mem);
                if let Some(d) = info.dst_reg() {
                    self.set_reg(d, imm);
                }
            }
            LD => {
                let addr = self.resolve_addr(mem, info.mode);
                let v = mem.read(addr);
                if let Some(d) = info.dst_reg() {
                    self.set_reg(d, v);
                }
            }
            ST => {
                let addr = self.resolve_addr(mem, info.mode);
                if let Some(s) = info.dst_reg() {
                    let v = self.reg(s);
                    mem.write(addr, v);
                }
            }

            LDX => {
                let v = self.fetch16(mem);
                self.ix = v;
            }
            LDXD => {
                let addr = self.fetch16(mem);
                self.ix = mem.read16(addr);
            }
            STXD => {
                let addr = self.fetch16(mem);
                mem.write16(addr, self.ix);
            }
            INX => {
                self.ix = self.ix.wrapping_add(1);
            } // aucun flag (§2.3)
            DEX => {
                self.ix = self.ix.wrapping_sub(1);
            } // aucun flag
            ADX => {
                let imm = self.fetch8(mem);
                self.ix = self.ix.wrapping_add(imm as u16);
            }

            PSH => {
                if let Some(r) = info.dst_reg() {
                    let v = self.reg(r);
                    self.push(mem, v);
                }
            }
            POP => {
                let v = self.pop(mem);
                if let Some(r) = info.dst_reg() {
                    self.set_reg(r, v);
                }
            }

            SYS => {
                let n = self.fetch8(mem);
                // §18 : 8 cycles (opcode SYS) déjà comptés via info.cycles ;
                // on ajoute le coût de la routine selon le barème normatif.
                let routine_cost = crate::sys::dispatch(self, mem, n);
                cyc += routine_cost;
            }
            SEI => {
                self.irq_masked = true;
            }
            CLI => {
                self.irq_masked = false;
            }
            HLT => {
                // Gèle jusqu'au prochain front VBlank puis reprend (§13).
                // Coût déterministe = cycles restants jusqu'à la prochaine frontière VBlank,
                // d'après la cadence fournie par le harnais. Ne termine PAS le run.
                let period = self.vblank_period.max(1);
                let into = self.cycles % period;
                let wait = period - into;
                cyc = wait; // remplace le coût de base (0)
                            // pas de self.halted = true : on reprend à l'instruction suivante
            }

            // ── ALU reg-reg & immédiat ──────────────────────────────────────
            ADD | ADC | SUB | SBC | AND | ORA | XOR | CMP => {
                self.exec_alu(mem, info);
            }

            INC | DEC | SHL | SHR | ROL | ROR => {
                if let Some(d) = info.dst_reg() {
                    let rd = self.reg(d);
                    let out = match info.mnem {
                        INC => alu::inc(rd),
                        DEC => alu::dec(rd),
                        SHL => alu::shl(rd),
                        SHR => alu::shr(rd),
                        ROL => alu::rol(rd, self.get_c()),
                        ROR => alu::ror(rd, self.get_c()),
                        // Famille fermée : seuls les 6 ci-dessus arrivent ici.
                        _ => {
                            mem.raise_ill();
                            self.cycles += cyc;
                            return;
                        }
                    };
                    self.set_reg(d, out.value);
                    apply_flags(&mut self.fl, info.flags.0, &out);
                }
            }

            // ── Contrôle de flux ────────────────────────────────────────────
            JMP => {
                let t = self.fetch16(mem);
                self.pc = t;
            }
            JSR => {
                let t = self.fetch16(mem);
                let ret = self.pc; // adresse de l'instruction suivante
                self.push16(mem, ret);
                self.push(mem, 0); // is_irq = 0 (appel ordinaire)
                self.pc = t;
            }
            RET => {
                let marker = self.pop(mem);
                let target = self.pop16(mem);
                if marker & 0x01 != 0 {
                    // Entrée d'interruption : restaurer FL (empilé avant le marqueur)
                    // et l'état du masque d'avant l'entrée (bit1 du marqueur).
                    let saved_fl = self.pop(mem);
                    self.fl = saved_fl & fl::VALID;
                    self.irq_masked = marker & 0x02 != 0;
                }
                self.pc = target;
            }
            BRA => {
                let off = self.fetch8(mem) as i8;
                self.branch(off);
                cyc = info.cyc_taken as u64;
            }
            BZ => cyc = self.cond_branch(mem, self.fl & fl::Z != 0, info),
            BNZ => cyc = self.cond_branch(mem, self.fl & fl::Z == 0, info),
            BC => cyc = self.cond_branch(mem, self.fl & fl::C != 0, info),
            BNC => cyc = self.cond_branch(mem, self.fl & fl::C == 0, info),
            BN => cyc = self.cond_branch(mem, self.fl & fl::N != 0, info),
            BV => cyc = self.cond_branch(mem, self.fl & fl::V != 0, info),

            // RESERVED est intercepté dans step() avant exec(). Si on arrive ici
            // malgré tout, comportement défini : NOP + ILL (jamais de panic).
            RESERVED => {
                mem.raise_ill();
            }
        }

        let _ = opcode;
        self.cycles += cyc;
    }

    /// ALU reg-reg ($4_-$B_) ET immédiat ($C_/$D_), distingués par le mode.
    fn exec_alu(&mut self, mem: &mut Memory, info: &OpInfo) {
        use Mnemonic::*;
        // On lit l'opérande AVANT tout garde, pour que PC avance correctement
        // même dans le cas (théoriquement impossible) d'un registre invalide.
        let operand = match info.mode {
            Mode::Imm => self.fetch8(mem), // OP #imm, rd
            Mode::RegPair => info.src_reg().map(|s| self.reg(s)).unwrap_or(0),
            _ => 0,
        };
        let d = match info.dst_reg() {
            Some(d) => d,
            None => {
                mem.raise_ill();
                return;
            } // PC déjà avancé si Imm
        };
        let rd = self.reg(d);
        let c = self.get_c();
        let out = match info.mnem {
            ADD => alu::add(rd, operand),
            ADC => alu::adc(rd, operand, c),
            SUB => alu::sub(rd, operand),
            SBC => alu::sbc(rd, operand, c),
            AND => alu::and(rd, operand),
            ORA => alu::ora(rd, operand),
            XOR => alu::xor(rd, operand),
            CMP => alu::cmp(rd, operand), // résultat jeté
            // Famille fermée : seuls les 8 ci-dessus sont routés vers exec_alu.
            _ => {
                mem.raise_ill();
                return;
            }
        };
        if !matches!(info.mnem, CMP) {
            self.set_reg(d, out.value);
        }
        apply_flags(&mut self.fl, info.flags.0, &out);
    }

    /// Résout l'adresse effective pour LD/ST selon le mode (§6).
    fn resolve_addr(&mut self, mem: &Memory, mode: Mode) -> u16 {
        match mode {
            Mode::Zp => self.fetch8(mem) as u16,
            Mode::Abs => self.fetch16(mem),
            Mode::IndIx => self.ix,
            Mode::IdxIx => {
                let off = self.fetch8(mem) as u16;
                self.ix.wrapping_add(off)
            }
            _ => 0, // inatteignable pour LD/ST
        }
    }

    /// Branchement relatif : déplacement signé relatif à l'instruction suivante (§11).
    #[inline]
    fn branch(&mut self, off: i8) {
        self.pc = (self.pc as i32 + off as i32) as u16;
    }

    /// Branchement conditionnel : consomme l'octet rel, applique si `cond`,
    /// renvoie le coût en cycles (non pris / pris, §11).
    #[inline]
    fn cond_branch(&mut self, mem: &Memory, cond: bool, info: &OpInfo) -> u64 {
        let off = self.fetch8(mem) as i8;
        if cond {
            self.branch(off);
            info.cyc_taken as u64
        } else {
            info.cycles as u64
        }
    }

    // ── Interruptions (§15) ─────────────────────────────────────────────────
    /// Entrée d'interruption : empile (FL, PC, marqueur) et saute au handler.
    /// Le marqueur encode is_irq (bit0) et l'état du masque AVANT l'entrée (bit1),
    /// pour que `RET` restaure à la fois FL et le masque (§15.1).
    pub fn enter_interrupt(&mut self, mem: &mut Memory, vector: u16) {
        let handler = mem.read16(vector);
        if handler == 0 {
            return; // handler non installé → pas d'IT
        }
        let marker = 0x01 | if self.irq_masked { 0x02 } else { 0x00 };
        self.push(mem, self.fl); // FL empilé en premier (dépilé en dernier au RET)
        self.push16(mem, self.pc);
        self.push(mem, marker); // bit0=is_irq, bit1=masque précédent
        self.pc = handler;
        self.irq_masked = true; // l'entrée pose le masque (§15.1)
    }

    /// Déclenche VBLANK si le handler est installé (non masquable).
    pub fn trigger_vblank(&mut self, mem: &mut Memory) {
        self.enter_interrupt(mem, VEC_VBLANK);
    }

    /// Déclenche TIMER si non masqué (SEI/CLI, §15).
    pub fn trigger_timer(&mut self, mem: &mut Memory) {
        if self.irq_masked {
            return;
        }
        self.enter_interrupt(mem, VEC_TIMER);
    }
}

// ── Helpers de classification (défense en profondeur §13) ───────────────────

/// L'instruction nécessite-t-elle un registre destination valide ?
fn requires_dst(m: Mnemonic) -> bool {
    use Mnemonic::*;
    matches!(
        m,
        MOV | XCH
            | LDI
            | LD
            | ST
            | PSH
            | POP
            | ADD
            | ADC
            | SUB
            | SBC
            | AND
            | ORA
            | XOR
            | CMP
            | INC
            | DEC
            | SHL
            | SHR
            | ROL
            | ROR
    )
}

/// L'instruction nécessite-t-elle un registre source valide ?
/// (Seules MOV/XCH et l'ALU reg-reg ont une vraie source ; les formes immédiates non.)
fn requires_src(m: Mnemonic) -> bool {
    use Mnemonic::*;
    matches!(m, MOV | XCH)
}