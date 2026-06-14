# CHUCK-8 — MANUEL DE PROGRAMMATION
## Apprendre à coder comme en 1980 pour devenir un meilleur développeur en 2026

---

```
  ██████╗██╗  ██╗██╗   ██╗ ██████╗██╗  ██╗      █████╗
 ██╔════╝██║  ██║██║   ██║██╔════╝██║ ██╔╝     ██╔══██╗
 ██║     ███████║██║   ██║██║     █████╔╝      ╚█████╔╝
 ██║     ██╔══██║██║   ██║██║     ██╔═██╗      ██╔══██╗
 ╚██████╗██║  ██║╚██████╔╝╚██████╗██║  ██╗     ╚█████╔╝
  ╚═════╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝     ╚════╝
```

---

> *"To understand a computer, you must think like a computer."*
> — Rodnay Zaks, Programming the 6502 (1978)

Ce manuel t'apprend à programmer le Chuck-8 — un vrai ordinateur 8-bit avec ses règles, ses contraintes, et sa logique propre. Il n'y a pas de garbage collector, pas de framework, pas de bibliothèque magique. Juste toi, 64 Ko de RAM, et un processeur qui exécute une instruction à la fois.

C'est difficile. C'est aussi profondément formateur. Tout ce que tu apprendras ici — la gestion manuelle de la mémoire, la pensée en registres, l'optimisation cycle par cycle — te rendra meilleur dans n'importe quel langage, n'importe quelle plateforme.

**Comment utiliser ce manuel :**

Chaque chapitre alterne théorie et exemples complets. Les exemples sont conçus pour être tapés et exécutés dans Chuck IDE. Ne te contente pas de lire — tape, exécute, modifie, casse.

**Structure des chapitres :**

| # | Titre | Ce que tu apprendras |
|---|-------|---------------------|
| 1 | La Machine | Architecture, mémoire, processeur |
| 2 | Le Langage | Instructions 6502, modes d'adressage |
| 3 | Le Système | Vidéo, son, I/O — la plateforme Chuck-8 |
| 4 | Les Patterns | Boucles, fonctions, données, structures |
| 5 | Les Projets | Jeux, démos, outils — tout ensemble |

---

# CHAPITRE 1 — LA MACHINE

## 1.1 Ce qu'est le Chuck-8

Le Chuck-8 est un ordinateur personnel imaginaire conçu pour l'enseignement. Il est réaliste — chaque décision de conception est motivée par ce qui existait ou existe encore en hardware. Un jour, on pourrait en construire un vrai.

Ses caractéristiques principales :

- **Processeur :** MOS 6502 à 1 MHz — le même chip que l'Apple II, le Commodore 64, l'Atari 800, et la NES
- **Mémoire :** 64 Ko de RAM adressables (65 536 octets)
- **Écran :** 128×128 pixels, 16 couleurs — ou 32×32 caractères en mode texte
- **Son :** 3 voix (carrée, triangle, bruit)
- **I/O :** Clavier, manette (style NES), souris

C'est intentionnellement limité. Ces limites sont des outils pédagogiques : quand tu n'as que 64 Ko et 1 MHz, chaque décision compte.

## 1.2 Comment fonctionne un ordinateur

Avant de programmer, comprends ce qui se passe physiquement.

Un ordinateur n'est pas magique. C'est une machine qui répète indéfiniment trois actions :

```
1. FETCH  — lire l'instruction en mémoire à l'adresse PC
2. DECODE — interpréter les bits de l'instruction
3. EXECUTE — effectuer l'action (calcul, lecture/écriture mémoire)
```

Chaque cycle de cette boucle prend 1 microseconde sur le Chuck-8 (à 1 MHz). Certaines instructions prennent 2 cycles, d'autres 7. En une seconde, le processeur effectue environ 500 000 à 1 000 000 d'opérations.

La mémoire est un tableau linéaire d'octets. Chaque octet a une adresse, de 0 (`$0000`) à 65535 (`$FFFF`). L'adresse est toujours exprimée en hexadécimal dans ce manuel.

## 1.3 Le hexadécimal — la langue du matériel

Les humains comptent en base 10 (dix doigts). Les ordinateurs comptent en base 2 (deux états : 0 et 1). Le hexadécimal (base 16) est le compromis : un chiffre hex représente exactement 4 bits.

```
Décimal  Hexadécimal  Binaire
0        $00          0000 0000
1        $01          0000 0001
15       $0F          0000 1111
16       $10          0001 0000
127      $7F          0111 1111
128      $80          1000 0000
255      $FF          1111 1111
```

Dans l'assembleur Chuck-8 (syntaxe ca65) :
- `$FF` — hexadécimal
- `%11111111` — binaire
- `255` — décimal
- `'A'` — valeur ASCII du caractère A (= 65)

**Un octet vaut toujours entre 0 et 255.** C'est fondamental. Quand on dépasse 255, ça déborde à 0. Quand on descend sous 0, ça déborde à 255. Cette arithmétique modulo est au cœur de nombreuses techniques.

## 1.4 La mémoire du Chuck-8

Les 64 Ko ne sont pas tous équivalents. Certaines zones ont des usages réservés :

```
$0000–$00FF   Zero Page       Tes 256 variables les plus importantes
$0100–$01FF   Stack           La pile hardware (gérée automatiquement)
$0200–$3FFF   RAM libre       Tes données, buffers, tableaux
$4000–$7FFF   VRAM            L'écran (géré par le VPU)
$8000–$BFFF   Cartouche ROM   Code optionnel en ROM
$D000–$DFFF   I/O Registers   Les périphériques (lecture/écriture)
$E000–$EFFF   RAM haute       Ton programme principal
$F000–$FFFF   ROM système     L'API Chuck-8 (lecture seule)
```

