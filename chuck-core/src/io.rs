//---------------IO----------------------|
// chuck-core/src/io.rs
//
// État des périphériques Chuck-8.
// Ce module maintient l'état de tous les I/O entre les frames.
// Le JS met à jour cet état via wasm_api (set_key, set_pad, set_mouse...).
// La mémoire lit cet état quand le CPU accède à $D200–$D3FF.

// ── Constantes des registres I/O ─────────────────────────────────────────────

// VPU $D000–$D0FF
pub const VPU_CTRL      : u16 = 0xD000;
pub const VPU_BORDER    : u16 = 0xD001;
pub const VPU_SCROLL_X  : u16 = 0xD002;
pub const VPU_SCROLL_Y  : u16 = 0xD003;
pub const VPU_STATUS    : u16 = 0xD004;
pub const VPU_SPR_CTRL  : u16 = 0xD005;
pub const VPU_SPR_IDX   : u16 = 0xD006;
pub const VPU_SPR_X     : u16 = 0xD007;
pub const VPU_SPR_Y     : u16 = 0xD008;
pub const VPU_SPR_FLAGS : u16 = 0xD009;
pub const VPU_SPR_TILE  : u16 = 0xD00A;
pub const VPU_CURSOR_X  : u16 = 0xD00B;
pub const VPU_CURSOR_Y  : u16 = 0xD00C;
pub const VPU_INK       : u16 = 0xD00D;
pub const VPU_PAPER     : u16 = 0xD00E;
pub const VPU_CHAR_OUT  : u16 = 0xD00F;

// SPU $D100–$D1FF
pub const SPU_V0_BASE   : u16 = 0xD100; // + 0..7 pour chaque voix
pub const SPU_V1_BASE   : u16 = 0xD108;
pub const SPU_V2_BASE   : u16 = 0xD110;
pub const SPU_MASTER_VOL: u16 = 0xD118;
pub const SPU_STATUS    : u16 = 0xD119;
pub const SPU_SAMPLE_LO : u16 = 0xD11A;
pub const SPU_SAMPLE_HI : u16 = 0xD11B;
pub const SPU_SAMPLE_LEN: u16 = 0xD11C;
pub const SPU_SAMPLE_CTRL: u16 = 0xD11D;

// INPUT $D200–$D2FF
pub const KEY_ASCII     : u16 = 0xD200;
pub const KEY_STATUS    : u16 = 0xD201;
pub const KEY_MOD       : u16 = 0xD202;
pub const KEY_RAW       : u16 = 0xD203;
pub const PAD1_STATE    : u16 = 0xD210;
pub const PAD2_STATE    : u16 = 0xD211;
pub const PAD_CTRL      : u16 = 0xD212;
pub const MOUSE_X       : u16 = 0xD220;
pub const MOUSE_Y       : u16 = 0xD221;
pub const MOUSE_DX      : u16 = 0xD222;
pub const MOUSE_DY      : u16 = 0xD223;
pub const MOUSE_BTN     : u16 = 0xD224;
pub const MOUSE_SCROLL  : u16 = 0xD225;

// SYSTEM $D300–$D3FF
pub const SYS_TIMER_LO  : u16 = 0xD300;
pub const SYS_TIMER_HI  : u16 = 0xD301;
pub const SYS_IRQ_RATE  : u16 = 0xD302;
pub const SYS_IRQ_CTRL  : u16 = 0xD303;
pub const SYS_FRAME_LO  : u16 = 0xD304;
pub const SYS_FRAME_HI  : u16 = 0xD305;
pub const SYS_RAND_REG  : u16 = 0xD306;  // registre LFSR hardware (≠ API SYS_GET_RAND=$F05A)
pub const SYS_RAND_SEED : u16 = 0xD307;
pub const SYS_RESET_REG : u16 = 0xD308;  // écrire $C7 → reset logiciel
pub const SYS_CAPS      : u16 = 0xD309;

// ── Bits des registres ────────────────────────────────────────────────────────

// VPU_CTRL bits
pub const VPU_CTRL_MODE  : u8 = 0b0000_0001; // 0=texte, 1=graphique
pub const VPU_CTRL_FLIP  : u8 = 0b0000_0010; // flip framebuffer au prochain VBlank
pub const VPU_CTRL_ENABLE: u8 = 0b1000_0000; // VPU activé

