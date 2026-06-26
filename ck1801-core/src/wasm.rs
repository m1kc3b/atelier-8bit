// wasm.rs — Binding WebAssembly du cœur CK-1801 (feature `wasm`).
//
// Expose à l'IDE TypeScript et au harnais : chargement de programme, exécution
// pas-à-pas / par lots, accès registres & mémoire, injection d'entrées, snapshot
// d'état, lecture VRAM, drapeaux debug, et assemblage.
//
// Ce module n'est compilé que sous la feature `wasm` (toolchain wasm32 ≥ 1.77) ;
// le cœur natif n'en dépend pas.

use wasm_bindgen::prelude::*;

use crate::asm;
use crate::Machine;

/// Initialise le hook de panic (messages lisibles dans la console navigateur).
#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

/// Snapshot d'état exposé au JS (sérialisé en objet).
#[derive(serde::Serialize)]
pub struct StateSnapshot {
    pub r0: u8,
    pub r1: u8,
    pub r2: u8,
    pub ix: u16,
    pub sp: u8,
    pub pc: u16,
    pub fl: u8,
    pub cycles: f64, // u64 → f64 pour JS (précis jusqu'à 2^53)
    pub halted: bool,
    pub irq_masked: bool,
    pub dbg_flags: u8,
    pub frame: u16,
    pub vpu_mode: u8,
    pub cursor_x: u8,
    pub cursor_y: u8,
}

/// Résultat d'assemblage exposé au JS.
#[derive(serde::Serialize)]
pub struct AsmResult {
    pub ok: bool,
    pub origin: u16,
    pub bytes: Vec<u8>,
    pub error: Option<String>,
    pub error_line: Option<usize>,
}

/// Façade WASM : une machine CK-1801 complète.
#[wasm_bindgen]
pub struct Chuck {
    machine: Machine,
}

#[wasm_bindgen]
impl Chuck {
    /// Crée une machine neuve.
    #[wasm_bindgen(constructor)]
    pub fn new() -> Chuck {
        Chuck {
            machine: Machine::new(),
        }
    }

    // ── Chargement & boot ────────────────────────────────────────────────────

    /// Charge un programme à l'adresse `addr` et pointe PC dessus.
    pub fn load(&mut self, addr: u16, code: &[u8]) {
        self.machine.load_at(addr, code);
    }

    /// Installe un programme en RAM sans déplacer PC (ex. data/vecteurs).
    pub fn write_bytes(&mut self, addr: u16, bytes: &[u8]) {
        self.machine.mem.load(addr, bytes);
    }

    /// Séquence de boot RESET (§14) : lit le vecteur et initialise l'état.
    pub fn reset(&mut self) {
        let Machine { cpu, mem } = &mut self.machine;
        cpu.reset(mem);
    }

    /// Définit la cadence VBlank (cycles/frame) — paramètre de notation.
    pub fn set_vblank_period(&mut self, period: u32) {
        self.machine.cpu.set_vblank_period(period as u64);
    }

    // ── Exécution ────────────────────────────────────────────────────────────

    /// Exécute une instruction. Retourne true si la machine est arrêtée (HLT).
    pub fn step(&mut self) -> bool {
        self.machine.cpu.step(&mut self.machine.mem)
    }

    /// Exécute jusqu'à `max_steps` instructions ou arrêt. Retourne le nombre exécuté.
    pub fn run(&mut self, max_steps: u32) -> u32 {
        self.machine.run_steps(max_steps as usize) as u32
    }

    // ── Accès registres ──────────────────────────────────────────────────────

    pub fn reg(&self, i: u8) -> u8 {
        *self.machine.cpu.r.get(i as usize).unwrap_or(&0)
    }
    pub fn set_reg(&mut self, i: u8, v: u8) {
        if let Some(slot) = self.machine.cpu.r.get_mut(i as usize) {
            *slot = v;
        }
    }
    pub fn pc(&self) -> u16 {
        self.machine.cpu.pc
    }
    pub fn set_pc(&mut self, pc: u16) {
        self.machine.cpu.pc = pc;
    }
    pub fn sp(&self) -> u8 {
        self.machine.cpu.sp
    }
    pub fn ix(&self) -> u16 {
        self.machine.cpu.ix
    }
    pub fn fl(&self) -> u8 {
        self.machine.cpu.fl
    }
    pub fn cycles(&self) -> f64 {
        self.machine.cpu.cycles as f64
    }
    pub fn halted(&self) -> bool {
        self.machine.cpu.halted
    }

    // ── Accès mémoire ────────────────────────────────────────────────────────

