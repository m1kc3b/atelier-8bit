# CHUCK-8 — MANUEL DE PROGRAMMATION
## Coder comme en 1980 pour devenir un meilleur développeur en 2026

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

> *"To understand a computer, you must think like a computer."* — Rodnay Zaks, *Programming the 6502* (1978)

---

## Pourquoi ce manuel existe

En 2026, tu peux écrire une application web complète sans jamais savoir ce qu'est un registre. Tu peux faire tourner de l'IA sans comprendre comment un processeur exécute une instruction. Les frameworks, les langages de haut niveau, les abstractions en couches — c'est formidable, mais ça te cache quelque chose d'essentiel.

Ce que ce manuel te propose, c'est un détour. Un détour par 1980.

À cette époque, quand Steve Wozniak concevait l'Apple II ou quand des milliers de kids en Grande-Bretagne tapaient du BASIC sur leur ZX Spectrum, il n'y avait pas d'abstraction possible. Pour allumer un pixel à l'écran, tu calculais son adresse mémoire à la main. Pour lire un bouton de manette, tu testais un bit dans un registre. Pour écrire de la musique, tu programmais des fréquences en Hz.

Ces contraintes n'étaient pas des handicaps — elles forçaient à comprendre.

Aujourd'hui, programmer sur le Chuck-8 te force à la même chose. Et ce que tu vas comprendre ici — la mémoire, les registres, les interruptions, la pile, l'arithmétique binaire — ça restera vrai dans cinquante ans, parce que c'est le fonctionnement fondamental de tous les ordinateurs, du plus modeste microcontrôleur au serveur de datacenter le plus puissant.

**Le Chuck-8 est imaginaire. Ce qu'il t'apprend est réel.**

> Pourquoi Chuck-8 ? En hommage à Chuck Peddle le concepteur du MOS 6502.

---

## Comment utiliser ce manuel

Chaque section alterne explication, exemples et **exercices**. Les exercices sont signalés par `✏️`. Ils se font directement dans l'éditeur — tape, exécute, observe, modifie. Ne saute pas les exercices : c'est là que la théorie devient de la mémoire musculaire.

| Chapitre | Titre | Ce que tu vas comprendre |
|----------|-------|-----------------------------|
| 1 | La Machine | Comment un ordinateur fonctionne vraiment |
| 2 | Le Langage | Les instructions du 6502, mot par mot |
| 3 | Le Système | L'écran, le son, les entrées — la plateforme Chuck-8 |
| 4 | Les Patterns | Les techniques qui reviennent dans tous les jeux 8-bit |
| 5 | Les Projets | Construire des vrais programmes, du début à la fin |

---

# CHAPITRE 1 — LA MACHINE

## 1.1 Ce qu'est le Chuck-8

Le Chuck-8 est un ordinateur personnel imaginaire des années 1980. Imaginaire — mais cohérent. Chaque décision de sa conception est motivée par ce qui existait vraiment à cette époque, et tout ce qu'il contient est constructible avec du hardware réel. Un jour, on pourrait en souder un.

Ses caractéristiques :

| Composant | Chuck-8 | Comparaison historique |
|-----------|---------|------------------------|
| Processeur | MOS 6502 à 1 MHz | Apple II, Commodore 64, NES, Atari 800 |
| RAM | 64 Ko | Commodore 64 : 64 Ko, Apple II : 48 Ko |
| Écran | 128×128 px, 16 couleurs | Atari 2600 : 160×192, 128 couleurs |
| Son | 3 voix | Commodore 64 (SID) : 3 voix |
| I/O | Clavier, manette, souris | Standard de l'époque |

Le 6502 mérite qu'on s'y attarde une seconde. Ce chip, conçu par Chuck Peddle et son équipe chez MOS Technology en 1975, a changé l'histoire. Vendu à 25 dollars quand son concurrent (l'Intel 8080) en coûtait 150, il a rendu l'ordinateur personnel financièrement accessible. Steve Jobs en a mis un dans l'Apple II. Atari en a mis un dans ses consoles. Nintendo en a mis un (légèrement modifié) dans la NES.

Ce même 6502 — Western Design Center le fabrique encore aujourd'hui, en 2026. Tu peux en commander un pour quelques euros. C'est le chip que tu vas programmer.


## 1.2 Le cycle fondamental

Avant d'écrire une ligne de code, comprends ce qui se passe physiquement à l'intérieur du processeur. Tout le reste en découle.

Un CPU ne fait qu'une chose, indéfiniment, depuis qu'il est mis sous tension jusqu'à ce qu'on l'éteigne :

```
    ┌─────────────────────────────────────┐
    │                                     │
    ▼                                     │
FETCH — lit l'octet en mémoire à PC       │
    │                                     │
    ▼                                     │
DECODE — interprète l'opcode              │
    │                                     │
    ▼                                     │
EXECUTE — effectue l'action               │
    │                                     │
    └─────────────────────────────────────┘
```

**FETCH** : le processeur lit l'octet à l'adresse contenue dans le *Program Counter* (PC). Si PC vaut `$E000`, il lit `mem[$E000]`. PC s'incrémente automatiquement.

**DECODE** : cet octet est un *opcode* — un code d'opération. `$A9` signifie "LDA immédiat". `$8D` signifie "STA absolu". Il y en a 151 au total.

**EXECUTE** : l'action est effectuée. Ça peut être un calcul, une lecture ou une écriture en mémoire, un changement de direction (branchement).

Sur le Chuck-8, chaque cycle dure exactement **1 microseconde** (un millionième de seconde). Les instructions les plus simples prennent 2 cycles. Les plus complexes prennent 7. En une seconde : environ 500 000 instructions.

Ton smartphone fait la même chose, mais à 3 milliards de cycles par seconde. Le principe est identique. La vitesse change. Rien d'autre.


## 1.3 La mémoire : un tableau de 65 536 cases

La mémoire d'un ordinateur, c'est fondamentalement un tableau. Un tableau de 65 536 cases (sur le Chuck-8), numérotées de `$0000` à `$FFFF`. Chaque case contient exactement un octet — une valeur entre 0 et 255.

```
Adresse   Contenu
$0000     [  42 ]   ← variable de ton programme
$0001     [   0 ]
$0002     [ 255 ]
  ...       ...
$4000     [  119]   ← pixel de l'écran
  ...       ...
$E000     [ 169 ]   ← première instruction de ton programme
$E001     [  81 ]
  ...       ...
$FFFC     [   0 ]   ← vecteur RESET (lo)
$FFFD     [ 224 ]   ← vecteur RESET (hi) → $E000
```

Quand tu "accèdes à la mémoire" en assembleur, tu lis ou tu écris dans ce tableau. C'est tout. Il n'y a pas de type, pas d'objet, pas de référence. Juste des octets à des adresses.

> **Lien avec le présent** — En C, quand tu fais `int* p = malloc(4)`, tu obtiens une adresse dans un tableau de mémoire. En JavaScript, quand V8 stocke un objet, il le place quelque part dans la RAM et garde son adresse. L'abstraction change selon le langage — le tableau d'octets reste.

> ✏️ **Exercice 1.3** — Écris le programme suivant et clique Run. Puis ouvre le panneau **Mémoire** et cherche les adresses `$0010` et `$0011`. Que contiennent-elles ?
> ```asm
>   .org $E000
>   LDA #42
>   STA $10
>   LDA #255
>   STA $11
>   BRK
> ```
> Change les valeurs 42 et 255 par d'autres nombres (entre 0 et 255). Vérifie que la mémoire reflète exactement ce que tu as écrit.


## 1.4 La memory map du Chuck-8

Toutes les cases ne se valent pas. Certaines zones ont des rôles précis, définis une fois pour toutes :

```
$0000  ┌──────────────────────┐
       │  ZERO PAGE (256 o.)  │ ← tes variables les plus importantes
       │  $10–$7F libres      │
       │  $80–$EF paramètres  │
$0100  ├──────────────────────┤
       │  STACK (256 o.)      │ ← pile hardware, gérée automatiquement
$0200  ├──────────────────────┤
       │  RAM LIBRE (15 Ko)   │ ← données, buffers, tableaux
$4000  ├──────────────────────┤
       │  VRAM (16 Ko)        │ ← tout ce qui s'affiche à l'écran
       │  $4000  framebuffer  │   (mode graphique)
       │  $4800  texte 32×32  │   (mode texte)
       │  $4C00  attributs    │   (couleurs du texte)
$8000  ├──────────────────────┤
       │  CARTOUCHE (16 Ko)   │ ← ROM optionnelle
$D000  ├──────────────────────┤
       │  I/O (4 Ko)          │ ← périphériques : écran, son, manette...
$E000  ├──────────────────────┤
       │  TON PROGRAMME       │ ← tu démarres ici
$F000  ├──────────────────────┤
       │  ROM SYSTÈME (4 Ko)  │ ← API Chuck-8, charset, vecteurs
$FFFF  └──────────────────────┘
```

**La Zero Page** (`$0000–$00FF`) est spéciale. Les instructions qui y accèdent sont d'un octet plus courtes et d'un cycle plus rapides que les accès ailleurs. Mets tes variables les plus utilisées ici.

**La zone I/O** (`$D000–$DFFF`) est magique. Quand tu écris à l'adresse `$D000`, tu ne modifies pas un octet en mémoire — tu envoies une commande au VPU (la puce vidéo). Quand tu lis `$D210`, tu reçois l'état actuel des boutons de la manette. C'est le principe des *memory-mapped I/O*, utilisé sur tous les ordinateurs 8-bit de l'époque — et encore aujourd'hui dans les microcontrôleurs embarqués.

**La ROM système** (`$F000–$FFFF`) contient les routines toutes faites. `JSR $F003` dessine un pixel. `JSR $F000` efface l'écran. Tu ne peux pas modifier cette zone — elle est en lecture seule, comme son nom l'indique.


## 1.5 L'hexadécimal — s'y habituer

L'hexadécimal te semblera bizarre pendant une semaine. Puis tu ne pourras plus t'en passer.

Les ordinateurs pensent en binaire (0 et 1). L'hexadécimal (base 16) est le pont entre le binaire et le décimal : chaque chiffre hex représente exactement 4 bits. Deux chiffres hex = 1 octet.