**La Zero Page ($0000–$00FF) est spéciale.** Les instructions qui y accèdent sont plus courtes (1 octet d'adresse au lieu de 2) et plus rapides. C'est là que tu mets tes variables les plus utilisées.

**La ROM système ($F000–$FFFF) est en lecture seule.** Elle contient les routines d'API (dessin, son, I/O) et les vecteurs d'interruption. Tu ne peux pas la modifier — c'est voulu.

**Ton programme commence à $E000.** C'est là que pointe le vecteur RESET. Toujours commencer par `.org $E000`.

### Les registres I/O

La zone $D000–$DFFF n'est pas de la RAM ordinaire. Écrire à une adresse I/O déclenche une action matérielle. Lire retourne l'état courant d'un périphérique.

```asm
; Activer le VPU en mode graphique
LDA #$81          ; valeur à écrire
STA $D000         ; écriture dans VPU_CTRL → le VPU s'active

; Lire l'état du clavier
LDA $D200         ; lecture de KEY_ASCII → code ASCII de la touche
```

C'est le même principe que sur tous les vrais ordinateurs 8-bit. Sur le Commodore 64, le chip vidéo VIC-II occupait la zone $D000–$D3FF. Sur l'Atari, c'était GTIA et POKEY. Le Chuck-8 suit cette tradition.

## 1.5 Le processeur 6502

Le 6502 a cinq registres visibles du programmeur :

```
A   (Accumulateur)  8 bits  Le registre principal. Toutes les opérations arithmétiques
                             passent par lui. Seul A peut lire/écrire la mémoire directement.

X   (Index X)       8 bits  Registre d'index. Compteurs, adressage indexé.
Y   (Index Y)       8 bits  Registre d'index. Même rôle que X mais pour certains modes.

PC  (Program Counter) 16 bits  Adresse de la prochaine instruction. Avance automatiquement.
SP  (Stack Pointer)   8 bits   Pointe dans la stack ($0100+SP). Géré par PHA/PLA/JSR/RTS.
P   (Processor Status) 8 bits  7 flags qui décrivent le résultat de la dernière opération.
```

### Les flags (registre P)

Chaque instruction arithmétique ou logique positionne certains flags :

```
N — Negative   : 1 si le résultat a le bit 7 à 1 (≥ 128 en non-signé, ou négatif en signé)
V — oVerflow   : 1 si un débordement signé s'est produit (+127+1 = -128 !)
B — Break      : 1 quand BRK s'exécute
D — Decimal    : mode BCD (arithmétique décimale — rare)
I — Interrupt  : 1 = IRQ masquées
Z — Zero       : 1 si le résultat est exactement 0
C — Carry      : 1 si l'opération a produit un report (carry) au-delà de 8 bits
```

Ces flags sont la seule façon de prendre des décisions. Le 6502 n'a pas d'instruction `if` — il a des branchements conditionnels qui testent ces flags.

## 1.6 Premier programme complet

Voici le programme le plus simple possible sur le Chuck-8 :

```asm
; ══════════════════════════════════════════
;  PREMIER PROGRAMME CHUCK-8
;  Affiche "BONJOUR" en mode texte
; ══════════════════════════════════════════

; Constantes
VPU_CTRL     = $D000
VPU_CHAR_OUT = $D00F

  .org $E000              ; commence ici (vecteur RESET pointe ici)

; Activer le VPU en mode texte
  LDA #$80               ; $80 = VPU enable, bit0=0 = mode texte
  STA VPU_CTRL

; Positionner le curseur en (0, 0)
  LDA #$00
  STA $D00B              ; VPU_CURSOR_X = 0
  STA $D00C              ; VPU_CURSOR_Y = 0

; Afficher chaque lettre
  LDA #'B'
  STA VPU_CHAR_OUT
  LDA #'O'
  STA VPU_CHAR_OUT
  LDA #'N'
  STA VPU_CHAR_OUT
  LDA #'J'
  STA VPU_CHAR_OUT
  LDA #'O'
  STA VPU_CHAR_OUT
  LDA #'U'
  STA VPU_CHAR_OUT
  LDA #'R'
  STA VPU_CHAR_OUT

  BRK                    ; arrêt propre
```

Tape ce programme dans Chuck IDE et exécute-le. "BONJOUR" apparaît en haut à gauche.

**Que se passe-t-il exactement ?**

1. Le CPU démarre à $E000 (le vecteur RESET $FFFC/$FFFD pointe ici)
2. `LDA #$80` charge la valeur 128 dans le registre A
3. `STA VPU_CTRL` écrit 128 dans le registre $D000 → le VPU s'active
4. Les `STA $D00B` et `$D00C` positionnent le curseur en (0,0)
5. Chaque `STA VPU_CHAR_OUT` envoie un caractère au VPU qui l'affiche et avance le curseur
6. `BRK` arrête le CPU

Deux instructions, sept caractères. C'est tout. Il n'y a pas de runtime, pas d'OS, pas de couche d'abstraction. Le programme parle directement au matériel.

## 1.7 La structure canonique d'un programme Chuck-8

Tout programme Chuck-8 sérieux suit ce modèle :

```asm
; ══════════════════════════════════════════
;  NOM DU PROGRAMME
;  Auteur, version, description
; ══════════════════════════════════════════

; ── Constantes (noms des registres et API) ─
VPU_CTRL        = $D000
SYS_CLEAR       = $F000
SYS_WAIT_VBLANK = $F057
; ... etc.

; ── Variables Zero Page ─────────────────────
POS_X  = $10     ; position du joueur x
POS_Y  = $11     ; position du joueur y
SCORE  = $20     ; score courant

  .org $E000

; ── INIT : s'exécute une seule fois ─────────
INIT:
  LDA #$81               ; mode graphique
  STA VPU_CTRL
  LDA #$00 : JSR SYS_CLEAR  ; efface l'écran en noir
  ; ... initialiser les variables ...

; ── MAIN LOOP : boucle principale ────────────
MAIN_LOOP:
  JSR SYS_WAIT_VBLANK    ; attendre 1/60e de seconde (sync VBlank)
  JSR UPDATE             ; mettre à jour la logique
  JSR DRAW               ; dessiner la frame
  JMP MAIN_LOOP          ; recommencer

; ── UPDATE ───────────────────────────────────
UPDATE:
  ; lire les entrées, mettre à jour la physique
  RTS

; ── DRAW ─────────────────────────────────────
DRAW:
  ; dessiner l'état courant
  RTS

; ── Données statiques ──────────────────────────
  .org $EC00
DONNEES:
  .byte $01, $02, $03
```

Cette structure — INIT, MAIN_LOOP, UPDATE, DRAW — est universelle dans les jeux 8-bit. Le Commodore 64, l'Atari, la NES : tous les jeux de l'époque suivaient ce pattern fondamental.

**Pourquoi `JSR SYS_WAIT_VBLANK` ?**

Le VPU dessine l'écran de haut en bas, 60 fois par seconde. Pendant qu'il dessine, si ton programme modifie le framebuffer, des artefacts visuels apparaissent (lignes brisées, déchirements). `SYS_WAIT_VBLANK` bloque ton programme jusqu'à ce que le VPU ait terminé de dessiner et recommence. Tu modifies l'écran pendant cette fenêtre "sûre".

C'est exactement ce que fait `requestAnimationFrame` en JavaScript — sauf que là, tu contrôles le mécanisme depuis le bas.

## 1.8 Résumé du chapitre 1

- Le Chuck-8 est un ordinateur avec 64 Ko de RAM, un processeur 6502 à 1 MHz, et des périphériques câblés en mémoire ($D000–$DFFF)
- L'hexadécimal est la base de travail : un octet = deux chiffres hex
- Les registres du 6502 : A (accumulateur), X/Y (index), PC (compteur programme), SP (pile), P (flags)
- Les flags décrivent le résultat de la dernière opération — ce sont les seuls outils de décision
- Tout programme commence à `.org $E000` et suit la structure INIT / MAIN_LOOP / UPDATE / DRAW

**Exercices :**

1. Modifie le premier programme pour afficher ton prénom
2. Change la position du curseur pour afficher le texte au centre (col 13, ligne 15)
3. Ajoute une deuxième ligne de texte en appuyant sur la touche entrée : `LDA #10 : STA VPU_CHAR_OUT` (code ASCII de la nouvelle ligne)

---

# CHAPITRE 2 — LE LANGAGE

## 2.1 L'assembleur ca65

Le Chuck-8 utilise la syntaxe **ca65**, le même assembleur qu'utilisent aujourd'hui les développeurs NES et 6502. La syntaxe est claire et précise.

Une ligne d'assembleur suit ce format :

```
[label:]  mnémonique  [opérande]  [; commentaire]
```

Exemples :

```asm
DEBUT:   LDA  #$42    ; charge 42 hex dans A
         STA  $10     ; écrit A dans la case mémoire $10
         BNE  DEBUT   ; si Z=0, retourne à DEBUT
```

### Définir des constantes

```asm
VITESSE    = 3         ; constante numérique
VPU_CTRL   = $D000     ; alias d'adresse
SKY        = %00000001 ; valeur binaire
NOM        = 'Z'       ; valeur ASCII
```

### Directives d'assemblage

```asm
.org $E000             ; fixe l'adresse courante
.byte $01, $02, $03    ; émet des octets
.word $1234            ; émet un mot 16-bit (lo, hi)
.res 16, $00           ; réserve 16 octets initialisés à 0
.ascii "Hello"         ; émet les codes ASCII de la chaîne
```

### Opérateurs d'adresse

```asm
LDA #<LABEL    ; octet bas de l'adresse de LABEL
LDA #>LABEL    ; octet haut de l'adresse de LABEL
LDA #SCORE + 1 ; expression arithmétique
```

## 2.2 Les 56 instructions du 6502

Le 6502 n'a que 56 instructions distinctes (mais 151 opcodes car chaque instruction existe en plusieurs modes d'adressage). Voici les groupes essentiels.

### Chargement et stockage

```asm
LDA #$42     ; A ← $42          (Load Accumulator, immédiat)
LDA $10      ; A ← mem[$10]     (Load depuis Zero Page)
LDA $1000    ; A ← mem[$1000]   (Load depuis adresse absolue)
STA $10      ; mem[$10] ← A     (Store A)
STA $1000    ; mem[$1000] ← A
LDX #5       ; X ← 5
STX $20      ; mem[$20] ← X
LDY #0       ; Y ← 0
STY $30
```

**Règle fondamentale :** seul A peut interagir avec la mémoire. X et Y servent d'index et de compteurs, mais pour écrire en mémoire depuis X ou Y, il faut d'abord passer par A :

```asm
LDX #$FF
TXA          ; A ← X  (Transfer X to A)
STA $0200    ; maintenant on peut écrire
```

### Transferts entre registres

```asm
TAX   ; A → X    TXA   ; X → A
TAY   ; A → Y    TYA   ; Y → A
TXS   ; X → SP   TSX   ; SP → X
```

### Arithmétique

```asm
CLC          ; TOUJOURS avant ADC (efface le Carry)
LDA #$10
ADC #$05     ; A = A + 5 + Carry = $15

SEC          ; TOUJOURS avant SBC (met le Carry)
LDA #$20
SBC #$08     ; A = A - 8 - (1-Carry) = $18
```

**Le Carry est le bit de liaison.** Pour une addition 16-bit :

```asm
; Additionner $1234 + $0056
CLC
LDA #$34 : ADC #$56 : STA $10  ; octets bas : $8A, Carry=0
LDA #$12 : ADC #$00 : STA $11  ; octets hauts : $12 + Carry = $12
; Résultat en $10/$11 = $128A
```

### Incrément et décrément

```asm
INX   ; X++    DEX   ; X--
INY   ; Y++    DEY   ; Y--
INC $10   ; mem[$10]++
DEC $20   ; mem[$20]--
```

Ces instructions sont utilisées massivement pour les compteurs de boucles. `INX` coûte seulement 2 cycles — beaucoup plus efficace que `LDA $10 : CLC : ADC #1 : STA $10`.

### Comparaison

`CMP`, `CPX`, `CPY` effectuent une soustraction fantôme (le résultat est jeté) et positionnent les flags :

```asm
LDA #$42
CMP #$42      ; Z=1 (égaux), C=1 (A >= valeur)
CMP #$43      ; Z=0, C=0 (A < valeur), N=1
CMP #$41      ; Z=0, C=1 (A > valeur), N=0
```