// VPU_STATUS bits
pub const VPU_STATUS_VBLANK: u8 = 0b1000_0000; // 1 pendant le VBlank
pub const VPU_STATUS_BUF   : u8 = 0b0000_0010; // buffer actif : 0=A, 1=B (spec §4.4)
pub const VPU_STATUS_FRAME : u8 = 0b0000_0001; // alternance frame paire/impaire

// KEY_STATUS bits
pub const KEY_STATUS_PRESSED: u8 = 0b1000_0000; // touche enfoncée ce frame

// Boutons manette (bit = 0 si enfoncé, logique NES)
pub const PAD_A     : u8 = 0b1000_0000;
pub const PAD_B     : u8 = 0b0100_0000;
pub const PAD_SELECT: u8 = 0b0010_0000;
pub const PAD_START : u8 = 0b0001_0000;
pub const PAD_RIGHT : u8 = 0b0000_1000;
pub const PAD_LEFT  : u8 = 0b0000_0100;
pub const PAD_DOWN  : u8 = 0b0000_0010;
pub const PAD_UP    : u8 = 0b0000_0001;

// ── État périphériques ────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct KeyboardState {
    pub ascii:   u8,    // char ASCII courant (0 si aucun)
    pub status:  u8,    // KEY_STATUS_PRESSED si touche ce frame
    pub modifiers: u8,  // Shift/Ctrl/Alt
    pub raw:     u8,    // scancode brut
}

impl Default for KeyboardState {
    fn default() -> Self {
        Self { ascii: 0, status: 0, modifiers: 0, raw: 0 }
    }
}

#[derive(Debug, Clone)]
pub struct PadState {
    pub pad1: u8,   // $FF = tout relâché (logique inversée NES)
    pub pad2: u8,
}

impl Default for PadState {
    fn default() -> Self {
        Self { pad1: 0xFF, pad2: 0xFF } // tout relâché
    }
}

#[derive(Debug, Clone)]
pub struct MouseState {
    pub x:      u8,
    pub y:      u8,
    pub dx:     i8,   // delta depuis dernière frame
    pub dy:     i8,
    pub btn:    u8,   // boutons (bit=0 si enfoncé)
    pub scroll: i8,
}

impl Default for MouseState {
    fn default() -> Self {
        Self { x: 64, y: 64, dx: 0, dy: 0, btn: 0xFF, scroll: 0 }
    }
}

#[derive(Debug, Clone)]
pub struct VpuState {
    pub ctrl:     u8,  // mode + flip + enable
    pub border:   u8,
    pub scroll_x: u8,
    pub scroll_y: u8,
    pub status:   u8,  // vblank flag
    pub cursor_x: u8,
    pub cursor_y: u8,
    pub ink:      u8,  // couleur texte (0–15)
    pub paper:    u8,  // couleur fond (0–15)
}

impl Default for VpuState {
    fn default() -> Self {
        Self {
            ctrl:     VPU_CTRL_ENABLE, // actif, mode texte par défaut
            border:   0,
            scroll_x: 0,
            scroll_y: 0,
            status:   0,
            cursor_x: 0,
            cursor_y: 0,
            ink:      1,  // blanc
            paper:    0,  // noir
        }
    }
}

// Registres d'une voix SPU
#[derive(Debug, Clone, Default)]
pub struct SpuVoice {
    pub freq_lo: u8,
    pub freq_hi: u8,
    pub vol:     u8,
    pub attack:  u8,
    pub decay:   u8,
    pub sustain: u8,
    pub release: u8,
    pub ctrl:    u8,  // bit7=gate, bits3-0=waveform
}

#[derive(Debug, Clone)]
pub struct SpuState {
    pub voices:     [SpuVoice; 3],
    pub master_vol: u8,
    pub status:     u8,  // bit N = voix N active
    pub sample_lo:   u8,
    pub sample_hi:   u8,
    pub sample_len:  u8,
    pub sample_ctrl: u8,
}