```
Binaire       Hex    Décimal
0000 0000  =  $00  =   0
0000 1111  =  $0F  =  15
0001 0000  =  $10  =  16
0111 1111  =  $7F  = 127
1000 0000  =  $80  = 128
1111 1111  =  $FF  = 255
```

Dans l'assembleur ca65 que tu utilises ici, les constantes s'écrivent :

```asm
LDA #$FF        ; hexadécimal — valeur 255
LDA #%11111111  ; binaire — même valeur
LDA #255        ; décimal — même valeur
LDA #'A'        ; ASCII — code du caractère A (= 65 = $41)
```

Une astuce : quand tu vois une adresse comme `$D210`, lis-la comme un code postal. Tu n'as pas besoin de la convertir en décimal. `$D210` c'est `$D210`, point final.

> **Pourquoi le $ ?** Convention de l'assembleur MOS de 1975. Dans d'autres assembleurs, tu verras `0xFF` (C/C++), `FFh` (x86/Intel), ou `&HFF` (BASIC). C'est la même chose, habillée différemment.

> ✏️ **Exercice 1.5** — Sans calculatrice, convertis mentalement ces valeurs hex en décimal : `$10`, `$20`, `$40`, `$80`, `$FF`. Puis vérifie en écrivant `LDA #$10 : BRK` et en regardant le registre A dans le panneau Registres. Essaie aussi `$3F` (indice : `$3F` = `$40` - 1 = 64 - 1).


## 1.6 Les registres du 6502

Le processeur dispose de petites zones de stockage ultra-rapides, intégrées directement dans le chip : les **registres**. Il y en a cinq sur le 6502.

```
A : Accumulateur (8 bits)
Le registre principal. Toute opération arithmétique passe par lui.
Tu ne peux lire ou écrire en mémoire que depuis A.

X : Index X (8 bits)
Y : Index Y (8 bits)
Registres secondaires. Compteurs, adressage indexé.
Ils ne peuvent pas directement lire/écrire en mémoire.

PC : Program Counter (16 bits)
L'adresse de la prochaine instruction à exécuter.
S'incrémente automatiquement. On ne le touche pas directement.

SP : Stack Pointer (8 bits)
Pointe dans la pile ($0100–$01FF). Géré par PHA/PLA/JSR/RTS.

P : Processor Status (8 bits)
7 drapeaux (flags) décrivant le résultat de la dernière opération.
```

Les **flags** du registre P sont essentiels :

```
Bit  7   6   5   4   3   2   1   0
     N   V   —   B   D   I   Z   C
     │   │       │   │   │   │   └── Carry    : report (addition/soustraction)
     │   │       │   │   │   └────── Zero     : résultat = 0
     │   │       │   │   └────────── Interrupt: IRQ masquées (1=masquées)
     │   │       │   └────────────── Decimal  : mode BCD (rare)
     │   │       └────────────────── Break    : BRK en cours
     │   └────────────────────────── oVerflow : débordement signé
     └────────────────────────────── Negative : bit 7 du résultat = 1
```

Ces flags sont ta seule façon de prendre des décisions. Le 6502 n'a pas d'instruction `if`. Il a des branchements conditionnels qui testent ces flags — `BEQ` (branche si Z=1), `BCC` (branche si C=0), etc.

> **En 2026** — Ton CPU moderne a des dizaines de registres et des flags similaires. Les processeurs ARM et x86 ont leurs propres PSR (Program Status Register). Le principe est le même depuis 50 ans.

> ✏️ **Exercice 1.6** — Exécute ce programme et observe le panneau Registres à chaque étape. Quel flag s'allume quand on charge 0 ? Quel flag s'allume quand on charge 200 (`$C8`) ?
> ```asm
>   .org $E000
>   LDA #0     ; charge zéro
>   LDA #200   ; charge 200 ($C8 = 1100 1000 — bit 7 = 1)
>   LDA #127   ; charge 127 ($7F = 0111 1111 — bit 7 = 0)
>   BRK
> ```
> *Réponse attendue : Z=1 après LDA #0, N=1 après LDA #200, N=0 après LDA #127.*


## 1.7 Premier programme : "BONJOUR"

Voilà le programme le plus simple qui soit sur le Chuck-8 :

```asm
; ══════════════════════════════════════════
;  BONJOUR — Premier programme Chuck-8
; ══════════════════════════════════════════

VPU_CTRL     = $D000   ; registre de contrôle vidéo
VPU_CHAR_OUT = $D00F   ; écrire un caractère à l'écran

  .org $E000            ; mon programme commence ici

; Activer le VPU (puce vidéo) en mode texte
  LDA #$80
  STA VPU_CTRL

; Placer le curseur en (0, 0)
  LDA #0
  STA $D00B            ; VPU_CURSOR_X = colonne 0
  STA $D00C            ; VPU_CURSOR_Y = ligne 0

; Afficher "BONJOUR" lettre par lettre
  LDA #'B' : STA VPU_CHAR_OUT
  LDA #'O' : STA VPU_CHAR_OUT
  LDA #'N' : STA VPU_CHAR_OUT
  LDA #'J' : STA VPU_CHAR_OUT
  LDA #'O' : STA VPU_CHAR_OUT
  LDA #'U' : STA VPU_CHAR_OUT
  LDA #'R' : STA VPU_CHAR_OUT

  BRK                  ; arrêt
```

Tape ce programme et clique **Run**. "BONJOUR" apparaît en haut à gauche.

**`.org $E000`** — dit à l'assembleur "place mon code à partir de l'adresse $E000". C'est là que pointe le vecteur RESET — l'adresse où le CPU commence à exécuter au démarrage.

**`LDA #$80`** — charge la valeur 128 (`$80`) dans le registre A. Le `#` signifie "valeur immédiate" (la valeur elle-même, pas une adresse).

**`STA VPU_CTRL`** — écrit A dans `$D000`. Ça active la puce vidéo. L'écriture à cette adresse n'est pas un simple stockage en mémoire — c'est une commande matérielle.

**`STA VPU_CHAR_OUT`** — écrire à `$D00F` envoie un caractère au VPU, qui l'affiche à la position du curseur et avance le curseur d'une position.

**`BRK`** — Break. Arrête le CPU proprement.

Rien d'autre. Pas de runtime, pas d'OS, pas de bibliothèque standard chargée en arrière-plan. Ton programme parle directement au matériel.

> ✏️ **Exercice 1.7** — Modifie le programme pour :
> 1. Afficher ton prénom à la place de "BONJOUR"
> 2. Positionner le texte au centre de l'écran (colonne 13, ligne 15)
> 3. Ajouter une deuxième ligne sous ton prénom avec le message "CHUCK-8" (astuce : `LDA #10 : STA VPU_CHAR_OUT` envoie un saut de ligne)


## 1.8 Structure canonique d'un programme

Pour les programmes qui tournent en continu (des jeux, des démos), on utilise une structure standard :

```asm
; ══════════════════════════════════════════
;  STRUCTURE CHUCK-8 STANDARD
; ══════════════════════════════════════════

; ── Constantes (addresses et API) ─────────
SYS_CLEAR       = $F000
SYS_DRAW_PIXEL  = $F003
SYS_RAND        = $F05A

; ── Variables en Zero Page ────────────────
; La ZP est précieuse — mets-y tout ce qui change souvent
POS_X  = $10     ; position x du joueur
POS_Y  = $11     ; position y du joueur
DIR_X  = $12     ; direction x (1 ou $FF = -1)
SCORE  = $20     ; score courant

  .org $E000

; ── INIT : exécuté une seule fois ─────────
INIT:
  LDA #$81 : STA $D000    ; mode graphique
  LDA #0 : JSR SYS_CLEAR  ; écran noir
  ; ... initialiser les variables ...

; ── BOUCLE PRINCIPALE ─────────────────────
MAIN_LOOP:
  JSR UPDATE    ; logique du jeu
  JSR DRAW      ; rendu
  JMP MAIN_LOOP

; ── LOGIQUE ───────────────────────────────
UPDATE:
  ; lire les entrées, déplacer, collision...
  RTS

; ── RENDU ─────────────────────────────────
DRAW:
  ; dessiner l'état courant...
  RTS
```

Cette architecture — INIT, MAIN_LOOP, UPDATE, DRAW — est universelle. Elle s'appelle la *game loop*. Tous les jeux de l'époque l'utilisaient. Tous les jeux modernes aussi. Unity, Unreal, Pygame — tous ont une boucle principale qui appelle Update() et Render() en alternance.

Tu viens de toucher une des constantes de l'informatique.

---

## ✏️ Atelier chapitre 1 — "CARTE DE VISITE"

Tu as appris ce qu'est la mémoire, les registres, l'hexadécimal et les I/O. Il est temps de tout assembler.

**Objectif :** afficher une carte de visite en mode texte avec :
- Ton prénom centré sur la ligne 12
- Le texte "CLUB CHUCK-8" centré sur la ligne 14, en couleur différente
- Une ligne de séparation faite de tirets `---` sur la ligne 11

**Ce dont tu as besoin :**
```asm
VPU_CTRL     = $D000
VPU_CHAR_OUT = $D00F
SYS_SET_COLOR = $F030
; SYS_SET_COLOR : A = (ink << 4) | paper
; Exemples : $10 = blanc sur noir, $70 = jaune sur noir, $20 = rouge sur noir

  LDA #col : STA $D00B   ; positionner curseur (colonne)
  LDA #lig : STA $D00C   ; positionner curseur (ligne)
  LDA #$XX : JSR SYS_SET_COLOR  ; choisir couleur
  LDA #'?' : STA VPU_CHAR_OUT   ; écrire un caractère
```

**Bonus :** Ajoute une bordure de `*` sur tout le pourtour de l'écran (colonnes 0 et 31, lignes 0 et 31). Indice : utilise une boucle avec `LDX` / `DEX` / `BNE`.

---

# CHAPITRE 2 — LE LANGAGE

## 2.1 L'assembleur ca65

Un programme assembleur est une suite d'instructions humainement lisibles — les *mnémoniques* — que l'assembleur traduit en octets machine. Le Chuck-8 utilise la syntaxe **ca65**, le même outil qu'utilisent aujourd'hui les développeurs qui programment sur NES, Atari, ou 6502 en général.

