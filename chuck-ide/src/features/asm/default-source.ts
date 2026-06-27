/* features/asm/default-source.ts — code par défaut de l'éditeur au démarrage. */

export const DEFAULT_SOURCE = `; ══════════════════════════════════════════════════
;  CHUCK-8 COMPUTER — Programme de démonstration
;  Dessine des pixels aléatoires sur l'écran
; ══════════════════════════════════════════════════

SYS_CLEAR      = $F000
SYS_DRAW_PIXEL = $F003
SYS_GET_RAND   = $F05A
VPU_CTRL       = $D000

  .org $E000

INIT:
  LDA #$81
  STA VPU_CTRL

  LDA #0
  JSR SYS_CLEAR

LOOP:
  ; Couleur aléatoire (évite le noir)
  JSR SYS_GET_RAND
  AND #$0F
  BEQ LOOP

  PHA

  ; X aléatoire (0-127)
  JSR SYS_GET_RAND
  AND #$7F
  TAX

  ; Y aléatoire (0-127)
  JSR SYS_GET_RAND
  AND #$7F
  TAY

  PLA
  JSR SYS_DRAW_PIXEL

  JMP LOOP
`;