impl Default for SpuState {
    fn default() -> Self {
        Self {
            voices:     [SpuVoice::default(), SpuVoice::default(), SpuVoice::default()],
            master_vol: 15,
            status:     0,
            sample_lo:   0,
            sample_hi:   0,
            sample_len:  0,
            sample_ctrl: 0,
        }
    }
}

// ── IoState global ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Default)]
pub struct IoState {
    pub kbd:        KeyboardState,
    pub pad:        PadState,
    pub mouse:      MouseState,
    pub vpu:        VpuState,
    pub spu:        SpuState,
    pub frame_count: u16,
    pub timer:      u16,        // compteur cycles CPU depuis reset
    pub irq_rate:   u8,         // 0=désactivé
    pub irq_ctrl:   u8,
    pub lfsr:       u16,        // PRNG
    pub pending_nmi: bool,      // NMI à déclencher au prochain step
    pub pending_reset: bool,    // RESET logiciel
}

impl IoState {
    pub fn new() -> Self {
        Self {
            lfsr: 0xACE1,
            ..Default::default()
        }
    }

    /// Appelé par le JS à chaque frame (60 Hz)
    pub fn vblank_tick(&mut self) {
        self.frame_count = self.frame_count.wrapping_add(1);
        // Positionne VBlank dans VPU_STATUS
        self.vpu.status |= VPU_STATUS_VBLANK;
        // Alterne le bit frame
        if self.frame_count & 1 == 0 {
            self.vpu.status |= VPU_STATUS_FRAME;
        } else {
            self.vpu.status &= !VPU_STATUS_FRAME;
        }
        // Si flip_request (bit 1) était demandé, effectue le swap et auto-clear le bit
        // (spec v1.1 correction #17 : bit 1 = flip_request, AUTO-CLEAR après VBlank)
        if self.vpu.ctrl & VPU_CTRL_FLIP != 0 {
            // Swap le bit d'état du buffer actif dans VPU_STATUS
            self.vpu.status ^= VPU_STATUS_BUF; // alterne bit1 (0=A actif, 1=B actif)
            // Auto-clear du flip_request
            self.vpu.ctrl &= !VPU_CTRL_FLIP;
        }
        // Déclenche NMI (VBlank non-masquable)
        self.pending_nmi = true;
    }

    /// Appelé après que le CPU a traité le VBlank
    pub fn clear_vblank(&mut self) {
        self.vpu.status &= !VPU_STATUS_VBLANK;
        self.pending_nmi = false;
    }

    /// Clavier — appelé par le JS
    pub fn set_key(&mut self, ascii: u8, raw: u8, modifiers: u8) {
        self.kbd.ascii     = ascii;
        self.kbd.raw       = raw;
        self.kbd.modifiers = modifiers;
        self.kbd.status    = KEY_STATUS_PRESSED;
    }

    pub fn clear_key(&mut self) {
        self.kbd.ascii  = 0;
        self.kbd.raw    = 0;
        self.kbd.status = 0;
    }

    /// Manette
    pub fn set_pad(&mut self, pad: u8, state: u8) {
        match pad {
            0 => self.pad.pad1 = state,
            1 => self.pad.pad2 = state,
            _ => {}
        }
    }

    /// Souris
    pub fn set_mouse(&mut self, x: u8, y: u8, btn: u8, scroll: i8) {
        self.mouse.dx = (x as i16 - self.mouse.x as i16).clamp(-127, 127) as i8;
        self.mouse.dy = (y as i16 - self.mouse.y as i16).clamp(-127, 127) as i8;
        self.mouse.x      = x;
        self.mouse.y      = y;
        self.mouse.btn    = btn;
        self.mouse.scroll = scroll;
    }

    /// PRNG — LFSR Galois 16-bit
    pub fn next_rand(&mut self) -> u8 {
        let bit = self.lfsr & 1;
        self.lfsr >>= 1;
        if bit != 0 { self.lfsr ^= 0xB400; }
        (self.lfsr & 0xFF) as u8
    }

    pub fn seed_rand(&mut self, seed: u16) {
        if seed != 0 { self.lfsr = seed; }
    }

