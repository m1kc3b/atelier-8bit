/* ─────────────────────────────────────────────────────────────
   Chuck IDE — core/emulator.ts  (Chuck-8 Platform v1.0)
   Façade TS → WASM. Gère :
     - Assemblage + exécution CPU
     - VBlank 60 Hz → NMI + rendu écran
     - Clavier, manette, souris → registres I/O WASM
     - Dispatche les événements Bus
   ───────────────────────────────────────────────────────────── */

import { bus } from './bus.js';

// ── Types WASM ────────────────────────────────────────────────

interface WasmCpuState {
  a: number; x: number; y: number;
  pc: number; sp: number; p: number;
  cycles: number;
  flag_n: boolean; flag_v: boolean; flag_b: boolean;
  flag_d: boolean; flag_i: boolean; flag_z: boolean; flag_c: boolean;
}

interface WasmVpuState {
  mode: number; cursor_x: number; cursor_y: number;
  ink: number; paper: number; scroll_x: number; scroll_y: number;
  border: number;
}

interface WasmSpuVoice {
  freq: number; vol: number; waveform: number; gate: boolean;
  attack: number; decay: number; sustain: number; release: number;
}

interface WasmSpuState { voices: WasmSpuVoice[]; master_vol: number; }

interface ChuckCoreInstance {
  assemble(src: string): { ok: boolean; error_msg: string; error_line: number; bytes_written: number; org: number };
  reset(): void;
  run(maxCycles: number): { cycles: number; halted: boolean; state: WasmCpuState };
  step(): { cycles: number; halted: boolean; disasm: string; state: WasmCpuState };
  get_state(): WasmCpuState;
  vblank_tick(): void;
  memory_view(): Uint8Array;
  mem_peek(addr: number): number;
  mem_poke(addr: number, val: number): void;
  take_dirty_pixels(): [number, number] | null;
  set_key(ascii: number, raw: number, modifiers: number): void;
  clear_key(): void;
  set_pad(pad: number, state: number): void;
  set_mouse(x: number, y: number, btn: number, scroll: number): void;
  get_vpu_state(): WasmVpuState;
  get_spu_state(): WasmSpuState;
  video_mode(): number;
  frame_count(): number;
}

interface WasmModule {
  default(): Promise<void>;
  ChuckCore: new() => ChuckCoreInstance;
}

// ── Constantes ────────────────────────────────────────────────
const CYCLES_PER_FRAME = 16_667;  // ~1 MHz / 60 Hz
const hex4 = (n: number) => n.toString(16).padStart(4, '0').toUpperCase();
const hex2 = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();

function toBusState(s: WasmCpuState) {
  return { A: s.a, X: s.x, Y: s.y, PC: s.pc, SP: s.sp, P: s.p, cycles: s.cycles };
}

// ── Emulator ──────────────────────────────────────────────────

export class Emulator {
  private core!:    ChuckCoreInstance;
  private _unsubs:  Array<() => void> = [];
  private _rafId:   number | null = null;
  private _running: boolean = false;
  private _lastOrg: number = 0xE000;

  // ── Initialisation ───────────────────────────────────────────

  static async create(): Promise<Emulator> {
    const emu = new Emulator();
    await emu._loadWasm();
    emu._bindBus();
    emu._bindInput();
    return emu;
  }

  private async _loadWasm(): Promise<void> {
    // @ts-ignore — module généré par wasm-pack, disponible au runtime
    const mod = await import('../lib/chuck_core.js') as WasmModule;
    await mod.default();
    this.core = new mod.ChuckCore();

    bus.emit('chuck:log', {
      text:  'Chuck-8 v1.0 — Moteur Rust/WASM prêt. Point d\'entrée : $E000',
      level: 'dim',
    });
  }

  destroy(): void {
    this._unsubs.forEach(fn => fn());
    this._stopLoop();
  }

  // ── Liaison Bus ───────────────────────────────────────────────

  private _bindBus(): void {
    const sub = <K extends Parameters<typeof bus.on>[0]>(
      ev: K, fn: Parameters<typeof bus.on<K>>[1]
    ) => this._unsubs.push(bus.on(ev, fn));

    sub('chuck:assemble',    ({ source })  => this._assemble(source));
    sub('chuck:run',         ()            => this._run());
    sub('chuck:stop',        ()            => this._stop());
    sub('chuck:reset',       ()            => this._reset());
    sub('chuck:step',        ()            => this._step());
    sub('chuck:goto',        ({ address }) => this._goto(address));
    sub('chuck:hexdump',     ()            => this._hexdump());
    sub('chuck:disassemble', ()            => this._hexdump());
    sub('chuck:validate',    ({ source })  => this._doValidate(source));
    sub('chuck:memory-read', ({ address, length }) => this._memRead(address, length));
  }

  // ── Clavier, manette, souris ──────────────────────────────────

