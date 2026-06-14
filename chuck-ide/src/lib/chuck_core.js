/* @ts-self-types="./chuck_core.d.ts" */

export class ChuckCore {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ChuckCoreFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_chuckcore_free(ptr, 0);
    }
    /**
     * Assemble `source` et charge en mémoire à partir de `.org`.
     * Remet le CPU à l'état initial avec PC pointant sur l'org.
     * @param {string} source
     * @returns {any}
     */
    assemble(source) {
        const ptr0 = passStringToWasm0(source, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.chuckcore_assemble(this.__wbg_ptr, ptr0, len0);
        return ret;
    }
    /**
     * Relâcher toutes les touches
     */
    clear_key() {
        wasm.chuckcore_clear_key(this.__wbg_ptr);
    }
    /**
     * Numéro de frame courant (incrémenté par vblank_tick).
     * @returns {number}
     */
    frame_count() {
        const ret = wasm.chuckcore_frame_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Retourne l'état des 3 voix SPU pour que le JS génère le son.
     * @returns {any}
     */
    get_spu_state() {
        const ret = wasm.chuckcore_get_spu_state(this.__wbg_ptr);
        return ret;
    }
    /**
     * Retourne l'état courant du CPU.
     * @returns {any}
     */
    get_state() {
        const ret = wasm.chuckcore_get_state(this.__wbg_ptr);
        return ret;
    }
    /**
     * Retourne l'état courant du VPU (mode, curseur, couleurs, scroll).
     * @returns {any}
     */
    get_vpu_state() {
        const ret = wasm.chuckcore_get_vpu_state(this.__wbg_ptr);
        return ret;
    }
    /**
     * Lit un octet sans effet de bord.
     * @param {number} addr
     * @returns {number}
     */
    mem_peek(addr) {
        const ret = wasm.chuckcore_mem_peek(this.__wbg_ptr, addr);
        return ret;
    }
    /**
     * Écrit un octet (usage debug/test — bypass I/O).
     * @param {number} addr
     * @param {number} val
     */
    mem_poke(addr, val) {
        wasm.chuckcore_mem_poke(this.__wbg_ptr, addr, val);
    }
    /**
     * Vue zero-copy sur les 64 Ko de RAM.
     * ⚠️ Invalide si Rust réalloue — ne jamais stocker.
     * @returns {Uint8Array}
     */
    memory_view() {
        const ret = wasm.chuckcore_memory_view(this.__wbg_ptr);
        return ret;
    }
    constructor() {
        const ret = wasm.chuckcore_new();
        this.__wbg_ptr = ret;
        ChuckCoreFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Reset hardware complet.
     */
    reset() {
        wasm.chuckcore_reset(this.__wbg_ptr);
    }
    /**
     * Exécute jusqu'à `max_cycles` cycles ou BRK.
     * @param {number} max_cycles
     * @returns {any}
     */
    run(max_cycles) {
        const ret = wasm.chuckcore_run(this.__wbg_ptr, max_cycles);
        return ret;
    }
    /**
     * Clavier : ascii = char ASCII, raw = scancode, modifiers = Shift/Ctrl/Alt
     * @param {number} ascii
     * @param {number} raw
     * @param {number} modifiers
     */
    set_key(ascii, raw, modifiers) {
        wasm.chuckcore_set_key(this.__wbg_ptr, ascii, raw, modifiers);
    }
    /**
     * Souris : x/y (0–127 en mode gfx, 0–31 en mode texte)
     * btn : bit0=gauche bit1=droit (0=enfoncé)
     * scroll : delta molette signé
     * @param {number} x
     * @param {number} y
     * @param {number} btn
     * @param {number} scroll
     */
    set_mouse(x, y, btn, scroll) {
        wasm.chuckcore_set_mouse(this.__wbg_ptr, x, y, btn, scroll);
    }
    /**
     * Manette : pad=0 (manette 1) ou pad=1 (manette 2)
     * state = bitmask NES (bit=0 si enfoncé, logique inversée)
     * Exemple : A enfoncé = state & 0x80 == 0
     * @param {number} pad
     * @param {number} state
     */
    set_pad(pad, state) {
        wasm.chuckcore_set_pad(this.__wbg_ptr, pad, state);
    }
    /**
     * Exécute une seule instruction (mode debug pas-à-pas).
     * @returns {any}
     */
    step() {
        const ret = wasm.chuckcore_step(this.__wbg_ptr);
        return ret;
    }
    /**
     * Plage VRAM modifiée depuis le dernier appel → [min, max] ou null.
     * @returns {any}
     */
    take_dirty_pixels() {
        const ret = wasm.chuckcore_take_dirty_pixels(this.__wbg_ptr);
        return ret;
    }
    /**
     * Déclenche un VBlank : incrémente le frame counter, positionne
     * VPU_STATUS.VBLANK et arme le NMI pour le prochain cpu.run().
     */
    vblank_tick() {
        wasm.chuckcore_vblank_tick(this.__wbg_ptr);
    }
    /**
     * Mode vidéo courant : 0=texte, 1=graphique.
     * @returns {number}
     */
    video_mode() {
        const ret = wasm.chuckcore_video_mode(this.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) ChuckCore.prototype[Symbol.dispose] = ChuckCore.prototype.free;
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_fdd633d4bb5dd76a: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg___wbindgen_debug_string_8a447059637473e2: function(arg0, arg1) {
            const ret = debugString(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_throw_ea4887a5f8f9a9db: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_error_a6fa202b58aa1cd3: function(arg0, arg1) {
            let deferred0_0;
            let deferred0_1;
            try {
                deferred0_0 = arg0;
                deferred0_1 = arg1;
                console.error(getStringFromWasm0(arg0, arg1));
            } finally {
                wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
            }
        },
        __wbg_new_227d7c05414eb861: function() {
            const ret = new Error();
            return ret;
        },
        __wbg_new_2e117a478906f062: function() {
            const ret = new Object();
            return ret;
        },
        __wbg_new_36e147a8ced3c6e0: function() {
            const ret = new Array();
            return ret;
        },
        __wbg_push_f724b5db8acf89d2: function(arg0, arg1) {
            const ret = arg0.push(arg1);
            return ret;
        },
        __wbg_set_6be42768c690e380: function(arg0, arg1, arg2) {
            arg0[arg1] = arg2;
        },
        __wbg_set_dc601f4a69da0bc2: function(arg0, arg1, arg2) {
            arg0[arg1 >>> 0] = arg2;
        },
        __wbg_stack_3b0d974bbf31e44f: function(arg0, arg1) {
            const ret = arg1.stack;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbindgen_cast_0000000000000001: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Ref(Slice(U8)) -> NamedExternref("Uint8Array")`.
            const ret = getArrayU8FromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_cast_0000000000000003: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_cast_0000000000000004: function(arg0) {
            // Cast intrinsic for `U64 -> Externref`.
            const ret = BigInt.asUintN(64, arg0);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./chuck_core_bg.js": import0,
    };
}

const ChuckCoreFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_chuckcore_free(ptr, 1));

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('chuck_core_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