Une ligne suit ce format :

```asm
[label:]   mnémonique   [opérande]   [; commentaire]

DEBUT:     LDA          #$42        ; charge 42 en A
```

**Définir des constantes** avec `=` :
```asm
VPU_CTRL = $D000    ; un nom pour une adresse
VITESSE  = 3        ; un nom pour une valeur
COULEUR  = %0111    ; binaire : 4 bits, valeur 7
```

**Directives d'assemblage** :
```asm
.org $E000          ; fixer l'adresse courante
.byte $01, $02, $03 ; émettre des octets bruts
.word $1234         ; émettre 2 octets (little-endian : lo, hi)
.res 16, $00        ; réserver 16 octets à zéro
```

**Opérateurs `<` et `>` pour les adresses 16-bit** :
```asm
LABEL = $E123

LDA #<LABEL    ; octet bas : $23
LDA #>LABEL    ; octet haut : $E1
```

C'est essentiel pour passer des adresses à l'API :
```asm
MSG: .byte "Chuck-8", 0     ; chaîne null-terminated

  LDA #<MSG : STA $80       ; adresse lo de MSG
  LDA #>MSG : STA $81       ; adresse hi de MSG
  JSR SYS_PRINT_STR         ; $F021 — affiche la chaîne
```

> ✏️ **Exercice 2.1** — Déclare deux constantes `VITESSE = 3` et `LIMITE = 100`. Écris un programme qui charge VITESSE dans A, la stocke à l'adresse `$10`, puis charge LIMITE dans A et la stocke à `$11`. Vérifie en hexdump.


## 2.2 Les trois registres actifs — A, X, Y

**A** est le seul registre qui peut lire et écrire en mémoire directement. X et Y servent d'index et de compteurs.

```asm
; ── Charger dans A ──────────────────────────────────
LDA #42       ; A ← 42 (valeur immédiate)
LDA $10       ; A ← mem[$0010] (Zero Page)
LDA $1000     ; A ← mem[$1000] (absolu)
LDA $10,X     ; A ← mem[$10 + X] (ZP indexé)
LDA $1000,X   ; A ← mem[$1000 + X] (absolu indexé)
LDA $1000,Y   ; A ← mem[$1000 + Y]

; ── Écrire depuis A ─────────────────────────────────
STA $10       ; mem[$10] ← A
STA $1000     ; mem[$1000] ← A
STA $10,X     ; mem[$10 + X] ← A

; ── Même chose pour X et Y ──────────────────────────
LDX #5        ; X ← 5
STX $20       ; mem[$20] ← X
LDY #0        ; Y ← 0
STY $30       ; mem[$30] ← Y
```

**Pour écrire X ou Y en mémoire, passe par A** :
```asm
LDX #$FF
TXA           ; A ← X   (Transfer X to A)
STA $0200     ; maintenant tu peux écrire en mémoire
```

Les transferts disponibles :
```asm
TAX  ; A → X       TXA  ; X → A
TAY  ; A → Y       TYA  ; Y → A
TXS  ; X → SP      TSX  ; SP → X
```

> ✏️ **Exercice 2.2** — Remplis les 8 premières cases de la Zero Page ($10 à $17) avec la valeur 42 en utilisant `STX` avec un index. Tu auras besoin de `LDA #42`, `STA $10`, `STA $11`... mais essaie de faire ça avec `LDX` et `STA $10,X` dans une boucle. *Indice : `LDX #7` puis boucle avec `STA $10,X : DEX : BPL BOUCLE`.*


## 2.3 L'arithmétique et le Carry

Voici quelque chose qui va te déstabiliser au début, puis qui va changer ta façon de penser.

Le 6502 n'a pas d'instruction "additionne A et B". Il a **ADC** — *Add with Carry*. Et **SBC** — *Subtract with Borrow*. Ces instructions incluent systématiquement le Carry flag dans le calcul.

**Pourquoi ?** Parce que ça permet de faire de l'arithmétique sur des nombres plus grands qu'un octet, en enchaînant les additions octet par octet. Le Carry "déborde" d'un octet vers le suivant — exactement comme tu poses un "1" en colonne quand tu fais une addition à la main.

```asm
; Addition simple : A = A + 5
  CLC          ; efface le Carry avant ADC (TOUJOURS faire ça)
  ADC #5

; Soustraction simple : A = A - 3
  SEC          ; met le Carry avant SBC (TOUJOURS faire ça)
  SBC #3
```

**Règle d'or :**
- Avant `ADC` : toujours `CLC` (Clear Carry)
- Avant `SBC` : toujours `SEC` (Set Carry)

**Addition 16-bit** — additionner deux valeurs 16-bit stockées en ZP :

```asm
; VAL1 = $1234 stocké en $10/$11 (lo en $10, hi en $11)
; VAL2 = $0056 stocké en $12/$13
; Résultat dans $14/$15

  CLC
  LDA $10 : ADC $12 : STA $14   ; octets bas + carry sortant
  LDA $11 : ADC $13 : STA $15   ; octets hauts + carry entrant
```

Si les octets bas dépassent 255, le carry est automatiquement reporté sur l'addition des octets hauts. C'est de la magie — non, c'est juste du binaire.

> **Lien avec le présent** — Quand ton CPU moderne fait `a + b` sur des entiers 64-bit, il fait exactement la même chose, mais en un seul cycle grâce à des circuits parallèles. La logique de propagation du Carry est identique.

**Incrément et décrément** — ces instructions sont rapides et ne touchent pas au Carry :

```asm
INX   ; X = X + 1  (2 cycles)
DEX   ; X = X - 1  (2 cycles)
INY   ; Y = Y + 1
DEY   ; Y = Y - 1
INC $10   ; mem[$10]++ (5 cycles)
DEC $10   ; mem[$10]-- (5 cycles)
```

`INX` + `DEX` sont tes meilleurs amis pour les boucles. Bien plus rapides que `LDA $10 : CLC : ADC #1 : STA $10` (10 cycles vs 2).

> ✏️ **Exercice 2.3** — Calcule 200 + 100 avec `CLC : ADC`. Que se passe-t-il ? (200 + 100 = 300 > 255 — le résultat déborde !) Regarde le flag C dans les registres : il vaut 1, ce qui signifie qu'il y a eu un débordement. La valeur dans A sera 44 (`300 - 256`). C'est le comportement normal en 8-bit.
> ```asm
>   .org $E000
>   LDA #200
>   CLC
>   ADC #100    ; résultat = 44, Carry = 1
>   STA $10     ; vérifie en hexdump : $10 = $2C = 44
>   BRK
> ```
> Maintenant calcule `300` sur 16 bits : stocke 200 en `$10` et 0 en `$11`, stocke 100 en `$12` et 0 en `$13`. Additionne les deux paires. Le résultat `$012C` (= 300) doit apparaître en `$14`/`$15`.


## 2.4 Comparer et brancher

Le 6502 n'a pas de `if`. Il a `CMP` + une instruction de branchement.

`CMP` fait une soustraction fantôme — le résultat est jeté, mais les flags sont mis à jour :

```asm
LDA #$42
CMP #$42      ; $42 - $42 = 0   → Z=1, C=1
CMP #$41      ; $42 - $41 = 1   → Z=0, C=1 (A > valeur)
CMP #$43      ; $42 - $43 = -1  → Z=0, C=0 (A < valeur)
```

**La règle CMP à retenir** :
- Résultat = 0  → Z=1 → utilise `BEQ` / `BNE`
- A < valeur   → C=0 → utilise `BCC` (*Branch if Carry Clear*)
- A >= valeur  → C=1 → utilise `BCS` (*Branch if Carry Set*)

Les branchements disponibles :
```asm
BEQ LABEL   ; si Z=1  (égal, ou résultat = 0)
BNE LABEL   ; si Z=0  (différent, ou résultat ≠ 0)
BCC LABEL   ; si C=0  (inférieur après CMP)
BCS LABEL   ; si C=1  (supérieur ou égal après CMP)
BMI LABEL   ; si N=1  (résultat négatif, bit 7 = 1)
BPL LABEL   ; si N=0  (résultat positif ou nul)
```

**Construire un if/else** :
```asm
; if (A == 7) { ... } else { ... }
  CMP #7
  BNE ELSE
  ; — code du if —
  JMP SUITE
ELSE:
  ; — code du else —
SUITE:
```

**Boucle for — la forme idiomatique** :
```asm
; for (X = 8; X > 0; X--)
  LDX #8
BOUCLE:
  ; corps de la boucle
  DEX
  BNE BOUCLE   ; DEX positionne Z → BNE si X ≠ 0
```

Cette forme est omniprésente. `DEX` + `BNE` = 2 instructions = 5 cycles. Mémorise-la.

**Astuce : 256 itérations avec DEX** :
```asm
; Remplir 256 octets depuis $4000
  LDA #$77    ; jaune nibble-packed
  LDX #0
FILL:
  STA $4000,X
  DEX         ; 0 → $FF → $FE → ... → 1 → 0
  BNE FILL    ; boucle 256 fois
```

**Attention** : les branchements ne peuvent atteindre que ±127 octets depuis l'instruction suivante. Pour les sauts longs, utilise `JMP`.

> ✏️ **Exercice 2.4a — Le if/else** — Écris un programme qui stocke une valeur en `$10`, puis affiche `'G'` si cette valeur est >= 50, et `'P'` sinon (G pour Grand, P pour Petit). Change la valeur entre 0 et 100 pour vérifier que les deux branches fonctionnent.

> ✏️ **Exercice 2.4b — La boucle** — Écris une boucle qui calcule la somme de 1 à 10 et la stocke en `$20`. Utilise `LDX #10` et `TXA : CLC : ADC $20 : STA $20 : DEX : BNE`. Vérifie que `$20` contient 55 (`$37`) à la fin.


## 2.5 Les modes d'adressage

C'est ici que le 6502 révèle sa richesse. La même instruction `LDA` peut accéder à la mémoire de huit façons différentes — chacune avec ses cas d'usage.

