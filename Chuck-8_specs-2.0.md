# CHUCK-8 COMPUTER SYSTEM SPECIFICATION
## Version 1.0 — Draft

```
  ██████╗██╗  ██╗██╗   ██╗ ██████╗██╗  ██╗      █████╗
 ██╔════╝██║  ██║██║   ██║██╔════╝██║ ██╔╝     ██╔══██╗
 ██║     ███████║██║   ██║██║     █████╔╝      ╚█████╔╝
 ██║     ██╔══██║██║   ██║██║     ██╔═██╗      ██╔══██╗
 ╚██████╗██║  ██║╚██████╔╝╚██████╗██║  ██╗     ╚█████╔╝
  ╚═════╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝     ╚════╝
  C O M P U T E R   S Y S T E M   S P E C I F I C A T I O N
```

**Révision :** 1.0-DRAFT  
**Date :** 2025  
**Statut :** Reference Document

---

## PRÉAMBULE

Le Chuck-8 est un ordinateur personnel 8-bit imaginaire à vocation pédagogique.
Sa conception s'inspire directement des machines des années 1975–1985 (Apple II,
Commodore 64, Atari 800) tout en restant cohérente et accessible.

**Philosophie :**
- Fidélité au 6502 original — pas d'extensions, pas de raccourcis
- Règles fixes et documentées — la machine ne change pas
- Constructible en hardware — chaque décision est motivée par la faisabilité réelle
- Pédagogique avant tout — comprendre pourquoi, pas seulement comment

---

## CHAPITRE 1 — VUE D'ENSEMBLE

### 1.1 Caractéristiques principales

| Composant         | Spécification                                    |
|-------------------|--------------------------------------------------|
| CPU               | MOS 6502 (1 MHz simulé)                          |
| RAM               | 64 Ko (65 536 octets)                            |
| ROM               | 4 Ko ($F000–$FFFF) — système + vecteurs          |
| Vidéo             | 128×128 pixels, 16 couleurs, 2 modes             |
| VRAM              | 16 Ko ($4000–$7FFF)                              |
| Texte             | 16x16 caractères (mode texte)                    |
| Son               | 3 voix (carrée + triangle + bruit), 1 bit sample |
| Clavier           | ASCII complet + touches spéciales                |
| Manette           | 2 × 8 boutons (compatible NES)                   |
| Souris            | X/Y + 2 boutons                                  |
| Cartouche         | 16 Ko max ($8000–$BFFF)                          |
| Fréquence CPU     | 1 MHz (1 000 000 cycles/seconde)                 |
| Framerate cible   | 50 Hz (PAL) ou 60 Hz (NTSC) — configurable       |

### 1.2 Blocs fonctionnels

```
┌────────────────────────────────────────────────────────┐
│                    BUS PRINCIPAL 8-bit                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │  6502    │  │  64 Ko   │  │  I/O Chip (virtuel)  │  │
│  │  CPU     │  │  RAM     │  │  $D000–$D0FF         │  │
│  │  1 MHz   │  │          │  │  clavier/pad/souris  │  │
│  └──────────┘  └──────────┘  └──────────────────────┘  │
│  ┌──────────────────────┐    ┌──────────────────────┐  │
│  │  VPU (Video)         │    │  SPU (Sound)         │  │
│  │  $4000–$7FFF VRAM    │    │  $D100–$D1FF regs    │  │
│  │  128×128 / 16×16 txt │    │  3 voix + enveloppe  │  │
│  └──────────────────────┘    └──────────────────────┘  │
│  ┌──────────────────────┐    ┌──────────────────────┐  │
│  │  CART ROM (optionnel)│    │  SYS ROM             │  │
│  │  $8000–$BFFF 16 Ko   │    │  $F000–$FFFF 4 Ko    │  │
│  └──────────────────────┘    └──────────────────────┘  │
└────────────────────────────────────────────────────────┘
```
La plage `$4000–$7FFF` se reconfigure selon le mode sélectionné dans le registre `$D000`. 
Dans le mode bitmap, les ressources "Texte" sont désactivées pour laisser la place aux deux buffers vidéo.

---

## CHAPITRE 2 — CPU : MOS 6502

### 2.1 Registres

| Registre | Taille | Description                                  |
|----------|--------|----------------------------------------------|
| A        | 8 bits | Accumulateur - toutes les opérations passent ici |
| X        | 8 bits | Index - adressage indexé, compteurs          |
| Y        | 8 bits | Index - adressage indexé, compteurs          |
| PC       | 16 bits| Program Counter - adresse de la prochaine instruction |
| SP       | 8 bits | Stack Pointer - pointe dans $0100–$01FF      |
| P        | 8 bits | Statut - Processor Status — 7 flags                   |

### 2.2 Flags (registre P)

```
Bit : 7  6  5  4  3  2  1  0
      N  V  -  B  D  I  Z  C
      │  │  │  │  │  │  │  └── Carry
      │  │  │  │  │  │  └───── Zero
      │  │  │  │  │  └──────── Interrupt Disable
      │  │  │  │  └─────────── Decimal (BCD — actif mais rare)
      │  │  │  └────────────── Break
      │  │  └───────────────── (toujours 1)
      │  └──────────────────── oVerflow
      └─────────────────────── Negative
```

### 2.3 Modes d'adressage supportés (13 modes)

| Mode | Syntaxe ca65 | Exemple | Taille |
|------|-------------|---------|--------|
| Implicite | — | `CLC` | 1 octet |
| Accumulateur | `A` | `ASL A` | 1 octet |
| Immédiat | `#val` | `LDA #$42` | 2 octets |
| Zero Page | `$zz` | `LDA $10` | 2 octets |
| Zero Page,X | `$zz,X` | `LDA $10,X` | 2 octets |
| Zero Page,Y | `$zz,Y` | `LDX $10,Y` | 2 octets |
| Absolu | `$xxxx` | `LDA $1234` | 3 octets |
| Absolu,X | `$xxxx,X` | `LDA $1234,X` | 3 octets |
| Absolu,Y | `$xxxx,Y` | `LDA $1234,Y` | 3 octets |
| Indirect | `($xxxx)` | `JMP ($FFFE)` | 3 octets |
| (Indirect,X) | `($zz,X)` | `LDA ($10,X)` | 2 octets |
| (Indirect),Y | `($zz),Y` | `STA ($10),Y` | 2 octets |
| Relatif | `label` | `BEQ LOOP` | 2 octets |

