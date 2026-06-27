/* ─────────────────────────────────────────────────────────────
   Chuck IDE — core/emulator.ts  (Chuck-8 Platform v1.0)
   Façade TS → WASM. Gère :
     - Assemblage + exécution CPU
     - VBlank 60 Hz → NMI + rendu écran
     - Clavier, manette, souris → registres I/O WASM
     - Dispatche les événements Bus
   ───────────────────────────────────────────────────────────── */

import { bus } from "../../core/bus";
import { superAdmin } from "../../core/super-admin";

/**
 * Nettoie les messages d'erreur bruts venant de l'assembleur Rust/WASM.
 * Les variants Rust comme `Some(Colon)` ou `Token::Ident` ne sont pas
 * des messages utilisateur — on les remplace par des explications claires.
 */
function cleanAsmError(raw: string): string {
  return (
    raw
      // Tokens Rust bruts → noms lisibles
      .replace(/\bSome\(Colon\)/g, '":"')
      .replace(/\bSome\(Comma\)/g, '","')
      .replace(/\bSome\(Hash\)/g, '"#"')
      .replace(/\bSome\(LParen\)/g, '"("')
      .replace(/\bSome\(RParen\)/g, '")"')
      .replace(/\bSome\(Plus\)/g, '"+"')
      .replace(/\bSome\(Minus\)/g, '"-"')
      .replace(/\bSome\(Star\)/g, '"*"')
      .replace(/\bSome\(Slash\)/g, '"/"')
      .replace(/\bSome\(Dot\)/g, '"."')
      .replace(/\bSome\(Eq\)/g, '"="')
      .replace(/\bSome\(Lt\)/g, '"<"')
      .replace(/\bSome\(Gt\)/g, '">"')
      .replace(/\bSome\(Newline\)/g, "fin de ligne")
      .replace(/\bSome\(Eof\)/g, "fin de fichier")
      .replace(/\bSome\(Ident\(([^)]+)\)\)/g, '"$1"')
      .replace(/\bSome\(Number\((\d+)\)\)/g, "$1")
      .replace(/\bSome\(Str\("([^"]+)"\)\)/g, '"$1"')
      .replace(/\bSome\(([^)]+)\)/g, '"$1"') // fallback générique
      .replace(/\bNone\b/g, "fin de fichier")
      // Reformulations de messages courants
      .replace(/Unexpected token/gi, "Élément inattendu")
      .replace(/Unexpected end of/gi, "Fin inattendue de")
      .replace(/Expected ([^,]+), got/gi, "Attendu $1, trouvé")
      .replace(/Undefined label/gi, "Label inconnu")
      .replace(/Duplicate label/gi, "Label déjà défini")
      .replace(/Out of range/gi, "Valeur hors plage")
      .replace(/Invalid operand/gi, "Opérande invalide")
      .replace(/Unknown mnemonic/gi, "Mnémonique inconnu")
  );
}

// ── Masquage des opcodes cachés ───────────────────────────────
// L'émulateur Rust connaît les opcodes illégaux (LAX, SAX…) et les
// opcodes réassignés secrets (MUL, MCP). On ne révèle jamais leur
// mnémonique dans le désassemblage public : ils s'affichent en "???".
// Le super-admin (toi) conserve un désassemblage complet pour le debug.
const HIDDEN_MNEMONICS = new Set([
  "LAX", "SAX", "DCP", "ISC",
  "SLO", "RLA", "SRE", "RRA",
  "ANC", "ALR", "ARR", "AXS",
  "MUL", "MCP",
]);

/** Remplace un mnémonique caché par "???" dans une ligne désassemblée,
 *  sauf si le super-admin est actif. */
function maskDisasm(disasm: string): string {
  if (superAdmin.active) return disasm;
  const mnem = disasm.trimStart().split(/\s+/)[0]?.toUpperCase();
  if (mnem && HIDDEN_MNEMONICS.has(mnem)) {
    return "??? (instruction non documentée)";
  }
  return disasm;
}

// ── Types WASM ────────────────────────────────────────────────