```asm
; Immédiat — la valeur est dans l'instruction
LDA #$42         ; A ← 42

; Zero Page — accès rapide (3 cycles, 2 octets)
LDA $10          ; A ← mem[$0010]

; Zero Page indexée
LDA $10,X        ; A ← mem[$0010 + X]
LDA $10,Y        ; A ← mem[$0010 + Y]

; Absolu (4 cycles, 3 octets)
LDA $1000        ; A ← mem[$1000]

; Absolu indexée
LDA $4000,X      ; A ← mem[$4000 + X]
LDA $4000,Y      ; A ← mem[$4000 + Y]

; Indirect (uniquement pour JMP)
JMP ($FFFC)      ; PC ← mem[$FFFC] (lit le vecteur)

; (Indirect,X) — pré-indexé
LDA ($10,X)      ; lit le vecteur à mem[$10+X], accède à l'adresse trouvée

; (Indirect),Y — post-indexé ← le plus puissant
LDA ($F0),Y      ; lit le vecteur 16-bit à $F0/$F1, accède à (adresse + Y)
STA ($F0),Y
```

**Le mode `($zp),Y` est le plus puissant du 6502.** Il te permet d'accéder à n'importe quelle adresse via un pointeur stocké en Zero Page. C'est l'équivalent d'un pointeur C.

```asm
; Exemple : écrire dans le framebuffer via un pointeur
; PTR = $F0/$F1 (deux octets en ZP = un pointeur 16-bit)

  LDA #$00 : STA $F0   ; PTR lo = $00
  LDA #$40 : STA $F1   ; PTR hi = $40  →  PTR = $4000

  LDY #0
  LDA #$77             ; jaune nibble-packed
  STA ($F0),Y          ; mem[$4000 + 0] ← $77
  INY
  STA ($F0),Y          ; mem[$4000 + 1] ← $77
```

Pense à `($F0),Y` comme `*(ptr + Y) = valeur` en C. C'est exactement ça.

> **Anecdote** — Le mode `($zp),Y` a permis à des programmeurs comme Jordan Mechner (auteur de Prince of Persia sur Apple II) d'écrire des routines d'affichage impossibles sur d'autres chips de l'époque. En changeant simplement le pointeur en ZP, la même routine peut écrire n'importe où dans les 64 Ko.

> ✏️ **Exercice 2.5** — Utilise le mode indexé `STA $10,X` pour remplir un tableau de 5 octets aux adresses `$10` à `$14` avec les valeurs 10, 20, 30, 40, 50. Puis relis-les avec `LDA $10,X` dans une deuxième boucle et stocke leur somme en `$20`.


## 2.6 La logique bit à bit

Les opérations logiques sont omniprésentes en assembleur. Apprends-les par cœur.

```asm
AND #$0F     ; A = A ET $0F   — garde seulement les bits 0-3
ORA #$80     ; A = A OU $80   — allume le bit 7
EOR #$FF     ; A = A XOR $FF  — inverse tous les bits
```

**AND — masquer** :
```asm
LDA $D306          ; lit le registre aléatoire
AND #$0F           ; force dans 0-15 (garde les 4 bits bas)
AND #$7F           ; force dans 0-127 (garde les 7 bits bas)
```

**ORA — fusionner** :
```asm
LDA $D000          ; lit VPU_CTRL
ORA #$01           ; allume le bit 0 (mode graphique) sans toucher les autres
STA $D000
```

**EOR — inverser** :
```asm
; La manette NES : bit=0 si bouton enfoncé
; Pour avoir bit=1 si enfoncé :
LDA $D210          ; PAD1_STATE
EOR #$FF           ; inverse tout — maintenant 1=enfoncé
AND #%00000001     ; teste le bouton Haut
BEQ PAS_HAUT
```

**Décalages — multiplier ou diviser par 2** :
```asm
ASL   ; Arithmetic Shift Left  — A × 2  (C = ancien bit 7)
LSR   ; Logical Shift Right    — A ÷ 2  (C = ancien bit 0)
```

`ASL` est crucial pour calculer des adresses écran. La ligne Y du framebuffer est à `$4000 + Y × 64`. Pour calculer Y × 64 :
```asm
LDA POS_Y
ASL   ; × 2
ASL   ; × 4
ASL   ; × 8
ASL   ; × 16
ASL   ; × 32
ASL   ; × 64
```

Six `ASL` enchaînés. 6 cycles. Pas de multiplication. Pas de division. C'est du binaire pur.

> ✏️ **Exercice 2.6** — Le générateur aléatoire du Chuck-8 est à l'adresse `$D306` (lecture seule). Écris une boucle qui :
> 1. Lit `$D306` pour obtenir un octet aléatoire
> 2. Applique `AND #$0F` pour le forcer dans 0–15
> 3. Si le résultat est 0, recommence (pour éviter le noir)
> 4. Stocke le résultat en `$10`
> 5. Recommence la boucle 8 fois en stockant en `$10`, `$11`, ..., `$17`
> Tu dois obtenir 8 couleurs aléatoires différentes (entre 1 et 15) en mémoire.


## 2.7 La pile et les sous-routines

La pile (stack) est une zone de 256 octets à `$0100–$01FF`. Elle fonctionne en LIFO — *Last In, First Out*. Le premier entré est le dernier sorti.

```asm
PHA   ; pousse A sur la pile (SP--)
PLA   ; dépile dans A (SP++)
PHP   ; pousse les flags P
PLP   ; dépile les flags P
```

**Règle absolue : chaque PHA doit avoir son PLA correspondant.** La pile déséquilibrée est l'erreur la plus classique du débutant en assembleur. Le CPU ne le détecte pas — il va juste sauter au mauvais endroit au prochain RTS.

**JSR / RTS — appeler une sous-routine** :
```asm
  JSR DESSINER_POINT   ; pousse PC+2 sur la pile, saute à DESSINER_POINT
  ; on revient ici après RTS

DESSINER_POINT:
  ; A=couleur, X=px, Y=py
  JSR SYS_DRAW_PIXEL   ; $F003
  RTS                  ; dépile PC+2, continue
```

`JSR` et `RTS` utilisent la pile automatiquement. C'est pourquoi tu ne peux jamais faire plus de PHA que de PLA dans une sous-routine — ça déséquilibrerait la pile et `RTS` sauterait à la mauvaise adresse.

```asm
; MAUVAIS — la pile se déséquilibre
MA_ROUTINE:
  PHA        ; pousse A
  ; oublie PLA !
  RTS        ; dépile... la valeur de A, pas l'adresse → CRASH

; BON
MA_ROUTINE:
  PHA        ; sauvegarde A
  ; ...
  PLA        ; restaure A
  RTS        ; dépile correctement l'adresse de retour
```

> ✏️ **Exercice 2.7** — Écris une sous-routine `DOUBLE` qui double la valeur dans A (A = A × 2) avec `ASL` et retourne le résultat dans A. Appelle-la 3 fois de suite depuis le programme principal sur la valeur 1. Tu dois obtenir 8. Vérifie en observant A dans le panneau Registres.
> ```asm
>   .org $E000
>   LDA #1
>   JSR DOUBLE   ; A = 2
>   JSR DOUBLE   ; A = 4
>   JSR DOUBLE   ; A = 8
>   STA $10
>   BRK
>
> DOUBLE:
>   ASL          ; A × 2
>   RTS
> ```

---

## ✏️ Atelier chapitre 2 — "CALCULATRICE 8-BIT"

Tu maîtrises maintenant les registres, l'arithmétique et les branchements. Construis une mini-calculatrice.

**Objectif :** écrire un programme qui effectue les 4 opérations sur deux nombres stockés en `$10` et `$11`, et stocke les résultats en mémoire :
- Addition (`$10` + `$11`) → résultat en `$20`
- Soustraction (`$10` - `$11`) → résultat en `$21`
- Multiplication par 2 de `$10` → résultat en `$22` (utilise ASL)
- Division par 2 de `$10` → résultat en `$23` (utilise LSR)

**Puis affiche les résultats** en mode texte avec `SYS_PRINT_NUM` (`$F024`, A=valeur à afficher) et `SYS_SET_CURSOR` (`$F02A`, X=col, Y=ligne).

**Teste avec** `$10 = 40` et `$11 = 10`. Résultats attendus : 50, 30, 80, 20.

**Défi bonus :** Gère le cas où la soustraction donne un résultat négatif (si `$10` < `$11`). Dans ce cas, affiche `'?'` à la place du résultat.

---

# CHAPITRE 3 — LE SYSTÈME

## 3.1 La vidéo — deux modes, une réalité

Le VPU (Video Processing Unit) du Chuck-8 supporte deux modes qu'on peut alterner à tout moment.

### Mode texte

32 colonnes × 32 lignes = 1024 caractères. Chaque char fait 4×4 pixels → 128×128 au total.

Deux zones mémoire :
- **Texte** `$4800–$4BFF` : un octet par case = code ASCII du caractère
- **Attributs** `$4C00–$4FFF` : un octet par case = `bits 7-4 = couleur fond`, `bits 3-0 = couleur texte`

Calculer l'adresse d'une case `(col, ligne)` :
```
adresse_texte    = $4800 + ligne × 32 + col
adresse_attribut = $4C00 + ligne × 32 + col
```

La façon la plus simple d'écrire du texte : `VPU_CHAR_OUT` (`$D00F`).

```asm
; Positionner le curseur et écrire
  LDA #5 : STA $D00B    ; VPU_CURSOR_X = colonne 5
  LDA #3 : STA $D00C    ; VPU_CURSOR_Y = ligne 3

; Définir les couleurs avant d'écrire
  LDA #$76              ; ink=7(jaune) sur paper=6(bleu)
  JSR SYS_SET_COLOR     ; $F030

; Écrire — le curseur avance automatiquement
  LDA #'H' : STA $D00F
  LDA #'e' : STA $D00F
  LDA #'l' : STA $D00F
  LDA #'l' : STA $D00F
  LDA #'o' : STA $D00F
```

### Mode graphique

128×128 pixels, 16 couleurs. Framebuffer à `$4000–$5FFF` (8192 octets).

**Nibble-packing** : deux pixels par octet. Le nibble haut (bits 7-4) = pixel gauche (coord paire). Le nibble bas (bits 3-0) = pixel droit (coord impaire).

