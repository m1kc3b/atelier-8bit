// chuck-core/src/wasm_api.rs
//
// Interface WebAssembly — exports vers JavaScript via wasm-bindgen.
// Implémente le protocole Chuck-8 complet :
//   - Assemblage + exécution CPU
//   - VBlank 60 Hz (déclenche NMI)
//   - Périphériques I/O (clavier, manette, souris)
//   - Accès VRAM zero-copy

use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

use crate::memory::Memory;
use crate::cpu::Cpu;
use crate::assembler::Assembler;

// ── Types sérialisés vers JS ──────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
pub struct JsAssembleResult {
    pub ok:            bool,
    pub error_msg:     String,
    pub error_line:    i32,
    pub bytes_written: usize,
    pub org:           u16,
}

#[derive(Serialize, Deserialize)]
pub struct JsCpuState {
    pub a: u8, pub x: u8, pub y: u8,
    pub pc: u16, pub sp: u8, pub p: u8,
    pub cycles:  f64,
    pub flag_n: bool, pub flag_v: bool, pub flag_b: bool,
    pub flag_d: bool, pub flag_i: bool, pub flag_z: bool, pub flag_c: bool,
}

#[derive(Serialize, Deserialize)]
pub struct JsRunResult {
    pub cycles: f64,
    pub halted: bool,
    pub state:  JsCpuState,
}

#[derive(Serialize, Deserialize)]
pub struct JsStepResult {
    pub cycles: f64,
    pub halted: bool,
    pub state:  JsCpuState,
    pub disasm: String,
}

#[derive(Serialize, Deserialize)]
pub struct JsVpuState {
    pub mode:     u8,   // 0=texte, 1=graphique
    pub cursor_x: u8,
    pub cursor_y: u8,
    pub ink:      u8,
    pub paper:    u8,
    pub scroll_x: u8,
    pub scroll_y: u8,
    pub border:   u8,
}

#[derive(Serialize, Deserialize)]
pub struct JsSpuVoice {
    pub freq:    u16,   // Hz (calculé depuis freq_lo/hi)
    pub vol:     u8,
    pub attack:  u8,
    pub decay:   u8,
    pub sustain: u8,
    pub release: u8,
    pub waveform: u8,
    pub gate:    bool,
}

#[derive(Serialize, Deserialize)]
pub struct JsSpuState {
    pub voices:     Vec<JsSpuVoice>,
    pub master_vol: u8,
}

// ── ChuckCore ─────────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub struct ChuckCore {
    cpu: Cpu,
    mem: Memory,
}

#[wasm_bindgen]
impl ChuckCore {

    // ── Construction ─────────────────────────────────────────────────────────

    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        #[cfg(feature = "console_error_panic_hook")]
        console_error_panic_hook::set_once();

        let mut mem = Memory::new();
        let mut cpu = Cpu::new();
        // Reset initial : PC → $E000 via vecteur RESET
        cpu.reset(&mut mem);

