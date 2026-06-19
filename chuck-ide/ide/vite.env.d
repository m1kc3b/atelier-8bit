/// <reference types="vite/client" />

// ── Types Chuck-8 WASM ───────────────────────────────────────────────────────

interface WasmCpuState {
  a: number; x: number; y: number;
  pc: number; sp: number; p: number;
  cycles: number;
  flag_n: boolean; flag_v: boolean; flag_b: boolean;
  flag_d: boolean; flag_i: boolean; flag_z: boolean; flag_c: boolean;
}

interface WasmVpuState {
  mode:     number;   // 0=texte 1=graphique
  cursor_x: number;
  cursor_y: number;
  ink:      number;   // 0–15
  paper:    number;
  scroll_x: number;
  scroll_y: number;
  border:   number;
}

interface WasmSpuVoice {
  freq:     number;   // Hz
  vol:      number;
  attack:   number;
  decay:    number;
  sustain:  number;
  release:  number;
  waveform: number;   // 1=carré50% 2=carré25% 3=triangle 4=sawtooth 8=bruit
  gate:     boolean;
}

interface WasmSpuState {
  voices:     WasmSpuVoice[];
  master_vol: number;
}

// Module généré par wasm-pack (disponible au runtime dans /public/)
declare module '/chuck_core.js' {
  export default function init(): Promise<void>;

  export class ChuckCore {
    constructor();

    // ── Assemblage ──────────────────────────────────────────────
    assemble(source: string): {
      ok: boolean; error_msg: string; error_line: number;
      bytes_written: number; org: number;
    };

    // ── CPU ─────────────────────────────────────────────────────
    reset(): void;
    run(maxCycles: number): {
      cycles: number; halted: boolean; state: WasmCpuState;
    };
    step(): {
      cycles: number; halted: boolean; disasm: string; state: WasmCpuState;
    };
    get_state(): WasmCpuState;

    // ── VBlank 60 Hz ────────────────────────────────────────────
    vblank_tick(): void;

    // ── Mémoire ─────────────────────────────────────────────────
    memory_view(): Uint8Array;
    mem_peek(addr: number): number;
    mem_poke(addr: number, val: number): void;
    take_dirty_pixels(): [number, number] | null;

    // ── Périphériques I/O ────────────────────────────────────────
    set_key(ascii: number, raw: number, modifiers: number): void;
    clear_key(): void;
    set_pad(pad: number, state: number): void;
    set_mouse(x: number, y: number, btn: number, scroll: number): void;

    // ── VPU / SPU ────────────────────────────────────────────────
    get_vpu_state(): WasmVpuState;
    get_spu_state(): WasmSpuState;
    video_mode(): number;
    frame_count(): number;
  }
}