```
Octet à l'adresse $4000 :
┌─────────────┬─────────────┐
│ bits 7-4    │ bits 3-0    │
│ pixel (0,0) │ pixel (1,0) │
└─────────────┴─────────────┘
```

Calculer l'adresse d'un pixel `(px, py)` :
```
adresse = $4000 + py × 64 + px ÷ 2
```

Pourquoi 64 ? Parce que 128 pixels par ligne, 2 pixels par octet = 64 octets par ligne.

Via l'API (recommandé) :
```asm
SYS_DRAW_PIXEL = $F003
; A=couleur, X=px (0-127), Y=py (0-127)

  LDA #7    ; jaune
  LDX #64   ; px = 64 (centre)
  LDY #32   ; py = 32
  JSR SYS_DRAW_PIXEL
```

### Basculer entre les modes

```asm
SYS_SET_MODE = $F01B
; A=0 → mode texte   A=1 → mode graphique

  LDA #1 : JSR SYS_SET_MODE   ; passe en gfx
  ; ... dessine ...
  LDA #0 : JSR SYS_SET_MODE   ; passe en texte
  ; ... écrit du texte ...
  LDA #1 : JSR SYS_SET_MODE   ; retour en gfx
```

Le contenu de la VRAM est **préservé** lors du switch. Tu peux afficher du texte par-dessus un fond graphique.

> ✏️ **Exercice 3.1** — Affiche les 16 couleurs en mode graphique sous forme d'une grille 4×4. Chaque case fait 30×30 pixels. Couleur 0 en haut à gauche, couleur 15 en bas à droite. Utilise `SYS_FILL_RECT` (`$F00C`, A=couleur, `$80`=x, `$81`=y, `$82`=w, `$83`=h) et deux boucles imbriquées (une pour les colonnes, une pour les lignes).


## 3.2 La palette — 16 couleurs fixes

Les 16 couleurs du Chuck-8 sont fixes. Pas de palette custom — c'est une contrainte volontaire, comme les 16 couleurs fixes du Commodore 64. Apprendre à faire du beau avec 16 couleurs : c'est un art à part entière.

```
  0  Noir        #000000      8  Orange       #CC8800
  1  Blanc       #FFFFFF      9  Brun         #884400
  2  Rouge       #CC0000     10  Rose         #FF8888
  3  Cyan        #00CCCC     11  Gris foncé   #444444
  4  Violet      #CC00CC     12  Gris moyen   #888888
  5  Vert        #00CC00     13  Vert clair   #88FF88
  6  Bleu        #0000CC     14  Bleu clair   #8888FF
  7  Jaune       #CCCC00     15  Gris clair   #CCCCCC
```

> **Anecdote** — Les couleurs du Commodore 64 n'ont pas été choisies au hasard. Elles correspondent aux limites physiques du chip vidéo (VIC-II) et du signal composite NTSC de l'époque. Les bleus et verts étaient plus brillants parce que le phosphore du tube cathodique les rendait mieux. Sur le Chuck-8, on garde cet esprit.


## 3.3 L'API vidéo complète

Toutes les routines d'affichage sont dans la ROM à partir de `$F000` :

```asm
SYS_CLEAR       = $F000  ; A=couleur → efface tout l'écran
SYS_DRAW_PIXEL  = $F003  ; A=couleur, X=px, Y=py → dessine 1 pixel
SYS_DRAW_LINE   = $F006  ; A=couleur, $80/$81=x0/y0, $82/$83=x1/y1
SYS_DRAW_RECT   = $F009  ; A=couleur, $80=x $81=y $82=w $83=h (contour)
SYS_FILL_RECT   = $F00C  ; A=couleur, mêmes params (rempli)
SYS_SET_MODE    = $F01B  ; A=0(texte) A=1(gfx)
SYS_PRINT_CHAR  = $F01E  ; A=char ASCII → affiche au curseur
SYS_PRINT_STR   = $F021  ; $80/$81=adresse chaîne null-terminated
SYS_PRINT_NUM   = $F024  ; A=entier 8-bit → décimal au curseur
SYS_PRINT_HEX   = $F027  ; A=valeur → "$XX" au curseur
SYS_SET_CURSOR  = $F02A  ; X=colonne, Y=ligne
SYS_SET_COLOR   = $F030  ; A=(ink<<4)|paper
SYS_RAND        = $F05A  ; → A=octet aléatoire
SYS_FRAME_NUM   = $F069  ; → A=lo, X=hi (compteur frames)
```

**Paramètres larges via la zone $80–$83** :

```asm
; Dessiner un rectangle rouge rempli (10, 20) 40×30
  LDA #10 : STA $80   ; x
  LDA #20 : STA $81   ; y
  LDA #40 : STA $82   ; w
  LDA #30 : STA $83   ; h
  LDA #2              ; rouge
  JSR SYS_FILL_RECT
```

**Afficher une chaîne** :
```asm
MSG: .byte "Score : ", 0    ; null-terminated

  LDA #<MSG : STA $80       ; adresse lo
  LDA #>MSG : STA $81       ; adresse hi
  JSR SYS_PRINT_STR         ; affiche jusqu'au 0
```

> ✏️ **Exercice 3.3** — Dessine le drapeau français en mode graphique. L'écran fait 128×128 pixels. Le drapeau a 3 bandes verticales égales (42 px de large chacune) : bleu (couleur 6), blanc (couleur 1), rouge (couleur 2). Utilise `SYS_FILL_RECT` avec `$82=42` et `$83=128` pour chaque bande.


## 3.4 Le son

Le SPU (Sound Processing Unit) a 3 voix indépendantes. Chaque voix est contrôlée par 8 registres.

**Voix 0 : `$D100–$D107`** (voix 1 à `$D108`, voix 2 à `$D110`) :

| Registre | Nom | Description |
|----------|-----|-------------|
| `$D100` | FREQ_LO | Fréquence lo — période = 1 000 000 ÷ (valeur+1) |
| `$D101` | FREQ_HI | Fréquence hi |
| `$D102` | VOL | Volume (bits 7-4 = gauche, bits 3-0 = droite) |
| `$D103` | ATTACK | Durée d'attaque en frames |
| `$D104` | DECAY | Durée de decay |
| `$D105` | SUSTAIN | Niveau de sustain (0-15) |
| `$D106` | RELEASE | Durée de release en frames |
| `$D107` | CTRL | bit7=gate (1=note on), bits 3-0=forme d'onde |

Via l'API (plus simple) :
```asm
SYS_PLAY_NOTE = $F036
; A=note MIDI (21-108), X=voix (0-2), $80=durée en frames

  LDA #69     ; La4 = MIDI 69 = 440 Hz
  LDX #0      ; voix 0
  LDA #60 : STA $80    ; durée = 60 frames = 1 seconde
  JSR SYS_PLAY_NOTE

  JSR SYS_STOP_ALL     ; $F03C — coupe toutes les voix
```

> **L'ADSR, c'est quoi ?** Attaque, Decay, Sustain, Release — les quatre phases d'une note. En musique synthétique, une note de piano a une attaque courte (le marteau frappe), un decay rapide, un sustain au niveau 0, et un release selon la pédale. Un orgue a une attaque longue et un sustain constant. Ces paramètres permettent de simuler des instruments. Le SID du Commodore 64 utilisait exactement ces mêmes paramètres — c'était révolutionnaire en 1982.

> ✏️ **Exercice 3.4** — Joue la gamme de Do majeur : Do(60), Ré(62), Mi(64), Fa(65), Sol(67), La(69), Si(71), Do(72). Stocke les notes dans une table `.byte` et parcours-la avec une boucle. Chaque note dure 20 frames.
> ```asm
> GAMME: .byte 60, 62, 64, 65, 67, 69, 71, 72
>
>   LDX #0
> JOUE:
>   LDA GAMME,X
>   ; ... joue la note ...
>   INX
>   CPX #8
>   BNE JOUE
> ```


## 3.5 Les entrées

### Clavier

```asm
KEY_ASCII  = $D200   ; code ASCII de la touche (0 si aucune)
KEY_STATUS = $D201   ; bit7=1 si touche enfoncée ce frame
KEY_MOD    = $D202   ; modificateurs : bit0=Shift bit1=Ctrl bit2=Alt

; Attendre une touche (bloquant)
  JSR SYS_WAIT_KEY   ; $F04E → A = code ASCII

; Lire sans bloquer
  LDA $D201
  AND #$80 : BEQ AUCUNE_TOUCHE
  LDA $D200          ; lit le char ASCII
  LDA #0 : STA $D201 ; acquitte (efface le flag)
AUCUNE_TOUCHE:
```

### Manette

```asm
PAD1_STATE = $D210   ; bits manette 1 (bit=0 si enfoncé)
PAD2_STATE = $D211

PAD_A      = %10000000
PAD_B      = %01000000
PAD_SELECT = %00100000
PAD_START  = %00010000
PAD_RIGHT  = %00001000
PAD_LEFT   = %00000100
PAD_DOWN   = %00000010
PAD_UP     = %00000001
```

La logique inversée est piégeuse au début. Bit = 0 = bouton **enfoncé**. C'est la logique de la NES — un signal tiré à la masse par le bouton physique. Pour obtenir la logique normale (1 = enfoncé) :

```asm
  LDA #0 : JSR SYS_READ_PAD   ; $F048 → A = état pad 1
  EOR #$FF                     ; inverse — maintenant 1=enfoncé
  AND #PAD_RIGHT               ; teste Droite
  BEQ PAS_DROITE               ; 0 = pas enfoncé
  ; ici : bouton Droite enfoncé
PAS_DROITE:
```

**Le `EOR #$FF` après `SYS_READ_PAD` — ne jamais l'oublier.** C'est une des erreurs les plus fréquentes.

### Souris

```asm
MOUSE_X    = $D220   ; position x (0-127 en mode gfx)
MOUSE_Y    = $D221   ; position y (0-127)
MOUSE_BTN  = $D224   ; bit0=gauche bit1=droit (0=enfoncé)

  JSR SYS_READ_MOUSE   ; $F051 → X=mouseX, Y=mouseY, A=boutons
```

