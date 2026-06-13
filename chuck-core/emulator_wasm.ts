// chuck-ide/src/core/emulator.ts  — VERSION WASM
//
// Façade entre le Bus d'événements TS et le cœur Rust/WASM.
// Remplace entièrement l'ancien emulator.ts basé sur le CPU TypeScript.
//
// Usage :
//   import { Emulator } from './emulator.js';
//   const emu = await Emulator.create();

import { bus }    from './bus.js';
import type { ToolbarState } from './bus.js';

// Types retournés par le WASM (miroir de wasm_api.rs)
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
  cycles: number;
  flag_n: boolean; flag_v: boolean; flag_b: boolean;
  flag_d: boolean; flag_i: boolean; flag_z: boolean; flag_c: boolean;
}

interface JsRunResult  { cycles: number; halted: boolean; state: JsCpuState; }
interface JsStepResult { cycles: number; halted: boolean; state: JsCpuState; disasm: string; }

// Interface minimale du module WASM tel qu'exposé par wasm-bindgen
interface WasmModule {
  ChuckCore: new() => WasmCore;
}

interface WasmCore {
  assemble(source: string): JsAssembleResult;
  reset(): void;
  run(maxCycles: number): JsRunResult;
  step(): JsStepResult;
  get_state(): JsCpuState;
  memory_view(): Uint8Array;
  mem_peek(addr: number): number;
  mem_poke(addr: number, val: number): void;
  take_dirty_pixels(): [number, number] | null;
  set_keyboard(key: number): void;
}

const DISPLAY_START = 0x0200;
const DISPLAY_END   = 0x05FF;

export class Emulator {
  private core:      WasmCore;
  private _unsubs:   Array<() => void> = [];
  private _state:    ToolbarState = 'idle';
  private _rafId:    number | null = null;

  private constructor(core: WasmCore) {
    this.core = core;
  }

  // ── Chargement du WASM ────────────────────────────────────────────────────

  static async create(): Promise<Emulator> {
    // Charge le module WASM depuis public/
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
    const sub = <K extends keyof Parameters<typeof bus.on>[0]>(
      ev: K, fn: any
    ) => {
      const unsub = bus.on(ev as any, fn);
      this._unsubs.push(unsub);
    };

    sub('chuck:assemble',    ({ source }: { source: string }) => this._assemble(source));
    sub('chuck:run',         ()                               => this._run());
    sub('chuck:stop',        ()                               => this._stop());
    sub('chuck:reset',       ()                               => this._reset());
    sub('chuck:step',        ()                               => this._step());
    sub('chuck:goto',        ({ address }: { address: number }) => this._goto(address));
    sub('chuck:validate',    ({ source }: { source: string }) => this._validate(source));

    sub('chuck:memory-read', ({ address, length }: { address: number; length: number }) => {
      const bytes = new Uint8Array(length);
      for (let i = 0; i < length; i++) {
        bytes[i] = this.core.mem_peek(address + i);
      }
      bus.emit('chuck:memory-data', { address, bytes });
    });

    // Touche clavier
    document.addEventListener('keydown', (e) => {
      this.core.set_keyboard(e.keyCode & 0xFF);
    });
  }

  // ── Assemblage ────────────────────────────────────────────────────────────

  private _assemble(source: string): void {
    const result: JsAssembleResult = this.core.assemble(source);

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
      text:  `✓ Assemblé — ${result.bytes_written} octet(s) à $${result.org.toString(16).toUpperCase().padStart(4,'0')}`,
      level: 'info',
    });

    // Envoyer l'état initial du CPU
    this._emitState(this.core.get_state());
    this._emitDirtyPixels();
  }

  // ── Exécution ─────────────────────────────────────────────────────────────

  private _run(): void {
    bus.emit('chuck:toolbar-state', { state: 'running' });
    bus.emit('chuck:log', { text: '▶ Exécution…', level: 'info' });

    // Exécution par tranches pour ne pas bloquer l'UI
    const SLICE_CYCLES = 100_000;

    const tick = () => {
      const result: JsRunResult = this.core.run(SLICE_CYCLES);
      this._emitState(result.state);
      this._emitDirtyPixels();

      if (result.halted) {
        bus.emit('chuck:cpu-halted', result.state as any);
        bus.emit('chuck:log', {
          text:  `■ Arrêt — ${result.cycles} cycle(s)`,
          level: 'info',
        });
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
    this.core.reset();
    this._emitState(this.core.get_state());
    bus.emit('chuck:cpu-reset', this.core.get_state() as any);
    bus.emit('chuck:log', { text: '↺ CPU réinitialisé', level: 'info' });
    this._emitDirtyPixels();
  }

  private _step(): void {
    const result: JsStepResult = this.core.step();
    const pcHex = result.state.pc.toString(16).toUpperCase().padStart(4, '0');
    const prevPc = (result.state.pc - 1); // approximatif pour le log
    bus.emit('chuck:log', {
      text:  `→ Step — PC=$${prevPc.toString(16).toUpperCase().padStart(4,'0')}  ${result.disasm}`,
      level: 'info',
    });
    this._emitState(result.state);
    this._emitDirtyPixels();

    if (result.halted) {
      bus.emit('chuck:cpu-halted', result.state as any);
    }
  }

  private _goto(address: number): void {
    this.core.mem_poke(0, 0); // dummy — le goto n'existe pas en WASM direct
    // On met simplement le PC
    const state = this.core.get_state();
    (state as any).pc = address;
    bus.emit('chuck:log', {
      text:  `⤷ PC → $${address.toString(16).toUpperCase().padStart(4,'0')}`,
      level: 'info',
    });
  }

  // ── Validation des défis ──────────────────────────────────────────────────

  private _validate(source: string): void {
    // Sauvegarde l'état courant
    const savedMem = new Uint8Array(this.core.memory_view());

    // Assemble dans une instance temporaire... mais on n'a qu'une instance.
    // Solution : assemble + run dans le core courant, puis compare.
    const asmResult: JsAssembleResult = this.core.assemble(source);
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

    this.core.reset();
    const runResult: JsRunResult = this.core.run(100_000);
    this._emitDirtyPixels();

    bus.emit('chuck:validate-done', {
      state:   runResult.state,
      memory:  this.core.memory_view(),
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
    // Le composant chuck-display écoute chuck:memory-data pour rafraîchir
    const dirty = this.core.take_dirty_pixels();
    if (dirty) {
      const [min, max] = dirty;
      const len   = max - min + 1;
      const bytes = new Uint8Array(len);
      const mem   = this.core.memory_view();
      bytes.set(mem.subarray(min, max + 1));
      bus.emit('chuck:memory-data', { address: min, bytes });
    }
  }
}
