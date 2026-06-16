// chuck-ide/src/core/emulator.ts  — VERSION WASM v1.1
//
// Façade entre le Bus d'événements TS et le cœur Rust/WASM.
// Remplace entièrement l'ancien emulator.ts basé sur le CPU TypeScript.
//
// Usage :
//   import { Emulator } from './emulator.js';
//   const emu = await Emulator.create();

import { bus }    from './bus.js';
import type { ToolbarState } from './bus.js';

// Types retournés par le WASM (miroir de wasm_api.rs via serde_wasm_bindgen)
// Toutes les méthodes WASM retournent JsValue — on caste après désérialisation.

interface JsAssembleResult {
  ok:            boolean;
  error_msg:     string;
  error_line:    number;   // -1 si ok
  bytes_written: number;
  org:           number;
}

interface JsCpuState {
  a: number; x: number; y: number;
  pc: number; sp: number; p: number;
  cycles: number;           // f64 côté Rust
  flag_n: boolean; flag_v: boolean; flag_b: boolean;
  flag_d: boolean; flag_i: boolean; flag_z: boolean; flag_c: boolean;
}

interface JsRunResult  { cycles: number; halted: boolean; state: JsCpuState; }
interface JsStepResult { cycles: number; halted: boolean; state: JsCpuState; disasm: string; }

// Interface du module WASM tel qu'exposé par wasm-bindgen.
// Toutes les méthodes retournent `any` car wasm-bindgen sérialise via JsValue.
interface WasmModule {
  ChuckCore: new() => WasmCore;
}

interface WasmCore {
  // Assemblage
  assemble(source: string): any;          // → JsAssembleResult

  // CPU
  reset(): void;                          // hard reset (RAM + ROM + CPU + IoState)
  soft_reset(): void;                     // soft reset (préserve le code, remet RAM basse + CPU)
  run(maxCycles: number): any;            // → JsRunResult
  step(): any;                            // → JsStepResult
  get_state(): any;                       // → JsCpuState

  // VBlank — à appeler à 60 Hz via requestAnimationFrame
  vblank_tick(): void;

  // Mémoire
  memory_view(): Uint8Array;              // zero-copy — ne pas stocker
  memory_snapshot(): Uint8Array;          // snapshot avec I/O synchronisés (pour validation)
  mem_peek(addr: number): number;
  mem_poke(addr: number, val: number): void;

  // Pixels VRAM
  take_dirty_pixels(): any;              // → Array [min, max] | null

  // Périphériques I/O
  set_key(ascii: number, raw: number, modifiers: number): void;
  clear_key(): void;
  set_pad(pad: number, state: number): void;
  set_mouse(x: number, y: number, btn: number, scroll: number): void;
}

export class Emulator {
  private core:    WasmCore;
  private _unsubs: Array<() => void> = [];
  private _rafId:  number | null = null;

  private constructor(core: WasmCore) {
    this.core = core;
  }

  // ── Chargement du WASM ────────────────────────────────────────────────────

  static async create(): Promise<Emulator> {
    const wasmModule = await import('/chuck_core.js') as WasmModule;
    const core       = new wasmModule.ChuckCore();
    const emu        = new Emulator(core);
    emu._bindBus();
    return emu;
  }

  destroy(): void {
    this._unsubs.forEach(fn => fn());
    if (this._rafId !== null) cancelAnimationFrame(this._rafId);
  }

  // ── Liaison Bus ───────────────────────────────────────────────────────────

  private _bindBus(): void {
    const sub = (ev: any, fn: any) => {
      const unsub = bus.on(ev, fn);
      this._unsubs.push(unsub);
    };

    sub('chuck:assemble', ({ source }: { source: string }) => this._assemble(source));
    sub('chuck:run',      ()                               => this._run());
    sub('chuck:stop',     ()                               => this._stop());
    sub('chuck:reset',    ()                               => this._reset());
    sub('chuck:step',     ()                               => this._step());
    sub('chuck:validate', ({ source }: { source: string }) => this._validate(source));

    sub('chuck:memory-read', ({ address, length }: { address: number; length: number }) => {
      const bytes = new Uint8Array(length);
      for (let i = 0; i < length; i++) {
        bytes[i] = this.core.mem_peek(address + i);
      }
      bus.emit('chuck:memory-data', { address, bytes });
    });

    // Clavier — set_key(ascii, raw, modifiers) en v1.1
    document.addEventListener('keydown', (e) => {
      const ascii     = e.key.length === 1 ? e.key.charCodeAt(0) & 0xFF : 0;
      const raw       = e.keyCode & 0xFF;
      const modifiers = (e.shiftKey ? 0x01 : 0)
                      | (e.ctrlKey  ? 0x02 : 0)
                      | (e.altKey   ? 0x04 : 0);
      this.core.set_key(ascii, raw, modifiers);
    });

    document.addEventListener('keyup', () => {
      this.core.clear_key();
    });
  }