> ✏️ **Exercice 3.5** — Dessine un pixel blanc qui se déplace avec la manette (haut/bas/gauche/droite). Le pixel repart de l'autre côté si il sort de l'écran (wrap-around). Structure recommandée :
> ```asm
> POS_X = $10 : POS_Y = $11
>
> INIT:
>   LDA #1 : JSR SYS_SET_MODE
>   LDA #64 : STA POS_X : STA POS_Y
>
> LOOP:
>   ; Effacer ancien pixel (noir)
>   ; Lire manette → déplacer POS_X / POS_Y
>   ; Clamp ou wrap 0-127
>   ; Dessiner nouveau pixel (blanc)
>   JMP LOOP
> ```


## 3.6 Le timer et l'aléatoire

```asm
SYS_FRAME_NUM = $F069  ; → A=lo, X=hi (compteur frames 16-bit)
SYS_RAND      = $F05A  ; → A=octet pseudo-aléatoire

; Animation : clignoter toutes les 16 frames (~0.27s)
  JSR SYS_FRAME_NUM
  AND #$10             ; bit 4 alterne toutes les 16 frames
  BEQ ETEINT
  ; allumé...
ETEINT:

; Position aléatoire dans l'écran
  JSR SYS_RAND
  AND #$7F             ; 0-127
  TAX                  ; → px

  JSR SYS_RAND
  AND #$7F
  TAY                  ; → py
```

> **Le PRNG du Chuck-8** utilise un LFSR (*Linear Feedback Shift Register*) 16-bit. C'est l'algorithme standard des jeux 8-bit : rapide, petit, pas besoin de tables. Le même principe est utilisé dans les implémentations légères modernes — Xorshift, par exemple — pour générer des nombres pseudo-aléatoires sans avoir besoin de Mersenne Twister.


## 3.7 Exemple complet — Pixels aléatoires animés

```asm
; ══════════════════════════════════════════
;  CONSTELLATION — pixels colorés aléatoires
;  Fonctionne en boucle infinie
; ══════════════════════════════════════════

SYS_CLEAR      = $F000
SYS_DRAW_PIXEL = $F003
SYS_RAND       = $F05A

  .org $E000

INIT:
  LDA #$81 : STA $D000    ; mode graphique
  LDA #0 : JSR SYS_CLEAR  ; écran noir

LOOP:
COULEUR:
  JSR SYS_RAND
  AND #$0F
  BEQ COULEUR             ; 0 = noir, recommence

  PHA                     ; sauvegarde couleur

  JSR SYS_RAND
  AND #$7F
  TAX

  JSR SYS_RAND
  AND #$7F
  TAY

  PLA                     ; restaure couleur
  JSR SYS_DRAW_PIXEL

  JMP LOOP
```

---

## ✏️ Atelier chapitre 3 — "BARRE DE VIE ANIMÉE"

Tu sais maintenant afficher des graphiques, lire des entrées et utiliser le timer. Construis une interface de jeu.

**Objectif :** afficher une barre de vie qui se remplit et se vide automatiquement.

**Éléments :**
- Un fond noir en mode graphique
- Le texte "VIE :" en mode texte superposé (colonne 1, ligne 0) en blanc
- Une barre verte (`SYS_FILL_RECT`) qui représente la vie (0 à 100%)
- La vie diminue de 1 point par frame, repart à 100 quand elle atteint 0
- La couleur change selon le niveau : vert (>50%), jaune (25–50%), rouge (<25%)

**Variables Zero Page :**
```asm
VIE = $10   ; 0 à 100
```

**Formule pour la largeur de la barre :**
`largeur = VIE` (si VIE=100 → barre de 100px, VIE=50 → 50px, etc.)

**Bonus :** Ajoute un son d'alarme (note aiguë courte) quand la vie passe sous 25%.

---

# CHAPITRE 4 — LES PATTERNS

## 4.1 La convention d'appel

Quand tu écris plusieurs sous-routines, tu dois décider comment elles se "parlent" — comment elles se passent des paramètres et comment elles retournent des résultats. C'est ce qu'on appelle une *calling convention*.

**La convention Chuck-8 ABI en cinq règles** :

| Règle | Ce qu'elle dit | Pourquoi |
|-------|----------------|----------|
| 1 | A = valeur de retour | L'appelant sait toujours où chercher le résultat |
| 2 | X et Y = libres pour l'appelé | L'appelant doit les sauvegarder lui-même s'il en a besoin |
| 3 | `$80–$EF` = zone paramètres | Pour passer plus de 3 paramètres ou des valeurs larges |
| 4 | `$F0–$FF` = pointeurs temporaires | L'appelé peut les écraser — l'appelant ne doit pas en dépendre |
| 5 | La pile est sacrée | SP identique à l'entrée et à la sortie — chaque PHA a son PLA |

```asm
; Convention à 1 paramètre → via A
  LDA #7               ; couleur = jaune
  JSR EFFACER_ECRAN

; Convention à 3 paramètres → A, X, Y
  LDA #5               ; couleur
  LDX #40              ; x
  LDY #20              ; y
  JSR DRAW_POINT

; Convention avec params larges → Zone $80+
  LDA #$00 : STA $80   ; x
  LDA #$40 : STA $81   ; y
  LDA #$50 : STA $82   ; w
  LDA #$30 : STA $83   ; h
  LDA #2               ; couleur dans A
  JSR DRAW_ZONE_LARGE
```

**Exemple de routine bien écrite** :
```asm
; DRAW_HBAR — dessine une ligne horizontale remplie
; Entrée  : A=couleur, X=x_start, Y=y, $80=longueur
; Retour  : A=couleur (inchangée)
; Modifie : $F0/$F1 (pointeurs temporaires — règle 4)
; Préserve: X, Y (bonne pratique)

DRAW_HBAR:
  STX $10         ; sauvegarde x_start
  STY $11         ; sauvegarde y
  PHA             ; sauvegarde couleur
  ; ... calculs ...
  PLA             ; restaure couleur (= valeur de retour A)
  LDX $10         ; restaure X
  LDY $11         ; restaure Y
  RTS
```

> ✏️ **Exercice 4.1** — Écris une sous-routine `CLAMP` qui force une valeur dans A dans l'intervalle [0, 100] : si A > 100, retourne 100 ; si A ≤ 100, retourne A inchangé. Teste avec les valeurs 50 (→ 50), 150 (→ 100), 0 (→ 0).


## 4.2 Les tables de données

Le 6502 n'a pas de multiplication. Mais il a l'adressage indexé. La solution : calculer les résultats à l'avance et les stocker dans des tables `.byte`.

**Table de couleurs pour une animation** :
```asm
SEQUENCE_COULEURS:
  .byte 2, 7, 5, 3, 7, 2, 0, 0
  .byte 14, 13, 5, 1

  LDX #0
PROCHAIN:
  LDA SEQUENCE_COULEURS,X
  INX : CPX #12 : BNE PROCHAIN
```

**Table de dispatch — switch/case efficace** :
```asm
HANDLERS:
  .word HANDLER_TITRE
  .word HANDLER_JEU
  .word HANDLER_PAUSE

DISPATCHER:
  LDA ETAT_JEU
  ASL              ; × 2
  TAX
  LDA HANDLERS,X   : STA $F0
  LDA HANDLERS+1,X : STA $F1
  JMP ($F0)
```

**Table de sinus pré-calculée** :
```asm
; 32 valeurs : sin(i × 360/32) × 40 + 64
SINUS:
  .byte 64, 72, 80, 87, 93, 98, 101, 103
  .byte 104, 103, 101, 98, 93, 87, 80, 72
  .byte 64, 55, 47, 40, 34, 29, 26, 24
  .byte 23, 24, 26, 29, 34, 40, 47, 55

PHASE = $10

  LDX PHASE
  LDA SINUS,X : TAY    ; py = sin(phase)
  LDA PHASE : CLC : ADC #8 : AND #$1F : TAX
  LDA SINUS,X : TAX    ; px = cos(phase)
```

> **Anecdote** — Les tables de sinus étaient universelles dans les jeux 8-bit et les démos Amiga. Sur les microcontrôleurs embarqués modernes (Arduino, ESP32), on les utilise encore pour les mêmes raisons.

> ✏️ **Exercice 4.2** — Crée une table de 8 positions x/y qui forment un carré (coins + milieux des côtés). Puis dessine ces 8 points sur l'écran avec une boucle, en parcourant la table. Chaque point est un pixel blanc sur fond noir.
> ```asm
> POINTS_X: .byte 20, 64, 108, 108, 108, 64, 20, 20
> POINTS_Y: .byte 20, 20,  20,  64, 108, 108, 108, 64
> ```


## 4.3 La machine à états

Un jeu a plusieurs modes : titre, jeu, pause, game over. Gérer ces transitions proprement, c'est écrire une *machine à états*.

```asm
STATE_TITLE    = 0
STATE_PLAYING  = 1
STATE_PAUSED   = 2
STATE_GAMEOVER = 3

GAME_STATE = $20

  LDA #STATE_TITLE : STA GAME_STATE

UPDATE:
  LDA GAME_STATE
  BEQ DO_TITLE
  CMP #STATE_PLAYING : BEQ DO_PLAYING
  CMP #STATE_PAUSED  : BEQ DO_PAUSED
  JMP DO_GAMEOVER

DO_TITLE:
  LDA #0 : JSR SYS_READ_PAD : EOR #$FF
  AND #PAD_START : BEQ SKIP_T
  LDA #STATE_PLAYING : STA GAME_STATE
SKIP_T:
  RTS

DO_PLAYING:
  ; ... si vies = 0 : LDA #STATE_GAMEOVER : STA GAME_STATE
  RTS
```

> ✏️ **Exercice 4.3** — Prends la structure ci-dessus et implémente les 4 états visuellement :
> - **TITLE** : affiche "PRESS START" en texte, attend Start
> - **PLAYING** : affiche un pixel qui bouge tout seul, attend Start pour pauser
> - **PAUSED** : affiche "PAUSE" par-dessus, attend Start pour reprendre
> - **GAMEOVER** : affiche "GAME OVER", attend Start pour revenir au titre


## 4.4 Physique : vélocité et gravité

La physique 8-bit utilise des entiers 8-bit signés (complément à deux).

**Complément à deux** : en 8 bits, `$FF` = -1, `$FE` = -2, `$80` = -128, `$7F` = +127.