### 2.4 Timing

- **Clock :** 1 MHz (1 µs par cycle)
- **Instruction la plus courte :** 2 cycles (NOP, CLC...)
- **Instruction la plus longue :** 7 cycles (BRK, interruptions)
- **Page cross :** +1 cycle sur Absolu,X / Absolu,Y / (Indirect),Y
- **Branch taken :** +1 cycle, +2 si page cross
- **VBlank :** toutes les 16 667 µs @ 60 Hz (16 667 cycles CPU)

Le CPU et le VPU partagent le même cycle (ou sont entrelacés), 
sinon ton émulateur aura du mal à savoir quand mettre à jour l'écran.

### 2.5 Vecteurs d'interruption

| Adresse | Nom | Déclenchement |
|---------|-----|---------------|
| `$FFFA/$FFFB` | NMI | VBlank (chaque frame) — non masquable |
| `$FFFC/$FFFD` | RESET | Démarrage machine, appui bouton RESET |
| `$FFFE/$FFFF` | IRQ | Timer programmable (via $D080) |

Le vecteur RESET ( $FFFC) doit pointer vers le BIOS, 
qui s'occupera d'initialiser les registres et de sauter au programme utilisateur ($8000 si cartouche, ou $0200 si RAM).
---

## CHAPITRE 3 — MEMORY MAP

La mémoire du Chuck-8 est organisée sur un espace adressable de 64 Ko ($0000–$FFFF), conforme à l'architecture du processeur MOS 6502.

### 3.1 Carte mémoire globale

|Plage adresse|Usage|Accès|
|-------------|-----|-----|
|$0000-$00FF  |ZeroPage (Variables rapides)|R/W|
|$0100-$01FF  |Pile CPU (Stack)|R/W|
|$0200-$3FFF  |Ram program/data|R/W|
|$4000-$7FFF  |VRAM dynamique (Mode 0 ou 1)|R/W|
|$8000-$BFFF  |Cartouche ROM|R|
|$C000-$CFFF  |RAM Expansion / Sauvegarde|R/W|
|$D000-$DFFF  |Registres I/O (VPU, SPU, Pads)|R/W|
|$F000-$FFFF  |ROM Système (BIOS)|R|


### 3.2 Règles d'accès et gestion des conflits
L'accès à la mémoire doit respecter les contraintes suivantes pour garantir la stabilité du système et éviter les corruptions visuelles :

| Zone | CPU | VPU | Notes |
|------|-----|-----|-------|
| $0000–$3FFF | R/W | — | RAM générale |
| $4000–$7FFF | R/W | R/W | VRAM. L'accès CPU doit être synchronisé avec le VBlank pour éviter les glitchs. |
| $8000–$BFFF | R | — | Mémoire morte (ROM) : toute écriture est ignorée. |
| $D000–$DFFF | R/W | — | Registres I/O : accès aux périphériques. |
| $F000–$FFFF | R | — | ROM Système : contient le BIOS et les vecteurs d'interruption. |


### 3.3 Structuration de la page I/O ($D000–$DFFF)
Pour faciliter le développement et éviter les chevauchements, la page `$D000` est segmentée par type de périphérique :

- `$D000–$D0FF` : VPU (Vidéo) — Contrôle du mode vidéo, curseur, scroll, palette.
- `$D100–$D1FF` : SPU (Son) — Registres des 3 voix, ADSR et samples.
- `$D200–$D2FF` : Entrées/Sorties — Clavier, manettes (PAD1/PAD2), souris.
- `$D300–$D3FF` : Système — Générateur de nombres aléatoires, Timers et contrôle du système.


**Note de conception**: La zone $4000–$7FFF est dite "dynamique". Son organisation interne (adresses des buffers graphiques, table des caractères, sprites) est reconfigurée par le processeur via le registre VPU_CTRL situé en $D000.

---

## CHAPITRE 4 — SYSTÈME VIDÉO (VPU)

### 4.1 Modes vidéo

Le VPU supporte deux modes sélectionnables via `$D000` (VPU_CTRL) :

#### Mode 0 — TEXTE (défaut au boot)

- **Résolution logique :** 16 colonnes × 16 lignes = 256 caractères
- **Taille écran physique :** 128×128 pixels (chaque char = 8×8 pixels)

```
Mémoire texte : $4800–$48FF (256 octets)
  Un octet = un caractère (code ASCII $20–$FF)
  Adresse = $4800 + (ligne * 16) + colonne

Attributs couleur : $4900–$49FF (256 octets)
  Un octet par case : bits 7-4 = couleur fond, bits 3-0 = couleur texte
  Adresse = $4900 + (ligne * 16) + colonne

Charset : $6000–$7FFF (8192 octets)
  256 caractères × 32 octets chacun (police 8x8, 1bpp = 8 octets, ou mode 4-bit)
  Note : Format standard 8x8 pixels.
```

**Accès texte :**
```asm
; Écrire 'A' en colonne 5, ligne 3
LDA #$41           ; 'A'
STA $4800 + (3*16) + 5   ; = $4835
; Couleur : texte blanc (1) sur fond noir (0)
LDA #$01
STA $4900 + (3*16) + 5   ; = $4935
```

#### Mode 1 — GRAPHIQUE

- **Résolution :** 128×128 pixels
- **Couleurs :** 16 (palette fixe, voir §4.3)
- **Format :** 2 pixels par octet (nibble packing)
- **Taille framebuffer :** 128×128 / 2 = 8192 octets ($2000)
- **Framebuffer A :** $4000–$5FFF (actif)
- **Framebuffer B :** $6000–$7FFF (backbuffer — double buffering)

