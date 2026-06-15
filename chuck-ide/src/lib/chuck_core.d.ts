/* tslint:disable */
/* eslint-disable */

export class ChuckCore {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Assemble `source` et charge en mémoire à partir de `.org`.
     * Remet le CPU et l'IoState à l'état initial.
     */
    assemble(source: string): any;
    /**
     * Relâcher toutes les touches
     */
    clear_key(): void;
    /**
     * Numéro de frame courant (incrémenté par vblank_tick).
     */
    frame_count(): number;
    /**
     * Retourne l'état des 3 voix SPU pour que le JS génère le son.
     */
    get_spu_state(): any;
    /**
     * Retourne l'état courant du CPU.
     */
    get_state(): any;
    /**
     * Retourne l'état courant du VPU (mode, curseur, couleurs, scroll).
     */
    get_vpu_state(): any;
    /**
     * Lit un octet sans effet de bord.
     */
    mem_peek(addr: number): number;
    /**
     * Écrit un octet (usage debug/test — bypass I/O).
     */
    mem_poke(addr: number, val: number): void;
    /**
     * Snapshot 64 Ko avec l'état I/O synchronisé dans la zone $D000–$DFFF.
     * Utiliser pour la validation — plus lent que memory_view() mais correct.
     */
    memory_snapshot(): Uint8Array;
    /**
     * Vue zero-copy sur les 64 Ko de RAM.
     * ⚠️ Invalide si Rust réalloue — ne jamais stocker.
     * Note : la zone I/O $D000–$DFFF reflète self.mem.ram[], pas IoState.
     * Utiliser mem_peek() pour lire un registre I/O précis.
     */
    memory_view(): Uint8Array;
    constructor();
    /**
     * Reset hardware complet.
     */
    reset(): void;
    /**
     * Exécute jusqu'à `max_cycles` cycles ou BRK.
     */
    run(max_cycles: number): any;
    /**
     * Clavier : ascii = char ASCII, raw = scancode, modifiers = Shift/Ctrl/Alt
     */
    set_key(ascii: number, raw: number, modifiers: number): void;
    /**
     * Souris : x/y (0–127 en mode gfx, 0–31 en mode texte)
     * btn : bit0=gauche bit1=droit (0=enfoncé)
     * scroll : delta molette signé
     */
    set_mouse(x: number, y: number, btn: number, scroll: number): void;
    /**
     * Manette : pad=0 (manette 1) ou pad=1 (manette 2)
     * state = bitmask NES (bit=0 si enfoncé, logique inversée)
     * Exemple : A enfoncé = state & 0x80 == 0
     */
    set_pad(pad: number, state: number): void;
    /**
     * Exécute une seule instruction (mode debug pas-à-pas).
     */
    step(): any;
    /**
     * Plage VRAM modifiée depuis le dernier appel → [min, max] ou null.
     */
    take_dirty_pixels(): any;
    /**
     * Déclenche un VBlank : incrémente le frame counter, positionne
     * VPU_STATUS.VBLANK et arme le NMI pour le prochain cpu.run().
     */
    vblank_tick(): void;
    /**
     * Mode vidéo courant : 0=texte, 1=graphique.
     */
    video_mode(): number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_chuckcore_free: (a: number, b: number) => void;
    readonly chuckcore_assemble: (a: number, b: number, c: number) => any;
    readonly chuckcore_clear_key: (a: number) => void;
    readonly chuckcore_frame_count: (a: number) => number;
    readonly chuckcore_get_spu_state: (a: number) => any;
    readonly chuckcore_get_state: (a: number) => any;
    readonly chuckcore_get_vpu_state: (a: number) => any;
    readonly chuckcore_mem_peek: (a: number, b: number) => number;
    readonly chuckcore_mem_poke: (a: number, b: number, c: number) => void;
    readonly chuckcore_memory_snapshot: (a: number) => any;
    readonly chuckcore_memory_view: (a: number) => any;
    readonly chuckcore_new: () => number;
    readonly chuckcore_reset: (a: number) => void;
    readonly chuckcore_run: (a: number, b: number) => any;
    readonly chuckcore_set_key: (a: number, b: number, c: number, d: number) => void;
    readonly chuckcore_set_mouse: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly chuckcore_set_pad: (a: number, b: number, c: number) => void;
    readonly chuckcore_step: (a: number) => any;
    readonly chuckcore_take_dirty_pixels: (a: number) => any;
    readonly chuckcore_vblank_tick: (a: number) => void;
    readonly chuckcore_video_mode: (a: number) => number;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