```asm
POS_X  = $10 : POS_Y  = $11
VEL_X  = $12 : VEL_Y  = $13

  LDA #64 : STA POS_X : STA POS_Y
  LDA #2  : STA VEL_X    ; +2 px/frame
  LDA #1  : STA VEL_Y    ; +1 px/frame

; Chaque frame
  LDA POS_X : CLC : ADC VEL_X : STA POS_X
  LDA POS_Y : CLC : ADC VEL_Y : STA POS_Y

; Rebond gauche/droite
  LDA POS_X : BEQ REBOND_G
  CMP #126 : BCC PAS_REBOND_D
REBOND_G:
  LDA #0 : SEC : SBC VEL_X : STA VEL_X
PAS_REBOND_D:

; Gravité
  LDA VEL_Y : CLC : ADC #1 : STA VEL_Y

; Sol
  LDA POS_Y : CMP #110 : BCC PAS_SOL
  LDA #110 : STA POS_Y
  LDA #$FC : STA VEL_Y   ; rebond amorti
PAS_SOL:
```

> ✏️ **Exercice 4.4** — Implémente une balle qui rebondit sur les 4 bords de l'écran sans gravité. La balle part du centre (64, 64) avec VEL_X=2 et VEL_Y=1. Elle doit rebondir proprement sur les bords gauche (x=0), droit (x=127), haut (y=0) et bas (y=127). Dessine la balle comme un pixel blanc, efface l'ancienne position avant de dessiner la nouvelle.


## 4.5 Optimisation 6502 — chaque cycle compte

Sur 16 667 cycles disponibles par frame (à 60 Hz), chaque cycle gaspillé est une opportunité manquée.

**Règle 1 — Zero Page d'abord**
```asm
LDA $1000   ; 4 cycles, 3 octets
LDA $10     ; 3 cycles, 2 octets ← préférable
```

**Règle 2 — DEX/BNE pour les boucles**
```asm
; Lent : 9 cycles/tour
  INX : CPX #64 : BNE BOUCLE
; Rapide : 5 cycles/tour
  DEX : BNE BOUCLE
```

**Règle 3 — LDA positionne Z automatiquement**
```asm
; Inutile
  LDA COMPTEUR : CMP #0 : BEQ ZERO
; Correct
  LDA COMPTEUR : BEQ ZERO
```

**Règle 4 — Inliner les routines critiques**

`JSR` + `RTS` = 12 cycles d'overhead. Une routine dans une boucle de 100 itérations = 1 200 cycles perdus.

**Règle 5 — ASL/LSR pour ×2 et ÷2**
```asm
; Multiplier par 5 : × 4 + × 1
  ASL : STA $10 : ASL : CLC : ADC $10
```

> **Perspective moderne** — Ces optimisations t'apprennent à penser en coût. Un développeur qui a programé en assembleur comprend instinctivement pourquoi le cache L1 est 100× plus rapide que la RAM, pourquoi le *branch prediction* du CPU moderne est si important. Le 6502 te force à penser à ce niveau.

> ✏️ **Exercice 4.5** — Mesure l'optimisation. Écris deux versions d'une boucle qui compte de 64 à 0 :
> - **Version A** : `LDX #0 : INX : CPX #64 : BNE boucle` (compte de 0 à 64)
> - **Version B** : `LDX #64 : DEX : BNE boucle` (compte de 64 à 0)
> Dans chaque boucle, fais `STA $0200,X` pour écrire en mémoire. Regarde le compteur de cycles dans le panneau Registres. Quelle version est la plus rapide ?

---

## ✏️ Atelier chapitre 4 — "MINI-JEU : ATTRAPE L'ÉTOILE"

Tu maîtrises les sous-routines, les tables, les états et la physique. Construis un mini-jeu complet.

**Règles :** Une étoile (pixel jaune) apparaît à un endroit aléatoire. Le joueur contrôle un carré (3×3 px blanc) avec la manette. Quand le carré touche l'étoile, le score augmente et une nouvelle étoile apparaît.

**Architecture recommandée :**

```asm
; Variables ZP
PLAYER_X = $10 : PLAYER_Y = $11   ; position joueur
STAR_X   = $12 : STAR_Y   = $13   ; position étoile
SCORE    = $14                     ; score

; États : PLAYING seulement pour simplifier

INIT:
  ; mode gfx, écran noir, joueur au centre, étoile aléatoire

MAIN_LOOP:
  JSR CLEAR_SPRITES    ; efface joueur et étoile
  JSR READ_INPUT       ; déplace joueur avec manette
  JSR CHECK_COLLISION  ; si collision → score++ et nouvelle étoile
  JSR DRAW_SPRITES     ; dessine joueur et étoile
  JSR DRAW_SCORE       ; affiche score en mode texte
  JMP MAIN_LOOP
```

**Collision simple :** si `|PLAYER_X - STAR_X| < 5` ET `|PLAYER_Y - STAR_Y| < 5`, c'est une collision. Pour calculer la valeur absolue d'une différence en 6502 :
```asm
  LDA PLAYER_X : SEC : SBC STAR_X
  BPL POSITIF       ; si résultat >= 0, déjà positif
  EOR #$FF : ADC #1 ; sinon, complément à 2 (= valeur absolue)
POSITIF:
  CMP #5 : BCS PAS_COLLISION
```

---

# CHAPITRE 5 — LES PROJETS

## 5.1 Projet : pluie d'étoiles

Un programme simple mais graphiquement satisfaisant. Des étoiles descendent depuis le haut de l'écran à des vitesses différentes, et repartent en haut quand elles sortent par le bas.

```asm
; ══════════════════════════════════════════
;  PLUIE D'ÉTOILES
;  4 étoiles qui descendent à des vitesses différentes
;
;  Variables (Zero Page) :
;  $10-$13 : positions x des étoiles
;  $14-$17 : positions y
;  $18-$1B : vitesses (1 à 4 pixels/frame)
; ══════════════════════════════════════════

SYS_DRAW_PIXEL = $F003
SYS_RAND       = $F05A

  .org $E000

INIT:
  LDA #$81 : STA $D000

  LDA #$00 : STA $80 : LDA #$40 : STA $81
  LDA #$00 : STA $82 : LDA #$20 : STA $83
  LDA #$66 : JSR $F063    ; fond bleu nuit

  JSR SYS_RAND : AND #$7F : STA $10
  JSR SYS_RAND : AND #$7F : STA $11
  JSR SYS_RAND : AND #$7F : STA $12
  JSR SYS_RAND : AND #$7F : STA $13

  LDA #0  : STA $14 : LDA #30 : STA $15
  LDA #60 : STA $16 : LDA #90 : STA $17

  LDA #1 : STA $18 : LDA #2 : STA $19
  LDA #2 : STA $1A : LDA #3 : STA $1B

LOOP:
  LDX #3
ETOILE:
  STX $20

  LDA $10,X : STA $21
  LDA $14,X : STA $22
  LDA $18,X : STA $23

  LDA $21 : TAX : LDA $22 : TAY
  LDA #6 : JSR SYS_DRAW_PIXEL    ; efface (bleu)

  LDX $20
  LDA $14,X : CLC : ADC $23 : STA $14,X

  CMP #128 : BCC DESSINE
  LDA #0 : STA $14,X
  JSR SYS_RAND : AND #$7F : STA $10,X

DESSINE:
  LDA $10,X : TAX : LDA $14,X : TAY
  LDA #1 : JSR SYS_DRAW_PIXEL    ; dessine (blanc)

  LDX $20 : DEX
  BPL ETOILE

  JMP LOOP
```

Le bug "X sert à deux choses" (index de boucle ET coordonnée) est endémique en 6502. La solution : `STX $20` sauvegarde l'index avant de l'utiliser comme coordonnée.


## 5.2 Projet : Pong

Pong (1972) était le premier jeu commercial à succès. Deux raquettes, une balle, pas de score limite. Sur le Chuck-8, il tient en moins de 200 lignes. C'est le projet parfait pour tout appliquer.