**Règle pour CMP :**
- `Z=1` → A = valeur → utiliser `BEQ`
- `C=0` → A < valeur → utiliser `BCC`
- `C=1` → A ≥ valeur → utiliser `BCS`

### Branchements conditionnels

```asm
BEQ LABEL   ; si Z=1 (résultat = 0, ou dernière CMP était égale)
BNE LABEL   ; si Z=0
BCC LABEL   ; si C=0 (Carry Clear = inférieur après CMP)
BCS LABEL   ; si C=1 (Carry Set = supérieur ou égal après CMP)
BMI LABEL   ; si N=1 (résultat négatif, bit 7 = 1)
BPL LABEL   ; si N=0 (résultat positif)
BVC LABEL   ; si V=0 (pas de débordement signé)
BVS LABEL   ; si V=1
```

**Important :** les branchements sont relatifs (+127/-128 octets). Si la cible est trop loin, l'assembleur génère une erreur. La solution : utiliser `JMP` pour les grands sauts.

### Sauts inconditionnels et sous-routines

```asm
JMP $E100    ; saut inconditionnel (PC ← $E100)
JMP (VECT)   ; saut indirect (PC ← mem[VECT])

JSR $F003    ; appel de sous-routine (SYS_DRAW_PIXEL)
             ; pousse PC sur la pile, saute à $F003
RTS          ; retour de sous-routine
             ; dépile PC, continue après le JSR
```

### Opérations logiques

```asm
AND #$0F     ; A = A ET $0F   (masque : ne garde que les bits 0-3)
ORA #$80     ; A = A OU $80   (fusionne : allume le bit 7)
EOR #$FF     ; A = A XOR $FF  (inverse tous les bits)
```

Applications typiques :

```asm
; Forcer une valeur dans [0, 15] pour la palette
AND #$0F

; Vérifier si un bit est à 1 (sans modifier A)
PHA
AND #$08          ; isole le bit 3
BEQ BIT_EST_ZERO  ; Z=1 si le bit était 0
PLA

; Inverser les bits d'état manette (0=enfoncé → 1=enfoncé)
EOR #$FF
```

### Décalages

```asm
ASL         ; A << 1  (× 2, Carry = ancien bit 7)
LSR         ; A >> 1  (÷ 2, Carry = ancien bit 0)
ROL         ; A << 1 avec Carry en entrée/sortie
ROR         ; A >> 1 avec Carry en entrée/sortie
```

`ASL` est fondamental pour les calculs d'adresses écran. La ligne Y du framebuffer commence à `$4000 + Y × 64`. Calculer `Y × 64` :

```asm
LDA #Y_POS
ASL          ; × 2
ASL          ; × 4
ASL          ; × 8
ASL          ; × 16
ASL          ; × 32
ASL          ; × 64
```

### La pile

```asm
PHA    ; pousse A sur la pile   (SP--)
PLA    ; dépile A depuis la pile (SP++)
PHP    ; pousse P (flags)
PLP    ; dépile P
```

La pile est **LIFO** (Last In, First Out). Chaque `PHA` doit correspondre à exactement un `PLA`. Une pile déséquilibrée est l'une des erreurs les plus courantes — et les plus difficiles à déboguer.

## 2.3 Les 13 modes d'adressage

Le même mnémonique (`LDA`) peut accéder à la mémoire de 8 façons différentes. Chaque façon a une utilité spécifique.

### Immédiat `#val`

```asm
LDA #$42     ; charge la constante 66 dans A
LDA #'H'     ; charge le code ASCII de 'H'
```

La valeur est dans l'instruction elle-même. C'est le plus rapide (2 cycles).

### Zero Page `$zz`

```asm
LDA $10      ; charge mem[$0010] dans A — 3 cycles
STA $10      ; sauvegarde A dans mem[$0010]
```

Accès ultra-rapide (instruction de 2 octets au lieu de 3). Toujours préférer la Zero Page pour les variables fréquentes.

### Zero Page indexée `$zz,X` et `$zz,Y`

```asm
LDA $10,X    ; charge mem[$0010 + X] — parfait pour les tableaux en ZP
STA $20,Y    ; sauvegarde à mem[$0020 + Y]
```

Si X = 3, `LDA $10,X` lit `mem[$0013]`. L'adresse wrap-around dans la page 0 (si $10+X > $FF, revient à $00).

### Absolu `$xxxx`

```asm
LDA $4800    ; charge mem[$4800] — lecture VRAM texte
STA $D000    ; écrit dans un registre I/O
```

3 octets, 4 cycles. Nécessaire pour les adresses > $FF.

### Absolu indexé `$xxxx,X` et `$xxxx,Y`

```asm
STA $4000,X  ; mem[$4000 + X] ← A
LDA $4800,Y  ; A ← mem[$4800 + Y]
```