  private _bindInput(): void {
    // ── Clavier ──────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
      if (!this._running) return;
      // Éviter les raccourcis IDE (Ctrl+B, F5...)
      if (e.ctrlKey || e.metaKey || e.key === 'F5' || e.key === 'F10') return;

      const ascii = e.key.length === 1 ? e.key.charCodeAt(0) : 0;
      const raw   = this._keyToRaw(e.code);
      const mods  = (e.shiftKey ? 1 : 0) | (e.ctrlKey ? 2 : 0) | (e.altKey ? 4 : 0);
      this.core.set_key(ascii, raw, mods);
    });

    document.addEventListener('keyup', () => {
      if (this._running) this.core.clear_key();
    });

    // ── Souris (sur le canvas de chuck-display) ───────────────
    document.addEventListener('mousemove', (e) => {
      if (!this._running) return;
      const display = document.getElementById('modal-display');
      if (!display) return;
      const canvas = display.shadowRoot?.getElementById('screen') as HTMLCanvasElement | null;
      if (!canvas) return;
      const r  = canvas.getBoundingClientRect();
      const px = Math.floor(((e.clientX - r.left) / r.width)  * 128);
      const py = Math.floor(((e.clientY - r.top)  / r.height) * 128);
      if (px >= 0 && px < 128 && py >= 0 && py < 128) {
        const btn = (e.buttons & 1 ? 0 : 1) | (e.buttons & 2 ? 0 : 2);
        this.core.set_mouse(px, py, btn, 0);
      }
    });

    // ── Manette (clavier WASD + touches) ─────────────────────
    // Les touches sont mappées vers les bits de la manette NES
    // bit=0 si enfoncé (logique inversée)
    const padState = { p1: 0xFF };
    const PAD_MAP: Record<string, number> = {
      'KeyZ':       0b10000000, // A
      'KeyX':       0b01000000, // B
      'ShiftRight': 0b00100000, // Select
      'Enter':      0b00010000, // Start
      'ArrowRight': 0b00001000,
      'ArrowLeft':  0b00000100,
      'ArrowDown':  0b00000010,
      'ArrowUp':    0b00000001,
    };

    document.addEventListener('keydown', (e) => {
      if (!this._running) return;
      const mask = PAD_MAP[e.code];
      if (mask) {
        padState.p1 &= ~mask; // bit à 0 = enfoncé
        this.core.set_pad(0, padState.p1);
      }
    });

    document.addEventListener('keyup', (e) => {
      if (!this._running) return;
      const mask = PAD_MAP[e.code];
      if (mask) {
        padState.p1 |= mask; // bit à 1 = relâché
        this.core.set_pad(0, padState.p1);
      }
    });
  }

  private _keyToRaw(code: string): number {
    const MAP: Record<string, number> = {
      'ArrowUp':    0x80, 'ArrowDown':  0x81,
      'ArrowLeft':  0x82, 'ArrowRight': 0x83,
      'F1': 0x84, 'F2': 0x85, 'F3': 0x86, 'F4': 0x87,
      'Insert': 0x88, 'Delete': 0x89, 'Home': 0x8A, 'End': 0x8B,
    };
    return MAP[code] ?? 0;
  }

  // ── Boucle principale 60 Hz ───────────────────────────────────

  private _startLoop(): void {
    if (this._rafId !== null) return;

    const tick = () => {
      if (!this._running) { this._rafId = null; return; }

      // 1. VBlank : incrémente frame counter + arme NMI dans le WASM
      this.core.vblank_tick();

      // 2. Exécute ~1 frame de CPU (NMI + programme principal)
      const result = this.core.run(CYCLES_PER_FRAME);

      // 3. Rendu écran si VRAM a changé
      this._flushDisplay();

      // 4. Émettre état CPU (pour le panneau registres)
      bus.emit('chuck:cpu-updated', toBusState(result.state));

      // 5. Émettre mode vidéo courant
      const mode = this.core.video_mode();
      bus.emit('chuck:vpu-mode' as any, { mode });

      // 6. BRK → arrêter
      if (result.halted) {
        this._running = false;
        this._rafId = null;
        this._flushDisplay(true);   // force rendu final même sans dirty
        bus.emit('chuck:cpu-halted', toBusState(result.state));
        bus.emit('chuck:log', {
          text:  `● BRK — PC=$${hex4(result.state.pc)} — frame #${this.core.frame_count()}`,
          level: 'ok',
        });
        return;
      }

      this._rafId = requestAnimationFrame(tick);
    };

    this._rafId = requestAnimationFrame(tick);
  }

  private _stopLoop(): void {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  // ── Commandes ─────────────────────────────────────────────────

  private _assemble(source: string): void {
    this._stopLoop();
    const result = this.core.assemble(source);

    if (!result.ok) {
      bus.emit('chuck:assemble-err', { line: result.error_line, err: result.error_msg });
      bus.emit('chuck:log', {
        text:  `✗ Erreur L${result.error_line} : ${result.error_msg}`,
        level: 'err',
      });
      return;
    }

    this._lastOrg = result.org;

    bus.emit('chuck:assembled', { ok: true, bytes: result.bytes_written, buf: [] });
    bus.emit('chuck:cpu-updated', toBusState(this.core.get_state()));
    bus.emit('chuck:log', {
      text:  `✓ ${result.bytes_written} octets → $${hex4(result.org)}–$${hex4(result.org + result.bytes_written - 1)}`,
      level: 'ok',
    });

    // Rendu initial — force même si rien de dirty (VRAM peut être propre)
    this._flushDisplay(true);
    this._emitVpuState();
  }

  private _run(): void {
    if (!this.core) return;
    this._running = true;
    bus.emit('chuck:log', { text: '▶ Exécution (60 Hz, NMI actif)', level: 'info' });
    this._startLoop();
  }

  private _stop(): void {
    this._stopLoop();
    bus.emit('chuck:cpu-updated', toBusState(this.core.get_state()));
    bus.emit('chuck:log', { text: '■ Arrêté', level: 'info' });
  }

  private _reset(): void {
    this._stopLoop();
    this.core.reset();
    this._flushDisplay();
    bus.emit('chuck:cpu-reset', toBusState(this.core.get_state()));
    bus.emit('chuck:log', { text: '↺ RESET → $E000', level: 'info' });
    this._emitVpuState();
  }

  private _step(): void {
    const result = this.core.step();
    bus.emit('chuck:log', {
      text:  `→ $${hex4(result.state.pc)}  ${result.disasm}`,
      level: 'info',
    });
    bus.emit('chuck:cpu-updated', toBusState(result.state));
    this._flushDisplay(true);
    this._emitVpuState();
    if (result.halted) bus.emit('chuck:cpu-halted', toBusState(result.state));
  }

  private _goto(address: number): void {
    // Place $E000 dans le vecteur RESET et déclenche un soft reset
    this.core.mem_poke(0xFFFC, address & 0xFF);
    this.core.mem_poke(0xFFFD, (address >> 8) & 0xFF);
    this.core.reset();
    bus.emit('chuck:cpu-updated', toBusState(this.core.get_state()));
    bus.emit('chuck:log', { text: `⤷ PC → $${hex4(address)}`, level: 'info' });
  }

  private _hexdump(): void {
    const mem   = this.core.memory_view();
    const start = this._lastOrg;
    const len   = Math.min(64, 0xF000 - start);
    bus.emit('chuck:log', { text: `── Hexdump $${hex4(start)} ──`, level: 'hex' });
    for (let i = 0; i < len; i += 16) {
      const row = Array.from(mem.subarray(start + i, start + i + 16))
        .map(b => hex2(b)).join(' ');
      bus.emit('chuck:log', { text: `$${hex4(start + i)}  ${row}`, level: 'hex' });
    }
  }

  private _memRead(address: number, length: number): void {
    const mem   = this.core.memory_view();
    const bytes = new Uint8Array(mem.subarray(address, address + length));
    bus.emit('chuck:memory-data', { address, bytes });
  }

  // ── Validation (headless) ─────────────────────────────────────

  private _doValidate(source: string): void {
    // Lance via chuck:validate-done pour que ChallengeManager puisse vérifier
    const r = this.runHeadless(source, 200_000);
    bus.emit('chuck:validate-done' as any, {
      ok: r.ok, errMsg: r.errMsg, errLine: r.errLine,
      state: r.state, memView: r.memView,
      cycles: r.cycles, halted: r.halted,
    });
  }

  runHeadless(source: string, maxCycles: number): {
    ok: boolean; errMsg: string; errLine: number;
    state: ReturnType<typeof toBusState>;
    memView: Uint8Array;
    cycles: number; halted: boolean;
  } {
    // Sauvegarde RAM programme
    const mem    = this.core.memory_view();
    const saved  = new Uint8Array(mem);

    const asmR = this.core.assemble(source);
    if (!asmR.ok) {
      // Restaure
      for (let i = 0; i < saved.length; i++) this.core.mem_poke(i, saved[i]!);
      return { ok: false, errMsg: asmR.error_msg, errLine: asmR.error_line,
               state: toBusState(this.core.get_state()), memView: saved, cycles: 0, halted: false };
    }

    this.core.reset();
    const runR  = this.core.run(maxCycles);
    const snap  = new Uint8Array(this.core.memory_view());

    // Restaure
    for (let i = 0; i < saved.length; i++) this.core.mem_poke(i, saved[i]!);

    return { ok: true, errMsg: '', errLine: -1,
             state: toBusState(runR.state), memView: snap,
             cycles: runR.cycles, halted: runR.halted };
  }

  // ── Helpers display ───────────────────────────────────────────

  /** Envoie un snapshot de la VRAM au display. Force=true contourne le dirty tracking. */
  private _flushDisplay(force = false): void {
    const dirty = this.core.take_dirty_pixels();
    if (!dirty && !force) return;

    const ram  = this.core.memory_view();
    const mode = this.core.video_mode();

    const vram = new Uint8Array(ram.subarray(0x4000, 0x8000));
    bus.emit('chuck:memory-data', { address: 0x4000, bytes: vram });
    bus.emit('chuck:vpu-mode' as any, { mode });
  }

  private _emitVpuState(): void {
    const vpu = this.core.get_vpu_state();
    bus.emit('chuck:vpu-mode' as any, { mode: vpu.mode });
  }
}