        Self { cpu, mem }
    }

    // ── Assemblage ────────────────────────────────────────────────────────────

    /// Assemble `source` et charge en mémoire à partir de `.org`.
    /// Remet le CPU et l'IoState à l'état initial.
    pub fn assemble(&mut self, source: &str) -> JsValue {
        // Réinitialise la RAM programme (garde la ROM et la VRAM)
        self.mem.ram[0xE000..0xF000].fill(0);

        // Réinitialise l'IoState pour partir d'un état propre
        // (évite que pending_nmi d'un Run précédent perturbe la validation)
        self.mem.io = crate::io::IoState::new();

        let result = Assembler::assemble(source, &mut self.mem);

        if result.ok {
            // Reset CPU avec le bon point d'entrée
            self.cpu.reset_registers();
            self.cpu.pc = result.org;
        }

        serde_wasm_bindgen::to_value(&JsAssembleResult {
            ok:            result.ok,
            error_msg:     result.error.as_ref().map_or(String::new(), |e| e.msg.clone()),
            error_line:    result.error.as_ref().map_or(-1, |e| e.line as i32),
            bytes_written: result.bytes_written,
            org:           result.org,
        }).unwrap()
    }

    // ── CPU ───────────────────────────────────────────────────────────────────

    /// Reset hardware complet.
    pub fn reset(&mut self) {
        self.mem.reset();
        self.cpu.reset(&mut self.mem);
    }

    /// Soft reset : préserve le code programme, remet CPU + RAM basse + IoState à zéro.
    /// C'est ce que fait le bouton Reset de l'IDE.
    pub fn soft_reset(&mut self) {
        self.mem.soft_reset();
        self.cpu.reset(&mut self.mem);  // relit $FFFC/$FFFD → PC = $E000
    }

    /// Exécute jusqu'à `max_cycles` cycles ou BRK.
    pub fn run(&mut self, max_cycles: f64) -> JsValue {
        let result = self.cpu.run(&mut self.mem, max_cycles as u64);
        serde_wasm_bindgen::to_value(&JsRunResult {
            cycles: result.cycles as f64,
            halted: result.halted,
            state:  to_js_state(&result.state),
        }).unwrap()
    }

    /// Exécute une seule instruction (mode debug pas-à-pas).
    pub fn step(&mut self) -> JsValue {
        let result = self.cpu.step(&mut self.mem);
        serde_wasm_bindgen::to_value(&JsStepResult {
            cycles: result.cycles as f64,
            halted: result.halted,
            state:  to_js_state(&result.state),
            disasm: result.disasm,
        }).unwrap()
    }

    /// Retourne l'état courant du CPU.
    pub fn get_state(&self) -> JsValue {
        serde_wasm_bindgen::to_value(&to_js_state(&self.cpu.state())).unwrap()
    }

    // ── VBlank (appelé par le JS à 60 Hz via requestAnimationFrame) ──────────

    /// Déclenche un VBlank : incrémente le frame counter, positionne
    /// VPU_STATUS.VBLANK et arme le NMI pour le prochain cpu.run().
    pub fn vblank_tick(&mut self) {
        self.mem.io.vblank_tick();
    }

    // ── Mémoire ───────────────────────────────────────────────────────────────

    /// Vue zero-copy sur les 64 Ko de RAM.
    /// ⚠️ Invalide si Rust réalloue — ne jamais stocker.
    /// Note : la zone I/O $D000–$DFFF reflète self.mem.ram[], pas IoState.
    /// Utiliser mem_peek() pour lire un registre I/O précis.
    pub fn memory_view(&self) -> js_sys::Uint8Array {
        unsafe { js_sys::Uint8Array::view(&self.mem.ram) }
    }

    /// Snapshot 64 Ko avec l'état I/O synchronisé dans la zone $D000–$DFFF.
    /// Utiliser pour la validation — plus lent que memory_view() mais correct.
    pub fn memory_snapshot(&self) -> js_sys::Uint8Array {
        let mut snap = self.mem.ram;
        // Synchronise les registres I/O courants dans le snapshot
        for addr in 0xD000u16..=0xD3FFu16 {
            snap[addr as usize] = self.mem.io.peek_register(addr);
        }
        js_sys::Uint8Array::from(&snap[..])
    }

    /// Lit un octet sans effet de bord.
    pub fn mem_peek(&self, addr: u16) -> u8 {
        self.mem.peek(addr)
    }

    /// Écrit un octet (usage debug/test — bypass I/O).
    pub fn mem_poke(&mut self, addr: u16, val: u8) {
        self.mem.write_raw(addr, val);
    }

    /// Plage VRAM modifiée depuis le dernier appel → [min, max] ou null.
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

    // ── Périphériques I/O ─────────────────────────────────────────────────────

    /// Clavier : ascii = char ASCII, raw = scancode, modifiers = Shift/Ctrl/Alt
    pub fn set_key(&mut self, ascii: u8, raw: u8, modifiers: u8) {
        self.mem.io.set_key(ascii, raw, modifiers);
    }

    /// Relâcher toutes les touches
    pub fn clear_key(&mut self) {
        self.mem.io.clear_key();
    }

    /// Manette : pad=0 (manette 1) ou pad=1 (manette 2)
    /// state = bitmask NES (bit=0 si enfoncé, logique inversée)
    /// Exemple : A enfoncé = state & 0x80 == 0
    pub fn set_pad(&mut self, pad: u8, state: u8) {
        self.mem.io.set_pad(pad, state);
    }

    /// Souris : x/y (0–127 en mode gfx, 0–31 en mode texte)
    /// btn : bit0=gauche bit1=droit (0=enfoncé)
    /// scroll : delta molette signé
    pub fn set_mouse(&mut self, x: u8, y: u8, btn: u8, scroll: i8) {
        self.mem.io.set_mouse(x, y, btn, scroll);
    }

    // ── État VPU ──────────────────────────────────────────────────────────────

    /// Retourne l'état courant du VPU (mode, curseur, couleurs, scroll).
    pub fn get_vpu_state(&self) -> JsValue {
        let vpu = &self.mem.io.vpu;
        use crate::io::VPU_CTRL_MODE;
        serde_wasm_bindgen::to_value(&JsVpuState {
            mode:     (vpu.ctrl & VPU_CTRL_MODE),
            cursor_x: vpu.cursor_x,
            cursor_y: vpu.cursor_y,
            ink:      vpu.ink,
            paper:    vpu.paper,
            scroll_x: vpu.scroll_x,
            scroll_y: vpu.scroll_y,
            border:   vpu.border,
        }).unwrap()
    }

    // ── État SPU (pour le moteur audio JS) ───────────────────────────────────

    /// Retourne l'état des 3 voix SPU pour que le JS génère le son.
    pub fn get_spu_state(&self) -> JsValue {
        let spu = &self.mem.io.spu;
        let voices: Vec<JsSpuVoice> = spu.voices.iter().map(|v| {
            // Calcule la fréquence Hz depuis les registres
            let period = ((v.freq_hi as u32) << 8) | (v.freq_lo as u32);
            let freq_hz = if period > 0 { 1_000_000u32 / (period + 1) } else { 0 };
            JsSpuVoice {
                freq:    freq_hz.min(0xFFFF) as u16,
                vol:     v.vol,
                attack:  v.attack,
                decay:   v.decay,
                sustain: v.sustain,
                release: v.release,
                waveform: v.ctrl & 0x0F,
                gate:    (v.ctrl & 0x80) != 0,
            }
        }).collect();

        serde_wasm_bindgen::to_value(&JsSpuState {
            voices,
            master_vol: spu.master_vol,
        }).unwrap()
    }

    // ── Infos frame ───────────────────────────────────────────────────────────

    /// Numéro de frame courant (incrémenté par vblank_tick).
    pub fn frame_count(&self) -> u32 {
        self.mem.io.frame_count as u32
    }

    /// Mode vidéo courant : 0=texte, 1=graphique.
    pub fn video_mode(&self) -> u8 {
        use crate::io::VPU_CTRL_MODE;
        self.mem.io.vpu.ctrl & VPU_CTRL_MODE
    }
}

// ── Helper ────────────────────────────────────────────────────────────────────

fn to_js_state(s: &crate::cpu::CpuState) -> JsCpuState {
    use crate::cpu::flags;
    JsCpuState {
        a: s.a, x: s.x, y: s.y,
        pc: s.pc, sp: s.sp, p: s.p,
        cycles:  s.cycles as f64,
        flag_n: s.flag(flags::N),
        flag_v: s.flag(flags::V),
        flag_b: s.flag(flags::B),
        flag_d: s.flag(flags::D),
        flag_i: s.flag(flags::I),
        flag_z: s.flag(flags::Z),
        flag_c: s.flag(flags::C),
    }
}