interface WasmCpuState {
  a: number;
  x: number;
  y: number;
  pc: number;
  sp: number;
  p: number;
  cycles: number;
  flag_n: boolean;
  flag_v: boolean;
  flag_b: boolean;
  flag_d: boolean;
  flag_i: boolean;
  flag_z: boolean;
  flag_c: boolean;
}

interface WasmVpuState {
  mode: number;
  cursor_x: number;
  cursor_y: number;
  ink: number;
  paper: number;
  scroll_x: number;
  scroll_y: number;
  border: number;
}

interface WasmSpuVoice {
  freq: number;
  vol: number;
  waveform: number;
  gate: boolean;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

interface WasmSpuState {
  voices: WasmSpuVoice[];
  master_vol: number;
}

interface ChuckCoreInstance {
  assemble(src: string): {
    ok: boolean;
    error_msg: string;
    error_line: number;
    bytes_written: number;
    org: number;
  };
  reset(): void;
  soft_reset(): void;
  run(maxCycles: number): {
    cycles: number;
    halted: boolean;
    state: WasmCpuState;
  };
  step(): {
    cycles: number;
    halted: boolean;
    disasm: string;
    state: WasmCpuState;
  };
  get_state(): WasmCpuState;
  vblank_tick(): void;
  memory_view(): Uint8Array;
  memory_snapshot(): Uint8Array;
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
  ChuckCore: new () => ChuckCoreInstance;
}

// ── Constantes ────────────────────────────────────────────────
const CYCLES_PER_FRAME = 16_667; // ~1 MHz / 60 Hz
const hex4 = (n: number) => n.toString(16).padStart(4, "0").toUpperCase();
const hex2 = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();

function toBusState(s: WasmCpuState) {
  return {
    A: s.a,
    X: s.x,
    Y: s.y,
    PC: s.pc,
    SP: s.sp,
    P: s.p,
    cycles: s.cycles,
  };
}

// ── Emulator ──────────────────────────────────────────────────

export class Emulator {
  private core!: ChuckCoreInstance;
  private _unsubs: Array<() => void> = [];
  private _rafId: number | null = null;
  private _running: boolean = false;
  private _lastOrg: number = 0xe000;

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
    const mod = (await import("./chuck_core.js")) as WasmModule;
    await mod.default();
    this.core = new mod.ChuckCore();

    bus.emit("chuck:log", {
      text: "Chuck-8 v1.0 — Moteur Rust/WASM prêt. Entrée : $E000 · clavier : $D200–$D203",
      level: "dim",
    });
  }

  destroy(): void {
    this._unsubs.forEach((fn) => fn());
    this._stopLoop();
  }

  // ── Liaison Bus ───────────────────────────────────────────────

  private _bindBus(): void {
    const sub = <K extends Parameters<typeof bus.on>[0]>(
      ev: K,
      fn: Parameters<typeof bus.on<K>>[1],
    ) => this._unsubs.push(bus.on(ev, fn));

    sub("chuck:assemble", ({ source }) => this._assemble(source));
    sub("chuck:run", () => this._run());
    sub("chuck:stop", () => this._stop());
    sub("chuck:reset", () => this._reset());
    sub("chuck:ide-free",        () => this._resetForModeChange());
    sub("chuck:ide-defi",        () => this._resetForModeChange());
    sub("chuck:tutos-requested", () => this._resetForModeChange());
    sub("chuck:step", () => this._step());
    sub("chuck:goto", ({ address }) => this._goto(address));
    sub("chuck:hexdump", () => this._hexdump());
    sub("chuck:disassemble", () => this._hexdump());
    sub("chuck:validate", ({ source }) => this._doValidate(source));
    sub("chuck:memory-read", ({ address, length }) =>
      this._memRead(address, length),
    );
  }

  // ── Clavier, manette, souris ──────────────────────────────────