**Calcul d'adresse pixel(x, y) :**
```
adresse = $4000 + (y * 64) + (x / 2)
Si x est pair  : octet = (couleur << 4) | (octet & $0F)
Si x est impair: octet = (octet & $F0) | (couleur & $0F)
```

**Accès pixel :**
```asm
; Écrire pixel(10, 5) en couleur 7 (jaune)
; adresse = $4000 + (5*64) + (10/2) = $4000 + 320 + 5 = $4145
; x=10 est pair → nibble haut
LDA $4145
AND #$0F           ; efface nibble haut
ORA #$70           ; couleur 7 dans bits 7-4
STA $4145
```

**Via l'API (recommandé) :**
```asm
LDA #7             ; couleur
LDX #10            ; x
LDY #5             ; y
JSR DRAW_PIXEL     ; $F003
```

### 4.2 Registres VPU ($D000–$D0FF)

```
$D000  VPU_CTRL     Bits : 7=enable 1=flip_now 0=mode(0=txt/1=gfx)
$D001  VPU_BORDER   Couleur de la bordure (0–15)
$D002  VPU_SCROLL_X Décalage horizontal (0–127, mode gfx uniquement)
$D003  VPU_SCROLL_Y Décalage vertical   (0–127)
$D004  VPU_STATUS   Lecture : bit7=vblank en cours, bit0=frame pair/impair
$D005  VPU_SPR_CTRL Contrôle sprites (bit0=enable, bit1=priority)
$D006  VPU_SPR_IDX  Index sprite actif (0–7)
$D007  VPU_SPR_X    Position X du sprite actif
$D008  VPU_SPR_Y    Position Y du sprite actif
$D009  VPU_SPR_FLAGS Bits: 3=visible 2=flip_h 1=flip_v 0=priority
$D00A  VPU_SPR_TILE Numéro de tuile source (0–255)
$D00B  VPU_CURSOR_X Colonne curseur texte (0–15)
$D00C  VPU_CURSOR_Y Ligne curseur texte   (0–15)
$D00D  VPU_INK      Couleur texte courante (0–15)
$D00E  VPU_PAPER    Couleur fond texte courante (0–15)
$D00F  VPU_CHAR_OUT Écriture : affiche un char à la position curseur + avance
```

**$D00F VPU_CHAR_OUT — écriture directe de caractère :**
```asm
; Écrire 'Hi' sans JSR
LDA #'H' : STA $D00F
LDA #'i' : STA $D00F
; Le curseur avance automatiquement. Newline ($0A) fait un retour chariot.
; Les valeurs X et Y du curseur sont limitées à 0–15.
```

### 4.3 Palette de couleurs (fixe v1.0)

La palette est indexée sur 4 bits (16 couleurs). Ces valeurs sont fixes dans la ROM système pour garantir une compatibilité totale entre les jeux.

```
Index  Couleur           R    G    B    Hex
──────────────────────────────────────────────
  0    Noir              $00  $00  $00  #000000
  1    Blanc             $FF  $FF  $FF  #FFFFFF
  2    Rouge             $CC  $00  $00  #CC0000
  3    Cyan              $00  $CC  $CC  #00CCCC
  4    Violet/Magenta    $CC  $00  $CC  #CC00CC
  5    Vert              $00  $CC  $00  #00CC00
  6    Bleu              $00  $00  $CC  #0000CC
  7    Jaune             $CC  $CC  $00  #CCCC00
  8    Orange            $CC  $88  $00  #CC8800
  9    Brun              $88  $44  $00  #884400
 10    Rose/Saumon       $FF  $88  $88  #FF8888
 11    Gris foncé        $44  $44  $44  #444444
 12    Gris moyen        $88  $88  $88  #888888
 13    Vert clair        $88  $FF  $88  #88FF88
 14    Bleu clair        $88  $88  $FF  #8888FF
 15    Gris clair        $CC  $CC  $CC  #CCCCCC
```

### 4.4 Double buffering

Le Double Buffering permet de dessiner une image dans le tampon inactif pendant que l'autre est affiché, évitant ainsi le clignotement (flicker). Le basculement se produit au début du prochain VBlank.

```asm
; --- Exemple de basculement (Flip) ---

; 1. Activer le mode graphique
LDA #%00000001     ; Bit 0: Mode GFX
STA $D000

; 2. Dessiner dans le backbuffer (Zone $6000–$7FFF)
; ... (Code de dessin ici) ...

; 3. Demander le basculement (Flip)
; Le bit 1 du registre $D000 est un flag de commande (auto-reset)
LDA #%00000011     ; Bit 0: GFX, Bit 1: Flip request
STA $D000

; 4. Attendre la synchronisation (optionnel)
@wait_vblank:
  LDA $D004        ; Lire VPU_STATUS
  AND #%10000000   ; Tester le bit VBlank (bit 7)
  BEQ @wait_vblank ; Boucler tant que VBlank n'est pas actif
```

---

## CHAPITRE 5 — SYSTÈME SONORE (SPU)

### 5.1 Architecture

Le SPU dispose de **3 voix** indépendantes (programmables) + **1 canal sample** :

- Voix 0 : Onde carrée/triangle/dent de scie (fréquence + ADSR)

- Voix 1 : Onde carrée/triangle/dent de scie (fréquence + ADSR)

- Voix 2 : Bruit blanc (registre de décalage 16-bit)

- Canal 3 : Sample PCM (8-bit, buffer en RAM)

### 5.2 Registres SPU ($D100–$D1FF)

Chaque voix occupe 8 registres consécutifs (base = `$D100` + `N*8`):

|Offset|Registre|Description|
|------|--------|-----------|
|+0|SPU_FREQ_LO|Fréquence octet bas (période = 1MHz / (f+1))|
|+1|SPU_FREQ_HI|Fréquence octet haut|
|+2|SPU_VOL|Volume (0–15, bits 7-4 = gauche, 3-0 = droit)|
|+3|SPU_ATTACK|Durée attaque (0–15, en frames)|
|+4|SPU_DECAY|Durée decay (0–15, en frames)|
|+5|SPU_SUSTAIN|Niveau sustain (0–15)|
|+6|SPU_RELEASE|Durée release (0–15, en frames)|
|+7|SPU_CTRL|bit7=gate (1=note on), bit3-0=forme d'onde|