Idéal pour parcourir des tableaux de plus de 256 éléments. La version `$xxxx,X` coûte un cycle de plus si le calcul traverse une page (le high byte de l'adresse change).

### Indirect `($xxxx)` — uniquement pour JMP

```asm
JMP ($FFFC)  ; lit le vecteur à $FFFC/$FFFD et saute là
```

C'est comment le processeur lit le vecteur RESET au démarrage.

### Indirect pré-indexé `($zz,X)` — "pré"

```asm
LDA ($10,X)  ; lit le vecteur à mem[$10+X]/$11+X, puis accède à cette adresse
```

Utile pour sélectionner un pointeur dans une table de pointeurs.

### Indirect post-indexé `($zz),Y` — "post"

```asm
LDA ($F0),Y  ; lit le vecteur 16-bit à $F0/$F1, ajoute Y, accède à l'adresse
STA ($F0),Y  ; same
```

**C'est le mode le plus puissant du 6502.** Il permet d'accéder à n'importe quelle adresse via un pointeur 16-bit en Zero Page. Exemples :

```asm
; Pointer vers $4000 (framebuffer)
LDA #$00 : STA $F0   ; lo
LDA #$40 : STA $F1   ; hi

LDY #$00
LDA #$77            ; jaune
STA ($F0),Y         ; écrit à $4000 + 0 = $4000

LDY #$40
STA ($F0),Y         ; écrit à $4000 + 64 = $4040 (début de la ligne 1)
```

### Relatif — uniquement pour les branches

```asm
BEQ LABEL    ; saute de -128 à +127 octets depuis l'instruction suivante
```

L'offset est signé : positif = en avant, négatif = en arrière.

## 2.4 Construire les structures de contrôle

Le 6502 n'a pas de `if`, `while`, `for`. Mais il a tout ce qu'il faut pour les construire.

### If / else

```asm
; if (A == $42) { ... } else { ... }
  CMP #$42
  BNE ELSE_BRANCH    ; si différent, saute vers ELSE
  ; code du if
  JMP APRES
ELSE_BRANCH:
  ; code du else
APRES:
```

### While

```asm
; while (X != 0) { X-- }
WHILE:
  CPX #$00
  BEQ FIN_WHILE
  DEX
  JMP WHILE
FIN_WHILE:
```

Ou plus idiomatique (le 6502 positionne Z automatiquement après DEX) :

```asm
  LDX #$10    ; 16 itérations
WHILE:
  ; corps de la boucle
  DEX
  BNE WHILE   ; continue tant que X != 0
```

### For loop — compter de 0 à N

```asm
; for (X = 0; X < 8; X++) { mem[$0200 + X] = 7; }
  LDA #7
  LDX #$00
FOR:
  STA $0200,X
  INX
  CPX #8
  BNE FOR
```

### For loop — 256 itérations (l'astuce DEX)

Pour exactement 256 itérations, `DEX/BNE` depuis 0 est élégant :

```asm
  LDA #$AA     ; valeur à écrire
  LDX #$00     ; commence à 0
BOUCLE:
  STA $4000,X  ; écrit à $4000 + X
  DEX          ; X-- (0 → $FF → $FE → ... → $01 → $00)
  BNE BOUCLE   ; s'arrête quand X revient à 0
; 256 tours exactement
```

### Switch / dispatch table

```asm
; switch (A) { case 0: ...; case 1: ...; case 2: ...; }
  CMP #0 : BEQ CASE_0
  CMP #1 : BEQ CASE_1
  CMP #2 : BEQ CASE_2
  JMP DEFAULT
CASE_0:
  ; ...
  JMP FIN_SWITCH
CASE_1:
  ; ...
```

Ou avec une table d'adresses pour un dispatch plus efficace :

```asm
; Index dans A (0-3)
  ASL          ; × 2 (les adresses font 2 octets)
  TAX
  LDA DISPATCH,X   ; lo
  STA $F0
  LDA DISPATCH+1,X ; hi
  STA $F1
  JMP ($F0)    ; saute vers la routine

DISPATCH:
  .word ROUTINE_0, ROUTINE_1, ROUTINE_2, ROUTINE_3
```

## 2.5 Exemple complet : calculer et afficher un score

Cet exemple combine plusieurs concepts : variables ZP, arithmétique 16-bit, affichage.

```asm
; ══════════════════════════════════════════
;  EXEMPLE : score 16-bit avec affichage
; ══════════════════════════════════════════

VPU_CTRL     = $D000
SYS_SET_COLOR = $F030
SYS_PRINT_HEX = $F027
SYS_PRINT_NUM = $F024
VPU_CHAR_OUT  = $D00F
VPU_CURSOR_X  = $D00B
VPU_CURSOR_Y  = $D00C

; Variables Zero Page
SCORE_LO = $10    ; octet bas du score
SCORE_HI = $11    ; octet haut du score
MULT     = $12    ; multiplicateur courant

  .org $E000

  ; Init
  LDA #$80 : STA VPU_CTRL    ; mode texte

  LDA #$00 : STA SCORE_LO
  LDA #$00 : STA SCORE_HI
  LDA #$01 : STA MULT        ; commence à ×1

  ; Calcule score = 1 + 2 + 4 + 8 + 16 + 32 (= 63)
  LDX #6
ACCUMULE:
  CLC
  LDA SCORE_LO : ADC MULT : STA SCORE_LO
  LDA SCORE_HI : ADC #0   : STA SCORE_HI   ; propage le carry
  ASL MULT                                   ; MULT *= 2
  DEX : BNE ACCUMULE

  ; Affiche le résultat
  LDA #$00 : STA VPU_CURSOR_X
  LDA #$00 : STA VPU_CURSOR_Y
  LDA #$10 : JSR SYS_SET_COLOR   ; blanc sur noir

  ; Affiche "SCORE: " en ASCII direct
  LDA #'S':STA VPU_CHAR_OUT : LDA #'C':STA VPU_CHAR_OUT
  LDA #'O':STA VPU_CHAR_OUT : LDA #'R':STA VPU_CHAR_OUT
  LDA #'E':STA VPU_CHAR_OUT : LDA #':':STA VPU_CHAR_OUT
  LDA #' ':STA VPU_CHAR_OUT

  ; Affiche le score en décimal
  LDA SCORE_LO : JSR SYS_PRINT_NUM

  ; Nouvelle ligne
  LDA #10 : STA VPU_CHAR_OUT

  ; Affiche le score en hex pour vérification
  LDA #'$':STA VPU_CHAR_OUT
  LDA SCORE_HI : JSR SYS_PRINT_HEX
  LDA SCORE_LO : JSR SYS_PRINT_HEX

  BRK
```

Résultat affiché : `SCORE: 63` puis `$003F`.

Remarque comment la propagation du Carry entre `SCORE_LO` et `SCORE_HI` permet l'arithmétique 16-bit avec des instructions 8-bit seulement.

## 2.6 Résumé du chapitre 2

- Les 56 mnémoniques 6502 couvrent : chargement/stockage, transferts, arithmétique, comparaison, branchement, sauts, logique, décalages, pile
- Le Carry est essentiel : `CLC` avant `ADC`, `SEC` avant `SBC`, toujours
- Les 13 modes d'adressage permettent d'accéder à la mémoire de façons très différentes — le mode `($zp),Y` est le plus puissant
- Les structures de contrôle (if, while, for) se construisent avec CMP et les branches
- La Zero Page est précieuse : utilise-la pour toutes tes variables importantes

**Exercices :**

1. Écris une boucle qui calcule la somme de 1 à 10 et l'affiche
2. Implémente une fonction `CLAMP` qui force une valeur dans [0, 100] : si A < 0, force à 0 ; si A > 100, force à 100 ; sinon laisse inchangé
3. Utilise `($F0),Y` pour écrire 16 pixels jaunes à la ligne 5 du framebuffer (adresse = $4000 + 5×64 = $4140)

---

# CHAPITRE 3 — LE SYSTÈME

## 3.1 La vidéo Chuck-8

Le VPU (Video Processing Unit) du Chuck-8 gère deux modes d'affichage, sélectionnables à volonté.

### Mode texte (mode 0)

32 colonnes × 32 lignes = 1024 caractères. Chaque caractère est affiché en 4×4 pixels, ce qui donne 128×128 pixels au total.

La mémoire texte est à **$4800–$4BFF** (1 octet par case = code ASCII). Les attributs couleur sont à **$4C00–$4FFF** (1 octet par case = bits 7-4 : couleur fond, bits 3-0 : couleur texte).

```asm
; Écrire 'A' blanc sur fond bleu en position (5, 3)
; Adresse texte  = $4800 + 3×32 + 5 = $4800 + $61 = $4861
; Adresse attrib = $4C00 + 3×32 + 5 = $4C00 + $61 = $4C61

LDA #'A'
STA $4861    ; le caractère

LDA #$61     ; bits 7-4 = $6 (bleu) = fond, bits 3-0 = $1 (blanc) = texte
STA $4C61    ; l'attribut
```

La façon la plus simple d'utiliser le mode texte est via les registres VPU :

```asm
; Configurer couleurs et écrire un caractère
LDA #$61     ; fond bleu (6), texte blanc (1)
STA $D00E    ; VPU_PAPER = 6
LDA #$01
STA $D00D    ; VPU_INK = 1

LDA #5 : STA $D00B    ; colonne 5
LDA #3 : STA $D00C    ; ligne 3
LDA #'A' : STA $D00F  ; VPU_CHAR_OUT — écrit et avance
```

### Mode graphique (mode 1)

128×128 pixels, 16 couleurs. Le framebuffer est à **$4000–$5FFF** (8192 octets).

**Format nibble-packed :** 2 pixels par octet. Le nibble haut (bits 7-4) contient le pixel de gauche, le nibble bas (bits 3-0) le pixel de droite.

```
Octet à l'adresse $4000 :
  Bits 7-4 = couleur du pixel (0, 0)
  Bits 3-0 = couleur du pixel (1, 0)

Octet à l'adresse $4001 :
  Bits 7-4 = couleur du pixel (2, 0)
  Bits 3-0 = couleur du pixel (3, 0)

...et ainsi de suite sur 64 octets par ligne.
```

**Calcul d'adresse :**
```
adresse = $4000 + py × 64 + px ÷ 2
```

En code :
```asm
; Pixel (px=10, py=5)
; adresse = $4000 + 5×64 + 5 = $4000 + $140 = $4145

LDA #5       ; py
ASL : ASL : ASL : ASL : ASL : ASL   ; × 64
CLC : ADC #5 ; + px/2 = 10/2 = 5
STA $F0
LDA #$40
STA $F1      ; pointeur vers $4145

LDY #$00
LDA ($F0),Y  ; lit l'octet actuel
AND #$0F     ; efface le nibble haut (px pair)
ORA #$70     ; jaune (7) dans le nibble haut
STA ($F0),Y
```

L'API `SYS_DRAW_PIXEL` fait tout ça automatiquement :

```asm
SYS_DRAW_PIXEL = $F003
LDA #7    ; couleur jaune
LDX #10   ; px
LDY #5    ; py
JSR SYS_DRAW_PIXEL
```

### La palette Chuck-8

16 couleurs fixes, numérotées 0 à 15 :

```
0  Noir       #000000    8  Orange     #CC8800
1  Blanc      #FFFFFF    9  Brun       #884400
2  Rouge      #CC0000   10  Rose       #FF8888
3  Cyan       #00CCCC   11  Gris foncé #444444
4  Violet     #CC00CC   12  Gris moyen #888888
5  Vert       #00CC00   13  Vert clair #88FF88
6  Bleu       #0000CC   14  Bleu clair #8888FF
7  Jaune      #CCCC00   15  Gris clair #CCCCCC
```

Ces couleurs sont fixes. Il n'y a pas de palette custom en v1.0 — c'est une contrainte volontaire, comme les 16 couleurs du C64 (qui étaient aussi fixes).

### Basculer entre les modes

```asm
SYS_SET_MODE = $F01B
; A=0 → mode texte, A=1 → mode graphique

LDA #1 : JSR SYS_SET_MODE   ; passer en graphique
; ... dessiner ...
LDA #0 : JSR SYS_SET_MODE   ; revenir en texte
; ... écrire du texte ...
LDA #1 : JSR SYS_SET_MODE   ; retour en graphique
```

Le contenu de la VRAM est **préservé** lors du switch. Le framebuffer graphique et la mémoire texte coexistent — seul l'affichage change.

### Double buffering

Pour les animations sans scintillement :

```asm
; Activer le mode double buffer
LDA #$83    ; bit7=enable, bit1=flip mode, bit0=gfx
STA $D000   ; VPU_CTRL

; ... dessiner dans le backbuffer ($6000–$7FFF) ...

; Swapper les buffers au prochain VBlank
JSR SYS_FLIP   ; $F018
```

Sans double buffering, tu dessines directement dans ce qui est affiché — visible octet par octet. Avec, tu dessines dans l'ombre et montres tout d'un coup.

## 3.2 L'API vidéo complète

```asm
SYS_CLEAR      = $F000  ; A=couleur → efface tout l'écran
SYS_DRAW_PIXEL = $F003  ; A=couleur, X=px, Y=py
SYS_DRAW_LINE  = $F006  ; A=couleur, $80/$81=x0/y0, $82/$83=x1/y1
SYS_DRAW_RECT  = $F009  ; A=couleur, $80=x $81=y $82=w $83=h (contour)
SYS_FILL_RECT  = $F00C  ; A=couleur, mêmes params (rempli)
SYS_FLIP       = $F018  ; swap framebuffers A↔B au prochain VBlank
SYS_SET_MODE   = $F01B  ; A=0(texte) ou A=1(gfx)
SYS_PRINT_CHAR = $F01E  ; A=char ASCII → affiche au curseur
SYS_PRINT_STR  = $F021  ; $80/$81=adresse chaîne null-terminated
SYS_PRINT_NUM  = $F024  ; A=entier → décimal au curseur
SYS_PRINT_HEX  = $F027  ; A=valeur → "$XX" au curseur
SYS_SET_CURSOR = $F02A  ; X=colonne, Y=ligne
SYS_SET_COLOR  = $F030  ; A=(ink<<4)|paper
```

## 3.3 Le son Chuck-8

Le SPU (Sound Processing Unit) a 3 voix et un canal sample. Chaque voix est contrôlée par 8 registres.

### Voix 0 ($D100–$D107)

```
$D100  Fréquence lo    La fréquence en Hz = 1 000 000 / (valeur + 1)
$D101  Fréquence hi
$D102  Volume          bits 7-4 = canal gauche, bits 3-0 = canal droit (0–15)
$D103  Attack          durée en frames (0–15)
$D104  Decay           durée en frames
$D105  Sustain         niveau (0–15)
$D106  Release         durée en frames
$D107  Contrôle        bit7=gate(1=note on) bits3-0=forme d'onde
```

**Formes d'onde :**
- `$01` — Onde carrée 50%
- `$02` — Onde carrée 25%
- `$03` — Triangle
- `$04` — Dent de scie

### Jouer une note

```asm
; La 440 Hz sur voix 0, onde carrée
; Période = 1 000 000 / 440 = 2272 = $08E0

LDA #$E0 : STA $D100   ; freq lo
LDA #$08 : STA $D101   ; freq hi
LDA #$FF : STA $D102   ; volume max
LDA #$02 : STA $D103   ; attack = 2 frames
LDA #$04 : STA $D104   ; decay
LDA #$0C : STA $D105   ; sustain
LDA #$06 : STA $D106   ; release
LDA #$81 : STA $D107   ; gate=1, onde carrée

; Arrêter la note :
LDA #$01 : STA $D107   ; gate=0, garde la forme d'onde
```

### API son (plus simple)

```asm
SYS_PLAY_NOTE  = $F036  ; A=note MIDI (21-108), X=voix, $80=durée en frames
SYS_STOP_VOICE = $F039  ; X=voix → arrête cette voix
SYS_STOP_ALL   = $F03C  ; arrête toutes les voix
SYS_SET_VOL    = $F042  ; A=volume (0-15), X=voix

; Jouer La 4 (note MIDI 69) sur voix 0, pendant 30 frames
LDA #69 : LDX #0 : LDA #30 : STA $80
JSR SYS_PLAY_NOTE
```

## 3.4 Les entrées

### Clavier

```asm
KEY_ASCII  = $D200   ; code ASCII (0 si aucune touche)
KEY_STATUS = $D201   ; bit7=1 si touche enfoncée

; Lire une touche (bloquant)
JSR SYS_WAIT_KEY   ; $F04E — attend et retourne ASCII dans A

; Lire sans bloquer
LDA KEY_STATUS
AND #$80 : BEQ PERSONNE   ; Z=1 si aucune touche
LDA KEY_ASCII              ; lit le code ASCII
```

**Codes spéciaux (KEY_RAW à $D203) :**

```
$80 = ↑    $81 = ↓    $82 = ←    $83 = →
$84 = F1   $85 = F2   $86 = F3   $87 = F4
```

### Manette

```asm
PAD1_STATE = $D210   ; état manette 1 (bit=0 si enfoncé)
PAD2_STATE = $D211

; Boutons (bits de PAD_STATE)
PAD_A      = %10000000
PAD_B      = %01000000
PAD_SELECT = %00100000
PAD_START  = %00010000
PAD_RIGHT  = %00001000
PAD_LEFT   = %00000100
PAD_DOWN   = %00000010
PAD_UP     = %00000001
```

**La logique inversée :** bit=0 signifie bouton **enfoncé**. C'est exactement la logique de la manette NES. Pour obtenir 1=enfoncé, utilise `EOR #$FF` :

```asm
LDA PAD1_STATE    ; $FF si tout relâché
EOR #$FF          ; maintenant 1=enfoncé
AND #PAD_RIGHT    ; teste droite
BEQ PAS_DROITE    ; 0 = pas enfoncé
; ici : bouton droite enfoncé
```

### Souris

```asm
MOUSE_X   = $D220    ; position x (0–127)
MOUSE_Y   = $D221    ; position y (0–127)
MOUSE_BTN = $D224    ; bit0=gauche bit1=droit (0=enfoncé)

LDA MOUSE_X    ; position courante X
LDA MOUSE_Y    ; position courante Y
LDA MOUSE_BTN
AND #$01 : BEQ CLIC_GAUCHE   ; 0 = bouton gauche enfoncé
```

## 3.5 Le timer et les frames

```asm
SYS_FRAME_LO = $D304    ; compteur frames lo
SYS_FRAME_HI = $D305    ; compteur frames hi
SYS_RAND     = $D306    ; octet aléatoire (LFSR)

; Utilisation typique pour animation
JSR SYS_FRAME_NUM   ; $F069 — A=lo, X=hi
AND #$3F            ; modulo 64 (0–63)
; utiliser comme phase d'animation

; Aléatoire
LDA SYS_RAND        ; nouvel octet à chaque lecture
AND #$0F            ; force dans 0–15 (palette)
```

## 3.6 Exemple complet : jeu de réflexe

```asm
; ══════════════════════════════════════════
;  JEU DE RÉFLEXE — appuie sur A au bon moment
; ══════════════════════════════════════════

SYS_SET_MODE    = $F01B
SYS_CLEAR       = $F000
SYS_FILL_RECT   = $F00C
SYS_WAIT_VBLANK = $F057
SYS_FRAME_NUM   = $F069
SYS_RAND        = $F05A
SYS_PRINT_STR   = $F021

PAD_A = %10000000

CIBLE_X = $10    ; position de la cible
SCORE   = $11    ; score

  .org $E000

  LDA #1 : JSR SYS_SET_MODE
  LDA #0 : JSR SYS_CLEAR
  LDA #0 : STA SCORE

  ; Position aléatoire initiale
  JSR SYS_RAND : AND #$60 : STA CIBLE_X

MAIN:
  JSR SYS_WAIT_VBLANK
  LDA #0 : JSR SYS_CLEAR

  ; Déplacer la cible (suit une sinusoïde approximée via frame counter)
  JSR SYS_FRAME_NUM
  AND #$3F             ; 0–63
  CLC : ADC #32        ; 32–95
  STA CIBLE_X

  ; Dessiner la cible rouge
  LDA CIBLE_X : STA $80
  LDA #54      : STA $81
  LDA #16      : STA $82
  LDA #16      : STA $83
  LDA #2       : JSR SYS_FILL_RECT

  ; Dessiner la zone de visée au centre
  LDA #55 : STA $80
  LDA #54 : STA $81
  LDA #18 : STA $82
  LDA #18 : STA $83
  LDA #1  : JSR SYS_DRAW_RECT   ; $F009

  ; Lire manette
  LDA #0 : JSR $F048   ; SYS_READ_PAD
  EOR #$FF
  AND #PAD_A
  BEQ PAS_A

  ; Bouton A : tester si cible dans la zone (55–73)
  LDA CIBLE_X
  CMP #55 : BCC RATE    ; trop à gauche
  CMP #73 : BCS RATE    ; trop à droite

  ; Touché !
  INC SCORE
  JSR SYS_RAND : AND #$60 : STA CIBLE_X

RATE:
PAS_A:
  ; Afficher score en mode texte
  LDA #0 : JSR SYS_SET_MODE    ; texte
  LDA #$10 : JSR $F030         ; blanc sur noir
  LDA #0 : STA $D00B
  LDA #0 : STA $D00C
  LDA #'S':STA $D00F:LDA #'C':STA $D00F
  LDA #'O':STA $D00F:LDA #'R':STA $D00F
  LDA #'E':STA $D00F:LDA #':':STA $D00F
  LDA SCORE : JSR SYS_PRINT_NUM
  LDA #1 : JSR SYS_SET_MODE    ; retour gfx

  JMP MAIN
```

## 3.7 Résumé du chapitre 3

- Le VPU supporte deux modes : texte (32×32 chars) et graphique (128×128 px, 16 couleurs)
- Le framebuffer graphique utilise le nibble-packing : 2 pixels par octet
- L'API ROM ($F000+) fournit toutes les primitives vidéo, son, et I/O
- La manette utilise la logique NES inversée (bit=0 si enfoncé) — toujours `EOR #$FF` avant les tests
- Le double buffering avec `SYS_FLIP` élimine le scintillement

---

# CHAPITRE 4 — LES PATTERNS

## 4.1 La convention d'appel ABI

Le Chuck-8 définit une **convention d'appel** stricte. Respecter cette convention permet de combiner des routines de différentes sources sans conflits.

**Les 5 règles :**

```
Règle 1  A = registre de retour. La valeur dans A après JSR est le résultat.
Règle 2  X et Y sont libres. L'appelé peut les modifier. L'appelant doit les sauvegarder s'il en a besoin.
Règle 3  $0080–$00EF = zone paramètres. Pour passer plus de 3 paramètres.
Règle 4  $00F0–$00FF = pointeurs temporaires (P0–P7). Appartiennent à l'appelé.
Règle 5  La pile est sacrée. SP identique à l'entrée et à la sortie.
```

**Exemples :**

```asm
; Appel avec 1 paramètre → via A
LDA #7             ; couleur
JSR MON_CLEAR

; Appel avec 3 paramètres → A, X, Y
LDA #7 : LDX #10 : LDY #20
JSR DRAW_PIXEL_AXY

; Appel avec paramètres larges → Zone paramètres
LDA #$00 : STA $80   ; x lo
LDA #$01 : STA $81   ; x hi
LDA #$00 : STA $82   ; y lo
LDA #$00 : STA $83   ; y hi
LDA #$80 : STA $84   ; w
LDA #$40 : STA $85   ; h
LDA #5               ; couleur (dans A comme d'habitude)
JSR DRAW_RECT_LARGE
```

## 4.2 Écrire une bibliothèque réutilisable

Une bonne routine de dessin sauvegarde et restaure ce qu'elle modifie :

```asm
; ── DRAW_HBAR ────────────────────────────────────────────
; Dessine une barre horizontale pleine
; Entrée : A=couleur, X=x_start, Y=y, $80=longueur
; Modifie : A, $F0/$F1 (pointeurs temporaires — autorisé)
; Préserve : X, Y (l'appelant peut en avoir besoin)
; ─────────────────────────────────────────────────────────
DRAW_HBAR:
  STX $10          ; sauvegarde x
  STY $11          ; sauvegarde y
  PHA              ; sauvegarde couleur

  ; Calcul adresse : $4000 + y*64 + x/2
  LDA $11          ; y
  ASL:ASL:ASL:ASL:ASL:ASL   ; ×64
  STA $F0
  LDA #$40 : STA $F1

  ; Ajouter x/2
  LDA $10 : LSR    ; x/2
  CLC : ADC $F0 : STA $F0
  LDA $F1 : ADC #0 : STA $F1

  ; Préparer couleur nibble-packed
  PLA              ; récupère couleur
  PHA              ; resauvegarde
  AND #$0F
  STA $12          ; sauvegarde couleur propre
  ASL:ASL:ASL:ASL
  ORA $12          ; color | (color<<4)
  STA $13          ; nibble-packed

  ; Boucle
  LDA $80          ; longueur en octets (= pixels/2)
  STA $14

  LDA $13          ; valeur à écrire
  LDY #0
HBAR_LOOP:
  STA ($F0),Y
  INY
  CPY $14
  BNE HBAR_LOOP

  PLA              ; restaure couleur dans A (valeur de retour)
  LDX $10          ; restaure X
  LDY $11          ; restaure Y
  RTS
```

## 4.3 Données statiques et tables de correspondance

Les données statiques sont des tables définis dans le code avec `.byte` ou `.word`. Elles permettent de remplacer des calculs coûteux par des lookups.

**Table de correspondance note MIDI → fréquence :**

```asm
; Fréquences pour les notes MIDI 60 (Do4) à 71 (Si4)
; freq = 1 000 000 / (période + 1), pré-calculé
FREQS_LO: .byte $BE,$49,$E0,$82,$2C,$E0,$9C,$60,$2B,$FC,$D2,$AD
FREQS_HI: .byte $09,$09,$08,$08,$08,$07,$07,$07,$07,$06,$06,$06

; Jouer la note N (0=Do, 1=Ré, ... 11=Si)
; Entrée : X = index note
PLAY_NOTE_SCALE:
  LDA FREQS_LO,X : STA $D100    ; freq lo voix 0
  LDA FREQS_HI,X : STA $D101    ; freq hi
  LDA #$FF : STA $D102           ; volume max
  LDA #$81 : STA $D107           ; gate=1, onde carrée
  RTS
```

**Table de sprites (données d'image) :**

```asm
; Sprite smiley 8×4 pixels (4 octets par ligne, nibble-packed)
; Couleur 7=jaune, 0=transparent (fond)
SMILEY:
  .byte $07,$77,$77,$70    ; ..JJJJJJ..  (ligne 0)
  .byte $79,$11,$11,$97    ; .J.BB.BB.J. (yeux)
  .byte $79,$10,$01,$97    ; .J.B..B..J. (sourire)
  .byte $07,$77,$77,$70    ; ..JJJJJJ..  (ligne 3)
```

**Table de positions pour une séquence d'animation :**

```asm
; 8 frames d'animation pour un personnage qui marche
; Chaque frame = (offset_x, offset_y) pour le sprite
WALK_ANIM_X: .byte 0, 1, 2, 1, 0, $FF, $FE, $FF   ; $FF = -1
WALK_ANIM_Y: .byte 0, 1, 0, $FF, 0, 1, 0, $FF
```

## 4.4 Gestion d'état avec une machine à états

Pour les jeux, une machine à états simplifie la logique :

```asm
; États du jeu
STATE_TITLE    = 0
STATE_PLAYING  = 1
STATE_PAUSED   = 2
STATE_GAMEOVER = 3

GAME_STATE = $20    ; état courant en ZP

; Dans UPDATE
LDA GAME_STATE
BEQ UPDATE_TITLE
CMP #1 : BEQ UPDATE_PLAYING
CMP #2 : BEQ UPDATE_PAUSED
CMP #3 : BEQ UPDATE_GAMEOVER
RTS

UPDATE_TITLE:
  ; ... logique menu titre ...
  RTS

UPDATE_PLAYING:
  ; ... logique jeu ...
  RTS
```

## 4.5 Optimisation 6502

Sur une machine à 1 MHz, chaque cycle compte. Voici les optimisations les plus importantes.

**Préférer la Zero Page :**

```asm
; Lent : 4 cycles, 3 octets
LDA $1000

; Rapide : 3 cycles, 2 octets (si la variable est en ZP)
LDA $10
```

**Utiliser DEX/BNE pour les boucles :**

```asm
; Moins efficace
  LDX #0
LOOP:
  ; ...
  INX : CPX #64 : BNE LOOP    ; 5 instructions

; Plus efficace
  LDX #64
LOOP:
  ; ...
  DEX : BNE LOOP              ; 2 instructions
```

**Eviter JSR/RTS pour les routines critiques :**

`JSR` coûte 6 cycles, `RTS` 6 cycles = 12 cycles d'overhead. Pour une routine appelée 1000 fois par frame, c'est 12 000 cycles perdus sur 16 667 disponibles (72%!). Inliner le code quand c'est possible.

**Comparer avec 0 implicitement :**

```asm
; Lourd
  LDA COMPTEUR : CMP #0 : BEQ ZERO

; Efficace : LDA positionne Z automatiquement
  LDA COMPTEUR : BEQ ZERO
```

**Utiliser X et Y pour les sauts de table :**

```asm
; Table de jump pour un menu de 4 options
  ASL          ; index × 2 (adresses 16-bit)
  TAX
  LDA JUMP_TABLE+1,X   ; hi
  PHA
  LDA JUMP_TABLE,X     ; lo
  PHA
  RTS    ; équivalent à JMP (addr) avec la pile

JUMP_TABLE:
  .word OPTION_1 - 1   ; -1 car RTS incrémente PC
  .word OPTION_2 - 1
  .word OPTION_3 - 1
  .word OPTION_4 - 1
```

## 4.6 Techniques d'animation

**Effacement et redessin :**

Pour déplacer un sprite, la technique minimale :
1. Effacer l'ancienne position (écrire la couleur de fond)
2. Mettre à jour la position
3. Dessiner la nouvelle position

```asm
; Effacer ancien sprite
LDA POS_X : STA $80
LDA POS_Y : STA $81
LDA #8    : STA $82 : STA $83
LDA #0    : JSR SYS_FILL_RECT    ; noir = fond

; Mettre à jour
LDA POS_X : CLC : ADC VITESSE : STA POS_X

; Dessiner nouveau sprite
LDA POS_X : STA $80
; ... (même params sauf x)
LDA #7    : JSR SYS_FILL_RECT    ; jaune
```

**Physique simple — vélocité et gravité :**

```asm
; Variables
VEL_Y = $12     ; vitesse verticale (-128 à +127, signée)
POS_Y = $11     ; position y

; Chaque frame
  LDA VEL_Y : CLC : ADC #1 : STA VEL_Y   ; gravité : +1 par frame
  LDA POS_Y : CLC : ADC VEL_Y : STA POS_Y ; position += vitesse

; Sol à y=100
  LDA POS_Y : CMP #100 : BCC PAS_SOL
  LDA #100  : STA POS_Y
  LDA #$F0  : STA VEL_Y    ; rebond : vitesse = -16
PAS_SOL:
```

$F0 en signé = -16 (complément à 2 : $F0 = 256 - 16 = -16).

**Clignotement avec frame counter :**

```asm
JSR SYS_FRAME_NUM   ; A = lo frame
AND #$10            ; bit 4 : alterne toutes les 16 frames ≈ 0.27s
BEQ AFFICHE_BLANC
; éteint
JMP SUITE
AFFICHE_BLANC:
; allumé
SUITE:
```

## 4.7 Résumé du chapitre 4

- La convention ABI Chuck-8 : A=retour, X/Y=libres, $80–$EF=params, $F0–$FF=pointeurs
- Les tables `.byte`/`.word` remplacent les calculs coûteux
- La machine à états structure les transitions entre modes de jeu
- Les optimisations principales : Zero Page, DEX/BNE, éviter JSR sur les chemins chauds, comparer avec 0 implicitement
- Les animations : effacer + redessiner, vélocité en ZP, gravité = +1 par frame

---

# CHAPITRE 5 — LES PROJETS

## 5.1 Projet 1 — Demo graphique

Une démo est un programme qui affiche des effets visuels sans logique de jeu. Les démos 8-bit étaient (et sont encore) un art à part entière.

**Effet : tunnel en cercles concentriques**

```asm
; ══════════════════════════════════════════
;  DEMO : TUNNEL
;  Cercles concentriques animés
; ══════════════════════════════════════════

SYS_SET_MODE    = $F01B
SYS_DRAW_PIXEL  = $F003
SYS_WAIT_VBLANK = $F057
SYS_FRAME_NUM   = $F069
SYS_RAND        = $F05A

  .org $E000

  LDA #1 : JSR SYS_SET_MODE

FRAME:
  JSR SYS_WAIT_VBLANK
  JSR SYS_FRAME_NUM   ; A = frame lo
  STA $20              ; phase d'animation

  ; Dessine 64 pixels aléatoires colorés
  LDX #64
PIXEL:
  STX $10
  JSR SYS_RAND : AND #$7F : TAX    ; x aléatoire 0-127
  JSR SYS_RAND : AND #$7F : TAY    ; y aléatoire 0-127
  ; Couleur = distance au centre modifiée par la phase
  ; Approximation : |x-64| + |y-64| → couleur
  TXA : SEC : SBC #64 : BPL PX : EOR #$FF : ADC #1
PX:
  STA $11
  TYA : SEC : SBC #64 : BPL PY : EOR #$FF : ADC #1
PY:
  CLC : ADC $11   ; distance manhattan
  CLC : ADC $20   ; + phase
  AND #$0F        ; palette
  BEQ COLOR_FIX   ; évite le noir
  JMP DRAW_IT
COLOR_FIX:
  LDA #1
DRAW_IT:
  JSR SYS_DRAW_PIXEL
  LDX $10 : DEX : BNE PIXEL

  JMP FRAME
```

## 5.2 Projet 2 — Pong complet

```asm
; ══════════════════════════════════════════
;  PONG — Raquettes + balle + score
; ══════════════════════════════════════════

SYS_SET_MODE    = $F01B
SYS_CLEAR       = $F000
SYS_FILL_RECT   = $F00C
SYS_WAIT_VBLANK = $F057
SYS_PLAY_NOTE   = $F036
SYS_STOP_ALL    = $F03C

PAD_UP   = %00000001
PAD_DOWN = %00000010

; Variables
BALL_X = $10  : BALL_Y = $11
BALL_DX = $12 : BALL_DY = $13
PAD1_Y = $14  : PAD2_Y = $15
SCORE1 = $16  : SCORE2 = $17

  .org $E000

  LDA #1 : JSR SYS_SET_MODE
  LDA #0 : JSR SYS_CLEAR

  ; Init
  LDA #64 : STA BALL_X : STA BALL_Y
  LDA #1  : STA BALL_DX : STA BALL_DY
  LDA #56 : STA PAD1_Y : STA PAD2_Y
  LDA #0  : STA SCORE1  : STA SCORE2

MAIN:
  JSR SYS_WAIT_VBLANK
  LDA #0 : JSR SYS_CLEAR

  ; ── MOUVEMENT BALLE ───────────────────
  LDA BALL_X : CLC : ADC BALL_DX : STA BALL_X
  LDA BALL_Y : CLC : ADC BALL_DY : STA BALL_Y

  ; Rebond haut/bas
  LDA BALL_Y : BEQ FLIP_DY
  CMP #127   : BNE NO_FLIP_Y
FLIP_DY:
  LDA #0 : SEC : SBC BALL_DY : STA BALL_DY
  LDA #69 : LDX #1 : LDA #4 : STA $80 : JSR SYS_PLAY_NOTE  ; bip
NO_FLIP_Y:

  ; Collision raquette gauche (x=4, y=PAD1_Y à PAD1_Y+16)
  LDA BALL_X : CMP #5 : BNE NO_PAD1
  LDA BALL_Y : CMP PAD1_Y : BCC NO_PAD1
  LDA BALL_Y : LDX PAD1_Y : TXA : CLC : ADC #16 : CMP BALL_Y : BCC NO_PAD1
  LDA #1 : STA BALL_DX
  LDA #72 : LDX #0 : LDA #3 : STA $80 : JSR SYS_PLAY_NOTE
NO_PAD1:

  ; Collision raquette droite (x=122)
  LDA BALL_X : CMP #122 : BNE NO_PAD2
  LDA BALL_Y : CMP PAD2_Y : BCC NO_PAD2
  LDA BALL_Y : LDX PAD2_Y : TXA : CLC : ADC #16 : CMP BALL_Y : BCC NO_PAD2
  LDA #$FF : STA BALL_DX   ; $FF = -1
  LDA #72 : LDX #0 : LDA #3 : STA $80 : JSR SYS_PLAY_NOTE
NO_PAD2:

  ; Point : balle sort à gauche → score2++
  LDA BALL_X : CMP #1 : BCS NO_SCORE2
  INC SCORE2 : LDA #64 : STA BALL_X : STA BALL_Y
NO_SCORE2:

  ; Point : balle sort à droite → score1++
  LDA BALL_X : CMP #126 : BCC NO_SCORE1
  INC SCORE1 : LDA #64 : STA BALL_X : STA BALL_Y
NO_SCORE1:

  ; ── MOUVEMENT RAQUETTES ───────────────
  LDA #0 : JSR $F048 : EOR #$FF
  AND #PAD_UP   : BEQ NO_P1_UP   : LDA PAD1_Y : BEQ NO_P1_UP   : DEC PAD1_Y
NO_P1_UP:
  LDA #0 : JSR $F048 : EOR #$FF
  AND #PAD_DOWN : BEQ NO_P1_DOWN : LDA PAD1_Y : CMP #112 : BCS NO_P1_DOWN : INC PAD1_Y
NO_P1_DOWN:

  ; Raquette 2 : IA simple (suit la balle)
  LDA PAD2_Y : CLC : ADC #8 : CMP BALL_Y
  BEQ NO_AI : BCS AI_UP : BCC AI_DOWN
AI_UP:   LDA PAD2_Y : BEQ NO_AI   : DEC PAD2_Y : JMP NO_AI
AI_DOWN: LDA PAD2_Y : CMP #112    : BCS NO_AI  : INC PAD2_Y
NO_AI:

  ; ── DESSIN ────────────────────────────
  ; Raquette 1
  LDA #4  : STA $80 : LDA PAD1_Y : STA $81
  LDA #4  : STA $82 : LDA #16    : STA $83
  LDA #1  : JSR SYS_FILL_RECT

  ; Raquette 2
  LDA #120 : STA $80 : LDA PAD2_Y : STA $81
  LDA #4   : STA $82 : LDA #16    : STA $83
  LDA #1   : JSR SYS_FILL_RECT

  ; Balle
  LDA BALL_X : STA $80 : LDA BALL_Y : STA $81
  LDA #2 : STA $82 : STA $83
  LDA #7 : JSR SYS_FILL_RECT

  ; Ligne centrale (pointillés)
  LDA #63 : STA $80
  LDX #16
DOTLINE:
  LDA #1 : STA $81
  LDA #2 : STA $82 : STA $83
  LDA #12 : JSR SYS_FILL_RECT
  LDA $81 : CLC : ADC #8 : STA $81
  DEX : BNE DOTLINE

  ; Score en mode texte superposé
  LDA #0 : JSR SYS_SET_MODE
  LDA #$10 : JSR $F030
  LDA #14 : STA $D00B : LDA #0 : STA $D00C
  LDA SCORE1 : JSR $F024
  LDA #17 : STA $D00B
  LDA SCORE2 : JSR $F024
  LDA #1 : JSR SYS_SET_MODE

  ; Fin du jeu à 9 points
  LDA SCORE1 : CMP #9 : BEQ WINNER1
  LDA SCORE2 : CMP #9 : BEQ WINNER2

  JMP MAIN

WINNER1:
WINNER2:
  JSR SYS_STOP_ALL
  LDA #0 : JSR SYS_SET_MODE
  LDA #$10 : JSR $F030
  LDA #10 : STA $D00B : LDA #15 : STA $D00C
  LDA #'G':STA $D00F:LDA #'A':STA $D00F:LDA #'M':STA $D00F
  LDA #'E':STA $D00F:LDA #' ':STA $D00F:LDA #'O':STA $D00F
  LDA #'V':STA $D00F:LDA #'E':STA $D00F:LDA #'R':STA $D00F
  BRK
```

## 5.3 Projet 3 — Outil : éditeur hexadécimal minimal

```asm
; ══════════════════════════════════════════
;  HEXEDIT — Navigue et modifie la RAM
; ══════════════════════════════════════════
; Manette : gauche/droite = adresse -1/+1
;           haut/bas = valeur +1/-1
;           Start = save (BRK)

ADDR_LO = $10 : ADDR_HI = $11   ; adresse courante
VALUE   = $12                     ; valeur à cette adresse

SYS_SET_MODE   = $F01B
SYS_SET_CURSOR = $F02A
SYS_SET_COLOR  = $F030
SYS_PRINT_HEX  = $F027
VPU_CHAR_OUT   = $D00F

PAD_UP=$01:PAD_DOWN=$02:PAD_LEFT=$04:PAD_RIGHT=$08:PAD_START=$10

  .org $E000

  LDA #0 : JSR SYS_SET_MODE
  LDA #$10 : STA $D00D   ; VPU_INK blanc
  LDA #$00 : STA $D00E   ; VPU_PAPER noir

  LDA #$00 : STA ADDR_LO
  LDA #$40 : STA ADDR_HI  ; démarre à $4000

MAIN:
  ; Lire valeur à l'adresse courante
  LDA ADDR_HI : STA $F1
  LDA ADDR_LO : STA $F0
  LDY #0 : LDA ($F0),Y : STA VALUE

  ; Afficher adresse et valeur
  LDA #0 : JSR SYS_SET_CURSOR
  LDA #$70 : JSR SYS_SET_COLOR   ; jaune sur noir = mode normal

  LDA #'$':STA VPU_CHAR_OUT
  LDA ADDR_HI : JSR SYS_PRINT_HEX
  LDA ADDR_LO : JSR SYS_PRINT_HEX
  LDA #':':STA VPU_CHAR_OUT
  LDA #' ':STA VPU_CHAR_OUT

  LDA #$20 : JSR SYS_SET_COLOR   ; rouge sur noir = valeur éditable
  LDA VALUE : JSR SYS_PRINT_HEX

  LDA #10 : STA VPU_CHAR_OUT    ; newline
  LDA #$10 : JSR SYS_SET_COLOR
  LDA #'[':STA VPU_CHAR_OUT
  LDA #'<':STA VPU_CHAR_OUT:LDA #'>':STA VPU_CHAR_OUT
  LDA #'=':STA VPU_CHAR_OUT:LDA #'a':STA VPU_CHAR_OUT
  LDA #'d':STA VPU_CHAR_OUT:LDA #'r':STA VPU_CHAR_OUT
  LDA #' ':STA VPU_CHAR_OUT
  LDA #'^':STA VPU_CHAR_OUT:LDA #'v':STA VPU_CHAR_OUT
  LDA #'=':STA VPU_CHAR_OUT:LDA #'v':STA VPU_CHAR_OUT
  LDA #'a':STA VPU_CHAR_OUT:LDA #'l':STA VPU_CHAR_OUT
  LDA #']':STA VPU_CHAR_OUT

  ; Lire pad
  LDA #0 : JSR $F048 : EOR #$FF : STA $20

  LDA $20 : AND #PAD_RIGHT : BEQ NR
  INC ADDR_LO : BNE NR : INC ADDR_HI
NR:
  LDA $20 : AND #PAD_LEFT : BEQ NL
  LDA ADDR_LO : BNE NL2 : DEC ADDR_HI
NL2: DEC ADDR_LO
NL:
  LDA $20 : AND #PAD_UP : BEQ NU
  INC VALUE
  LDA VALUE : STA ($F0),Y
NU:
  LDA $20 : AND #PAD_DOWN : BEQ ND
  DEC VALUE
  LDA VALUE : STA ($F0),Y
ND:
  LDA $20 : AND #PAD_START : BNE DONE

  ; Délai
  LDX #$FF : DEX : BNE *-1

  JMP MAIN

DONE:
  BRK
```

## 5.4 Ce que tu as appris

Cinq chapitres, et tu maîtrises maintenant :

**L'architecture** : comment un processeur lit, décode et exécute des instructions ; comment la mémoire est organisée en zones avec des rôles précis ; pourquoi la Zero Page est précieuse.

**Le langage** : les 56 instructions du 6502 et leurs 13 modes d'adressage ; comment construire if/else/while/for avec des branches ; la différence entre l'adressage absolu, indexé, et indirect post-indexé.

**Le système** : comment le VPU affiche des pixels en nibble-packing ; comment l'API ROM simplifie le dessin, le son, les entrées ; la convention de timing VBlank.

**Les patterns** : la convention d'appel ABI ; comment écrire des bibliothèques réutilisables ; les tables de données ; la machine à états ; l'optimisation cycle par cycle.

**Les projets** : un Pong complet, une démo graphique, un éditeur hexadécimal.

## 5.5 La suite

Le Chuck-8 a encore des territoires inexplorés dans ce manuel :

- **Les interruptions NMI/IRQ** — le NMI se déclenche à chaque VBlank. En écrivant un handler à l'adresse pointée par `$FFFA/$FFFB`, tu peux exécuter du code automatiquement 60 fois par seconde, indépendamment de ta boucle principale.

- **L'arithmétique avancée** — multiplication et division 16-bit, virgule fixe (un nombre en $xx.yy pour la physique), table de sinus pré-calculée pour des effets de rotation.

- **Le son avancée** — enveloppes ADSR complètes, musique avec une table de séquences, effet de vibrato via la modulation de fréquence.

- **Les sprites hardware** — la zone $5000–$5FFF et les registres VPU_SPR_* permettent d'afficher jusqu'à 8 sprites de 8×8 pixels gérés par le VPU lui-même.

- **Les formats de fichiers** — le format `.chuck` permet d'embarquer code, données, charset custom dans un seul fichier texte.

Et si un jour on construit le hardware ? Le 6502 (W65C02S) est encore fabriqué aujourd'hui par Western Design Center. Un Chuck-8 physique, c'est possible.

---

## ANNEXE — Référence rapide

### Instructions utilisées le plus souvent

```
LDA / STA  Charger / stocker A
LDX / STX  Charger / stocker X
LDY / STY  Charger / stocker Y
TAX / TXA / TAY / TYA  Transferts
PHA / PLA  Pile A
CLC / ADC  Addition
SEC / SBC  Soustraction
INX / DEX / INY / DEY  ±1 sur les index
INC / DEC  ±1 en mémoire
CMP / CPX / CPY  Comparaison
BEQ / BNE  Branchement égal/différent
BCC / BCS  Branchement < / >=
BMI / BPL  Branchement négatif / positif
JMP / JSR / RTS  Saut / appel / retour
AND / ORA / EOR  Logique
ASL / LSR  Décalage × 2 / ÷ 2
BRK  Arrêt
NOP  Ne fait rien (2 cycles)
```

### Adresses clés Chuck-8

```
$0010–$007F  Variables utilisateur (ZP)
$0080–$00EF  Paramètres ABI (ZP)
$00F0–$00FF  Pointeurs temporaires (ZP)
$4000–$5FFF  Framebuffer A (graphique)
$4800–$4BFF  Mémoire texte
$4C00–$4FFF  Attributs couleur texte
$D000        VPU_CTRL (bit7=enable, bit0=mode)
$D00B/$D00C  VPU_CURSOR_X / Y
$D00F        VPU_CHAR_OUT
$D200        KEY_ASCII
$D210        PAD1_STATE
$D306        SYS_RAND (lecture)
$E000        Point d'entrée
$F000        SYS_CLEAR
$F003        SYS_DRAW_PIXEL
$F00C        SYS_FILL_RECT
$F01B        SYS_SET_MODE
$F01E        SYS_PRINT_CHAR
$F02A        SYS_SET_CURSOR
$F030        SYS_SET_COLOR
$F048        SYS_READ_PAD
$F057        SYS_WAIT_VBLANK
$F05A        SYS_RAND
$FFFC/$FFFD  Vecteur RESET → $E000
```

### La palette

```
 0 Noir      1 Blanc     2 Rouge     3 Cyan
 4 Violet    5 Vert      6 Bleu      7 Jaune
 8 Orange    9 Brun     10 Rose     11 Gris foncé
12 Gris moy 13 Vert cl  14 Bleu cl  15 Gris clair
```

---

*Chuck-8 Manuel de Programmation — v1.0*
*Inspired by Rodnay Zaks, Programming the 6502 (1978)*
*"The best way to learn is to understand every detail."*