  // ── Assemblage ────────────────────────────────────────────────────────────

  private _assemble(source: string): void {
    const result = this.core.assemble(source) as JsAssembleResult;

    if (!result.ok) {
      bus.emit('chuck:assemble-err', {
        message: result.error_msg,
        line:    result.error_line,
      });
      bus.emit('chuck:log', {
        text:  `✗ Erreur ligne ${result.error_line} : ${result.error_msg}`,
        level: 'error',
      });
      return;
    }

    bus.emit('chuck:assembled', {
      bytesWritten: result.bytes_written,
      org:          result.org,
    });
    bus.emit('chuck:log', {
      text:  `✓ Assemblé — ${result.bytes_written} octet(s) à $${result.org.toString(16).toUpperCase().padStart(4, '0')}`,
      level: 'info',
    });

    this._emitState(this.core.get_state() as JsCpuState);
    this._emitDirtyPixels();
  }

  // ── Exécution ─────────────────────────────────────────────────────────────

  private _run(): void {
    bus.emit('chuck:toolbar-state', { state: 'running' });
    bus.emit('chuck:log', { text: '▶ Exécution…', level: 'info' });

    const SLICE_CYCLES = 100_000;

    const tick = () => {
      // Déclenche le VBlank à chaque frame (60 Hz)
      this.core.vblank_tick();

      const result = this.core.run(SLICE_CYCLES) as JsRunResult;
      this._emitState(result.state);
      this._emitDirtyPixels();

      if (result.halted) {
        bus.emit('chuck:cpu-halted', result.state as any);
        bus.emit('chuck:log', {
          text:  `■ Arrêt — ${result.cycles} cycle(s)`,
          level: 'info',
        });
        bus.emit('chuck:toolbar-state', { state: 'assembled' });
        this._rafId = null;
      } else {
        this._rafId = requestAnimationFrame(tick);
      }
    };

    this._rafId = requestAnimationFrame(tick);
  }

  private _stop(): void {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    bus.emit('chuck:toolbar-state', { state: 'assembled' });
    bus.emit('chuck:log', { text: '■ Arrêté', level: 'info' });
  }

  private _reset(): void {
    this._stop();
    // soft_reset : préserve le code assemblé, remet CPU + RAM basse + IoState
    this.core.soft_reset();
    const state = this.core.get_state() as JsCpuState;
    this._emitState(state);
    bus.emit('chuck:cpu-reset', state as any);
    bus.emit('chuck:log', { text: '↺ CPU réinitialisé', level: 'info' });
    this._emitDirtyPixels();
  }

  private _step(): void {
    const result = this.core.step() as JsStepResult;
    bus.emit('chuck:log', {
      text:  `→ Step — PC=$${result.state.pc.toString(16).toUpperCase().padStart(4, '0')}  ${result.disasm}`,
      level: 'info',
    });
    this._emitState(result.state);
    this._emitDirtyPixels();

    if (result.halted) {
      bus.emit('chuck:cpu-halted', result.state as any);
    }
  }

  // ── Validation des défis ──────────────────────────────────────────────────

  private _validate(source: string): void {
    const asmResult = this.core.assemble(source) as JsAssembleResult;
    if (!asmResult.ok) {
      bus.emit('chuck:challenge-failed', {
        result: {
          timeout:  false,
          failures: [{ message: `Erreur assemblage : ${asmResult.error_msg}` }],
          cycles:   0,
        },
      });
      return;
    }

    this.core.soft_reset();
    const runResult = this.core.run(100_000) as JsRunResult;
    this._emitDirtyPixels();

    bus.emit('chuck:validate-done', {
      state:   runResult.state,
      // memory_snapshot() synchronise les registres I/O dans la zone $D000–$D3FF
      memory:  this.core.memory_snapshot(),
      cycles:  runResult.cycles,
      halted:  runResult.halted,
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _emitState(state: JsCpuState): void {
    bus.emit('chuck:cpu-updated', {
      A: state.a, X: state.x, Y: state.y,
      PC: state.pc, SP: state.sp, P: state.p,
      flagN: state.flag_n, flagV: state.flag_v,
      flagB: state.flag_b, flagD: state.flag_d,
      flagI: state.flag_i, flagZ: state.flag_z,
      flagC: state.flag_c,
      cycles: state.cycles,
    } as any);
  }

  private _emitDirtyPixels(): void {
    const dirty = this.core.take_dirty_pixels();
    // take_dirty_pixels() retourne JsValue : soit null, soit un Array JS [min, max]
    if (dirty !== null && dirty !== undefined) {
      const min   = (dirty as number[])[0];
      const max   = (dirty as number[])[1];
      const len   = max - min + 1;
      const bytes = new Uint8Array(len);
      const mem   = this.core.memory_view();
      bytes.set(mem.subarray(min, max + 1));
      bus.emit('chuck:memory-data', { address: min, bytes });
    }
  }
}