Formes d'onde : `$01`=Carrée 50%, `$02`=Carrée 25%, `$03`=Triangle, `$04`=Sawtooth, `$08`=Noise.


**Registres globaux SPU :**
|Adresse|Registre|Description|
|-------|--------|-----------|
|$D120  |SPU_MASTER_VOL   |Volume master (0–15)|
|$D121  |SPU_STATUS       |Lecture : bit N = voix N active|
|$D122  |SPU_SAMPLE_LO    |Adresse sample bas (canal 3)|
|$D123  |SPU_SAMPLE_HI    |Adresse sample haut (canal 3)|
|$D124  |SPU_SAMPLE_LEN   |Longueur sample (256 octets × valeur)|
|$D125  |SPU_SAMPLE_CTRL  |bit7=start bit6=loop bit0=8kHz/4kHz|

### 5.3 Exemple de programmation

```asm
; Note La 440 Hz sur voix 0 (onde carrée)
; Période = 1 000 000 / 440 = 2272 → $08E0
LDA #$E0 : STA $D100      ; SPU_FREQ_LO (Voix 0)
LDA #$08 : STA $D101      ; SPU_FREQ_HI (Voix 0)
LDA #$FF : STA $D102      ; Volume max (L+R)
LDA #$02 : STA $D103      ; Attack = 2 frames
LDA #$04 : STA $D104      ; Decay = 4 frames
LDA #$08 : STA $D105      ; Sustain = niveau 8
LDA #$08 : STA $D106      ; Release = 8 frames
LDA #$81 : STA $D107      ; GATE=1 (ON), Forme=$01 (Carrée)

; Note ON. Pour arrêter :
LDA #$01 : STA $D107      ; GATE=0 (OFF)
```

---

## CHAPITRE 6 — I/O REGISTERS ($D200–$D3FF)

### 6.1 Clavier ($D200–$D20F)

```
$D200  KEY_ASCII     Lecture : ASCII de la touche enfoncée (0 si aucune)
$D201  KEY_STATUS    Lecture : bit7=touche enfoncée ce frame
                     Écriture : $00 = acquitter (clear)
$D202  KEY_MOD       Modificateurs : bit0=Shift bit1=Ctrl bit2=Alt
$D203  KEY_RAW       Scancode brut (indépendant de la langue)

; Codes spéciaux (KEY_RAW, valeurs > $7F)
$80 = Flèche haut    $84 = F1      $88 = Insert
$81 = Flèche bas     $85 = F2      $89 = Delete
$82 = Flèche gauche  $86 = F3      $8A = Home
$83 = Flèche droite  $87 = F4      $8B = End
```

**Lire le clavier :**
```asm
; Attendre et lire une touche
WAIT_KEY:
  LDA $D201
  BPL WAIT_KEY      ; bit7 = 0 → pas de touche
  LDA $D200         ; lire le char ASCII
  STA $00           ; stocker
  LDA #$00
  STA $D201         ; acquitter
```

### 6.2 Manette ($D210–$D21F)

```
$D210  PAD1_STATE   Manette 1 — lecture état
$D211  PAD2_STATE   Manette 2 — lecture état
$D212  PAD_CTRL     bit0 = latch (mise à jour du snapshot)

; Bits de PAD_STATE (1 = bouton enfoncé) :
; bit 7:A, bit 6:B, bit 5:Select, bit 4:Start, bit 3:Droite, bit 2:Gauche, bit 1:Bas, bit 0:Haut
```

**Lire la manette :**
```asm
; Lire l'état de la manette 1
LDA #$01 : STA $D212   ; latch
LDA $D210              ; snapshot
STA $10                ; stocker l'état

; Tester le bouton A (bit 7)
AND #$80
BEQ BOUTON_A_PRESSE    ; 0 = enfoncé
```

### 6.3 Souris ($D220–$D22F)

```
$D220  MOUSE_X      Position X (0–127 gfx, 0–15 txt)
$D221  MOUSE_Y      Position Y (0–127 gfx, 0–15 txt)
$D222  MOUSE_DX     Delta X depuis dernière lecture (signé, -128/+127)
$D223  MOUSE_DY     Delta Y
$D224  MOUSE_BTN    bit0=gauche bit1=droit bit2=milieu (0=enfoncé)
$D225  MOUSE_SCROLL Delta molette signé (-127/+127)
```

### 6.4 Système ($D300–$D3FF)

```
$D300  SYS_TIMER_LO  Timer 16-bit (cycles CPU), octet bas
$D301  SYS_TIMER_HI  Octet haut (lecture verrouille le LO pour garantir atomicité)
$D302  SYS_IRQ_RATE  Fréquence IRQ : 0=désactivé, N=toutes les N*256 cycles
$D303  SYS_IRQ_CTRL  bit0=enable IRQ timer
$D304  SYS_FRAME_LO  Compteur frames (16-bit), lo
$D305  SYS_FRAME_HI  Compteur frames (16-bit), hi
$D306  SYS_RAND      Octet pseudo-aléatoire (LFSR 16-bit)
$D307  SYS_RAND_SEED Écriture : réinitialise le LFSR
$D308  SYS_RESET     Écriture $C7 → RESET logiciel
$D309  SYS_CAPS      Capacités machine (lecture seule)
                     bit0=cartouche, bit1=émulateur, bit2=manette 2
```

---

## CHAPITRE 7 — CALLING CONVENTION & ABI

### 7.1 Principes fondamentaux

La Chuck-8 ABI définit des règles strictes pour l'interopérabilité entre
routines. Tout code conforme à la spec DOIT respecter ces règles.

