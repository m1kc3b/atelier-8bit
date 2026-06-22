// chuck-core/src/assembler/chuck_inc.rs
//
// Header système virtuel « chuck.inc ».
//
// L'assembleur Chuck-8 n'a pas de système de fichiers : `.include "chuck.inc"`
// ne lit aucun fichier disque. À la place, cette table de constantes est
// intégrée au binaire et injectée par le parser comme une série de
// définitions `NOM = valeur` (équivalent `.define`).
//
// SOURCE AUTORITATIVE : Chuck-8_specs-2.0.md, Annexe A — alignée sur la ROM
// réelle (chuck-core/src/rom.rs) pour les cas où la spec se contredit :
//   - SYS_RAND  était défini 2× ($D306 registre / $F05A routine)
//     → désambiguïsé en SYS_RAND_REG et SYS_GET_RAND.
//   - SYS_RESET était défini 2× ($D308 registre / $F06C routine)
//     → désambiguïsé en SYS_RESET_REG et SYS_SOFT_RESET.
// Sans cette désambiguïsation, la 2ᵉ affectation `=` écraserait la 1ʳᵉ en
// silence et produirait un bug invisible.

/// Le seul nom d'include reconnu.
pub const CHUCK_INC_NAME: &str = "chuck.inc";

/// Table (nom, valeur) du header système. Toutes les valeurs tiennent sur 16 bits.
pub const CHUCK_INC_CONSTANTS: &[(&str, u16)] = &[
    // ── Couleurs (mode graphique, 16 couleurs) ──────────────────────
    ("COLOR_BLACK", 0),
    ("COLOR_WHITE", 1),
    ("COLOR_RED", 2),
    ("COLOR_CYAN", 3),
    ("COLOR_PURPLE", 4),
    ("COLOR_GREEN", 5),
    ("COLOR_BLUE", 6),
    ("COLOR_YELLOW", 7),
    ("COLOR_ORANGE", 8),
    ("COLOR_BROWN", 9),
    ("COLOR_PINK", 10),
    ("COLOR_DKGRAY", 11),
    ("COLOR_MDGRAY", 12),
    ("COLOR_LTGREEN", 13),
    ("COLOR_LTBLUE", 14),
    ("COLOR_LTGRAY", 15),

    // ── VPU — Registres ($D000–$D00F) ───────────────────────────────
    ("VPU_CTRL", 0xD000),
    ("VPU_BORDER", 0xD001),
    ("VPU_SCROLL_X", 0xD002),
    ("VPU_SCROLL_Y", 0xD003),
    ("VPU_STATUS", 0xD004),
    ("VPU_SPR_CTRL", 0xD005),
    ("VPU_SPR_IDX", 0xD006),
    ("VPU_SPR_X", 0xD007),
    ("VPU_SPR_Y", 0xD008),
    ("VPU_SPR_FLAGS", 0xD009),
    ("VPU_SPR_TILE", 0xD00A),
    ("VPU_CURSOR_X", 0xD00B),
    ("VPU_CURSOR_Y", 0xD00C),
    ("VPU_INK", 0xD00D),
    ("VPU_PAPER", 0xD00E),
    ("VPU_CHAR_OUT", 0xD00F),

    // ── SPU — Registres ($D100–$D125) ───────────────────────────────
    ("SPU_V0_BASE", 0xD100),
    ("SPU_V1_BASE", 0xD108),
    ("SPU_V2_BASE", 0xD110),
    ("SPU_MASTER_VOL", 0xD120),
    ("SPU_STATUS", 0xD121),
    ("SPU_SAMPLE_LO", 0xD122),
    ("SPU_SAMPLE_HI", 0xD123),
    ("SPU_SAMPLE_LEN", 0xD124),
    ("SPU_SAMPLE_CTRL", 0xD125),

    // ── INPUT — Registres ($D200–$D225) ─────────────────────────────
    ("KEY_ASCII", 0xD200),
    ("KEY_STATUS", 0xD201),
    ("KEY_MOD", 0xD202),
    ("KEY_RAW", 0xD203),
    ("PAD1_STATE", 0xD210),
    ("PAD2_STATE", 0xD211),
    ("PAD_CTRL", 0xD212),
    ("MOUSE_X", 0xD220),
    ("MOUSE_Y", 0xD221),
    ("MOUSE_BTN", 0xD224),
    ("MOUSE_SCROLL", 0xD225),

    // ── SYSTEM — Registres ($D300–$D309) ────────────────────────────
    ("SYS_TIMER_LO", 0xD300),
    ("SYS_TIMER_HI", 0xD301),
    ("SYS_IRQ_RATE", 0xD302),
    ("SYS_IRQ_CTRL", 0xD303),
    ("SYS_FRAME_LO", 0xD304),
    ("SYS_FRAME_HI", 0xD305),
    ("SYS_RAND_REG", 0xD306),   // LFSR matériel (lecture directe)
    ("SYS_RAND_SEED", 0xD307),
    ("SYS_RESET_REG", 0xD308),
    ("SYS_CAPS", 0xD309),

    // ── Pad — masques de boutons (logique NES) ──────────────────────
    ("PAD_UP", 0b0000_0001),
    ("PAD_DOWN", 0b0000_0010),
    ("PAD_LEFT", 0b0000_0100),
    ("PAD_RIGHT", 0b0000_1000),
    ("PAD_START", 0b0001_0000),
    ("PAD_SELECT", 0b0010_0000),
    ("PAD_B", 0b0100_0000),
    ("PAD_A", 0b1000_0000),

    // ── API ROM — Jump table ($F000–$F06F), appel par JSR ───────────
    ("SYS_CLEAR", 0xF000),
    ("SYS_DRAW_PIXEL", 0xF003),
    ("SYS_DRAW_LINE", 0xF006),
    ("SYS_DRAW_RECT", 0xF009),
    ("SYS_FILL_RECT", 0xF00C),
    ("SYS_BLIT", 0xF00F),
    ("SYS_DRAW_SPR", 0xF012),
    ("SYS_SET_PIXEL", 0xF015),
    ("SYS_FLIP", 0xF018),
    ("SYS_SET_MODE", 0xF01B),
    ("SYS_PRINT_CHAR", 0xF01E),
    ("SYS_PRINT_STR", 0xF021),
    ("SYS_PRINT_NUM", 0xF024),
    ("SYS_PRINT_HEX", 0xF027),
    ("SYS_SET_CURSOR", 0xF02A),
    ("SYS_GET_CURSOR", 0xF02D),
    ("SYS_SET_COLOR", 0xF030),
    ("SYS_SCROLL_UP", 0xF033),
    ("SYS_PLAY_NOTE", 0xF036),
    ("SYS_STOP_VOICE", 0xF039),
    ("SYS_STOP_ALL", 0xF03C),
    ("SYS_PLAY_SFX", 0xF03F),
    ("SYS_SET_VOL", 0xF042),
    ("SYS_READ_PAD", 0xF048),
    ("SYS_READ_KEY", 0xF04B),
    ("SYS_WAIT_KEY", 0xF04E),
    ("SYS_READ_MOUSE", 0xF051),
    ("SYS_KEY_DOWN", 0xF054),
    ("SYS_WAIT_VBLANK", 0xF057),
    ("SYS_GET_RAND", 0xF05A),   // routine API (≠ SYS_RAND_REG=$D306)
    ("SYS_RAND16", 0xF05D),
    ("SYS_MEMCPY", 0xF060),
    ("SYS_MEMSET", 0xF063),
    ("SYS_MEMCMP", 0xF066),
    ("SYS_FRAME_NUM", 0xF069),
    ("SYS_SOFT_RESET", 0xF06C), // routine API (≠ SYS_RESET_REG=$D308)
    ("SYS_VERSION", 0xF06F),

    // ── Zones mémoire utiles ────────────────────────────────────────
    ("ZP_PARAMS", 0x0080),      // zone paramètres ABI ($80–$EF)
    ("ZP_PTR0", 0x00F0),        // pointeurs volatiles ($F0–$FF)
    ("FRAMEBUF_A", 0x4000),
    ("FRAMEBUF_B", 0x6000),
    ("VRAM_TEXT", 0x4800),
    ("VRAM_ATTR", 0x4C00),
];

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn no_duplicate_names() {
        let mut seen = HashSet::new();
        for (name, _) in CHUCK_INC_CONSTANTS {
            assert!(seen.insert(*name), "constante dupliquée : {name}");
        }
    }

    #[test]
    fn key_constants_present() {
        let map: std::collections::HashMap<_, _> =
            CHUCK_INC_CONSTANTS.iter().copied().collect();
        assert_eq!(map["SYS_DRAW_PIXEL"], 0xF003);
        assert_eq!(map["SYS_WAIT_VBLANK"], 0xF057);
        assert_eq!(map["PAD_UP"], 0b0000_0001);
        assert_eq!(map["COLOR_WHITE"], 1);
    }
}
