// chuck-core/src/wasm_api.rs
//
// Point d'entrée WebAssembly. Exporte une interface simple vers JavaScript.
// La mémoire 6502 est partagée via un Uint8Array JS pointant sur le buffer Rust.

use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

use crate::memory::Memory;
use crate::cpu::Cpu;
use crate::assembler::Assembler;

// ── Types JS-sérialisables ────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
pub struct JsAssembleResult {
    pub ok:            bool,
    pub error_msg:     String,
    pub error_line:    i32,     // -1 si ok
    pub bytes_written: usize,
    pub org:           u16,
}

#[derive(Serialize, Deserialize)]
pub struct JsCpuState {
    pub a:      u8,
    pub x:      u8,
    pub y:      u8,
    pub pc:     u16,
    pub sp:     u8,
    pub p:      u8,
    pub cycles: f64, // f64 pour éviter les limitations u64 en JS
    // Flags décompactés pour faciliter l'accès JS
    pub flag_n: bool,
    pub flag_v: bool,
    pub flag_b: bool,
    pub flag_d: bool,
    pub flag_i: bool,
    pub flag_z: bool,
    pub flag_c: bool,
}

#[derive(Serialize, Deserialize)]
pub struct JsRunResult {
    pub cycles:  f64,
    pub halted:  bool,
    pub state:   JsCpuState,
}

#[derive(Serialize, Deserialize)]
pub struct JsStepResult {
    pub cycles:  f64,
    pub halted:  bool,
    pub state:   JsCpuState,
    pub disasm:  String,
}

// ── Machine d'état globale ────────────────────────────────────────────────────

#[wasm_bindgen]
pub struct ChuckCore {
    cpu: Cpu,
    mem: Memory,
}

#[wasm_bindgen]
impl ChuckCore {
    /// Crée une nouvelle instance CPU + mémoire.
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        // Redirige les panics Rust vers console.error JS
        #[cfg(feature = "console_error_panic_hook")]
        console_error_panic_hook::set_once();

        Self {
            cpu: Cpu::new(),
            mem: Memory::new(),
        }
    }

    /// Assemble le code source et charge le code machine en mémoire.
    /// Retourne un objet JSON.
    pub fn assemble(&mut self, source: &str) -> JsValue {
        let result = Assembler::assemble(source, &mut self.mem);
        let js = JsAssembleResult {
            ok:            result.ok,
            error_msg:     result.error.as_ref().map_or(String::new(), |e| e.msg.clone()),
            error_line:    result.error.as_ref().map_or(-1, |e| e.line as i32),
            bytes_written: result.bytes_written,
            org:           result.org,
        };
        // Reset le CPU à l'adresse d'origine si assemblage OK
        if result.ok {
            self.cpu.pc = result.org;
            self.cpu.reset_registers();
        }
        serde_wasm_bindgen::to_value(&js).unwrap()
    }

    /// Reset complet du CPU (lit le vecteur RESET ou utilise $0600).
    pub fn reset(&mut self) {
        self.cpu.reset(&mut self.mem);
    }

    /// Exécute jusqu'à `max_cycles` cycles ou jusqu'au BRK.
    pub fn run(&mut self, max_cycles: f64) -> JsValue {
        let result = self.cpu.run(&mut self.mem, max_cycles as u64);
        let js = JsRunResult {
            cycles: result.cycles as f64,
            halted: result.halted,
            state:  to_js_state(&result.state),
        };
        serde_wasm_bindgen::to_value(&js).unwrap()
    }

    /// Exécute une seule instruction (mode debug).
    pub fn step(&mut self) -> JsValue {
        let result = self.cpu.step(&mut self.mem);
        let js = JsStepResult {
            cycles: result.cycles as f64,
            halted: result.halted,
            state:  to_js_state(&result.state),
            disasm: result.disasm,
        };
        serde_wasm_bindgen::to_value(&js).unwrap()
    }

    /// Retourne l'état courant du CPU.
    pub fn get_state(&self) -> JsValue {
        let state = self.cpu.state();
        serde_wasm_bindgen::to_value(&to_js_state(&state)).unwrap()
    }

    /// Retourne une vue Uint8Array sur la RAM complète (zero-copy).
    /// ⚠️  Cette vue est invalidée si Rust réalloue la mémoire — ne pas stocker.
    pub fn memory_view(&self) -> js_sys::Uint8Array {
        unsafe {
            js_sys::Uint8Array::view(&self.mem.data)
        }
    }

    /// Lit un octet en mémoire (sans effet de bord $FE).
    pub fn mem_peek(&self, addr: u16) -> u8 {
        self.mem.peek(addr)
    }

    /// Écrit un octet en mémoire (usage debug/test).
    pub fn mem_poke(&mut self, addr: u16, val: u8) {
        self.mem.write_raw(addr, val);
    }

    /// Retourne la plage de pixels modifiés depuis le dernier appel (pour le rendu).
    /// Retourne null si rien n'a changé.
    pub fn take_dirty_pixels(&mut self) -> JsValue {
        match self.mem.take_dirty() {
            None => JsValue::NULL,
            Some((min, max)) => {
                let arr = js_sys::Array::new();
                arr.push(&JsValue::from(min));
                arr.push(&JsValue::from(max));
                arr.into()
            }
        }
    }

    /// Définit la valeur de la touche clavier ($FF).
    pub fn set_keyboard(&mut self, key: u8) {
        self.mem.write_raw(0x00FF, key);
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn to_js_state(state: &crate::cpu::CpuState) -> JsCpuState {
    use crate::cpu::flags;
    JsCpuState {
        a:      state.a,
        x:      state.x,
        y:      state.y,
        pc:     state.pc,
        sp:     state.sp,
        p:      state.p,
        cycles: state.cycles as f64,
        flag_n: state.flag(flags::N),
        flag_v: state.flag(flags::V),
        flag_b: state.flag(flags::B),
        flag_d: state.flag(flags::D),
        flag_i: state.flag(flags::I),
        flag_z: state.flag(flags::Z),
        flag_c: state.flag(flags::C),
    }
}
