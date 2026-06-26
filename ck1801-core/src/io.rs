// io.rs — Périphériques mémoire-mappés du CK-1801 (déterministes).
//
// Référence normative : §16 (memory map), §19 (registres VPU/SPU/I-O),
// définition LFSR (§19, masque 0xB400), Annexe C (déterminisme).
//
// Ce module modélise l'ÉTAT des périphériques accessibles via la mémoire, sans
// rendu graphique/sonore réel : pour la notation, seul compte un état déterministe
// et reproductible. `Memory` délègue à `Io` les accès aux plages device.
//
// Invariant : aucune opération ne panique ; toute adresse device est bornée.

// ── Adresses de registres (§19) ─────────────────────────────────────────────

pub mod reg {
    // VPU $D000–$D0FF
    pub const VPU_MODE: u16 = 0xD000;
    pub const VPU_STATUS: u16 = 0xD001; // bit0 = VBlank en cours
    pub const VPU_CURSOR_X: u16 = 0xD002;
    pub const VPU_CURSOR_Y: u16 = 0xD003;
    pub const VPU_SCROLL: u16 = 0xD004;

    // Entrées (lecture seule côté programme) $D200–$D2FF
    pub const KEY_RAW: u16 = 0xD200;
    pub const KEY_ASCII: u16 = 0xD201;
    pub const PAD0: u16 = 0xD210;
    pub const PAD1: u16 = 0xD211;
    pub const MOUSE_X: u16 = 0xD220;
    pub const MOUSE_Y: u16 = 0xD221;
    pub const MOUSE_BTN: u16 = 0xD222;

    // Système $D300–$D308
    pub const TIMER_LO: u16 = 0xD300;
    pub const TIMER_HI: u16 = 0xD301;
    pub const TIMER_PERIOD: u16 = 0xD302;
    pub const TIMER_CTRL: u16 = 0xD303; // bit0 = enable
    pub const FRAME_LO: u16 = 0xD304;
    pub const FRAME_HI: u16 = 0xD305;
    pub const RESET: u16 = 0xD306;
    pub const RNG_LO: u16 = 0xD307;
    pub const RNG_HI: u16 = 0xD308;
}

/// Masque de rétroaction du LFSR 16 bits Galois (§19).
pub const LFSR_MASK: u16 = 0xB400;
/// Seed par défaut au boot (non nul ; l'état $0000 est absorbant et interdit).
pub const LFSR_DEFAULT_SEED: u16 = 0xACE1;

pub const TIMER_CTRL_ENABLE: u8 = 0b0000_0001;

/// Bornes de la zone clavier en lecture seule côté programme ($D200–$D2FF).
pub const INPUT_RO_START: u16 = 0xD200;
pub const INPUT_RO_END: u16 = 0xD2FF;

/// État des périphériques. Volontairement plat et `Copy`-friendly pour le
/// déterminisme et la facilité de snapshot par le harnais.
#[derive(Clone, Debug)]
pub struct Io {
    // VPU
    pub vpu_mode: u8,
    pub vpu_status: u8,
    pub cursor_x: u8,
    pub cursor_y: u8,
    pub scroll: u8,
    /// Couleur texte courante (INK 7-4, PAPER 3-0), posée par SYS_SET_COLOR.
    pub text_color: u8,

    // Entrées (injectées par le harnais, jamais lues d'un état hôte)
    pub key_raw: u8,
    pub key_ascii: u8,
    pub pad0: u8,
    pub pad1: u8,
    pub mouse_x: u8,
    pub mouse_y: u8,
    pub mouse_btn: u8,

    // Timer
    pub timer: u16,
    pub timer_period: u8,
    pub timer_ctrl: u8,

    // Frames
    pub frame: u16,

    // RNG (LFSR)
    pub lfsr: u16,

    /// Indicateur : une écriture en $D306 a demandé un SYS_RESET.
    pub reset_requested: bool,
}

impl Default for Io {
    fn default() -> Self {
        Self::new()
    }
}

impl Io {
    pub fn new() -> Self {
        Io {
            vpu_mode: 0,
            vpu_status: 0,
            cursor_x: 0,
            cursor_y: 0,
            scroll: 0,
            text_color: 0x0F, // INK blanc / PAPER noir par défaut
            key_raw: 0,
            key_ascii: 0,
            pad0: 0,
            pad1: 0,
            mouse_x: 0,
            mouse_y: 0,
            mouse_btn: 0,
            timer: 0,
            timer_period: 0,
            timer_ctrl: 0,
            frame: 0,
            lfsr: LFSR_DEFAULT_SEED,
            reset_requested: false,
        }
    }

    /// Une adresse appartient-elle à une plage device gérée par ce module ?
    #[inline]
    pub fn handles(addr: u16) -> bool {
        matches!(addr,
            reg::VPU_MODE..=reg::VPU_SCROLL
            | INPUT_RO_START..=INPUT_RO_END
            | reg::TIMER_LO..=reg::RNG_HI
        )
    }