    /// Lecture sans effet de bord d'un registre I/O (pour peek/debug/validation).
    /// Contrairement à read_register(), ne déclenche pas de reset de timer, etc.
    pub fn peek_register(&self, addr: u16) -> u8 {
        match addr {
            VPU_CTRL     => self.vpu.ctrl,
            VPU_BORDER   => self.vpu.border,
            VPU_SCROLL_X => self.vpu.scroll_x,
            VPU_SCROLL_Y => self.vpu.scroll_y,
            VPU_STATUS   => self.vpu.status,
            VPU_CURSOR_X => self.vpu.cursor_x,
            VPU_CURSOR_Y => self.vpu.cursor_y,
            VPU_INK      => self.vpu.ink,
            VPU_PAPER    => self.vpu.paper,
            SPU_MASTER_VOL => self.spu.master_vol,
            SPU_STATUS     => self.spu.status,
            SPU_SAMPLE_LO  => self.spu.sample_lo,
            SPU_SAMPLE_HI  => self.spu.sample_hi,
            SPU_SAMPLE_LEN => self.spu.sample_len,
            SPU_SAMPLE_CTRL => self.spu.sample_ctrl,
            0xD100..=0xD117 => self.peek_spu_voice(addr),
            KEY_ASCII    => self.kbd.ascii,
            KEY_STATUS   => self.kbd.status,
            KEY_MOD      => self.kbd.modifiers,
            KEY_RAW      => self.kbd.raw,
            PAD1_STATE   => self.pad.pad1,
            PAD2_STATE   => self.pad.pad2,
            MOUSE_X      => self.mouse.x,
            MOUSE_Y      => self.mouse.y,
            MOUSE_DX     => self.mouse.dx as u8,
            MOUSE_DY     => self.mouse.dy as u8,
            MOUSE_BTN    => self.mouse.btn,
            MOUSE_SCROLL => self.mouse.scroll as u8,
            SYS_TIMER_LO => (self.timer & 0xFF) as u8,
            SYS_TIMER_HI => (self.timer >> 8) as u8,
            SYS_FRAME_LO => (self.frame_count & 0xFF) as u8,
            SYS_FRAME_HI => (self.frame_count >> 8) as u8,
            SYS_RAND_REG => (self.lfsr & 0xFF) as u8,  // valeur courante sans avancer
            SYS_IRQ_RATE => self.irq_rate,
            SYS_IRQ_CTRL => self.irq_ctrl,
            SYS_CAPS     => 0b0000_0010,
            _            => 0,
        }
    }

    fn peek_spu_voice(&self, addr: u16) -> u8 {
        let voice_idx = ((addr - 0xD100) / 8) as usize;
        let reg_idx   = ((addr - 0xD100) % 8) as usize;
        if voice_idx >= 3 { return 0; }
        let v = &self.spu.voices[voice_idx];
        match reg_idx {
            0 => v.freq_lo, 1 => v.freq_hi, 2 => v.vol,
            3 => v.attack,  4 => v.decay,   5 => v.sustain,
            6 => v.release, 7 => v.ctrl,
            _ => 0,
        }
    }

