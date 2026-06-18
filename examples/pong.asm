VPU_CTRL    = $D000
KEY_ASCII   = $D200
SYS_CLEAR   = $F000
SYS_DRAW_PIXEL = $F003

COLOR_WHITE = 1
COLOR_RED   = 2
COLOR_YELLOW = 7

BALL_X      = $10
BALL_Y      = $11
BALL_DX     = $12
BALL_DY     = $13
BALL_SPEED  = $14
PAD_L_Y     = $15
PAD_R_Y     = $16
SCORE_L     = $17
SCORE_R     = $18
DRAW_CTR    = $20
FRAME_RDY   = $21   ; flag : 1 = nouveau frame à traiter

  .org $E000
  
START:
  LDA #%11000001    ; bit7=vpu_enable, bit6=nmi_enable, bit0=mode gfx
  STA VPU_CTRL
  LDA #64
  STA BALL_X
  LDA #64
  STA BALL_Y
  LDA #1
  STA BALL_DX
  LDA #1
  STA BALL_DY
  LDA #1
  STA BALL_SPEED
  LDA #58
  STA PAD_L_Y
  LDA #58
  STA PAD_R_Y
  LDA #0
  STA SCORE_L
  LDA #0
  STA SCORE_R
  LDA #0
  STA FRAME_RDY

MAIN_LOOP:
  LDA FRAME_RDY
  BEQ MAIN_LOOP     ; attendre le prochain VBlank
  LDA #0
  STA FRAME_RDY

  LDA #0
  JSR SYS_CLEAR


  ; ── INPUT ─────────────────────────────────────────
  LDA KEY_ASCII
  CMP #'w'
  BEQ @pad_up
  CMP #'s'
  BEQ @pad_down
  JMP @no_input
@pad_up:
  LDA PAD_L_Y
  BEQ @no_input
  DEC PAD_L_Y
  JMP @no_input
@pad_down:
  LDA PAD_L_Y
  CMP #117
  BCS @no_input
  INC PAD_L_Y
@no_input:

  ; ── IA raquette droite ────────────────────────────
  LDA BALL_Y
  CMP PAD_R_Y
  BEQ @ai_done
  BCC @ai_up
  INC PAD_R_Y
  JMP @ai_done
@ai_up:
  DEC PAD_R_Y
@ai_done:

  ; ── PHYSIQUE BALLE ────────────────────────────────
  LDA BALL_X
  CLC
  ADC BALL_DX
  STA BALL_X
  LDA BALL_Y
  CLC
  ADC BALL_DY
  STA BALL_Y

  ; Rebond bord haut (Y=0)
  LDA BALL_Y
  BNE @no_top
  LDA BALL_DY
  EOR #$FF
  CLC
  ADC #1
  STA BALL_DY
@no_top:

  ; Rebond bord bas (Y=127)
  LDA BALL_Y
  CMP #127
  BNE @no_bot
  LDA BALL_DY
  EOR #$FF
  CLC
  ADC #1
  STA BALL_DY
@no_bot:

  ; ── Collision raquette GAUCHE (x=8) ──────────────
  LDA BALL_X
  CMP #8
  BNE @no_pad_l
  LDA BALL_DX
  BMI @no_pad_l
  LDA BALL_Y
  CMP PAD_L_Y
  BCC @no_pad_l
  LDA PAD_L_Y
  CLC
  ADC #10
  CMP BALL_Y
  BCC @no_pad_l
  LDA BALL_DX
  EOR #$FF
  CLC
  ADC #1
  STA BALL_DX
  INC BALL_SPEED
  LDA BALL_SPEED
  CMP #5
  BCC @no_pad_l
  LDA #4
  STA BALL_SPEED
@no_pad_l:

  ; ── Collision raquette DROITE (x=119) ────────────
  LDA BALL_X
  CMP #119
  BNE @no_pad_r
  LDA BALL_DX
  BPL @no_pad_r
  LDA BALL_Y
  CMP PAD_R_Y
  BCC @no_pad_r
  LDA PAD_R_Y
  CLC
  ADC #10
  CMP BALL_Y
  BCC @no_pad_r
  LDA BALL_DX
  EOR #$FF
  CLC
  ADC #1
  STA BALL_DX
  INC BALL_SPEED
  LDA BALL_SPEED
  CMP #5
  BCC @no_pad_r
  LDA #4
  STA BALL_SPEED
@no_pad_r:

  ; ── Point côté droit ─────────────────────────────
  LDA BALL_X
  CMP #121
  BCC @no_point_r
  INC SCORE_R
  LDA #64
  STA BALL_X
  LDA #64
  STA BALL_Y
  LDA #1
  STA BALL_DX
  LDA #1
  STA BALL_DY
  LDA #1
  STA BALL_SPEED
@no_point_r:

  ; ── Point côté gauche ────────────────────────────
  LDA BALL_X
  CMP #4
  BCS @no_point_l
  INC SCORE_L
  LDA #64
  STA BALL_X
  LDA #64
  STA BALL_Y
  LDA #1
  STA BALL_DX
  LDA #1
  STA BALL_DY
  LDA #1
  STA BALL_SPEED
@no_point_l:

  ; ── DRAW balle ────────────────────────────────────
  LDA #COLOR_WHITE
  LDX BALL_X
  LDY BALL_Y
  JSR SYS_DRAW_PIXEL

  ; ── DRAW raquette gauche ──────────────────────────
  LDX #8
  LDY PAD_L_Y
  LDA #10
  STA DRAW_CTR
@draw_pad_l:
  LDA #COLOR_YELLOW
  JSR SYS_DRAW_PIXEL
  INY
  DEC DRAW_CTR
  BNE @draw_pad_l

  ; ── DRAW raquette droite ──────────────────────────
  LDX #119
  LDY PAD_R_Y
  LDA #10
  STA DRAW_CTR
@draw_pad_r:
  LDA #COLOR_RED
  JSR SYS_DRAW_PIXEL
  INY
  DEC DRAW_CTR
  BNE @draw_pad_r

  JMP MAIN_LOOP

; ── NMI HANDLER (déclenché par VBlank) ─────────────
NMI_HANDLER:
  PHA
  LDA #1
  STA FRAME_RDY
  PLA
  RTI

  .org $FFFA
  .word NMI_HANDLER  ; vecteur NMI
  .word START        ; vecteur RESET
  .word $0000        ; vecteur IRQ (inutilisé)