|Règle|Description|
|-----|-----------|
|1. Retour|A est le registre de retour (8-bit). Si 16-bit, A (lo) + X (hi).|
|2. Registres|X et Y sont libres d'utilisation. Ils ne sont pas préservés par la routine appelée.|
|3. Paramètres|La zone Zero Page $0080–$00EF est réservée aux paramètres (bloc de 112 octets).|
|4. Volatiles|La zone Zero Page $00F0–$00FF est réservée aux pointeurs temporaires de travail (volatiles).|
|5. Pile|Le SP doit être restauré avant le RTS. Tout PHA doit être suivi d'un PLA.|

### 7.2 Passage de paramètres

**Cas 1 — Paramètre unique 8-bit → via A**
```asm
; Appel : couleur dans A
  LDA #$07           ; couleur jaune
  JSR MA_ROUTINE

MA_ROUTINE:
  ; A = couleur à l'entrée
  RTS
```

**Cas 2 — 2 ou 3 paramètres 8-bit → via A, X, Y**
```asm
; Convention : 1er=A 2ème=X 3ème=Y
  LDA #$07           ; couleur
  LDX #$10           ; x
  LDY #$08           ; y
  JSR DRAW_PIXEL_AXY
```

**Cas 3 — Paramètres larges ou nombreux → via Zone Paramètres**
```asm
; Passer (x=$0010, y=$0008, largeur=$0020, hauteur=$0010, couleur=3)
  LDA #$10 : STA $80   ; x lo
  LDA #$00 : STA $81   ; x hi
  LDA #$08 : STA $82   ; y lo
  LDA #$00 : STA $83   ; y hi
  LDA #$20 : STA $84   ; w lo
  LDA #$00 : STA $85   ; w hi
  LDA #$10 : STA $86   ; h lo
  LDA #$00 : STA $87   ; h hi
  LDA #$03             ; couleur (dans A car dernier paramètre)
  JSR DRAW_RECT
```

**Cas 4 — Valeur de retour 16-bit → A (lo) + X (hi)**
```asm
JSR RAND16             ; retourne 16-bit dans A/X
STA $10                ; lo
STX $11                ; hi
```

### 7.3 Sauvegarde des registres

```asm
MA_ROUTINE:
  ; Exemple : Sauvegarde des registres non-libres si nécessaire
  ; La règle 2 stipule que X/Y sont libres, mais A doit souvent être préservé.
  PHA                ; Sauvegarde A
  TXA : PHA          ; Sauvegarde X
  TYA : PHA          ; Sauvegarde Y
  
  ; ... Corps de la routine ...
  
  PLA : TAY          ; Restaure Y
  PLA : TAX          ; Restaure X
  PLA : TAY          ; Restaure A
  RTS
```

### 7.4 Convention de nommage des labels

```
MAJUSCULES           → labels globaux (fonctions, données publiques)
minuscules           → labels locaux (privés à une fonction)
@minuscules          → labels très locaux (boucles, branchements courts)
_UNDERSCORE_DEBUT    → labels réservés système (ne pas utiliser)

Exemples :
  DRAW_PIXEL         → fonction publique
  draw_line_clip     → fonction interne au module video
  @loop              → label de boucle locale
  _VBL_HANDLER       → routine système (ROM)
```

---

## CHAPITRE 8 — API SYSTÈME (ROM $F000–$F7FF)

La ROM contient une **jump table** : chaque entrée fait 3 octets (JMP $xxxx).
L'adresse de chaque routine est donc fixe pour toujours, même si
l'implémentation interne change.

### 8.1 Table des routines

**Vidéo :**
```
$F000  SYS_CLEAR       Efface l'écran. A=couleur (mode gfx) ou A=char (mode txt)
$F003  SYS_DRAW_PIXEL  Pixel(X,Y)=couleur A. Mode gfx uniquement.
$F006  SYS_DRAW_LINE   Ligne de ($80,$81) à ($82,$83), couleur A
$F009  SYS_DRAW_RECT   Rect x=$80 y=$81 w=$82 h=$83, couleur A (contour)
$F00C  SYS_FILL_RECT   Rect rempli (mêmes params que DRAW_RECT)
$F00F  SYS_BLIT        Copie zone : src=$80/$81 dst=$82/$83 w=$84 h=$85
$F012  SYS_DRAW_SPR    Sprite: tile=A, x=X, y=Y (8×8 pixels, depuis charset RAM $6000–$7FFF)
$F015  SYS_SET_PIXEL   Lecture couleur pixel(X,Y) → A (non destructif)
$F018  SYS_FLIP        Swap framebuffer A↔B au prochain VBlank
$F01B  SYS_SET_MODE    Mode vidéo : A=0 (texte) A=1 (graphique)
```

**Texte :**
```
$F01E  SYS_PRINT_CHAR  Affiche char A à position curseur, avance
$F021  SYS_PRINT_STR   Affiche chaîne null-terminated à $80/$81
$F024  SYS_PRINT_NUM   Affiche entier 8-bit A en décimal à cursor
$F027  SYS_PRINT_HEX   Affiche A en hexadécimal "$XX" à cursor
$F02A  SYS_SET_CURSOR  Curseur à colonne X (0-15), ligne Y (0-15)
$F02D  SYS_GET_CURSOR  Retourne col → X (0-15), ligne → Y (0-15)
$F030  SYS_SET_COLOR   INK=A bits 7-4, PAPER=A bits 3-0
$F033  SYS_SCROLL_UP   Fait défiler le texte d'une ligne vers le haut
```

**Son :**
```
$F036  SYS_PLAY_NOTE   Voix=X, note MIDI=A (21–108), durée=$80 frames
$F039  SYS_STOP_VOICE  Arrête la voix X (gate=0)
$F03C  SYS_STOP_ALL    Arrête toutes les voix
$F03F  SYS_PLAY_SFX    Joue effet sonore N (banque ROM) dans voix X
$F042  SYS_SET_VOL     Volume voix X = A (0–15)
$F045  SYS_MASTER_VOL  Volume master = A (0–15)
```

**Input :**
```
$F048  SYS_READ_PAD    Lit manette A (0 ou 1) → A=état boutons
$F04B  SYS_READ_KEY    Lit clavier → A=ASCII (0 si aucune touche)
$F04E  SYS_WAIT_KEY    Bloque jusqu'à pression d'une touche → A=ASCII
$F051  SYS_READ_MOUSE  Retourne X=mouseX Y=mouseY A=boutons
$F054  SYS_KEY_DOWN    A=scancode → A=$FF si enfoncé, $00 sinon
```