    /// Lecture d'un registre I/O par le CPU
    pub fn read_register(&mut self, addr: u16) -> u8 {
        match addr {
            // VPU
            VPU_CTRL     => self.vpu.ctrl,
            VPU_BORDER   => self.vpu.border,
            VPU_SCROLL_X => self.vpu.scroll_x,
            VPU_SCROLL_Y => self.vpu.scroll_y,
            VPU_STATUS   => self.vpu.status,
            VPU_CURSOR_X => self.vpu.cursor_x,
            VPU_CURSOR_Y => self.vpu.cursor_y,
            VPU_INK      => self.vpu.ink,
            VPU_PAPER    => self.vpu.paper,
            VPU_CHAR_OUT => 0, // write-only

            // SPU lectures
            SPU_MASTER_VOL => self.spu.master_vol,
            SPU_STATUS     => self.spu.status,
            SPU_SAMPLE_LO  => self.spu.sample_lo,
            SPU_SAMPLE_HI  => self.spu.sample_hi,
            SPU_SAMPLE_LEN => self.spu.sample_len,
            SPU_SAMPLE_CTRL => self.spu.sample_ctrl,

            // Voix SPU
            0xD100..=0xD117 => self.read_spu_voice(addr),

            // Clavier
            KEY_ASCII   => {
                let v = self.kbd.ascii;
                v
            }
            KEY_STATUS  => self.kbd.status,
            KEY_MOD     => self.kbd.modifiers,
            KEY_RAW     => self.kbd.raw,

            // Manette
            PAD1_STATE  => self.pad.pad1,
            PAD2_STATE  => self.pad.pad2,
            PAD_CTRL    => 0,

            // Souris
            MOUSE_X     => self.mouse.x,
            MOUSE_Y     => self.mouse.y,
            MOUSE_DX    => self.mouse.dx as u8,
            MOUSE_DY    => self.mouse.dy as u8,
            MOUSE_BTN   => self.mouse.btn,
            MOUSE_SCROLL => self.mouse.scroll as u8,

            // Système
            SYS_TIMER_LO => (self.timer & 0xFF) as u8,
            SYS_TIMER_HI => {
                let hi = (self.timer >> 8) as u8;
                self.timer = 0; // reset à la lecture de HI (comme un vrai timer)
                hi
            }
            SYS_FRAME_LO => (self.frame_count & 0xFF) as u8,
            SYS_FRAME_HI => (self.frame_count >> 8) as u8,
            SYS_RAND_REG => self.next_rand(),
            SYS_IRQ_RATE => self.irq_rate,
            SYS_IRQ_CTRL => self.irq_ctrl,
            SYS_CAPS     => 0b0000_0010, // bit1 = émulateur

            _ => 0,
        }
    }

    /// Écriture d'un registre I/O par le CPU
    /// Retourne Some(action) si un effet de bord doit être traité par Memory
    pub fn write_register(&mut self, addr: u16, val: u8) -> Option<IoAction> {
        match addr {
            // VPU
            VPU_CTRL => {
                self.vpu.ctrl = val;
                None
            }
            VPU_BORDER   => { self.vpu.border   = val; None }
            VPU_SCROLL_X => { self.vpu.scroll_x = val; None }
            VPU_SCROLL_Y => { self.vpu.scroll_y = val; None }
            VPU_CURSOR_X => { self.vpu.cursor_x = val; None }
            VPU_CURSOR_Y => { self.vpu.cursor_y = val; None }
            VPU_INK      => { self.vpu.ink   = val & 0x0F; None }
            VPU_PAPER    => { self.vpu.paper = val & 0x0F; None }
            VPU_CHAR_OUT => Some(IoAction::PrintChar(val)),

            // SPU
            SPU_MASTER_VOL => { self.spu.master_vol = val & 0x0F; None }
            SPU_SAMPLE_LO  => { self.spu.sample_lo   = val; None }
            SPU_SAMPLE_HI  => { self.spu.sample_hi   = val; None }
            SPU_SAMPLE_LEN => { self.spu.sample_len  = val; None }
            SPU_SAMPLE_CTRL => { self.spu.sample_ctrl = val; None }
            0xD100..=0xD117 => { self.write_spu_voice(addr, val); None }

            // Clavier — acquitter
            KEY_STATUS => {
                if val == 0 { self.clear_key(); }
                None
            }

            // Manette — latch
            PAD_CTRL => None, // le latch est géré côté JS

            // Système
            SYS_IRQ_RATE => { self.irq_rate = val; None }
            SYS_IRQ_CTRL => { self.irq_ctrl = val; None }
            SYS_RAND_SEED => {
                // Seed avec val + frame_count pour éviter seed=0
                let seed = (val as u16) ^ self.frame_count ^ 0xACE1;
                self.seed_rand(seed);
                None
            }
            SYS_RESET_REG => {
                if val == 0xC7 {
                    self.pending_reset = true;
                }
                None
            }

            _ => None,
        }
    }

    fn read_spu_voice(&self, addr: u16) -> u8 {
        let voice_idx = ((addr - 0xD100) / 8) as usize;
        let reg_idx   = ((addr - 0xD100) % 8) as usize;
        if voice_idx >= 3 { return 0; }
        let v = &self.spu.voices[voice_idx];
        match reg_idx {
            0 => v.freq_lo,
            1 => v.freq_hi,
            2 => v.vol,
            3 => v.attack,
            4 => v.decay,
            5 => v.sustain,
            6 => v.release,
            7 => v.ctrl,
            _ => 0,
        }
    }