    /// Lecture côté programme (applique le routage device et les règles RO).
    pub fn read(&self, addr: u16) -> u8 {
        self.machine.mem.read(addr)
    }
    /// Écriture côté programme (règles RO appliquées).
    pub fn write(&mut self, addr: u16, val: u8) {
        self.machine.mem.write(addr, val);
    }
    /// Lecture RAM brute (bypass device/RO), pour inspection harnais.
    pub fn peek(&self, addr: u16) -> u8 {
        self.machine.mem.peek(addr)
    }

    /// Copie une plage mémoire vers un Vec (ex. snapshot RAM utilisateur).
    pub fn read_range(&self, addr: u16, len: u16) -> Vec<u8> {
        (0..len)
            .map(|i| self.machine.mem.read(addr.wrapping_add(i)))
            .collect()
    }

    /// Copie la VRAM ($4000–$5FFF, 8 Kio) pour rendu côté IDE.
    pub fn vram(&self) -> Vec<u8> {
        self.read_range(0x4000, 0x2000)
    }

    // ── Injection d'entrées (réservée au harnais / IDE) ──────────────────────

    pub fn set_key(&mut self, raw: u8, ascii: u8) {
        self.machine.mem.io.set_key(raw, ascii);
    }
    pub fn set_pads(&mut self, pad0: u8, pad1: u8) {
        self.machine.mem.io.set_pads(pad0, pad1);
    }
    pub fn set_mouse(&mut self, x: u8, y: u8, btn: u8) {
        self.machine.mem.io.set_mouse(x, y, btn);
    }

    // ── Drapeaux debug & RNG ─────────────────────────────────────────────────

    pub fn dbg_flags(&self) -> u8 {
        self.machine.mem.dbg_flags()
    }
    pub fn clear_dbg(&mut self) {
        self.machine.mem.clear_dbg();
    }
    /// Fixe le seed du RNG (reproductibilité des runs notés).
    pub fn set_rng_seed(&mut self, seed: u16) {
        self.machine.mem.io.lfsr = if seed == 0 { 0xACE1 } else { seed };
    }

    // ── Snapshot d'état (objet JS) ───────────────────────────────────────────

    /// Renvoie un objet JS décrivant l'état courant.
    pub fn snapshot(&self) -> Result<JsValue, JsValue> {
        let c = &self.machine.cpu;
        let io = &self.machine.mem.io;
        let snap = StateSnapshot {
            r0: c.r[0],
            r1: c.r[1],
            r2: c.r[2],
            ix: c.ix,
            sp: c.sp,
            pc: c.pc,
            fl: c.fl,
            cycles: c.cycles as f64,
            halted: c.halted,
            irq_masked: c.irq_masked,
            dbg_flags: self.machine.mem.dbg_flags(),
            frame: io.frame,
            vpu_mode: io.vpu_mode,
            cursor_x: io.cursor_x,
            cursor_y: io.cursor_y,
        };
        serde_wasm_bindgen::to_value(&snap).map_err(|e| JsValue::from_str(&e.to_string()))
    }
}

impl Default for Chuck {
    fn default() -> Self {
        Self::new()
    }
}

// ── Assembleur exposé ────────────────────────────────────────────────────────

/// Assemble un source CK-1801. Retourne un objet `{ ok, origin, bytes, error, error_line }`.
#[wasm_bindgen]
pub fn assemble(source: &str) -> Result<JsValue, JsValue> {
    let result = match asm::assemble(source) {
        Ok(out) => AsmResult {
            ok: true,
            origin: out.origin,
            bytes: out.bytes,
            error: None,
            error_line: None,
        },
        Err(e) => AsmResult {
            ok: false,
            origin: 0,
            bytes: Vec::new(),
            error: Some(e.msg),
            error_line: Some(e.line),
        },
    };
    serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Assemble et charge directement dans une machine (raccourci IDE).
#[wasm_bindgen]
pub fn assemble_into(chuck: &mut Chuck, source: &str) -> Result<JsValue, JsValue> {
    match asm::assemble(source) {
        Ok(out) => {
            chuck.machine.load_at(out.origin, &out.bytes);
            let result = AsmResult {
                ok: true,
                origin: out.origin,
                bytes: out.bytes,
                error: None,
                error_line: None,
            };
            serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
        }
        Err(e) => {
            let result = AsmResult {
                ok: false,
                origin: 0,
                bytes: Vec::new(),
                error: Some(e.msg),
                error_line: Some(e.line),
            };
            serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
        }
    }
}