  private _bindInput(): void {
    // ── Clavier + manette ────────────────────────────────────
    // Les frappes proviennent du canvas focalisé de chuck-display
    // (relayées via le bus `chuck:screen-key`) et NON de `document` :
    // sinon CodeMirror intercepte les touches (preventDefault /
    // stopPropagation) et le programme assembleur ne reçoit jamais rien.
    const padState = { p1: 0xff };
    const PAD_MAP: Record<string, number> = {
      KeyZ: 0b10000000, // A
      KeyX: 0b01000000, // B
      ShiftRight: 0b00100000, // Select
      Enter: 0b00010000, // Start
      ArrowRight: 0b00001000,
      ArrowLeft: 0b00000100,
      ArrowDown: 0b00000010,
      ArrowUp: 0b00000001,
    };

    this._unsubs.push(
      bus.on("chuck:screen-key", (e) => {
        if (!this._running) return;

        // 1. Registres clavier ($D200–$D203)
        if (e.down) {
          const ascii = e.key.length === 1 ? e.key.charCodeAt(0) : 0;
          const raw = this._keyToRaw(e.code);
          const mods =
            (e.shift ? 1 : 0) | (e.ctrl ? 2 : 0) | (e.alt ? 4 : 0);
          this.core.set_key(ascii, raw, mods);
        } else {
          this.core.clear_key();
        }

        // 2. Manette ($D300) — mêmes touches physiques
        const mask = PAD_MAP[e.code];
        if (mask) {
          if (e.down) padState.p1 &= ~mask; // bit à 0 = enfoncé
          else padState.p1 |= mask; // bit à 1 = relâché
          this.core.set_pad(0, padState.p1);
        }
      }),
    );

    // ── Souris (sur le canvas de chuck-display) ───────────────
    document.addEventListener("mousemove", (e) => {
      if (!this._running) return;
      const display = document.getElementById("modal-display");
      if (!display) return;
      const canvas = display.shadowRoot?.getElementById(
        "screen",
      ) as HTMLCanvasElement | null;
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      const px = Math.floor(((e.clientX - r.left) / r.width) * 128);
      const py = Math.floor(((e.clientY - r.top) / r.height) * 128);
      if (px >= 0 && px < 128 && py >= 0 && py < 128) {
        // btn : bit0=gauche bit1=droit, 0=enfoncé (logique inversée)
        const btn = (~e.buttons & 0b11) & 0xff;
        this.core.set_mouse(px, py, btn, 0);
      }
    });
  }

  private _keyToRaw(code: string): number {
    const MAP: Record<string, number> = {
      ArrowUp: 0x80,
      ArrowDown: 0x81,
      ArrowLeft: 0x82,
      ArrowRight: 0x83,
      F1: 0x84,
      F2: 0x85,
      F3: 0x86,
      F4: 0x87,
      Insert: 0x88,
      Delete: 0x89,
      Home: 0x8a,
      End: 0x8b,
    };
    return MAP[code] ?? 0;
  }

  // ── Boucle principale 60 Hz ───────────────────────────────────