    fn write_spu_voice(&mut self, addr: u16, val: u8) {
        let voice_idx = ((addr - 0xD100) / 8) as usize;
        let reg_idx   = ((addr - 0xD100) % 8) as usize;
        if voice_idx >= 3 { return; }
        let v = &mut self.spu.voices[voice_idx];
        match reg_idx {
            0 => v.freq_lo  = val,
            1 => v.freq_hi  = val,
            2 => v.vol      = val,
            3 => v.attack   = val,
            4 => v.decay    = val,
            5 => v.sustain  = val,
            6 => v.release  = val,
            7 => {
                v.ctrl = val;
                // bit7=gate : mettre à jour status SPU
                let gate = (val & 0x80) != 0;
                if gate {
                    self.spu.status |= 1 << voice_idx;
                } else {
                    self.spu.status &= !(1 << voice_idx);
                }
            }
            _ => {}
        }
    }
}

/// Actions déclenchées par écriture dans un registre I/O
/// et nécessitant une action côté Memory
#[derive(Debug, Clone)]
pub enum IoAction {
    /// VPU_CHAR_OUT : écrire un caractère à la position curseur
    PrintChar(u8),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vblank_sets_nmi_and_status() {
        let mut io = IoState::new();
        assert!(!io.pending_nmi);
        io.vblank_tick();
        assert!(io.pending_nmi);
        assert!(io.vpu.status & VPU_STATUS_VBLANK != 0);
    }

    #[test]
    fn frame_counter_increments() {
        let mut io = IoState::new();
        for _ in 0..5 { io.vblank_tick(); io.clear_vblank(); }
        assert_eq!(io.frame_count, 5);
    }

    #[test]
    fn rand_changes() {
        let mut io = IoState::new();
        let a = io.next_rand();
        let b = io.next_rand();
        let c = io.next_rand();
        assert!(a != b || b != c);
    }

    #[test]
    fn key_set_and_clear() {
        let mut io = IoState::new();
        io.set_key(0x41, 0x41, 0);
        assert_eq!(io.read_register(KEY_ASCII), 0x41);
        assert_eq!(io.read_register(KEY_STATUS) & KEY_STATUS_PRESSED, KEY_STATUS_PRESSED);
        io.write_register(KEY_STATUS, 0);
        assert_eq!(io.read_register(KEY_ASCII), 0);
        assert_eq!(io.read_register(KEY_STATUS), 0);
    }

    #[test]
    fn pad_default_all_released() {
        let mut io = IoState::new();
        assert_eq!(io.read_register(PAD1_STATE), 0xFF);
    }

    #[test]
    fn pad_button_press() {
        let mut io = IoState::new();
        io.set_pad(0, 0xFF & !PAD_A); // bouton A enfoncé
        assert_eq!(io.read_register(PAD1_STATE) & PAD_A, 0);
    }

    #[test]
    fn spu_voice_write_read() {
        let mut io = IoState::new();
        io.write_register(0xD100, 0xE0); // freq_lo voix 0
        io.write_register(0xD101, 0x08); // freq_hi
        io.write_register(0xD107, 0x81); // gate=1, waveform=carré
        assert_eq!(io.read_register(0xD100), 0xE0);
        assert_eq!(io.read_register(0xD101), 0x08);
        assert!(io.spu.status & 1 != 0); // voix 0 active
    }

    #[test]
    fn vpu_mode_switch() {
        let mut io = IoState::new();
        assert_eq!(io.vpu.ctrl & VPU_CTRL_MODE, 0); // mode texte par défaut
        io.write_register(VPU_CTRL, VPU_CTRL_ENABLE | VPU_CTRL_MODE);
        assert_eq!(io.read_register(VPU_CTRL) & VPU_CTRL_MODE, VPU_CTRL_MODE);
    }

    #[test]
    fn timer_hi_resets_on_read() {
        let mut io = IoState::new();
        io.timer = 0x1234;
        let lo = io.read_register(SYS_TIMER_LO);
        let hi = io.read_register(SYS_TIMER_HI); // reset ici
        assert_eq!(lo, 0x34);
        assert_eq!(hi, 0x12);
        assert_eq!(io.timer, 0);
    }
}