    /// Lecture d'un registre device (côté programme).
    #[inline]
    pub fn read(&self, addr: u16) -> u8 {
        match addr {
            reg::VPU_MODE => self.vpu_mode,
            reg::VPU_STATUS => self.vpu_status,
            reg::VPU_CURSOR_X => self.cursor_x,
            reg::VPU_CURSOR_Y => self.cursor_y,
            reg::VPU_SCROLL => self.scroll,

            reg::KEY_RAW => self.key_raw,
            reg::KEY_ASCII => self.key_ascii,
            reg::PAD0 => self.pad0,
            reg::PAD1 => self.pad1,
            reg::MOUSE_X => self.mouse_x,
            reg::MOUSE_Y => self.mouse_y,
            reg::MOUSE_BTN => self.mouse_btn,

            reg::TIMER_LO => (self.timer & 0xFF) as u8,
            reg::TIMER_HI => (self.timer >> 8) as u8,
            reg::TIMER_PERIOD => self.timer_period,
            reg::TIMER_CTRL => self.timer_ctrl,
            reg::FRAME_LO => (self.frame & 0xFF) as u8,
            reg::FRAME_HI => (self.frame >> 8) as u8,
            reg::RESET => 0, // RESET est write-only en pratique
            reg::RNG_LO => (self.lfsr & 0xFF) as u8,
            reg::RNG_HI => (self.lfsr >> 8) as u8,

            // Plage device non spécifiquement mappée → $00 (cohérent §13)
            _ => 0,
        }
    }

    /// Écriture d'un registre device (côté programme). Applique les règles RO §13.
    #[inline]
    pub fn write(&mut self, addr: u16, val: u8) {
        // Zone d'entrées : lecture seule côté programme (§13).
        if (INPUT_RO_START..=INPUT_RO_END).contains(&addr) {
            return;
        }
        match addr {
            reg::VPU_MODE => self.vpu_mode = val,
            reg::VPU_STATUS => self.vpu_status = val,
            reg::VPU_CURSOR_X => self.cursor_x = val,
            reg::VPU_CURSOR_Y => self.cursor_y = val,
            reg::VPU_SCROLL => self.scroll = val,

            reg::TIMER_LO => self.timer = (self.timer & 0xFF00) | val as u16,
            reg::TIMER_HI => self.timer = (self.timer & 0x00FF) | ((val as u16) << 8),
            reg::TIMER_PERIOD => self.timer_period = val,
            reg::TIMER_CTRL => self.timer_ctrl = val,
            reg::FRAME_LO => self.frame = (self.frame & 0xFF00) | val as u16,
            reg::FRAME_HI => self.frame = (self.frame & 0x00FF) | ((val as u16) << 8),
            reg::RESET => self.reset_requested = true, // §18 SYS_RESET
            reg::RNG_LO => self.set_lfsr_lo(val),
            reg::RNG_HI => self.set_lfsr_hi(val),

            _ => {} // plage device non mappée : écriture ignorée
        }
    }

    // ── LFSR (§19) ───────────────────────────────────────────────────────────

    #[inline]
    fn normalize_lfsr(&mut self) {
        // L'état $0000 est absorbant : le matériel force la valeur par défaut.
        if self.lfsr == 0 {
            self.lfsr = LFSR_DEFAULT_SEED;
        }
    }

    fn set_lfsr_lo(&mut self, val: u8) {
        self.lfsr = (self.lfsr & 0xFF00) | val as u16;
        self.normalize_lfsr();
    }
    fn set_lfsr_hi(&mut self, val: u8) {
        self.lfsr = (self.lfsr & 0x00FF) | ((val as u16) << 8);
        self.normalize_lfsr();
    }

    /// Avance le LFSR d'un pas (Galois, masque 0xB400) et renvoie l'état complet.
    #[inline]
    pub fn lfsr_step(&mut self) -> u16 {
        self.normalize_lfsr();
        let bit = self.lfsr & 1;
        self.lfsr >>= 1;
        if bit == 1 {
            self.lfsr ^= LFSR_MASK;
        }
        self.normalize_lfsr();
        self.lfsr
    }

    /// SYS_GET_RAND (#65) : un pas, renvoie l'octet de poids faible.
    #[inline]
    pub fn rand8(&mut self) -> u8 {
        (self.lfsr_step() & 0xFF) as u8
    }

    // ── Timer & frames (pilotés par l'horloge CPU, câblage dans cpu.rs) ───────

    /// Le timer est-il armé (§15) ?
    #[inline]
    pub fn timer_enabled(&self) -> bool {
        self.timer_ctrl & TIMER_CTRL_ENABLE != 0
    }

    /// Incrémente le compteur de frames (appelé au VBlank).
    #[inline]
    pub fn tick_frame(&mut self) {
        self.frame = self.frame.wrapping_add(1);
    }

    // ── Injection d'entrées par le harnais (jamais depuis l'hôte) ─────────────
    pub fn set_key(&mut self, raw: u8, ascii: u8) {
        self.key_raw = raw;
        self.key_ascii = ascii;
    }
    pub fn set_pads(&mut self, pad0: u8, pad1: u8) {
        self.pad0 = pad0;
        self.pad1 = pad1;
    }
    pub fn set_mouse(&mut self, x: u8, y: u8, btn: u8) {
        self.mouse_x = x;
        self.mouse_y = y;
        self.mouse_btn = btn;
    }
}