**Système :**
```
$F057  SYS_WAIT_VBLANK Bloque jusqu'au prochain VBlank (sync frame)
$F05A  SYS_RAND        Retourne octet aléatoire dans A
$F05D  SYS_RAND16      Retourne 16-bit aléatoire dans A (lo) + X (hi)
$F060  SYS_MEMCPY      Copie $84/$85 octets de $80/$81 vers $82/$83
$F063  SYS_MEMSET      Remplit $82/$83 octets à partir de $80/$81 avec A
$F066  SYS_MEMCMP      Compare $84 octets à $80/$81 vs $82/$83 → Z=1 si égal
$F069  SYS_FRAME_NUM   Retourne compteur de frames 16-bit : A=lo X=hi
$F06C  SYS_RESET       Reset logiciel (équivalent bouton RESET)
$F06F  SYS_VERSION     Retourne version ROM : A=major X=minor
```

### 8.2 Note MIDI → fréquence

```
La routine SYS_PLAY_NOTE accepte des notes MIDI standard :
  21 = La0 (27.5 Hz)     69 = La4 (440 Hz)
  60 = Do4 (261.6 Hz)   108 = Do8 (4186 Hz)
La conversion en valeur registre est faite par la ROM.
```

Note de précision : La routine `SYS_PLAY_NOTE` utilise une table de conversion interne en ROM pour mapper les notes MIDI vers les périodes du SPU. Étant donné le pas de fréquence à 1 MHz, une erreur de ±1-2 Hz est possible sur les notes très aiguës (Do8).

---

## CHAPITRE 9 — STRUCTURE D'UN PROGRAMME

### 9.1 Structure minimale (Cartouche)

```asm
; ── mon_programme.asm ────────────────────────────────────────
  .include "chuck.inc"
  .org $8000            ; Point d'entrée standard de la cartouche

; ── VECTEURS (Doivent être à $8000) ──────────────────────────
  .word INIT            ; Reset vecteur
  .word NMI_HANDLER     ; NMI vecteur
  .word IRQ_HANDLER     ; IRQ vecteur

; ── INIT ─────────────────────────────────────────────────────
INIT:
  SEI                   ; Désactiver les interruptions
  CLD                   ; Nettoyer le flag décimal
  LDX #$FF : TXS        ; Initialiser la pile
  
  JSR SYS_SET_MODE_GFX
  LDA #COLOR_BLACK
  JSR SYS_CLEAR
  CLI                   ; Réactiver les interruptions
  JMP MAIN_LOOP

; ── BOUCLE PRINCIPALE ────────────────────────────────────────
MAIN_LOOP:
  ; Logique de jeu ici
  JMP MAIN_LOOP
```

### 9.2 Handler NMI (VBlank)

```asm
  .include "chuck.inc"
  .org $E000

INIT:
  SEI                    ; désactive IRQ pendant l'init
  ; ... setup ...
  CLI                    ; réactive IRQ
  JMP MAIN_LOOP

; Handler NMI — appelé AUTOMATIQUEMENT à chaque VBlank
; DOIT être rapide (< 1000 cycles recommandé)
; DOIT commencer par PHA et finir par PLA + RTI
  .org $E100

; NMI appelé automatiquement à chaque VBlank par le BIOS système
NMI_HANDLER:
  PHA : TXA : PHA : TYA : PHA  ; Sauvegarde complète
  
  ; Tâches synchrones (obligatoires pendant le VBlank)
  JSR SYS_FLIP                 ; Swap buffers
  
  PLA : TAY : PLA : TAX : PLA  ; Restauration
  RTI                          ; Retour d'interruption

; Déclarer le handler dans la zone RESET config ($E000–$E007)
; (la ROM lit ces adresses au démarrage pour configurer les vecteurs)
; → fait automatiquement par chuck.inc si NMI_HANDLER est défini

MAIN_LOOP:
  ; ici on peut travailler sans se soucier du timing
  JMP MAIN_LOOP
```

---

## CHAPITRE 10 — FORMAT CARTOUCHE .chuck

### 10.1 Spécifications du format

Le fichier `.chuck` est un format de description structuré. Lors du chargement, l'émulateur (ou le hardware) mappe les segments directement dans l'espace mémoire `$8000–$BFFF` (et éventuellement `$6000` pour le charset custom).

```
chuck-cartridge-1.0
title: Mon Jeu
author: Jean Dupont
version: 1.0.0

--- code ---
; Code cartouche (chargé en ROM à $8000)
  .include "chuck.inc"
  .org $8000

; Vecteurs obligatoires pour le système
  .word INIT          ; RESET
  .word NMI_HANDLER   ; NMI
  .word IRQ_HANDLER   ; IRQ

INIT:
  ; ... ton code d'init ...

--- data ---
; Données constantes (placées en ROM à la suite du code)
  .org $A000
SPRITES:
  .byte $00, $7E, $FF, $FF, $FF, $FF, $7E, $00

--- charset ---
; (Optionnel : surcharge la RAM Charset $6000–$7FFF)
  .org $6000
MY_FONT:
  .byte $00, $00, $3C, $42, $42, $3C, $00, $00
```

### 10.2 Processus de chargement

Le système Chuck-8 suit un protocole de chargement strict :

1. Validation : L'émulateur vérifie la signature `chuck-cartridge-1.0` en tête de fichier.

2. Mapping ROM : Le bloc `--- code ---` est copié en ROM à partir de l'adresse `$8000`.

3. Vecteurs : Le BIOS système lit les adresses situées aux offsets `$8000`, `$8002` et `$8004` pour initialiser la table d'interruption.

4. Initialisation : Le processeur effectue un saut automatique vers l'adresse pointée par le vecteur `RESET` (généralement `$8006` si ton code `INIT` suit immédiatement les vecteurs).