  private _startLoop(): void {
    if (this._rafId !== null) return;

    const tick = () => {
      if (!this._running) {
        this._rafId = null;
        return;
      }

      // 1. VBlank : incrémente frame counter + arme NMI dans le WASM
      this.core.vblank_tick();

      // 2. Exécute ~1 frame de CPU (NMI + programme principal)
      const result = this.core.run(CYCLES_PER_FRAME);

      // 3. Rendu écran si VRAM a changé
      this._flushDisplay(true);

      // 4. Émettre état CPU (pour le panneau registres)
      bus.emit("chuck:cpu-updated", toBusState(result.state));

      // 5. Émettre mode vidéo courant
      const mode = this.core.video_mode();
      bus.emit("chuck:vpu-mode" as any, { mode });

      this._emitRamSnapshot();

      // 6. BRK → arrêter
      if (result.halted) {
        this._running = false;
        this._rafId = null;
        this._flushDisplay(true); // force rendu final même sans dirty
        this._emitRamSnapshot();
        bus.emit("chuck:cpu-halted", toBusState(result.state));
        bus.emit("chuck:log", {
          text: `● BRK — PC=$${hex4(result.state.pc)} — frame #${this.core.frame_count()}`,
          level: "ok",
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
      const err = cleanAsmError(result.error_msg);
      bus.emit("chuck:assemble-err", { line: result.error_line, err });
      return;
    }

    this._lastOrg = result.org;

    // Si le programme a défini un vecteur RESET valide ($FFFC/$FFFD),
    // core.assemble() a déjà écrit les octets en mémoire mais a remis le
    // CPU à un état par défaut sans relire ce vecteur. On fait un soft_reset()
    // pour que le PC parte de la bonne adresse au prochain Run.
    // (soft_reset() préserve la RAM programme, donc le code assemblé reste intact.)
    const vecLo = this.core.mem_peek(0xfffc);
    const vecHi = this.core.mem_peek(0xfffd);
    const resetVec = vecLo | (vecHi << 8);
    if (resetVec !== 0x0000 && resetVec !== 0xffff) {
      this.core.soft_reset();
    }

    bus.emit("chuck:assembled", {
      ok: true,
      bytes: result.bytes_written,
      buf: [],
    });
    this._emitRamSnapshot();
    bus.emit("chuck:cpu-updated", toBusState(this.core.get_state()));
    bus.emit("chuck:log", {
      text: `✓ ${result.bytes_written} octets → $${hex4(result.org)}–$${hex4(result.org + result.bytes_written - 1)}`,
      level: "ok",
    });

    // Rendu initial — force même si rien de dirty (VRAM peut être propre)
    this._flushDisplay(true);
    this._emitVpuState();
  }

  private _run(): void {
    if (!this.core) return;
    this._running = true;
    bus.emit("chuck:log", {
      text: "▶ Exécution (60 Hz, NMI actif)",
      level: "info",
    });
    this._emitRamSnapshot();
    this._startLoop();
  }

  private _stop(): void {
    this._stopLoop();
    bus.emit("chuck:cpu-updated", toBusState(this.core.get_state()));
    bus.emit("chuck:log", { text: "■ Arrêté", level: "info" });
    this._emitRamSnapshot();
  }

  private _reset(): void {
    this._stopLoop();
    this.core.soft_reset(); // préserve $E000–$EFFF
    this._flushDisplay(true); // écran noir
    bus.emit("chuck:cpu-reset", toBusState(this.core.get_state()));
    bus.emit("chuck:toolbar-state", { state: "assembled" }); // reste assemblé
    bus.emit("chuck:log", {
      text: "↺ Reset — PC=$E000, mémoire programme préservée",
      level: "info",
    });
    this._emitVpuState();
  }

  /** Reset déclenché par un changement de mode : coupe la boucle, remet le
   *  CPU à zéro et désactive la toolbar. Contrairement à _reset(), repasse en
   *  'idle' (et non 'assembled') car le programme du mode précédent ne doit
   *  plus être ni exécutable ni resettable depuis le nouveau mode. */
  private _resetForModeChange(): void {
    if (!this.core) return;
    this._stopLoop();
    this.core.soft_reset();
    this._flushDisplay(true);          // écran noir
    bus.emit("chuck:cpu-reset", toBusState(this.core.get_state()));
    bus.emit("chuck:toolbar-state", { state: "idle" }); // tous boutons désactivés
    this._emitRamSnapshot();
    this._emitVpuState();
  }

  private _step(): void {
    const result = this.core.step();
    bus.emit("chuck:log", {
      text: `→ $${hex4(result.state.pc)}  ${maskDisasm(result.disasm)}`,
      level: "info",
    });
    this._emitRamSnapshot();
    bus.emit("chuck:cpu-updated", toBusState(result.state));
    this._flushDisplay(true);
    this._emitVpuState();
    if (result.halted) bus.emit("chuck:cpu-halted", toBusState(result.state));
  }

  private _goto(address: number): void {
    // Place $E000 dans le vecteur RESET et déclenche un soft reset
    this.core.mem_poke(0xfffc, address & 0xff);
    this.core.mem_poke(0xfffd, (address >> 8) & 0xff);
    this.core.reset();
    bus.emit("chuck:cpu-updated", toBusState(this.core.get_state()));
    bus.emit("chuck:log", { text: `⤷ PC → $${hex4(address)}`, level: "info" });
  }

  private _hexdump(): void {
    const mem = this.core.memory_view();
    const start = this._lastOrg;
    const len = Math.min(64, 0xf000 - start);
    bus.emit("chuck:log", {
      text: `── Hexdump $${hex4(start)} ──`,
      level: "hex",
    });
    for (let i = 0; i < len; i += 16) {
      const row = Array.from(mem.subarray(start + i, start + i + 16))
        .map((b) => hex2(b))
        .join(" ");
      bus.emit("chuck:log", {
        text: `$${hex4(start + i)}  ${row}`,
        level: "hex",
      });
    }
  }

  private _memRead(address: number, length: number): void {
    const mem = this.core.memory_snapshot();
    const bytes = mem.slice(address, address + length);
    bus.emit("chuck:memory-data", { address, bytes });
  }

  // ── Validation (headless) ─────────────────────────────────────

  private _doValidate(source: string): void {
    // Lance via chuck:validate-done pour que ChallengeManager puisse vérifier
    const r = this.runHeadless(source, 200_000);
    bus.emit("chuck:validate-done" as any, {
      ok: r.ok,
      errMsg: r.errMsg,
      errLine: r.errLine,
      state: r.state,
      memView: r.memView,
      cycles: r.cycles,
      halted: r.halted,
    });
  }

  runHeadless(
    source: string,
    maxCycles: number,
  ): {
    ok: boolean;
    errMsg: string;
    errLine: number;
    state: ReturnType<typeof toBusState>;
    memView: Uint8Array;
    cycles: number;
    halted: boolean;
  } {
    // Sauvegarde RAM — DOIT être une copie indépendante.
    // memory_view() retourne une vue zero-copy sur le buffer Rust.
    // new Uint8Array(view) crée une vue, pas une copie.
    // slice() ou from() crée une vraie copie indépendante.
    const saved = this.core.memory_view().slice();

    const asmR = this.core.assemble(source);
    if (!asmR.ok) {
      for (let i = 0; i < saved.length; i++) this.core.mem_poke(i, saved[i]!);
      return {
        ok: false,
        errMsg: asmR.error_msg,
        errLine: asmR.error_line,
        state: toBusState(this.core.get_state()),
        memView: saved,
        cycles: 0,
        halted: false,
      };
    }

    const runR = this.core.run(maxCycles);
    const snap = new Uint8Array(this.core.memory_snapshot());

    // Restaure la RAM au contenu d'avant la validation
    for (let i = 0; i < saved.length; i++) this.core.mem_poke(i, saved[i]!);

    return {
      ok: true,
      errMsg: "",
      errLine: -1,
      state: toBusState(runR.state),
      memView: snap,
      cycles: runR.cycles,
      halted: runR.halted,
    };
  }

  // ── Helpers display ───────────────────────────────────────────

  /** Envoie un snapshot de la VRAM au display. Force=true contourne le dirty tracking. */
  private _flushDisplay(force = false): void {
    const dirty = this.core.take_dirty_pixels();
    if (!dirty && !force) return;

    const ram = this.core.memory_view();
    const mode = this.core.video_mode();

    bus.emit("chuck:vpu-mode" as any, { mode });

    const vram = new Uint8Array(
      ram.buffer,
      ram.byteOffset + 0x4000,
      0x4000,
    ).slice(); // ← slice() = vraie copie

    bus.emit("chuck:memory-data", { address: 0x4000, bytes: vram });
  }

  private _emitVpuState(): void {
    const vpu = this.core.get_vpu_state();
    bus.emit("chuck:vpu-mode" as any, { mode: vpu.mode });
  }

  /** Émet un snapshot complet des 64 Ko pour le débogueur */
  private _emitRamSnapshot(): void {
    const snap = new Uint8Array(this.core.memory_snapshot()); // copie propre
    bus.emit("chuck:ram-snapshot", { bytes: snap });
  }
}