```asm
; ══════════════════════════════════════════
;  PONG — Chuck-8
;  Joueur 1 : manette (haut/bas)
;  Joueur 2 : IA simple (suit la balle)
; ══════════════════════════════════════════

SYS_CLEAR      = $F000
SYS_FILL_RECT  = $F00C
SYS_READ_PAD   = $F048
SYS_PLAY_NOTE  = $F036
SYS_SET_MODE   = $F01B
SYS_SET_CURSOR = $F02A
SYS_SET_COLOR  = $F030
SYS_PRINT_NUM  = $F024

PAD_UP   = %00000001
PAD_DOWN = %00000010

BALL_X  = $10 : BALL_Y  = $11
BALL_DX = $12 : BALL_DY = $13
PAD1_Y  = $14 : PAD2_Y  = $15
SCORE1  = $16 : SCORE2  = $17

  .org $E000

  LDA #1 : JSR SYS_SET_MODE
  LDA #0 : JSR SYS_CLEAR
  LDA #64 : STA BALL_X : STA BALL_Y
  LDA #$01 : STA BALL_DX : STA BALL_DY
  LDA #56 : STA PAD1_Y : STA PAD2_Y
  LDA #0 : STA SCORE1 : STA SCORE2

MAIN:
  LDA #0 : JSR SYS_CLEAR

  LDA BALL_X : CLC : ADC BALL_DX : STA BALL_X
  LDA BALL_Y : CLC : ADC BALL_DY : STA BALL_Y

  LDA BALL_Y : BNE CHECK_BAS
  LDA #0 : SEC : SBC BALL_DY : STA BALL_DY
  JMP CHECK_PAD1
CHECK_BAS:
  CMP #127 : BNE CHECK_PAD1
  LDA #0 : SEC : SBC BALL_DY : STA BALL_DY

CHECK_PAD1:
  LDA BALL_X : CMP #5 : BCC SCORE_J2
  CMP #9 : BCS CHECK_PAD2
  LDA BALL_Y : CMP PAD1_Y : BCC CHECK_PAD2
  LDA PAD1_Y : CLC : ADC #16 : CMP BALL_Y : BCC CHECK_PAD2
  LDA #$01 : STA BALL_DX
  LDA #69 : LDX #0 : LDA #5 : STA $80 : JSR SYS_PLAY_NOTE
  JMP CHECK_PAD2

SCORE_J2:
  INC SCORE2
  LDA #64 : STA BALL_X : STA BALL_Y
  LDA #$01 : STA BALL_DX
  JMP MOVE_PADS

CHECK_PAD2:
  LDA BALL_X : CMP #119 : BCC CHECK_SCORE_J1
  CMP #123 : BCS CHECK_SCORE_J1
  LDA BALL_Y : CMP PAD2_Y : BCC CHECK_SCORE_J1
  LDA PAD2_Y : CLC : ADC #16 : CMP BALL_Y : BCC CHECK_SCORE_J1
  LDA #$FF : STA BALL_DX
  LDA #69 : LDX #0 : LDA #5 : STA $80 : JSR SYS_PLAY_NOTE
  JMP MOVE_PADS

CHECK_SCORE_J1:
  LDA BALL_X : CMP #123 : BCC MOVE_PADS
  INC SCORE1
  LDA #64 : STA BALL_X : STA BALL_Y
  LDA #$FF : STA BALL_DX

MOVE_PADS:
  LDA #0 : JSR SYS_READ_PAD : EOR #$FF : PHA
  AND #PAD_UP : BEQ NO_UP
  LDA PAD1_Y : BEQ NO_UP : DEC PAD1_Y
NO_UP:
  PLA : AND #PAD_DOWN : BEQ NO_DOWN
  LDA PAD1_Y : CMP #112 : BCS NO_DOWN : INC PAD1_Y
NO_DOWN:

  LDA PAD2_Y : CLC : ADC #8 : CMP BALL_Y : BEQ DRAW
  BCS IA_UP
  LDA PAD2_Y : CMP #112 : BCS DRAW : INC PAD2_Y : JMP DRAW
IA_UP:
  LDA PAD2_Y : BEQ DRAW : DEC PAD2_Y

DRAW:
  LDA #5  : STA $80 : LDA PAD1_Y : STA $81 : LDA #4 : STA $82 : LDA #16 : STA $83 : LDA #1 : JSR SYS_FILL_RECT
  LDA #119 : STA $80 : LDA PAD2_Y : STA $81 : LDA #4 : STA $82 : LDA #16 : STA $83 : LDA #1 : JSR SYS_FILL_RECT
  LDA BALL_X : STA $80 : LDA BALL_Y : STA $81 : LDA #3 : STA $82 : STA $83 : LDA #7 : JSR SYS_FILL_RECT

  LDA #0 : JSR SYS_SET_MODE
  LDA #$10 : JSR SYS_SET_COLOR
  LDA #13 : TAX : LDA #0 : TAY : JSR SYS_SET_CURSOR : LDA SCORE1 : JSR SYS_PRINT_NUM
  LDA #16 : TAX : LDA #0 : TAY : JSR SYS_SET_CURSOR : LDA SCORE2 : JSR SYS_PRINT_NUM
  LDA #1 : JSR SYS_SET_MODE

  LDA SCORE1 : CMP #9 : BEQ FIN
  LDA SCORE2 : CMP #9 : BNE MAIN

FIN:
  LDA #0 : JSR SYS_SET_MODE
  LDA #$10 : JSR SYS_SET_COLOR
  LDA #10 : TAX : LDA #14 : TAY : JSR SYS_SET_CURSOR
  LDA #'G' : STA $D00F : LDA #'A' : STA $D00F : LDA #'M' : STA $D00F
  LDA #'E' : STA $D00F : LDA #' ' : STA $D00F : LDA #'O' : STA $D00F
  LDA #'V' : STA $D00F : LDA #'E' : STA $D00F : LDA #'R' : STA $D00F
  BRK
```

Ce programme contient presque tout ce que tu as appris : Zero Page, sous-routines, flags, arithmétique signée, I/O, son.

---

## ✏️ Atelier chapitre 5 — Modifie Pong

Tu as le code complet de Pong. Voici deux défis pour le modifier :

**Défi A — Accélération :** La balle commence lentement et accélère après chaque échange de raquette. Ajoute une variable `VITESSE` en ZP, initialisée à 1. Après chaque rebond sur une raquette, incrémente `VITESSE` jusqu'à un maximum de 3. Utilise `VITESSE` pour déplacer la balle de plusieurs pixels par frame.

**Défi B — Deux joueurs :** Remplace l'IA (joueur 2) par un vrai deuxième joueur contrôlé par les touches du clavier. `W` = haut, `S` = bas pour le joueur 2. Lis le clavier avec `LDA $D200` (KEY_ASCII) et compare avec `'W'` (= $57) et `'S'` (= $73).


## 5.3 Ce que tu as vraiment appris

Tu as programmé sur une machine à 1 MHz avec 64 Ko de RAM. Voici ce que ça implique pour toi en 2026.

**La mémoire n'est pas magique.** Chaque variable a une adresse. Chaque adresse contient un octet. Quand tu déclares `let x = 42` en JavaScript, quelque chose d'exactement similaire se passe dans V8 — juste avec beaucoup plus de couches au-dessus. Tu sais maintenant ce qu'il y a en dessous.

**Le CPU exécute des instructions une par une.** Ton code JavaScript ne s'exécute pas "en parallèle" — il y a un fil d'exécution principal qui exécute une instruction à la fois. Le 6502 t'a forcé à y penser en permanence. Ce model mental t'aidera à déboguer des race conditions et à comprendre l'event loop de Node.js.

**Les registres sont précieux.** Le 6502 n'a que A, X, Y. Le x86_64 en a 16. ARM en a 32. Mais la contrainte est la même : les registres sont rares, et une bonne gestion des registres fait la différence entre un code performant et un code lent. Les compilateurs C/C++ passent énormément de temps à optimiser l'allocation des registres — tu sais maintenant pourquoi.

**Les abstractions ont un coût.** `JSR` + `RTS` = 12 cycles. Une boucle Python = des millions de cycles. Ce n'est pas un jugement de valeur — les abstractions sont utiles — mais savoir leur coût te rend meilleur pour choisir quand les utiliser.

**La contrainte libère la créativité.** Les meilleurs jeux du Commodore 64 et de la NES ont été faits avec 64 Ko et 1 MHz. Quand tu n'as pas de bibliothèque pour tout faire, tu dois comprendre ton problème profondément pour trouver une solution élégante. Ce réflexe — aller au fond du problème — est ce qui distingue un bon développeur d'un utilisateur de frameworks.

---

## ANNEXE — Référence rapide

### Instructions fréquentes

| Instruction | Action | Flags |
|-------------|--------|-------|
| `LDA #val` | A ← val | N, Z |
| `STA addr` | mem[addr] ← A | — |
| `LDX / LDY` | X/Y ← val | N, Z |
| `STX / STY` | mem ← X/Y | — |
| `TAX / TXA` | transferts A↔X | N, Z |
| `PHA / PLA` | pile ← A / A ← pile | (PLA: N, Z) |
| `CLC : ADC` | A = A + val + 0 | N, V, Z, C |
| `SEC : SBC` | A = A - val - 0 | N, V, Z, C |
| `INX / DEX` | X ± 1 | N, Z |
| `INC / DEC` | mem ± 1 | N, Z |
| `CMP #val` | flags selon A - val | N, Z, C |
| `BEQ / BNE` | si Z=1 / Z=0 | — |
| `BCC / BCS` | si C=0 / C=1 | — |
| `BMI / BPL` | si N=1 / N=0 | — |
| `JSR addr` | appel sous-routine | — |
| `RTS` | retour sous-routine | — |
| `JMP addr` | saut | — |
| `AND / ORA / EOR` | logique bit à bit | N, Z |
| `ASL / LSR` | décalage × 2 / ÷ 2 | N, Z, C |
| `BRK` | arrêt | B |
| `NOP` | ne fait rien (2 cycles) | — |

### Adresses clés Chuck-8

```
$0010–$007F  Variables libres (Zero Page)
$0080–$00EF  Zone paramètres ABI
$00F0–$00FF  Pointeurs temporaires ($F0/$F1, $F2/$F3...)
$4000–$5FFF  Framebuffer A (mode graphique)
$4800–$4BFF  Mémoire texte (mode texte)
$4C00–$4FFF  Attributs couleur texte
$D000        VPU_CTRL (bit7=enable, bit0=mode)
$D00B/$D00C  VPU_CURSOR_X / VPU_CURSOR_Y
$D00F        VPU_CHAR_OUT (écriture = affiche un char)
$D200        KEY_ASCII
$D201        KEY_STATUS (bit7=touche présente)
$D210        PAD1_STATE (bit=0 si enfoncé)
$D220/$D221  MOUSE_X / MOUSE_Y
$D306        SYS_RAND (lecture = nouvel octet aléatoire)
$E000        Point d'entrée programme (.org $E000)
$F000        SYS_CLEAR
$F003        SYS_DRAW_PIXEL
$F009        SYS_DRAW_RECT
$F00C        SYS_FILL_RECT
$F01B        SYS_SET_MODE
$F01E        SYS_PRINT_CHAR
$F021        SYS_PRINT_STR
$F024        SYS_PRINT_NUM
$F027        SYS_PRINT_HEX
$F02A        SYS_SET_CURSOR
$F030        SYS_SET_COLOR
$F036        SYS_PLAY_NOTE
$F048        SYS_READ_PAD
$F05A        SYS_RAND
$F069        SYS_FRAME_NUM
$FFFC/$FFFD  Vecteur RESET → $E000
```

### La palette

```
0  Noir    #000  │  4  Violet  #C0C  │   8  Orange  #C80  │  12  Gris moy  #888
1  Blanc   #FFF  │  5  Vert    #0C0  │   9  Brun    #840  │  13  Vert cl   #8F8
2  Rouge   #C00  │  6  Bleu    #00C  │  10  Rose    #F88  │  14  Bleu cl   #88F
3  Cyan    #0CC  │  7  Jaune   #CC0  │  11  Gris foncé #444  │  15  Gris cl #CCC
```

---

*Chuck-8 Manuel de Programmation — v3.0*
*Inspiré de Rodnay Zaks, Programming the 6502 (1978)*
*"The best programs are those that emerge from constraints." — Jeff Minter*