5. Charset Custom (Optionnel) : Si le segment `--- charset ---` est présent, les données sont copiées en RAM VRAM (`$6000`) après l'initialisation système.

**Note de conception** : La zone de code cartouche est limitée à 16 Ko (`$8000–$BFFF`). Si ton programme dépasse cette taille, il ne sera pas reconnu par le hardware standard.

---

## ANNEXE A — chuck.inc (header standard)

```asm
; ── chuck.inc — Chuck-8 System Header v1.0 ───────────────────
; Fichier d'en-tête standard pour le développement Chuck-8

; ── Couleurs ─────────────────────────────────────────────────
COLOR_BLACK    = 0
COLOR_WHITE    = 1
COLOR_RED      = 2
COLOR_CYAN     = 3
COLOR_PURPLE   = 4
COLOR_GREEN    = 5
COLOR_BLUE     = 6
COLOR_YELLOW   = 7
COLOR_ORANGE   = 8
COLOR_BROWN    = 9
COLOR_PINK     = 10
COLOR_DKGRAY   = 11
COLOR_MDGRAY   = 12
COLOR_LTGREEN  = 13
COLOR_LTBLUE   = 14
COLOR_LTGRAY   = 15

; ── VPU Registres ────────────────────────────────────────────
VPU_CTRL       = $D000
VPU_BORDER     = $D001
VPU_SCROLL_X   = $D002
VPU_SCROLL_Y   = $D003
VPU_STATUS     = $D004
VPU_SPR_CTRL   = $D005
VPU_SPR_IDX    = $D006
VPU_SPR_X      = $D007
VPU_SPR_Y      = $D008
VPU_SPR_FLAGS  = $D009
VPU_SPR_TILE   = $D00A
VPU_CURSOR_X   = $D00B
VPU_CURSOR_Y   = $D00C
VPU_INK        = $D00D
VPU_PAPER      = $D00E
VPU_CHAR_OUT   = $D00F

; ── SPU Registres ────────────────────────────────────────────
SPU_V0_BASE    = $D100
SPU_V1_BASE    = $D108
SPU_V2_BASE    = $D110
SPU_MASTER_VOL = $D120
SPU_STATUS     = $D121
SPU_SAMPLE_LO  = $D122
SPU_SAMPLE_HI  = $D123
SPU_SAMPLE_LEN = $D124
SPU_SAMPLE_CTRL= $D125

; ── INPUT Registres ──────────────────────────────────────────
KEY_ASCII      = $D200
KEY_STATUS     = $D201
KEY_MOD        = $D202
KEY_RAW        = $D203
PAD1_STATE     = $D210
PAD2_STATE     = $D211
PAD_CTRL       = $D212
MOUSE_X        = $D220
MOUSE_Y        = $D221
MOUSE_BTN      = $D224
MOUSE_SCROLL   = $D225

; ── SYSTEM Registres ─────────────────────────────────────────
SYS_TIMER_LO   = $D300
SYS_TIMER_HI   = $D301
SYS_IRQ_RATE   = $D302
SYS_IRQ_CTRL   = $D303
SYS_FRAME_LO   = $D304
SYS_FRAME_HI   = $D305
SYS_RAND       = $D306
SYS_RAND_SEED  = $D307
SYS_RESET      = $D308
SYS_CAPS       = $D309

; ── Pad boutons (Masques) ────────────────────────────────────
PAD_UP         = %00000001
PAD_DOWN       = %00000010
PAD_LEFT       = %00000100
PAD_RIGHT      = %00001000
PAD_START      = %00010000
PAD_SELECT     = %00100000
PAD_B          = %01000000
PAD_A          = %10000000

; ── API Jump Table ───────────────────────────────────────────
SYS_CLEAR      = $F000
SYS_DRAW_PIXEL = $F003
SYS_DRAW_LINE  = $F006
SYS_DRAW_RECT  = $F009
SYS_FILL_RECT  = $F00C
SYS_BLIT       = $F00F
SYS_DRAW_SPR   = $F012
SYS_SET_PIXEL  = $F015
SYS_FLIP       = $F018
SYS_SET_MODE   = $F01B
SYS_PRINT_CHAR = $F01E
SYS_PRINT_STR  = $F021
SYS_PRINT_NUM  = $F024
SYS_PRINT_HEX  = $F027
SYS_SET_CURSOR = $F02A
SYS_GET_CURSOR = $F02D
SYS_SET_COLOR  = $F030
SYS_SCROLL_UP  = $F033
SYS_PLAY_NOTE  = $F036
SYS_STOP_VOICE = $F039
SYS_STOP_ALL   = $F03C
SYS_PLAY_SFX   = $F03F
SYS_SET_VOL    = $F042
SYS_READ_PAD   = $F048
SYS_READ_KEY   = $F04B
SYS_WAIT_KEY   = $F04E
SYS_READ_MOUSE = $F051
SYS_KEY_DOWN   = $F054
SYS_WAIT_VBLANK= $F057
SYS_RAND       = $F05A
SYS_RAND16     = $F05D
SYS_MEMCPY     = $F060
SYS_MEMSET     = $F063
SYS_MEMCMP     = $F066
SYS_FRAME_NUM  = $F069
SYS_RESET      = $F06C
SYS_VERSION    = $F06F

; ── Zone mémoire ─────────────────────────────────────────────
ZP_PARAMS      = $0080    ; Zone paramètres (ABI)
ZP_PTR0        = $00F0    ; Pointeurs volatiles ($F0-$FF)

FRAMEBUF_A     = $4000
FRAMEBUF_B     = $6000
VRAM_TEXT      = $4800    ; 16x16 grille (256 octets)
VRAM_ATTR      = $4900    ; 16x16 attributs (256 octets)
VRAM_TILES     = $6000    ; Charset (8x8)

; ── Macros utilitaires ───────────────────────────────────────
.macro SET_COLOR ink, paper
  LDA #((.ink << 4) | .paper)
  JSR SYS_SET_COLOR
.endmacro

.macro CURSOR col, row
  LDX #.col
  LDY #.row
  JSR SYS_SET_CURSOR
.endmacro

.macro PRINT str
  LDA #<.str
  STA ZP_PARAMS
  LDA #>.str
  STA ZP_PARAMS+1
  JSR SYS_PRINT_STR
.endmacro

.macro PIXEL x, y, color
  LDA #.color
  LDX #.x
  LDY #.y
  JSR SYS_DRAW_PIXEL
.endmacro

.macro PAD_PRESSED btn
  AND #.btn
.endmacro
```

---

## ANNEXE B — EXEMPLE COMPLET : PONG MINIMAL

```asm
; pong.asm — Démo Chuck-8 : balle rebondissante + raquette
  .include "chuck.inc"
  .org $8000

; ── VECTEURS (Table obligatoire) ─────────────────────────────
  .word INIT          ; RESET
  .word 0             ; NMI (non utilisé ici)
  .word 0             ; IRQ (non utilisé ici)

; ── Variables (Zero Page pour la rapidité) ───────────────────
  .org $80
BALL_X:   .byte 0
BALL_Y:   .byte 0
BALL_DX:  .byte 0
BALL_DY:  .byte 0
PAD_Y:    .byte 0
PAD_STATE:.byte 0

; ── Init ─────────────────────────────────────────────────────
INIT:
  LDA #1 : JSR SYS_SET_MODE     ; mode graphique
  
  ; Initialisation des positions
  LDA #64 : STA BALL_X
  LDA #64 : STA BALL_Y
  LDA #1  : STA BALL_DX
  LDA #1  : STA BALL_DY
  LDA #56 : STA PAD_Y           ; raquette au centre

MAIN_LOOP:
  JSR SYS_WAIT_VBLANK           ; synchronisation 50/60Hz

  ; ── INPUT ────────────────────────────────────────────────
  LDA #0 : JSR SYS_READ_PAD
  STA PAD_STATE

  ; Déplacer raquette (Haut)
  LDA PAD_STATE : AND #PAD_UP
  BEQ @no_up
  LDA PAD_Y : BEQ @no_up
  DEC PAD_Y
@no_up:
  ; Déplacer raquette (Bas)
  LDA PAD_STATE : AND #PAD_DOWN
  BEQ @no_down
  LDA PAD_Y : CMP #118 : BCS @no_down ; limite écran
  INC PAD_Y
@no_down:

  ; ── UPDATE BALLE ─────────────────────────────────────────
  ; Effacer l'ancienne position
  LDA #COLOR_BLACK
  LDX BALL_X : LDY BALL_Y : JSR SYS_DRAW_PIXEL

  ; Calcul nouvelle position
  LDA BALL_X : CLC : ADC BALL_DX : STA BALL_X
  LDA BALL_Y : CLC : ADC BALL_DY : STA BALL_Y

  ; Rebond Y
  LDA BALL_Y : BEQ @flip_dy
  CMP #127   : BEQ @flip_dy
  JMP @no_flip_dy
@flip_dy:
  LDA #0 : SEC : SBC BALL_DY : STA BALL_DY
@no_flip_dy:

  ; Collision raquette (x=8, y=PAD_Y à PAD_Y+10)
  LDA BALL_X : CMP #8 : BNE @no_pad
  LDA BALL_Y : CMP PAD_Y : BCC @no_pad
  LDA PAD_Y  : CLC : ADC #10 : CMP BALL_Y : BCC @no_pad
  LDA #0 : SEC : SBC BALL_DX : STA BALL_DX
@no_pad:

  ; ── DRAW ─────────────────────────────────────────────────
  ; Dessiner Balle
  LDA #COLOR_WHITE
  LDX BALL_X : LDY BALL_Y : JSR SYS_DRAW_PIXEL

  ; Dessiner Raquette
  LDA #COLOR_WHITE
  LDX #8
  LDY PAD_Y
@draw_pad:
  JSR SYS_DRAW_PIXEL
  INY
  TYA : SEC : SBC PAD_Y : CMP #10 : BCC @draw_pad

  JMP MAIN_LOOP
```

---

## ANNEXE C — TABLEAU DE RÉFÉRENCE RAPIDE

```
|Zone|Adresses|Usage|
|Zero Page|	$0000–$007F|	RAM Système/Stack (Zéro Page libre)|
|ABI Zone|	$0080–$00EF|	Paramètres routine (ABI)|
|Volatile|	$00F0–$00FF|	Pointeurs temporaires (P0–P7)|
|VRAM Text|	$4800–$48FF|	Grille écran (256 octets)|
|VRAM Attr|	$4900–$49FF|	Couleurs texte (256 octets)|
|VRAM GFX|	$4000–$5FFF|	Framebuffer A|
|VRAM B|	$6000–$7FFF|	Framebuffer B / Charset|
|Cartouche|	$8000–$BFFF|	Mémoire programme (ROM)|
|I/O Ports|	$D000–$D3FF|	VPU, SPU, Input, Système|
|BIOS API|	$F000–$F06F|	Table de saut (API Système)|

|Instruction|Description|
|-----------|-----------|
|LDA/LDX/LDY|	Charger valeur dans A, X, ou Y|
|STA/STX/STY|	Stocker A, X, ou Y en mémoire|
|TAX/TAY/TXA/TYA|	Transfert entre registres|
|PHA/PLA|	Empiler/Dépiler A|
|CLC/SEC|	Effacer/Positionner le carry flag|
|ADC/SBC|	Addition / Soustraction avec carry|
|CMP/CPX/CPY|	Comparer le registre avec une valeur|
|BEQ/BNE|	Branchement si Égal (Z=1) / Inégal (Z=0)|
|BCC/BCS|	Branchement si Carry clair (C=0) / set (C=1)|
|JSR/RTS|	Appel de sous-programme / Retour|
|JMP|	Saut inconditionnel|
|INX/INY/DEX/DEY|	Incrémentation / Décrémentation index|

---

*Chuck-8 Computer System Specification v2.0*
*Ce document est la référence canonique de la plateforme.*
*Toute implémentation (émulateur ou hardware) doit s'y conformer.*