# Formation Chuck-8 : Programmer en assembleur 6502

*Pour ceux qui savent coder, mais n'ont jamais touché au hardware.*

---

## Avant de commencer : pourquoi apprendre ça ?

En 2024, écrire de l'assembleur 6502 n'a aucun intérêt pratique immédiat. Personne ne vous demandera de livrer un projet en assembleur 6502 lors d'un entretien. Alors pourquoi s'y mettre ?

Parce que ça change fondamentalement comment vous pensez à votre code.

Quand vous écrivez `let x = 5` en JavaScript, il se passe des dizaines de choses invisibles : allocation mémoire, gestion de types, garbage collector, compilation JIT... En assembleur, il ne se passe qu'une seule chose. Vous voyez exactement ce que la machine fait, octet par octet, cycle par cycle.

Les développeurs qui ont ce bagage comprennent pourquoi un `cache miss` coûte cher, pourquoi certaines boucles sont plus rapides que d'autres, pourquoi les alignements mémoire ont de l'importance. Ce n'est pas de la nostalgie — c'est de la mécanique fondamentale.

Et puis, honnêtement ? C'est aussi un peu magique de faire apparaître un pixel à l'écran avec trois lignes de code qu'on a écrites soi-même, sans framework, sans runtime, sans rien entre soi et la machine.

---

## Chapitre 0 — La machine

### 0.1 Le Chuck-8, c'est quoi ?

Le Chuck-8 est un ordinateur imaginaire, conçu spécifiquement pour apprendre. Il ressemble à ce que vous auriez pu acheter dans un magasin entre 1978 et 1984 — un Apple II, un Commodore 64, un Atari 800. Même philosophie, même type de CPU, même façon d'adresser la mémoire.

Ce qui le rend idéal pour apprendre, c'est qu'il est **documenté jusqu'au dernier bit**. Il ne change pas. Il ne cache rien. Vous pouvez comprendre l'intégralité de la machine — ce n'est pas le cas de votre MacBook ou de votre PC.

Voici ce qu'il contient :

| Composant | Spécification |
|-----------|--------------|
| CPU | MOS 6502 (1 MHz) |
| RAM | 64 Ko (65 536 octets) |
| ROM système | 4 Ko ($F000–$FFFF) |
| Vidéo (VPU) | 128×128 pixels, 16 couleurs, 2 modes |
| Son (SPU) | 3 voix synthétisées + 1 canal sample |
| Clavier | ASCII complet |
| Manette | 2 × 8 boutons (compatible NES) |
| Souris | X/Y + 3 boutons + molette |


Un seul mégahertz. 65.536 octets de RAM. À titre de comparaison, une image JPEG ordinaire pèse plus lourd que toute la mémoire de cette machine.

Et pourtant, des milliers de jeux ont été écrits sur des machines comparables. Pac-Man. Space Invaders. Pitfall. Tout ça sur moins de mémoire que ce qu'occupe cet onglet dans votre navigateur.

### 0.2 L'architecture en un coup d'œil

Voici comment les composants sont reliés :

```
┌─────────────────────────────────────────────────────────────┐
│              BUS DONNÉES 8-bit / BUS ADRESSES 16-bit        │
│                                                             │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────────┐     │
│  │  6502    │   │  64 Ko   │   │  Registres I/O       │     │
│  │  CPU     │   │  RAM     │   │  $D000–$D3FF         │     │
│  │  1 MHz   │   │          │   │  (VPU, SPU, Input)   │     │
│  └──────────┘   └──────────┘   └──────────────────────┘     │
│                                                             │
│  ┌──────────────────────┐   ┌──────────────────────────┐    │
│  │  VPU – Vidéo         │   │  SPU – Son               │    │
│  │  $4000–$7FFF         │   │  3 voix + sample PCM     │    │
│  │  Framebuffers A et B │   │                          │    │
│  └──────────────────────┘   └──────────────────────────┘    │
│                                                             │
│  ┌──────────────────────┐   ┌──────────────────────────┐    │
│  │  ROM Cartouche       │   │  ROM Système             │    │
│  │  $8000–$BFFF         │   │  $F000–$FFFF             │    │
│  └──────────────────────┘   └──────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Le bus**, c'est le câblage qui relie tout. Il y en a deux :
- Le **bus d'adresses** (16 bits) : le CPU dit *où* il veut lire ou écrire.
- Le **bus de données** (8 bits) : la valeur qui transite (toujours un octet à la fois).

C'est la contrainte fondamentale de cette architecture : on ne déplace jamais plus d'un octet à la fois. Pas de `int`, pas de `float`, pas de `string`. Des octets. Toujours des octets.

[note]
**Pont avec le moderne :** En Python, `x = 42` crée un objet entier qui contient bien plus qu'un simple nombre — des métadonnées, un compteur de références, un type... Sur le 6502, `42` c'est l'octet `$2A`. Rien de plus.
[/note]

### 0.3 La mémoire vue d'avion

Le 6502 peut adresser 65 536 emplacements mémoire (de `$0000` à `$FFFF`). Chaque emplacement contient exactement un octet. Certaines zones sont de la RAM, d'autres de la ROM, d'autres des registres matériels déguisés en mémoire.

Cette technique s'appelle le **memory-mapped I/O** : pour parler à la carte vidéo, vous n'utilisez pas une instruction spéciale — vous écrivez simplement à une adresse précise. La machine sait que cette adresse n'est pas de la RAM ordinaire, mais un registre du VPU.

```
$0000–$00FF  ← Zero Page (vos variables les plus rapides, on y reviendra)
$0100–$01FF  ← La pile (stack)
$0200–$03FF  ← RAM programme (variables globales)
$0400–$3FFF  ← RAM libre (votre terrain de jeu)
$4000–$7FFF  ← VRAM (pixels, texte, sprites)
$8000–$BFFF  ← ROM Cartouche (votre programme peut aller là)
$D000–$DFFF  ← Registres I/O (VPU, SPU, clavier, manette...)
$E000–$EFFF  ← RAM haute (point d'entrée : $E000)
$F000–$FFFF  ← ROM Système (API, charset, vecteurs)
```

[note]
**Ce qu'il faut retenir maintenant :** Votre programme démarre toujours à `$E000`. C'est là que le CPU va chercher la première instruction au démarrage.
[/note]

---

## Chapitre 1 — Le CPU : le cœur de la machine

### 1.1 Les registres : les seules « variables » du CPU

En JavaScript ou Python, vous pouvez créer autant de variables que vous voulez. En assembleur 6502, vous n'avez que **cinq registres** dans lesquels vous pouvez réellement calculer quelque chose.

Un registre, c'est un emplacement de stockage *à l'intérieur même du CPU*. C'est l'endroit le plus rapide qui existe sur la machine — pas besoin de passer par le bus pour y accéder.

| Registre | Taille | Rôle |
|----------|--------|------|
| **A** (Accumulateur) | 8 bits | Le seul registre où vous pouvez faire des calculs (additions, soustractions, opérations logiques). Indispensable. |
| **X** | 8 bits | Index : sert à parcourir des tableaux, compter des boucles. |
| **Y** | 8 bits | Index : même usage que X, mais certaines instructions n'acceptent qu'un des deux. |
| **PC** (Program Counter) | 16 bits | L'adresse de la prochaine instruction à exécuter. Vous ne le modifiez pas directement (sauf avec des sauts). |
| **SP** (Stack Pointer) | 8 bits | Pointe vers le sommet de la pile. Géré automatiquement par `JSR`/`RTS`/`PHA`/`PLA`. |
| **P** (Processor Status) | 8 bits | 7 drapeaux qui reflètent l'état du dernier calcul. |

**Le grand enseignement :** Avec seulement A, X et Y pour calculer, vous jonglerez constamment entre mémoire et registres. C'est là que 90% de la complexité de l'assembleur réside — pas dans les instructions elles-mêmes, mais dans la *logistique* des données.

[note]
**Comment regarder les registres dans Chuck-IDE :** Le panneau "Registres" affiche en permanence la valeur de A, X, Y, PC, SP et P. Observez A à chaque instruction : vous verrez exactement ce qui transite par l'accumulateur.
[/note]

### 1.2 Le registre P : les drapeaux

Le registre P (Processor Status) est un octet particulier : chaque bit est un **drapeau** (flag) qui s'allume ou s'éteint automatiquement après certaines opérations. Vous ne l'écrivez pas directement (sauf cas avancés), vous le *lisez* indirectement via les instructions de saut conditionnel.

```
Bit :  7   6   5   4   3   2   1   0
       N   V   1   B   D   I   Z   C
       │   │   │   │   │   │   │   │
       │   │   │   │   │   │   │   └── C : Carry (retenue)
       │   │   │   │   │   │   └────── Z : Zero (résultat = 0)
       │   │   │   │   │   └────────── I : Interrupt Disable
       │   │   │   │   └────────────── D : Decimal (BCD, rarement utilisé)
       │   │   │   └────────────────── B : Break (instruction BRK)
       │   │   └────────────────────── - : Toujours à 1 (bit constant)
       │   └────────────────────────── V : oVerflow (dépassement signé)
       └────────────────────────────── N : Negative (résultat < 0)
```

Les deux drapeaux que vous utiliserez le plus souvent :

**Z (Zero)** : passe à 1 si le résultat de la dernière opération est zéro. Utilisé par `BEQ` (Branch if Equal) et `BNE` (Branch if Not Equal).

**C (Carry)** : la retenue. Passe à 1 si une addition dépasse 255, ou si une soustraction passe sous 0. Utilisé par `BCC` et `BCS`. *Attention : vous devez le préparer manuellement avant toute addition ou soustraction.*

**N (Negative)** : passe à 1 si le bit 7 du résultat est à 1 (convention complément à deux). Utilisé par `BMI` (Branch if Minus) et `BPL` (Branch if Plus).

[note]
**Comment regarder P dans Chuck-IDE :** Le panneau affiche P sous forme de flags individuels. Après chaque `LDA`, `CMP` ou `ADC`, observez Z et N changer.
[/note]

### 1.3 Les modes d'adressage : comment on dit au CPU où trouver les données

C'est l'un des concepts les plus déroutants pour un développeur moderne. En Python, `x` est un nom. En assembleur, une adresse est un *numéro*. Mais comment on spécifie ce numéro ? C'est là qu'interviennent les modes d'adressage.

Prenons l'instruction `LDA` (Load Accumulator — charger l'accumulateur). Elle peut s'utiliser de plusieurs façons :

```asm
LDA #42        ; Immédiat : A ← 42 (la valeur 42 elle-même, pas une adresse)
LDA $10        ; Zero Page : A ← mémoire[$10]
LDA $0200      ; Absolu : A ← mémoire[$0200]
LDA $0200,X    ; Absolu indexé : A ← mémoire[$0200 + X]
LDA $10,X      ; Zero Page indexé : A ← mémoire[$10 + X]
```

Le `#` devant une valeur signifie *"cette valeur directement"*. Sans `#`, c'est une adresse.

[note] 
**Analogie Python :**
- `LDA #42` → c'est comme `a = 42`
- `LDA $10` → c'est comme `a = memoire[0x10]` (lire ce qui est stocké à l'adresse $10)
- `LDA $0200,X` → c'est comme `a = memoire[0x0200 + x]` (accès indexé dans un tableau)
[/note]

Les modes d'adressage les plus utiles, avec leur taille en mémoire :

| Mode | Syntaxe | Exemple | Ce qui se passe |
|------|---------|---------|-----------------|
| Implicite | — | `CLC` | Pas d'opérande (l'instruction suffit) |
| Immédiat | `#val` | `LDA #$42` | A ← la valeur $42 |
| Zero Page | `$zz` | `LDA $10` | A ← mem[$10] |
| Zero Page,X | `$zz,X` | `LDA $10,X` | A ← mem[$10 + X] |
| Absolu | `$xxxx` | `LDA $1234` | A ← mem[$1234] |
| Absolu,X | `$xxxx,X` | `LDA $1234,X` | A ← mem[$1234 + X] |
| Absolu,Y | `$xxxx,Y` | `LDA $1234,Y` | A ← mem[$1234 + Y] |
| Relatif | `label` | `BEQ LOOP` | Saut de -128 à +127 octets |
| (Indirect),Y | `($zz),Y` | `LDA ($10),Y` | Pointeur en Zero Page + offset Y |

**La Zero Page est spéciale.** Les adresses $00–$FF forment la "page zéro". Les instructions qui accèdent à la Zero Page ne nécessitent qu'un octet d'adresse (au lieu de deux pour les adresses complètes) — elles sont donc plus courtes et plus rapides. C'est votre zone de variables "premium".

[note]
**Pont avec le moderne :** Le mode `(Indirect),Y` est l'équivalent d'un pointeur en C : `*(ptr + y)`. Vous stockez une adresse 16 bits en Zero Page, puis vous lisez à cette adresse + un offset. Utile pour parcourir des tableaux dont l'adresse n'est connue qu'à l'exécution.

[/note]

### 1.4 Timing : tout se compte en cycles

Le CPU du Chuck-8 tourne à **1 MHz** : un million de cycles par seconde. Chaque instruction prend entre 2 et 7 cycles. À 60 images par seconde (mode NTSC), vous disposez d'environ **16 667 cycles par frame** pour tout faire : lire les entrées, mettre à jour la logique, dessiner.

Ce n'est pas un exercice académique. Sur les vraies machines de l'époque, les développeurs comptaient les cycles dans leurs routines critiques pour garantir que l'écran serait prêt à temps.

| Instruction | Cycles typiques |
|-------------|-----------------|
| `NOP`, `CLC`, `SEC`... | 2 cycles |
| `LDA #val` (immédiat) | 2 cycles |
| `LDA $zz` (Zero Page) | 3 cycles |
| `LDA $xxxx` (absolu) | 4 cycles |
| `JSR` (appel de routine) | 6 cycles |
| `RTI` (retour d'interruption) | 6 cycles |

[note]

**Comment voir les cycles dans Chuck-IDE :** Le compteur de cycles s'affiche dans le panneau de debug. Vous pouvez mesurer combien de cycles prend votre boucle principale.
[/note]

---

## Chapitre 2 — Les premières instructions

Avant d'écrire un programme complet, comprenons les briques de base. Nous allons travailler sur cinq familles d'instructions : charger, stocker, calculer, comparer, sauter.

### 2.1 Charger et stocker : LDA, STA, LDX, STX, LDY, STY

Ce sont les instructions les plus fréquentes de tout programme 6502. Elles déplacent des données entre les registres et la mémoire.

```asm
LDA #$42    ; Load A : A ← $42 (la valeur 66 en décimal)
STA $0200   ; Store A : mémoire[$0200] ← A

LDX #10     ; Load X : X ← 10
STX $0201   ; Store X : mémoire[$0201] ← X

LDY #0      ; Load Y : Y ← 0
STY $0202   ; Store Y : mémoire[$0202] ← Y
```

[note]

**À surveiller dans le débogueur :** Après `LDA #$42`, regardez le registre A — il vaut $42. Regardez aussi le flag Z : il passe à 0 (car $42 ≠ 0). Si vous faites `LDA #0`, Z passe à 1.
[/note]

**Les transferts entre registres :**

```asm
TAX   ; Transfer A to X : X ← A
TAY   ; Transfer A to Y : Y ← A
TXA   ; Transfer X to A : A ← X
TYA   ; Transfer Y to A : A ← Y
```

Pourquoi ces instructions ? Parce que vous ne pouvez pas faire `LDX $10,Y` (Zero Page indexé par Y pour charger X). Certaines combinaisons de registres/modes n'existent pas. Les transferts compensent ça.

### 2.2 L'addition et la soustraction : ADC, SBC

**La règle d'or à ne jamais oublier :**

```asm
; Addition : TOUJOURS CLC avant ADC
CLC        ; Clear Carry : effacer la retenue
ADC #5     ; A ← A + 5 + Carry(=0)

; Soustraction : TOUJOURS SEC avant SBC
SEC        ; Set Carry : activer la retenue
SBC #3     ; A ← A - 3 - (1 - Carry) = A - 3
```

Pourquoi cette contrainte bizarre ? Parce que le 6502 n'a pas d'instruction "ajouter sans retenue". L'ADC (Add with Carry) ajoute *toujours* le flag C au résultat. Si vous oubliez le `CLC`, et que C vaut 1 suite à une opération précédente, vous obtiendrez `A + 5 + 1 = A + 6`. Débogage garanti.

Cette conception a une raison : elle permet facilement de faire des additions sur plusieurs octets (16 bits, 24 bits...). La retenue "cascade" automatiquement d'un octet à l'autre.

[note]

**Pont avec le moderne :** En C, `a + b` ne se soucie pas d'un flag carry externe. En assembleur, l'addition est toujours une opération 9 bits (8 bits de résultat + 1 bit de retenue). C'est déstabilisant au début, mais très puissant pour l'arithmétique multi-octets.
[/note]

```asm
; Exemple : A = 10, on veut A + 7
LDA #10     ; A ← 10
CLC         ; C ← 0  (indispensable !)
ADC #7      ; A ← 10 + 7 + 0 = 17

; Exemple : A = 20, on veut A - 5
LDA #20     ; A ← 20
SEC         ; C ← 1  (indispensable !)
SBC #5      ; A ← 20 - 5 - (1-1) = 15
```

### 2.3 Les opérations logiques : AND, ORA, EOR

Ces instructions travaillent bit à bit, comme en Python (`&`, `|`, `^`).

```asm
; AND : met à 0 les bits non masqués
LDA #%11001010   ; A = 11001010 ($CA)
AND #%00001111   ; A = 00001010  (on garde seulement les 4 bits bas: $0A)

; ORA : force certains bits à 1
LDA #%11000000   ; A = 11000000 ($C0)
ORA #%00000001   ; A = 11000001  (on allume le bit 0: $C1)

; EOR : inverse certains bits (XOR)
LDA #%10101010   ; A = 10101010 ($AA)
EOR #%11111111   ; A = 01010101  (on inverse tout: $55)
```

Ces opérations sont essentielles pour manipuler les registres matériels. Par exemple, pour activer un bit sans toucher aux autres :

```asm
LDA $D000     ; Lire VPU_CTRL
ORA #%00000010  ; Allumer le bit 1 (flip_request)
STA $D000     ; Réécrire
```

Et pour désactiver un bit :

```asm
LDA $D000     ; Lire VPU_CTRL
AND #%11111101  ; Éteindre le bit 1 (masque inverse)
STA $D000     ; Réécrire
```

[note]

**Comment lire un masque binaire :** Le `%` devant un nombre indique la notation binaire en ca65. `%00000010` = 2 = bit 1 activé. Toujours écrire les masques en binaire dans vos programmes — c'est beaucoup plus lisible que l'hexadécimal quand on travaille bit à bit.
[/note]

### 2.4 Les décalages : ASL et LSR

`ASL` (Arithmetic Shift Left) décale tous les bits d'une position vers la gauche. Le bit sortant va dans C, un 0 entre à droite. Effet : **multiplication par 2**.

`LSR` (Logical Shift Right) fait l'inverse. Effet : **division par 2 (entière)**.

```asm
LDA #5      ; A = 00000101 (5)
ASL A       ; A = 00001010 (10) ← fois 2
ASL A       ; A = 00010100 (20) ← fois 4
LSR A       ; A = 00001010 (10) ← divisé par 2
```

Pourquoi utiliser ASL plutôt que ADC ? Parce qu'un décalage prend 2 cycles, alors qu'une multiplication complète (qu'il faudrait implémenter soi-même) en prend des dizaines. Sur un CPU à 1 MHz, c'est significatif.

```asm
; Calculer Y * 32 (pour trouver l'adresse d'une ligne de texte)
TYA         ; A ← Y (Y = numéro de ligne)
ASL A       ; A = Y * 2
ASL A       ; A = Y * 4
ASL A       ; A = Y * 8
ASL A       ; A = Y * 16
ASL A       ; A = Y * 32
```

### 2.5 Comparer : CMP, CPX, CPY

`CMP` compare A avec une valeur **sans modifier A**. Elle modifie seulement les flags N, Z et C :

- Si A = valeur : Z = 1, C = 1
- Si A > valeur : Z = 0, C = 1
- Si A < valeur : Z = 0, C = 0

```asm
LDA #10
CMP #10     ; A = 10, valeur = 10 → Z=1, C=1
CMP #5      ; A = 10, valeur = 5  → Z=0, C=1 (10 > 5)
CMP #20     ; A = 10, valeur = 20 → Z=0, C=0 (10 < 20)
```

[note]

**À surveiller dans le débogueur :** Placez un breakpoint juste après un `CMP`. Regardez les flags Z, C et N avant de regarder le branchement conditionnel qui suit. Vous comprendrez exactement pourquoi le programme prend telle ou telle direction.
[/note]

### 2.6 Les sauts conditionnels : BEQ, BNE, BCC, BCS, BMI, BPL

Ce sont les `if` de l'assembleur. Ils testent un flag et sautent à un label si la condition est vraie.

| Instruction | Condition | Usage typique |
|-------------|-----------|---------------|
| `BEQ label` | Z = 1 (résultat zéro / valeurs égales) | `if a == b` |
| `BNE label` | Z = 0 (résultat non nul / valeurs différentes) | `if a != b` |
| `BCC label` | C = 0 (pas de retenue / inférieur) | `if a < b` (non signé) |
| `BCS label` | C = 1 (retenue / supérieur ou égal) | `if a >= b` (non signé) |
| `BMI label` | N = 1 (résultat négatif) | `if a < 0` (signé) |
| `BPL label` | N = 0 (résultat positif ou nul) | `if a >= 0` (signé) |

**Attention :** les branches ne peuvent sauter qu'à **±127 octets** de l'instruction. Pour les sauts plus longs, on utilise `JMP`.

```asm
; Équivalent de : if (x == 10) { ... }
LDA X_VAR     ; A ← x
CMP #10       ; Comparer A avec 10
BNE PAS_EGAL  ; Si Z=0 (A ≠ 10), sauter
; ... code si x == 10 ...
PAS_EGAL:
```

```asm
; Équivalent de : while (x < 32) { x++; }
    LDX #0
BOUCLE:
    ; ... corps de la boucle ...
    INX           ; X = X + 1
    CPX #32       ; Comparer X à 32
    BNE BOUCLE    ; Si X ≠ 32, recommencer
```

### 2.7 Appeler une routine : JSR et RTS

`JSR` (Jump to SubRoutine) appelle une fonction. `RTS` (Return from Subroutine) en revient. C'est exactement comme un appel de fonction — sauf que vous gérez vous-même la convention d'appel.

```asm
; Appel d'une routine
JSR MA_ROUTINE    ; Pousse PC+2 sur la pile, saute à MA_ROUTINE

; ... suite du code après le retour ...

MA_ROUTINE:
    ; ... code de la routine ...
    RTS           ; Dépile l'adresse de retour, retourne
```

Comment passer des paramètres ? Il n'y a pas de convention unique imposée — vous pouvez utiliser A, X, Y, ou des adresses Zero Page convenues à l'avance. Dans le Chuck-8, les routines système utilisent les adresses `$80`–`$8F` pour les paramètres supplémentaires.

**La pile (Stack)** : Quand `JSR` est exécuté, il pousse l'adresse de retour sur la pile à `$0100`–`$01FF`. Le Stack Pointer (SP) pointe vers l'emplacement libre suivant, et *descend* (de $FF vers $00). Si vous faites trop d'appels imbriqués sans `RTS`, vous débordez la pile — Stack Overflow, comme le site, mais en vrai.

[note]

**Comment suivre les appels dans Chuck-IDE :** Regardez SP diminuer à chaque `JSR` et remonter à chaque `RTS`. La pile est visible dans la zone mémoire $0100–$01FF.
[/note]

### 2.8 La pile pour sauvegarder : PHA, PLA

Vous pouvez aussi utiliser la pile pour sauvegarder temporairement des valeurs :

```asm
PHA    ; Push A : empile A (SP décroit, mémoire[SP] ← A)
; ... A est maintenant libre pour autre chose ...
PLA    ; Pull A : dépile (A ← mémoire[SP], SP incrémente)
```

**Règle absolue :** chaque `PHA` doit avoir un `PLA` correspondant, dans le bon ordre (LIFO — Last In, First Out). Oublier un `PLA` avant un `RTS`, c'est retourner à la mauvaise adresse.

---

## Chapitre 3 — Écrire son premier programme

Maintenant que vous connaissez les briques de base, construisons quelque chose. Un programme Chuck-8 a toujours la même structure :

```asm
; ── 1. Déclarations des constantes ─────────────────────────────
; (adresses des routines système et des registres matériels)

; ── 2. Variables en RAM ─────────────────────────────────────────
.org $0200          ; Placer les variables à partir de $0200

; ── 3. Code principal ───────────────────────────────────────────
.org $E000          ; Le programme commence TOUJOURS à $E000

RESET:              ; Point d'entrée (le CPU démarre ici)
    ; ... initialisation ...

BOUCLE_PRINCIPALE:
    ; ... logique du jeu ...
    JMP BOUCLE_PRINCIPALE  ; Boucler indéfiniment

; ── 4. Vecteurs d'interruption ──────────────────────────────────
.org $FFFC
.word RESET         ; Dire au CPU que $E000 est le point de départ
```

### 3.1 Programme 1 : Afficher un 'H'

**Objectif :** Comprendre le mode texte et comment écrire à l'écran.

En mode texte, l'écran est une grille de 32×32 caractères. Chaque case est définie par :
- Un octet de **caractère** en `$4800 + ligne*32 + colonne`
- Un octet de **couleur** en `$4C00 + ligne*32 + colonne` (bits 7-4 = fond, bits 3-0 = texte)

```asm
; ═══════════════════════════════════════════════════════
; Premier programme : afficher 'H' en position (0,0)
; ═══════════════════════════════════════════════════════

; Adresse de la routine qui choisit le mode vidéo
SYS_SET_MODE = $F01B

; Début du code à $E000
.org $E000

RESET:
    ; ── Étape 1 : Passer en mode texte ──
    LDA #0              ; 0 = mode texte (1 = mode graphique)
    JSR SYS_SET_MODE    ; Appeler la routine système

    ; ── Étape 2 : Écrire le caractère 'H' en position (0,0) ──
    LDA #$48            ; $48 = code ASCII de 'H'
    STA $4800           ; Écrire à la case (colonne 0, ligne 0)
                        ; $4800 + 0*32 + 0 = $4800

    ; ── Étape 3 : Définir la couleur ──
    ; Octet couleur : bits 7-4 = PAPER (fond), bits 3-0 = INK (texte)
    ; On veut : fond noir (0), texte blanc (1) → %00000001
    LDA #%00000001
    STA $4C00           ; Attribut couleur pour la case (0,0)

    ; ── Boucle infinie : ne rien faire d'autre ──
    JMP *               ; * = adresse courante → boucle sur place

; Vecteur RESET : dire au CPU où commencer
.org $FFFC
.word RESET
```

**Décortiquons chaque ligne :**

`SYS_SET_MODE = $F01B` : Ce n'est pas du code — c'est une **déclaration de constante** pour l'assembleur. On donne le nom `SYS_SET_MODE` à l'adresse `$F01B`. C'est l'adresse dans la ROM où se trouve la routine qui configure le mode vidéo. Sans cette ligne, on devrait écrire `JSR $F01B` — fonctionnel, mais illisible.

`LDA #0` puis `JSR SYS_SET_MODE` : Convention de cette API — on met le numéro de mode dans A avant d'appeler. Pas de paramètres sur la pile, pas de parenthèses, juste un registre convenus à l'avance.

`LDA #$48` : Le code ASCII de 'H' est 72 en décimal, soit $48 en hexadécimal. L'écran du Chuck-8 en mode texte affiche directement les caractères ASCII.

`STA $4800` : La zone mémoire texte commence à $4800. La case (colonne c, ligne l) est à l'adresse `$4800 + l*32 + c`. Pour (0, 0) : `$4800 + 0 + 0 = $4800`.

`LDA #%00000001` : On construit l'octet couleur en binaire pour voir clairement les deux nibbles. Bits 7-4 = couleur de fond (PAPER) = 0 (noir). Bits 3-0 = couleur du texte (INK) = 1 (blanc).

`JMP *` : `*` désigne l'adresse courante en ca65. C'est une boucle infinie — le programme tourne en place indéfiniment, ce qui est parfaitement normal (les programmes embarqués ne s'arrêtent pas).

`.org $FFFC` puis `.word RESET` : Les deux derniers octets du CPU 6502 ($FFFC–$FFFD) contiennent l'adresse du point de départ. On y place l'adresse de notre label `RESET`. Sans ça, la machine ne saurait pas où commencer.

[note]

**👁️ Ce qu'on observe dans le débogueur :**
- Au démarrage : PC = $E000 (point d'entrée)
- Après `LDA #0` : A = $00, Z = 1
- Après `JSR SYS_SET_MODE` : PC saute à $F01B, SP diminue de 2 (adresse de retour empilée)
- Après le retour : PC = $E004 (instruction suivante), SP revient
- Après `LDA #$48` : A = $48, Z = 0
- Après `STA $4800` : La mémoire à $4800 contient $48 — et 'H' apparaît à l'écran
[/note]

---

### 📝 Exercice 1

**A. Afficher "HI" sur la première ligne**

Modifiez le programme pour afficher 'H' en colonne 0 et 'I' en colonne 1.

Indice : la case (colonne 1, ligne 0) est à l'adresse `$4801`. Pour y écrire 'I' (code ASCII $49) :
```asm
LDA #$49
STA $4801
```

N'oubliez pas d'écrire aussi l'attribut couleur pour $4C01.

**B. Changer la couleur**

Affichez 'H' avec un fond bleu (couleur 6) et du texte jaune (couleur 7).

L'octet couleur sera `%01110110` : bits 7-4 = 7 (jaune, fond), bits 3-0 = 6 (bleu, texte).

*Attendez... si 7 = jaune et 6 = bleu, et que bits 7-4 = PAPER (fond) et bits 3-0 = INK (texte), alors un fond jaune + texte bleu donnerait `%01110110`. Mais ce que l'œil attend c'est fond bleu + texte jaune, soit `%01100111`. Prenez le temps de vérifier l'effet dans Chuck-IDE.*

**C. (Bonus) Remplir la ligne 0 avec des 'A'**

Utilisez une boucle avec le registre X pour remplir les 32 cases de la première ligne avec le caractère 'A' ($41) en blanc sur noir.

```asm
LDX #0
BOUCLE:
    LDA #$41
    STA $4800,X   ; Écrire à $4800 + X
    LDA #%00000001
    STA $4C00,X   ; Attribut à $4C00 + X
    INX
    CPX #32
    BNE BOUCLE
```

Essayez de comprendre chaque ligne avant de la taper.

---

### 3.2 Programme 2 : Une routine d'affichage réutilisable

Le programme précédent était monolithique. En vrai, on factorise les comportements répétitifs en routines. Voici comment écrire un caractère à n'importe quelle position (ligne, colonne) :

```asm
; ═══════════════════════════════════════════════════════
; PRINT_CHAR : affiche un caractère à une position donnée
;
; Entrée :
;   A = caractère à afficher (code ASCII)
;   X = colonne (0–31)
;   Y = ligne (0–31)
;
; Registres modifiés : A, X, Y (non sauvegardés)
; ═══════════════════════════════════════════════════════

SYS_SET_MODE = $F01B

.org $E000

RESET:
    LDA #0
    JSR SYS_SET_MODE

    ; Afficher 'H' en (colonne=0, ligne=0)
    LDA #'H'     ; ca65 accepte les littéraux de caractères
    LDX #0
    LDY #0
    JSR PRINT_CHAR

    ; Afficher 'I' en (colonne=1, ligne=0)
    LDA #'I'
    LDX #1
    LDY #0
    JSR PRINT_CHAR

    ; Afficher '!' en (colonne=5, ligne=2)
    LDA #'!'
    LDX #5
    LDY #2
    JSR PRINT_CHAR

    JMP *

; ── Routine PRINT_CHAR ──────────────────────────────────
PRINT_CHAR:
    ; Sauvegarder le caractère (A va être utilisé pour le calcul)
    PHA

    ; Calculer l'offset = ligne * 32 + colonne
    ; On a : Y = ligne, X = colonne
    TYA             ; A ← Y (ligne)
    ASL A           ; A = ligne * 2
    ASL A           ; A = ligne * 4
    ASL A           ; A = ligne * 8
    ASL A           ; A = ligne * 16
    ASL A           ; A = ligne * 32
    STA $10         ; Sauvegarder en Zero Page $10
    TXA             ; A ← X (colonne)
    CLC
    ADC $10         ; A = ligne*32 + colonne = offset
    TAY             ; Y ← offset (on va utiliser l'adressage absolu,Y)

    ; Écrire le caractère
    PLA             ; Récupérer le caractère (PLA restaure A depuis la pile)
    STA $4800,Y     ; mémoire[$4800 + offset] ← caractère

    ; Écrire l'attribut couleur (blanc sur noir)
    LDA #%00000001  ; INK=1 (blanc), PAPER=0 (noir)
    STA $4C00,Y     ; mémoire[$4C00 + offset] ← couleur

    RTS

.org $FFFC
.word RESET
```

**Pourquoi `PHA` et `PLA` ?**

Le calcul de l'offset utilise A pour les décalages. Mais A contient aussi le caractère qu'on veut afficher. Si on fait le calcul *avant* de sauvegarder le caractère, on le perd.

La solution : `PHA` (Push A) empile le caractère *avant* le calcul. Après le calcul, `PLA` (Pull A) le restaure depuis la pile. La pile fonctionne en LIFO — le dernier empilé est le premier dépilé.

**Pourquoi 5 × `ASL A` pour multiplier par 32 ?**

$32 = 2^5$. Un `ASL A` multiplie par 2. Cinq `ASL A` multiplient par $2^5 = 32$. C'est la façon classique de multiplier par une puissance de 2 sur un CPU sans instruction de multiplication.

[note]

**👁️ Ce qu'on observe dans le débogueur :**
- Lors du `JSR PRINT_CHAR`, regardez SP diminuer de 2 (adresse de retour)
- Lors du `PHA`, SP diminue encore de 1 (le caractère)
- Lors du `PLA`, SP remonte de 1
- Lors du `RTS`, SP remonte de 2
- Vérifiez la mémoire à $0010 après `STA $10` : vous verrez l'offset calculé
[/note]

---

### 📝 Exercice 2

**A. Afficher un mot complet**

Écrivez un programme qui affiche "CHUCK" en ligne 2, à partir de la colonne 5, en utilisant cinq appels à `PRINT_CHAR`.

**B. Écrire PRINT_STR (chaîne null-terminée)**

Créez une routine `PRINT_STR` qui affiche une chaîne complète. La chaîne se termine par un octet `$00` (null terminator — comme en C).

Paramètres d'entrée (à convenir) :
- `$80` / `$81` : adresse 16 bits de la chaîne (octet bas, octet haut)
- X = colonne de départ
- Y = ligne

Structure de la routine :

```asm
PRINT_STR:
    ; $80/$81 contient l'adresse de la chaîne
    ; Utiliser l'adressage ($80),Y avec Y=0,1,2...
    ; Boucler jusqu'à lire $00
    ; Pour chaque caractère, appeler PRINT_CHAR et incrémenter X
    RTS

; La chaîne dans les données :
MESSAGE: .byte "HELLO", 0   ; ca65 encode les guillemets en ASCII + ajoute $00
```

Indice : l'adressage `($80),Y` lit l'octet à l'adresse stockée en $80/$81, décalée de Y. Si $80 = $00 et $81 = $02 (adresse $0200), alors `($80),Y` avec Y=3 lit `mémoire[$0200 + 3]`.

**C. (Bonus) Afficher un compteur**

Écrivez un programme qui affiche le chiffre "0" en position (10, 10) et qui, à chaque pression sur [Espace], incrémente le chiffre affiché (0→1→2...→9→0).

Pour lire le clavier : `KEY_ASCII = $D200`, `KEY_STATUS = $D201` (bit7 = touche pressée). Pour écrire `$00` dans `KEY_STATUS` pour acquitter.
---

## Chapitre 4 — La mémoire en profondeur

### 4.1 La Zero Page : vos variables rapides

Vous vous souvenez que les adresses $0000–$00FF forment la "page zéro" ? C'est votre espace de variables le plus précieux.

La différence concrète :

```asm
; Accès à une variable normale (3 octets d'instruction, 4 cycles)
LDA $0200      ; instruction : $AD $00 $02

; Accès à une variable Zero Page (2 octets d'instruction, 3 cycles)
LDA $10        ; instruction : $A5 $10
```

Une économie d'un cycle par accès peut sembler négligeable. Mais dans une boucle qui s'exécute 1000 fois par frame, c'est 1000 cycles économisés — soit 6% du budget total à 60 Hz.

**Convention d'usage sur le Chuck-8 :**

| Zone | Usage |
|------|-------|
| $0010–$007F | Vos variables (réservés à vos programmes) |
| $0080–$008F | Paramètres pour les appels API |
| $00F0–$00FF | Pointeurs 16 bits (paires d'octets) |

Les adresses `$80`–`$8F` servent de "registres de passage" pour les routines API qui ont besoin de plus de paramètres que ce que A, X, Y peuvent porter.

```asm
; Appel à SYS_DRAW_LINE : dessiner une ligne de (x1,y1) à (x2,y2)
SYS_DRAW_LINE = $F006

LDA #5     ; couleur
STA $80    ; x1 = 10
LDA #10
STA $80
LDA #20
STA $81    ; y1 = 20
LDA #100
STA $82    ; x2 = 100
LDA #20
STA $83    ; y2 = 20
LDA #5     ; couleur = 5 (vert)
JSR SYS_DRAW_LINE
```

### 4.2 Déclarer des variables en RAM

Le mot-clé `.res` (reserve) réserve des octets en mémoire sans écrire de valeur :

```asm
.org $0200          ; Placer les variables à partir de $0200

SCORE:      .res 1  ; 1 octet pour le score
JOUEUR_X:   .res 1  ; 1 octet pour la position X du joueur
JOUEUR_Y:   .res 1  ; 1 octet pour la position Y
VIES:       .res 1  ; 1 octet pour le nombre de vies
```

`.res 1` est différent de `.byte 0` : `.byte` *écrit* une valeur dans le programme (dans le fichier ROM/binaire), tandis que `.res` se contente de réserver l'espace en RAM. N'utilisez pas `.byte` pour déclarer des variables en RAM.

Pour des données *lues* (tableaux de sprites, textes, niveaux), on utilise `.byte` et `.word` :

```asm
.org $0400          ; Zone données en RAM libre

SPRITE_BALLE:
    .byte %00111100  ; ..####..
    .byte %01111110  ; .######.
    .byte %11111111  ; ########
    .byte %11111111  ; ########
    .byte %11111111  ; ########
    .byte %11111111  ; ########
    .byte %01111110  ; .######.
    .byte %00111100  ; ..####..

MESSAGE_DEBUT:
    .byte "APPUIE SUR START", 0
```

### 4.3 Adresser des tableaux avec l'indexation

Supposons que vous avez 10 ennemis, chacun avec une position X stockée séquentiellement :

```asm
.org $0200
ENNEMIS_X:  .res 10    ; 10 octets pour les X des 10 ennemis
ENNEMIS_Y:  .res 10    ; 10 octets pour les Y des 10 ennemis
```

Pour lire la position X de l'ennemi numéro `i` (dans X) :

```asm
LDA ENNEMIS_X,X    ; A ← mémoire[ENNEMIS_X + X]
```

C'est l'adressage `Absolu,X` : l'adresse de base (`ENNEMIS_X`) plus l'index (`X`). Identique à `ennemis_x[i]` en C.

Pour une boucle qui initialise tous les ennemis à X=20 :

```asm
LDX #0
INIT_ENNEMIS:
    LDA #20
    STA ENNEMIS_X,X
    LDA #30
    STA ENNEMIS_Y,X
    INX
    CPX #10
    BNE INIT_ENNEMIS
```

### 4.4 Les pointeurs : l'adressage indirect

Pour les cas où l'adresse n'est connue qu'à l'exécution, on utilise des pointeurs : une paire d'octets en Zero Page qui contient une adresse 16 bits.

Exemple : afficher une chaîne dont l'adresse est passée en paramètre.

```asm
; PTR_LO = $F0, PTR_HI = $F1 (un pointeur 16 bits en Zero Page)
PTR_LO = $F0
PTR_HI = $F1

; Lire un octet à l'adresse pointée + offset Y
    LDA #<MA_CHAINE    ; octet bas de l'adresse (opérateur < en ca65)
    STA PTR_LO
    LDA #>MA_CHAINE    ; octet haut de l'adresse (opérateur > en ca65)
    STA PTR_HI
    LDY #0
LIRE_CHAINE:
    LDA (PTR_LO),Y     ; A ← mémoire[PTR_LO/PTR_HI + Y]
    BEQ FIN_CHAINE     ; Si on lit $00, c'est la fin
    ; ... traiter le caractère ...
    INY
    JMP LIRE_CHAINE
FIN_CHAINE:
```

`<` extrait l'octet bas d'une adresse 16 bits, `>` extrait l'octet haut. Pour l'adresse `$4800` : `<$4800 = $00`, `>$4800 = $48`.

[note]

**Pont avec le moderne :** `(PTR_LO),Y` est strictement équivalent à `*(ptr + y)` en C. La paire PTR_LO/PTR_HI *est* un pointeur. La seule différence, c'est qu'on doit le gérer manuellement, octet par octet.
[/note]

---

### 📝 Exercice 3

**A. Tableau de scores**

Déclarez un tableau de 5 scores en `$0200`. Écrivez une routine `INIT_SCORES` qui les initialise tous à `$00`, puis `AFFICHER_SCORE` qui affiche la valeur du score numéro X (0–4) sur la ligne 0 en hexadécimal (indice : utilisez `SYS_PRINT_HEX = $F027`).

**B. Copier des données en VRAM**

Le sprite de la balle (8 octets définis en `.byte`) doit être copié en mémoire VRAM sprites (`$5000`). Écrivez une routine `COPIER_SPRITE` qui copie les 8 octets du sprite depuis sa position en RAM vers `$5000`.

```asm
SPRITE_BALLE:
    .byte $3C, $7E, $FF, $FF, $FF, $FF, $7E, $3C

COPIER_SPRITE:
    ; X = index (0 à 7)
    ; Copier SPRITE_BALLE,X vers $5000,X
    ; Boucler 8 fois
    RTS
```

**C. (Bonus) Chaîne avec pointeur**

Déclarez deux chaînes différentes. Écrivez une routine `AFFICHER_CHAINE` qui prend l'adresse de la chaîne dans `$F0`/`$F1` et l'affiche à partir de la position (0,0). Testez-la avec chacune des deux chaînes.

---

## Chapitre 5 — Les graphismes

### 5.1 Deux modes vidéo

Le Chuck-8 a deux modes vidéo, sélectionnés avec `SYS_SET_MODE` :

```asm
LDA #0 : JSR SYS_SET_MODE  ; Mode 0 = TEXTE  (32×32 cases, caractères 4×4 pixels)
LDA #1 : JSR SYS_SET_MODE  ; Mode 1 = GRAPHIQUE (128×128 pixels, 16 couleurs)
```

**Mode texte** : Rapide, peu de code, idéal pour les interfaces, les menus, les scores. Chaque case est un caractère ASCII avec une couleur de texte et une couleur de fond.

**Mode graphique** : Accès au pixel, résolution 128×128, 16 couleurs simultanées. Nécessite plus de calculs mais donne un contrôle total.

### 5.2 Le mode graphique : nibbles et calculs d'adresse

La contrainte principale du mode graphique : deux pixels tiennent dans un seul octet. Le pixel *pair* (x=0, 2, 4...) occupe les **bits 7-4** (nibble haut), le pixel *impair* (x=1, 3, 5...) occupe les **bits 3-0** (nibble bas).

```
Octet en mémoire : AAAABBBB
                   ^^^^---- pixel à x=1 (impair), couleur BBBB
                       ^^^^---- pixel à x=0 (pair), couleur AAAA
```

L'adresse d'un pixel (x, y) en Framebuffer A (`$4000`) :

```
adresse = $4000 + y * 64 + x / 2
```

Pourquoi 64 ? Parce qu'une ligne de 128 pixels avec 2 pixels par octet = 64 octets par ligne.

**Dessiner un pixel à la main** (pour comprendre le mécanisme — en pratique, utilisez l'API) :

```asm
; Dessiner pixel (x=10, y=5) en couleur 7 (jaune)
; Adresse = $4000 + 5*64 + 10/2 = $4000 + 320 + 5 = $4145
; x=10 est pair → nibble haut (bits 7-4)

; Étape 1 : Calculer y*64
LDA #5          ; y = 5
ASL A           ; y * 2
ASL A           ; y * 4
ASL A           ; y * 8
ASL A           ; y * 16
ASL A           ; y * 32
ASL A           ; y * 64
STA $10         ; Sauvegarder = 320 = $0140

; Étape 2 : Calculer x/2
LDA #10         ; x = 10
LSR A           ; x / 2 = 5
CLC
ADC $10         ; 5 + 320 = 325 = $0145

; Étape 3 : Ajouter la base $4000
CLC
ADC #<$4000     ; Ajouter octet bas de $4000 (= $00)
TAY             ; Y = $45 (offset bas)
LDA #>$4000     ; Octet haut = $40
; ... (voir note sur l'adressage 16 bits ci-dessous)
```

*C'est laborieux.* C'est pourquoi l'API existe :

```asm
SYS_DRAW_PIXEL = $F003

LDA #7      ; couleur jaune
LDX #10     ; x
LDY #5      ; y
JSR SYS_DRAW_PIXEL
```

**Utilisez toujours l'API sauf si vous avez une raison de performance de ne pas le faire.** Le code manuel du calcul d'adresse est fourni pour comprendre ce qui se passe dessous — pas comme modèle à copier.

[note]

**👁️ Ce qu'on observe dans le débogueur :**
Après `JSR SYS_DRAW_PIXEL`, regardez la mémoire à $4145. Vous devriez voir un octet dont le nibble haut vaut $7 (couleur jaune) et le nibble bas inchangé. En binaire : `0111xxxx`.
[/note]

### 5.3 La palette de 16 couleurs

| Index | Constante | Couleur |
|-------|-----------|---------|
| 0 | `COLOR_BLACK` | Noir |
| 1 | `COLOR_WHITE` | Blanc |
| 2 | `COLOR_RED` | Rouge |
| 3 | `COLOR_CYAN` | Cyan |
| 4 | `COLOR_PURPLE` | Violet |
| 5 | `COLOR_GREEN` | Vert |
| 6 | `COLOR_BLUE` | Bleu |
| 7 | `COLOR_YELLOW` | Jaune |
| 8 | `COLOR_ORANGE` | Orange |
| 9 | `COLOR_BROWN` | Brun |
| 10 | `COLOR_PINK` | Rose |
| 11 | `COLOR_DKGRAY` | Gris foncé |
| 12 | `COLOR_MDGRAY` | Gris moyen |
| 13 | `COLOR_LTGREEN` | Vert clair |
| 14 | `COLOR_LTBLUE` | Bleu clair |
| 15 | `COLOR_LTGRAY` | Gris clair |

Ces valeurs (0–15) s'encodent sur 4 bits. C'est exactement pourquoi on peut en mettre deux par octet.

### 5.4 L'API graphique complète

```asm
; Déclarations des routines graphiques
SYS_SET_MODE    = $F01B  ; A=mode (0=texte, 1=gfx)
SYS_CLEAR       = $F000  ; A=couleur → efface l'écran
SYS_DRAW_PIXEL  = $F003  ; A=couleur, X=x, Y=y
SYS_DRAW_LINE   = $F006  ; A=couleur, $80=x1, $81=y1, $82=x2, $83=y2
SYS_DRAW_RECT   = $F009  ; A=couleur, $80=x, $81=y, $82=w, $83=h (contour)
SYS_FILL_RECT   = $F00C  ; A=couleur, $80=x, $81=y, $82=w, $83=h (rempli)
SYS_DRAW_TEXT   = $F00F  ; A=couleur, X=x, Y=y, $80/$81=addr chaîne
SYS_FLIP        = $F012  ; Swap Framebuffer A↔B (double buffering)
```

### 5.5 Le double buffering : éviter le scintillement

Imaginez que vous effacez l'écran, puis vous redessinates vos objets un par un. Pendant le redessin, l'utilisateur voit momentanément l'écran à moitié rempli — c'est le **scintillement** (tearing/flickering).

La solution est le **double buffering** : deux écrans en mémoire, on dessine sur le B pendant que A est affiché, puis on les échange instantanément.

```
Framebuffer A : $4000–$5FFF  (affiché)
Framebuffer B : $6000–$7FFF  (en cours de dessin)

↕ Swap instantané au VBlank
```

En pratique :

```asm
SYS_SET_MODE    = $F01B
SYS_CLEAR       = $F000
SYS_DRAW_PIXEL  = $F003
SYS_WAIT_VBLANK = $F057
VPU_CTRL        = $D000

; Couleurs
COLOR_BLACK = 0
COLOR_WHITE = 1

.org $0200
BALLE_X: .res 1
BALLE_Y: .res 1

.org $E000

RESET:
    LDA #%10000001  ; bit7=VPU enable, bit0=mode graphique
    STA VPU_CTRL

    LDA #64 : STA BALLE_X
    LDA #64 : STA BALLE_Y

BOUCLE:
    ; ── Attendre le signal VBlank (fin d'image) ──
    JSR SYS_WAIT_VBLANK

    ; ── Effacer Framebuffer B (le buffer invisible) ──
    LDA #COLOR_BLACK
    JSR SYS_CLEAR

    ; ── Dessiner dans B ──
    LDA #COLOR_WHITE
    LDX BALLE_X
    LDY BALLE_Y
    JSR SYS_DRAW_PIXEL

    ; ── Demander le swap A↔B au prochain VBlank ──
    LDA VPU_CTRL
    ORA #%00000010  ; bit1 = flip_request
    STA VPU_CTRL
    ; Le VPU effacera automatiquement bit1 après le swap

    JMP BOUCLE

.org $FFFC
.word RESET
```

**Comprendre `VPU_CTRL` à $D000 :**

C'est un registre matériel — pas de la RAM ordinaire. Écrire dedans envoie des commandes à la carte vidéo. Chaque bit a un rôle :

```
Bit 7 : VPU enable (1 = activé)
Bit 1 : flip_request (1 = demander le swap au prochain VBlank)
Bit 0 : mode (0 = texte, 1 = graphique)
```

Quand on écrit `ORA #%00000010`, on allume le bit 1 sans toucher aux autres bits. C'est la manière standard de modifier un seul bit d'un registre matériel : lire, modifier, réécrire.

[note]

 **👁️ Ce qu'on observe dans le débogueur :**
 - Regardez $D000 avant et après le `ORA` : le bit 1 s'allume
 - Après le VBlank, re-lisez $D000 : le bit 1 est revenu à 0 (auto-clear)
 - Regardez $D004 (VPU_STATUS) : le bit 1 indique quel buffer est actif
[/note]

### 5.6 Programme : dessin interactif

Assemblons ce qu'on sait pour faire un programme qui dessine des pixels en suivant la position de la souris :

```asm
; ═══════════════════════════════════════════════════════
; Dessin à la souris : clic gauche = pixel blanc
; ═══════════════════════════════════════════════════════

SYS_SET_MODE    = $F01B
SYS_DRAW_PIXEL  = $F003
SYS_WAIT_VBLANK = $F057

VPU_CTRL    = $D000
MOUSE_X     = $D220   ; Position X de la souris (0–127)
MOUSE_Y     = $D221   ; Position Y de la souris (0–127)
MOUSE_BTN   = $D224   ; Boutons : bit0=gauche, bit1=droit, bit2=milieu

COLOR_WHITE = 1
COLOR_BLACK = 0

; Masque bouton gauche
BTN_LEFT = %00000001  ; bit0 = bouton gauche enfoncé (logique directe)

.org $E000

RESET:
    ; Activer le mode graphique
    LDA #%10000001
    STA VPU_CTRL

BOUCLE:
    JSR SYS_WAIT_VBLANK

    ; Lire l'état du bouton gauche
    LDA MOUSE_BTN
    AND #BTN_LEFT
    BEQ PAS_CLIC        ; Si bit0=0, pas de clic → sauter

    ; Bouton gauche enfoncé : dessiner un pixel blanc
    LDA #COLOR_WHITE
    LDX MOUSE_X
    LDY MOUSE_Y
    JSR SYS_DRAW_PIXEL

PAS_CLIC:
    JMP BOUCLE

.org $FFFC
.word RESET
```
[note]

**👁️ Ce qu'on observe dans le débogueur :**
- Lisez $D220 et $D221 : les valeurs changent en temps réel avec la souris
- Lisez $D224 : le bit 0 passe à 1 lors d'un clic gauche
- Regardez la VRAM à $4000 : les pixels s'accumulent (on ne clear pas, c'est voulu)
[/note]

---

### 📝 Exercice 4

**A. Ligne horizontale**

Dessinez une ligne horizontale de 20 pixels de couleur rouge (2) en y=64, de x=10 à x=30, en utilisant `SYS_DRAW_LINE` ou une boucle avec `SYS_DRAW_PIXEL`.

Avec `SYS_DRAW_LINE` :
```asm
SYS_DRAW_LINE = $F006
LDA #2    ; rouge
LDA #10 : STA $80  ; x1
LDA #64 : STA $81  ; y1
LDA #30 : STA $82  ; x2
LDA #64 : STA $83  ; y2
; A doit contenir la couleur au moment du JSR
LDA #2
JSR SYS_DRAW_LINE
```

**B. Rebond**

Partez du programme de la balle. Ajoutez une direction (BALLE_DX et BALLE_DY, valeurs 1 ou $FF pour -1 en complément à deux). À chaque frame, déplacez la balle et faites-la rebondir sur les bords.

Pour inverser la direction (multiplier par -1 en complément à deux) :
```asm
; Inverser BALLE_DX
LDA #0
SEC
SBC BALLE_DX    ; 0 - BALLE_DX = -BALLE_DX
STA BALLE_DX
```

**C. (Bonus) Effacement sélectif**

Dans le programme de la balle, sans utiliser `SYS_CLEAR` sur tout l'écran, effacez *uniquement* l'ancien pixel avant d'en dessiner le nouveau. Dessinez un pixel noir à l'ancienne position, puis un pixel blanc à la nouvelle.

---

## Chapitre 6 — Le son

### 6.1 La SPU : trois voix et un canal sample

La Sound Processing Unit (SPU) du Chuck-8 a trois voix synthétisées et un canal de lecture de sample PCM.

Chaque voix produit une onde sonore continue que vous contrôlez avec 8 registres :

```
Voix N — adresse de base : $D100 + N*8

$D100+N*8+0  FREQ_LO   Fréquence (octet bas)
$D100+N*8+1  FREQ_HI   Fréquence (octet haut)
$D100+N*8+2  VOL       Volume (bits 7-4=gauche 0–15, bits 3-0=droit 0–15)
$D100+N*8+3  ATK       Attaque (0–15 frames)
$D100+N*8+4  DCY       Decay (0–15 frames)
$D100+N*8+5  SUS       Sustain (0–15, niveau)
$D100+N*8+6  REL       Release (0–15 frames)
$D100+N*8+7  CTRL      bit7=gate, bits 3-0=forme d'onde
```

Adresses concrètes :
- Voix 0 : `$D100`–`$D107`
- Voix 1 : `$D108`–`$D10F`
- Voix 2 : `$D110`–`$D117`

**Les formes d'onde disponibles :**

| Valeur bits 3-0 | Forme | Voix |
|-----------------|-------|------|
| `$01` | Onde carrée 50% | 0, 1 |
| `$02` | Onde carrée 25% | 0, 1 |
| `$03` | Triangle | 0, 1 |
| `$04` | Sawtooth (dent de scie) | 0, 1 |
| `$08` | Bruit blanc (LFSR) | 2 uniquement |

### 6.2 L'enveloppe ADSR

ADSR (Attack, Decay, Sustain, Release) — c'est le "profil de volume" d'une note dans le temps :

```
Volume
  │
  │      Attack
  │       ╱╲     Decay
  │      ╱  ╲───────── Sustain
  │     ╱            ╲
  │    ╱               ╲ Release
  └──────────────────────────── Temps
        ↑                ↑
     Gate ON           Gate OFF
```

- **Attack** : montée du silence au volume max (en frames)
- **Decay** : descente du max vers le niveau sustain (en frames)
- **Sustain** : niveau de volume pendant qu'on tient la note (0–15)
- **Release** : descente vers le silence après relâchement (en frames)

`Gate` (bit 7 de CTRL) : 1 = la note commence (ON), 0 = la note s'arrête et la phase Release commence.

[note]

**Analogie musicale :** Pianotez une touche de piano → bruit fort (A), légère chute (D), son stable (S). Relâchez → le son s'estompe (R). C'est l'ADSR.
[/note]

### 6.3 Jouer une note manuellement

```asm
; ═══════════════════════════════════════════════════════
; Jouer La 440 Hz sur la voix 0 pendant 1 seconde
; ═══════════════════════════════════════════════════════

; Registres SPU voix 0
SPU_V0_FREQ_LO = $D100
SPU_V0_FREQ_HI = $D101
SPU_V0_VOL     = $D102
SPU_V0_ATK     = $D103
SPU_V0_DCY     = $D104
SPU_V0_SUS     = $D105
SPU_V0_REL     = $D106
SPU_V0_CTRL    = $D107

SYS_WAIT_VBLANK = $F057

.org $E000

RESET:
    ; ── Fréquence : La 440 Hz ──
    ; Formule : période = 1 000 000 / (fréquence + 1)
    ; Pour 440 Hz : période ≈ 2272 = $08E0
    ; FREQ_LO = $E0 (octet bas), FREQ_HI = $08 (octet haut)
    LDA #$E0 : STA SPU_V0_FREQ_LO
    LDA #$08 : STA SPU_V0_FREQ_HI

    ; ── Volume maximum des deux canaux ──
    ; bits 7-4 = volume gauche = 15 = $F
    ; bits 3-0 = volume droit  = 15 = $F
    ; → $FF
    LDA #$FF : STA SPU_V0_VOL

    ; ── Enveloppe ADSR ──
    LDA #$02 : STA SPU_V0_ATK   ; Attaque : 2 frames
    LDA #$04 : STA SPU_V0_DCY   ; Decay : 4 frames
    LDA #$0A : STA SPU_V0_SUS   ; Sustain : niveau 10/15
    LDA #$08 : STA SPU_V0_REL   ; Release : 8 frames

    ; ── Démarrer la note : gate=1, forme=carrée 50% ($01) ──
    ; bit7=1 (gate ON) + bits 3-0=$01 (carré) → $81
    LDA #$81 : STA SPU_V0_CTRL

    ; ── Attendre 50 frames (≈1 seconde à 50 Hz) ──
    LDX #50
ATTENTE:
    JSR SYS_WAIT_VBLANK
    DEX
    BNE ATTENTE

    ; ── Arrêter la note : gate=0 (Release démarre) ──
    LDA #$01 : STA SPU_V0_CTRL  ; bit7=0 = gate OFF

    JMP *

.org $FFFC
.word RESET
```

**La formule de fréquence :**

La SPU utilise un registre de *période* sur 16 bits : `période = 1 000 000 / (freq_Hz + 1)`. Pour 440 Hz : `1 000 000 / 441 ≈ 2267`. En hexadécimal : `2267 = $08DB`. Donc `FREQ_LO = $DB`, `FREQ_HI = $08`.

[note]

 **👁️ Ce qu'on observe dans le débogueur :**
 - Regardez $D107 avant et après avoir écrit $81 : le bit 7 passe à 1 (gate ON)
 - Regardez $D119 (SPU_STATUS) : le bit 0 passe à 1 quand la voix 0 joue
 - Après avoir écrit $01 (gate OFF), le bit 0 de $D119 redescend à 0 après la phase Release
[/note]

### 6.4 L'API sonore : plus simple pour les cas courants

```asm
SYS_PLAY_NOTE  = $F036  ; A=note MIDI, X=voix (0–2), $80=durée en frames
SYS_STOP_VOICE = $F039  ; X=voix à arrêter
SYS_STOP_ALL   = $F03C  ; Arrêter toutes les voix
SYS_WAIT_VBLANK = $F057
```

Les notes MIDI : 60 = Do4 (Do du milieu), 69 = La4 (440 Hz). Chaque demi-ton = +1.

```asm
; Jouer Do4 (note MIDI 60) sur la voix 0 pendant 30 frames
LDA #60         ; Note MIDI
LDX #0          ; Voix 0
LDA #30         ; Durée
STA $80         ; Paramètre supplémentaire en Zero Page
LDA #60         ; (ré-charger la note car STA $80 ne modifie pas A... mais LDX l'a pas modifié)
                ; Attention : l'ordre compte. A doit contenir la note au moment du JSR
JSR SYS_PLAY_NOTE
```

*Une subtilité :* l'API `SYS_PLAY_NOTE` attend la note dans A et la voix dans X. Entre `LDA #60` et `JSR`, ne faites rien qui modifie A ou X, sinon vous jouez la mauvaise note sur la mauvaise voix.

### 6.5 Jouer une mélodie

```asm
; ═══════════════════════════════════════════════════════
; Jouer "Do Ré Mi" (Do4, Ré4, Mi4)
; ═══════════════════════════════════════════════════════

SYS_PLAY_NOTE   = $F036
SYS_WAIT_VBLANK = $F057

.org $0200
; Table de notes : [note MIDI, durée en frames, 0=fin]
MELODIE:
    .byte 60, 20   ; Do4, 20 frames
    .byte 62, 20   ; Ré4, 20 frames
    .byte 64, 20   ; Mi4, 20 frames
    .byte 60, 40   ; Do4 long, 40 frames
    .byte 0        ; Fin

.org $E000

RESET:
    LDX #0          ; X = index dans la table

JOUER_MELODIE:
    LDA MELODIE,X   ; Lire la note
    BEQ FIN         ; Si $00, c'est la fin

    ; Préparer les paramètres
    PHA             ; Sauvegarder la note
    INX
    LDA MELODIE,X   ; Lire la durée
    STA $80         ; Paramètre durée
    INX             ; Avancer l'index pour la prochaine note
    PLA             ; Récupérer la note dans A

    LDY #0          ; Y = voix 0 (mais SYS_PLAY_NOTE attend X = voix...)
    ; Attention : on a utilisé X pour l'index ! Sauvegarder avant.
    ; Version corrigée :
    PHA             ; Sauvegarder A (note)
    TXA
    PHA             ; Sauvegarder X (index)
    LDX #0          ; X = voix 0
    PLA
    TAX             ; ... non, ce n'est pas bon
    ; Voir solution dans les indications de l'exercice

FIN:
    JMP *

.org $FFFC
.word RESET
```

*Ce code a un problème intentionnel* : on utilise X à la fois pour l'index dans la table et comme numéro de voix pour `SYS_PLAY_NOTE`. La solution est de sauvegarder/restaurer X sur la pile, ou d'utiliser une variable Zero Page pour l'index.

**Version correcte avec variable Zero Page :**

```asm
SYS_PLAY_NOTE   = $F036
SYS_WAIT_VBLANK = $F057

.org $0010
IDX_MELODIE: .res 1   ; Index dans la table (Zero Page = rapide)

.org $0200
MELODIE:
    .byte 60, 20
    .byte 62, 20
    .byte 64, 20
    .byte 60, 40
    .byte 0

.org $E000

RESET:
    LDA #0
    STA IDX_MELODIE     ; IDX_MELODIE ← 0

JOUER_MELODIE:
    LDX IDX_MELODIE     ; X ← index courant
    LDA MELODIE,X       ; Note
    BEQ FIN             ; Si $00, fin
    PHA                 ; Sauvegarder la note

    INX
    LDA MELODIE,X       ; Durée
    STA $80
    INX
    STX IDX_MELODIE     ; Sauvegarder le nouvel index

    PLA                 ; Récupérer la note dans A
    LDX #0              ; Voix 0 (X est maintenant libre)
    JSR SYS_PLAY_NOTE

    ; Attendre la durée de la note
    LDA $80
ATTENTE:
    PHA
    JSR SYS_WAIT_VBLANK
    PLA
    SEC : SBC #1
    BNE ATTENTE

    JMP JOUER_MELODIE

FIN:
    JMP *

.org $FFFC
.word RESET
```

[note]

 **👁️ Ce qu'on observe dans le débogueur :**
 - Suivez IDX_MELODIE ($10) : il avance de 2 en 2 après chaque note
 - Regardez $D107 (SPU_V0_CTRL) : bit 7 s'allume à chaque note, s'éteint entre
 - Regardez $80 : il contient la durée courante
[/note]

---

### 📝 Exercice 5

**A. Effet sonore**

Créez un effet sonore d'explosion : bruit blanc sur la voix 2, avec une enveloppe très courte (Attack=0, Decay=8, Sustain=0, Release=4). Déclenchez-le sur appui de [Espace].

Voix 2 (bruit blanc) :
```asm
SPU_V2_FREQ_LO = $D110
SPU_V2_FREQ_HI = $D111
SPU_V2_VOL     = $D112
SPU_V2_ATK     = $D113
SPU_V2_DCY     = $D114
SPU_V2_SUS     = $D115
SPU_V2_REL     = $D116
SPU_V2_CTRL    = $D117
; Forme bruit : $08 (noise LFSR)
; Gate ON : %10001000 = $88
```

**B. Mélodie avec deux voix**

Modifiez la routine de mélodie pour jouer une ligne de basse simultanément (voix 1) : une note grave toutes les 4 notes de mélodie.

**C. (Bonus) Synthétiseur clavier**

Mappez 7 touches (A=Do, S=Ré, D=Mi, F=Fa, G=Sol, H=La, J=Si) à 7 notes MIDI. La note joue tant que la touche est enfoncée (gate ON à la pression, gate OFF au relâchement).

Pour détecter le relâchement, comparez `KEY_ASCII` entre deux frames : si la touche change (ou vaut $00), faire gate OFF.

---

## Chapitre 7 — Les entrées utilisateur

### 7.1 Le clavier

Le clavier expose trois registres :

```
$D200  KEY_ASCII   ASCII de la dernière touche pressée (0 si aucune)
$D201  KEY_STATUS  bit7 = 1 si une touche a été pressée ce frame
$D202  KEY_MOD     Modificateurs : bit0=Shift, bit1=Ctrl, bit2=Alt
```

**Convention importante :** Après avoir lu `KEY_STATUS`, vous devez écrire `$00` dedans pour "acquitter" — signaler à la machine que vous avez pris en compte l'événement. Sinon, le flag reste à 1 et vous pensez qu'une touche est pressée à chaque frame.

```asm
KEY_ASCII  = $D200
KEY_STATUS = $D201
SYS_PRINT_CHAR = $F01E

LIRE_CLAVIER:
    LDA KEY_STATUS      ; Lire l'état
    BPL PAS_DE_TOUCHE   ; Si bit7=0 (valeur positive), aucune touche

    ; Une touche a été pressée
    LDA KEY_ASCII       ; Lire le code ASCII
    JSR SYS_PRINT_CHAR  ; Afficher le caractère

    LDA #$00
    STA KEY_STATUS      ; Acquitter (INDISPENSABLE)

PAS_DE_TOUCHE:
    RTS
```

**Pourquoi `BPL` pour tester le bit 7 ?** L'instruction `BPL` (Branch if PLus) saute si le flag N (Negative) est à 0. Après `LDA KEY_STATUS`, le flag N reflète le bit 7 de la valeur lue. Si bit7=0 (aucune touche), N=0, `BPL` saute. Si bit7=1 (touche pressée), N=1, `BPL` ne saute pas. C'est une façon élégante de tester le bit 7 sans passer par `AND #$80`.

### 7.2 La manette

La manette NES-compatible expose :

```
$D210  PAD1_STATE  État de la manette 1 (snapshot)
$D211  PAD2_STATE  État de la manette 2
$D212  PAD_CTRL    Écrire 1 pour faire un latch (capturer l'état actuel)
```

**Logique inversée** : 0 = bouton enfoncé, 1 = relâché. C'est contre-intuitif, mais c'est la convention hardware héritée de l'électronique : au repos, la ligne est haute (1) ; quand on appuie, elle est mise à la masse (0).

```
Bit 7 : A
Bit 6 : B
Bit 5 : Select
Bit 4 : Start
Bit 3 : Droite
Bit 2 : Gauche
Bit 1 : Bas
Bit 0 : Haut
```

```asm
PAD1_STATE = $D210
PAD_CTRL   = $D212

; Masques (les boutons enfoncés donnent 0 sur le bit correspondant)
PAD_A     = %10000000
PAD_B     = %01000000
PAD_UP    = %00000001
PAD_DOWN  = %00000010
PAD_LEFT  = %00000100
PAD_RIGHT = %00001000

LIRE_MANETTE:
    ; Étape 1 : Déclencher la capture de l'état
    LDA #1
    STA PAD_CTRL        ; Latch : la manette fige son état actuel

    ; Étape 2 : Lire l'état
    LDA PAD1_STATE
    STA $10             ; Sauvegarder l'octet d'état en Zero Page

    ; Étape 3 : Tester un bouton
    LDA $10
    AND #PAD_UP         ; Masquer tous les bits sauf bit0 (Haut)
    BEQ HAUT_PRESSE     ; Si résultat=0 (Z=1), le bit était 0 → bouton enfoncé
    JMP PAS_HAUT

HAUT_PRESSE:
    ; ... déplacer le joueur vers le haut ...
PAS_HAUT:
    RTS
```

[note]

**La subtilité du latch :** Sans écrire dans PAD_CTRL, `PAD1_STATE` peut refléter un état intermédiaire si la manette change pendant que vous la lisez. Le latch "photographie" l'état à un instant précis, garantissant une lecture cohérente.
[/note]

[note]

 **👁️ Ce qu'on observe dans le débogueur :**
 - Lisez $D210 sans latch : la valeur peut être instable
 - Écrivez 1 dans $D212, puis relisez $D210 : valeur stable
 - Comparez les bits avec vos pressions de boutons : chaque 0 correspond à un bouton enfoncé
[/note]

### 7.3 La souris

```
$D220  MOUSE_X     Position X (0–127 en mode graphique)
$D221  MOUSE_Y     Position Y (0–127 en mode graphique)
$D222  MOUSE_DX    Déplacement X depuis la dernière frame (signé)
$D223  MOUSE_DY    Déplacement Y depuis la dernière frame (signé)
$D224  MOUSE_BTN   Boutons : bit0=gauche, bit1=droit, bit2=milieu
$D225  MOUSE_SCROLL  Delta molette (signé)
```

La souris se lit directement sans latch :

```asm
MOUSE_X   = $D220
MOUSE_Y   = $D221
MOUSE_BTN = $D224

SYS_DRAW_PIXEL = $F003

; Dessiner un curseur à la position de la souris
DESSINER_CURSEUR:
    LDA #1          ; blanc
    LDX MOUSE_X
    LDY MOUSE_Y
    JSR SYS_DRAW_PIXEL
    RTS
```

**Valeurs signées (DX, DY, SCROLL) :** Ces registres utilisent le complément à deux. $01 = +1 (déplacement à droite/bas), $FF = -1 (déplacement à gauche/haut). Pour tester si la valeur est négative, utilisez `BMI` après `LDA`.

### 7.4 L'API d'entrée

```asm
SYS_READ_PAD  = $F048  ; A=n° manette (0 ou 1) → A=état boutons
SYS_READ_KEY  = $F04B  ; → A=ASCII (0 si aucune touche)
SYS_WAIT_KEY  = $F04E  ; Bloque jusqu'à pression → A=ASCII
SYS_READ_MOUSE = $F051 ; → X=mouseX, Y=mouseY, A=boutons
```

---

### 📝 Exercice 6

**A. Echo clavier**

Écrivez un programme qui affiche chaque touche pressée à la position courante du curseur, et avance le curseur. Gérez la touche Entrée (code $0D) pour passer à la ligne suivante, et le Backspace ($08) pour reculer et effacer.

**B. Croix directionnelle**

Affichez un personnage '@' à l'écran qui se déplace avec la croix directionnelle de la manette. Bloquez le mouvement aux bords (x de 0 à 31, y de 0 à 31 en mode texte).

```asm
.org $0200
PERSO_X: .res 1
PERSO_Y: .res 1

; Initialisation :
LDA #16 : STA PERSO_X
LDA #16 : STA PERSO_Y

; Chaque frame :
; 1. Effacer l'ancienne position (écrire ' ' à PERSO_X, PERSO_Y)
; 2. Lire la manette
; 3. Mettre à jour PERSO_X / PERSO_Y (vérifier les bords)
; 4. Dessiner '@' à la nouvelle position
```

**C. (Bonus) Tracer à la souris avec gomme**

Reprenez le programme de dessin à la souris. Ajoutez : clic gauche = dessiner en blanc, clic droit = dessiner en noir (gomme). Affichez la position courante de la souris (X, Y) en mode texte superposé... mais le Chuck-8 n'a qu'un mode à la fois, alors affichez les coordonnées dans la console (utilisez `SYS_PRINT_NUM = $F024`).
---

## Chapitre 8 — Les interruptions

### 8.1 Qu'est-ce qu'une interruption ?

Imaginez que votre programme tourne dans sa boucle principale. Soudain, la carte vidéo a fini de dessiner l'image. Elle a besoin de vous signaler que c'est le bon moment pour envoyer la prochaine frame. Comment le faire sans bloquer votre code dans une attente active ?

Avec une **interruption** : le CPU suspend momentanément ce qu'il fait, saute dans un gestionnaire d'interruption (handler), exécute votre code, puis reprend exactement là où il s'était arrêté.

Le 6502 connaît trois types d'interruptions :

| Vecteur | Nom | Déclenchement | Masquable ? |
|---------|-----|---------------|-------------|
| `$FFFA/$FFFB` | NMI | VBlank (chaque frame) | Non |
| `$FFFC/$FFFD` | RESET | Démarrage / bouton RESET | — |
| `$FFFE/$FFFF` | IRQ | Timer programmable | Oui (SEI/CLI) |

Le **NMI** (Non-Maskable Interrupt) est le plus important en pratique : il se déclenche une fois par frame, au moment du VBlank — la courte période où le faisceau vidéo est en retour de bas en haut de l'écran. C'est le meilleur moment pour mettre à jour l'affichage.

**VBlank**, du terme "Vertical Blank" : sur les vieux écrans CRT, le faisceau électronique balayait l'image de gauche à droite, ligne par ligne. À la fin de la dernière ligne, il revenait à l'origine (en haut à gauche) — pendant ce retrait, il n'affichait rien. C'était le "blank" vertical. Cette fenêtre de quelques millisecondes est parfaite pour écrire en VRAM sans risquer d'interférer avec l'affichage en cours.

### 8.2 Handler NMI minimal

```asm
; ═══════════════════════════════════════════════════════
; Handler NMI qui incrémente un compteur de frames
; ═══════════════════════════════════════════════════════

SYS_WAIT_VBLANK = $F057
VPU_CTRL = $D000

.org $0200
FRAME_COUNT_LO: .res 1   ; Compteur 16-bit (octet bas)
FRAME_COUNT_HI: .res 1   ; (octet haut)

.org $E000

RESET:
    ; Initialiser le compteur
    LDA #0
    STA FRAME_COUNT_LO
    STA FRAME_COUNT_HI

    ; Désactiver les IRQ pendant la configuration du vecteur NMI
    SEI

    ; Placer l'adresse de notre handler dans le vecteur NMI
    LDA #<NMI_HANDLER    ; Octet bas de l'adresse
    STA $FFFA
    LDA #>NMI_HANDLER    ; Octet haut de l'adresse
    STA $FFFB

    ; Réactiver les IRQ
    CLI

    JMP PROGRAMME_PRINCIPAL

; ── Handler NMI ─────────────────────────────────────────
; RÈGLE ABSOLUE : sauvegarder A, X, Y en début de handler
;                 et les restaurer à la fin, avant RTI
.org $E100
NMI_HANDLER:
    PHA        ; ← Sauvegarder A (OBLIGATOIRE)
    TXA
    PHA        ; ← Sauvegarder X
    TYA
    PHA        ; ← Sauvegarder Y

    ; Incrémenter le compteur de frames (16 bits)
    INC FRAME_COUNT_LO
    BNE @pas_debordement    ; Si pas de débordement sur l'octet bas...
    INC FRAME_COUNT_HI      ; ...incrémenter l'octet haut

@pas_debordement:
    ; Demander le swap Framebuffer A↔B
    LDA VPU_CTRL
    ORA #%00000010
    STA VPU_CTRL

    PLA        ; ← Restaurer Y
    TAY
    PLA        ; ← Restaurer X
    TAX
    PLA        ; ← Restaurer A
    RTI        ; ← Retour d'interruption (pas RTS !)

PROGRAMME_PRINCIPAL:
    JMP *

.org $FFFC
.word RESET
```

**Pourquoi `RTI` et pas `RTS` ?**

`RTI` (Return from Interrupt) restaure aussi le registre P (les flags), qui avait été automatiquement empilé par le CPU lors du déclenchement de l'interruption. `RTS` ne le fait pas. Si vous utilisez `RTS` dans un handler d'interruption, les flags sont corrompus à la reprise du programme principal.

**Pourquoi sauvegarder A, X, Y ?**

Le programme principal peut être interrompu à n'importe quelle instruction. Si votre handler modifie A sans le restaurer, le programme principal reprend avec la mauvaise valeur dans A — comportement imprévisible garanti. Sauvegarder/restaurer les registres est une *loi fondamentale* de l'écriture de handlers d'interruption.

[note]

 **Pont avec le moderne :** Les handlers d'interruption existent encore aujourd'hui dans chaque système d'exploitation. En C, les signal handlers (`SIGINT`, `SIGTERM`) ont les mêmes contraintes : ils ne peuvent pas modifier l'état global impunément.
[/note]

[note]

 **👁️ Ce qu'on observe dans le débogueur :**
 - Observez SP au moment où NMI se déclenche : il diminue de 3 (PC basse, PC haute, P)
 - Les PHA ajoutent encore 3 (A, X, Y)
 - Après RTI, SP remonte de 6 d'un coup
[/note]


### 8.3 Pattern complet : boucle principale avec NMI

La structure canonique d'un programme Chuck-8 avec interruptions :

```asm
; ═══════════════════════════════════════════════════════
; Structure canonique avec NMI
; ═══════════════════════════════════════════════════════

SYS_SET_MODE    = $F01B
SYS_CLEAR       = $F000
SYS_DRAW_PIXEL  = $F003

VPU_CTRL = $D000

COLOR_BLACK = 0
COLOR_WHITE = 1

.org $0200
OBJET_X:    .res 1
OBJET_Y:    .res 1
FRAME_PRET: .res 1    ; Drapeau : 1 = NMI a eu lieu, frame prête

.org $E000

RESET:
    LDA #%10000001
    STA VPU_CTRL

    ; Configurer le vecteur NMI
    SEI
    LDA #<NMI_HANDLER : STA $FFFA
    LDA #>NMI_HANDLER : STA $FFFB
    CLI

    LDA #64 : STA OBJET_X
    LDA #64 : STA OBJET_Y
    LDA #0  : STA FRAME_PRET

BOUCLE_PRINCIPALE:
    ; Attendre que le NMI signale une nouvelle frame
    LDA FRAME_PRET
    BEQ BOUCLE_PRINCIPALE  ; Si = 0, pas encore de frame → attendre

    LDA #0 : STA FRAME_PRET  ; Remettre le drapeau à 0

    ; ── Logique de jeu ──
    ; (déplacer OBJET_X, tester collisions, lire entrées...)

    ; ── Dessin ──
    LDA #COLOR_BLACK : JSR SYS_CLEAR
    LDA #COLOR_WHITE
    LDX OBJET_X
    LDY OBJET_Y
    JSR SYS_DRAW_PIXEL

    ; Demander le swap
    LDA VPU_CTRL
    ORA #%00000010
    STA VPU_CTRL

    JMP BOUCLE_PRINCIPALE

.org $E100
NMI_HANDLER:
    PHA : TXA : PHA : TYA : PHA

    ; Signaler à la boucle principale qu'une frame est prête
    LDA #1 : STA FRAME_PRET

    PLA : TAY : PLA : TAX : PLA
    RTI

.org $FFFC
.word RESET
```

Le drapeau `FRAME_PRET` est le mécanisme de synchronisation : le NMI le met à 1, la boucle principale l'attend et le remet à 0. Cela garantit que la logique de jeu tourne exactement une fois par frame, ni plus, ni moins.

---

### 📝 Exercice 7

**A. Compteur de frames affiché**

Écrivez un programme avec handler NMI qui incrémente `FRAME_COUNT` et affiche sa valeur en haut de l'écran en mode texte (avec `SYS_PRINT_NUM`). Observez le compteur s'incrémenter en temps réel.

**B. Animation synchronisée**

Un cercle se déplace de gauche à droite et recommence. La mise à jour de la position ne doit se faire qu'une fois par frame (utilisez le pattern avec `FRAME_PRET`).

**C. (Bonus) Timer IRQ**

Configurez le timer IRQ pour déclencher toutes les 100 frames. Utilisez $D302/$D303 pour programmer le timer. À chaque déclenchement IRQ, changez la couleur de fond de l'écran.

---

## Chapitre 9 — Projet final : Pong

C'est le moment d'assembler tout ce qu'on a appris. Pong, c'est le jeu parfait pour un premier projet complet : deux raquettes, une balle, de la détection de collision, des entrées, du son. Simple à décrire, instructif à implémenter.

### 9.1 Architecture du programme

Avant d'écrire une ligne de code, on planifie. Un bon programme assembleur commence par des questions :
- **Quelles sont les données ?** → Les variables
- **Quelles sont les actions ?** → Les routines
- **Dans quel ordre s'enchaînent-elles ?** → La boucle principale

**Les données :**

```asm
.org $0200
BALLE_X:  .res 1   ; Position X de la balle (0–127)
BALLE_Y:  .res 1   ; Position Y de la balle (0–127)
BALLE_DX: .res 1   ; Vitesse X (+1 ou $FF = -1)
BALLE_DY: .res 1   ; Vitesse Y (+1 ou $FF = -1)
PAD1_Y:   .res 1   ; Position Y de la raquette joueur (0–111)
PAD2_Y:   .res 1   ; Position Y de la raquette IA (0–111)
```

**Les routines :**

1. `LIRE_ENTREES` → mise à jour de PAD1_Y selon la manette
2. `MAJ_BALLE` → déplacer, tester rebonds et collisions
3. `MAJ_IA` → PAD2_Y suit la balle
4. `DESSINER` → effacer, puis dessiner balle et raquettes

**La boucle principale :**

```
INIT
↓
BOUCLE:
  Attendre VBlank
  LIRE_ENTREES
  MAJ_BALLE
  MAJ_IA
  DESSINER
  Demander swap
  → BOUCLE
```

### 9.2 Le code complet annoté

```asm
; ╔═══════════════════════════════════════════════════════╗
; ║               PONG — Chuck-8                          ║
; ║  Joueur 1 : manette 1 (Haut/Bas)                     ║
; ║  IA : suit la balle automatiquement                   ║
; ╚═══════════════════════════════════════════════════════╝

; ── Routines système ────────────────────────────────────
SYS_SET_MODE    = $F01B
SYS_CLEAR       = $F000
SYS_DRAW_PIXEL  = $F003
SYS_DRAW_LINE   = $F006
SYS_WAIT_VBLANK = $F057
SYS_PLAY_NOTE   = $F036

; ── Registres hardware ──────────────────────────────────
VPU_CTRL    = $D000
PAD1_STATE  = $D210
PAD_CTRL    = $D212

; ── Boutons manette (0=enfoncé, convention inversée) ────
PAD_UP   = %00000001   ; bit 0
PAD_DOWN = %00000010   ; bit 1

; ── Couleurs ────────────────────────────────────────────
COLOR_BLACK = 0
COLOR_WHITE = 1

; ── Constantes du jeu ───────────────────────────────────
HAUTEUR_RAQUETTE = 16   ; Raquette = 16 pixels de haut
X_PAD1 = 4              ; Position X de la raquette joueur
X_PAD2 = 124            ; Position X de la raquette IA
Y_MIN   = 0             ; Bord haut
Y_MAX   = 127           ; Bord bas
X_MAX   = 127           ; Bord droit

; ── Variables en RAM ────────────────────────────────────
.org $0200
BALLE_X:   .res 1
BALLE_Y:   .res 1
BALLE_DX:  .res 1   ; +1 ou $FF (-1)
BALLE_DY:  .res 1   ; +1 ou $FF (-1)
PAD1_Y:    .res 1
PAD2_Y:    .res 1

; ════════════════════════════════════════════════════════
; CODE PRINCIPAL
; ════════════════════════════════════════════════════════
.org $E000

RESET:
    ; ── Activer le mode graphique ──
    LDA #%10000001      ; VPU enable (bit7) + mode gfx (bit0)
    STA VPU_CTRL

    ; ── Initialiser la balle au centre ──
    LDA #64 : STA BALLE_X
    LDA #64 : STA BALLE_Y
    LDA #1  : STA BALLE_DX   ; Direction initiale : droite (+1)
    LDA #1  : STA BALLE_DY   ; Direction initiale : bas (+1)

    ; ── Initialiser les raquettes au centre ──
    LDA #56 : STA PAD1_Y   ; 56 = (128 - 16) / 2 ≈ centre
    LDA #56 : STA PAD2_Y

; ════════════════════════════════════════════════════════
; BOUCLE PRINCIPALE
; ════════════════════════════════════════════════════════
BOUCLE:
    ; Attendre le signal VBlank (synchronisation 60 Hz)
    JSR SYS_WAIT_VBLANK

    ; ── Phase 1 : Entrées ──
    JSR LIRE_ENTREES

    ; ── Phase 2 : Logique ──
    JSR MAJ_BALLE
    JSR MAJ_IA

    ; ── Phase 3 : Dessin ──
    JSR DESSINER

    ; ── Phase 4 : Swap des framebuffers ──
    LDA VPU_CTRL
    ORA #%00000010
    STA VPU_CTRL

    JMP BOUCLE

; ════════════════════════════════════════════════════════
; ROUTINE : LIRE_ENTREES
; Lit la manette 1 et déplace PAD1_Y
; ════════════════════════════════════════════════════════
LIRE_ENTREES:
    ; Déclencher le latch (capturer l'état de la manette)
    LDA #1 : STA PAD_CTRL

    ; Lire l'état et le sauvegarder
    LDA PAD1_STATE
    STA $10             ; $10 = état boutons (Zero Page)

    ; ── Tester le bouton Haut ──
    LDA $10
    AND #PAD_UP         ; Masquer tout sauf bit0
    BEQ @haut_presse    ; Si résultat=0 → bouton enfoncé

    JMP @tester_bas

@haut_presse:
    LDA PAD1_Y
    BEQ @tester_bas     ; Si déjà à 0, ne pas bouger
    DEC PAD1_Y          ; Monter d'un pixel

@tester_bas:
    LDA $10
    AND #PAD_DOWN
    BEQ @bas_presse
    JMP @fin_entrees

@bas_presse:
    LDA PAD1_Y
    CMP #(128 - HAUTEUR_RAQUETTE)  ; Limite basse
    BCS @fin_entrees     ; Si >= limite, ne pas bouger
    INC PAD1_Y           ; Descendre d'un pixel

@fin_entrees:
    RTS

; ════════════════════════════════════════════════════════
; ROUTINE : MAJ_BALLE
; Déplace la balle et gère tous les rebonds + collisions
; ════════════════════════════════════════════════════════
MAJ_BALLE:
    ; ── Détecter sortie à gauche AVANT de déplacer ──
    ; (si la balle sort à gauche, reset et son)
    LDA BALLE_X
    CMP #1
    BNE @deplacer       ; Si x ≠ 1, pas de sortie
    LDA BALLE_DX
    BMI @reset_balle    ; Si DX < 0 (vers gauche), c'est une sortie

@deplacer:
    ; ── Déplacer horizontalement ──
    LDA BALLE_X
    CLC
    ADC BALLE_DX        ; X ← X + DX
    STA BALLE_X

    ; ── Déplacer verticalement ──
    LDA BALLE_Y
    CLC
    ADC BALLE_DY        ; Y ← Y + DY
    STA BALLE_Y

    ; ── Rebond bord haut (y=0) ──
    LDA BALLE_Y
    BEQ @inverser_dy    ; Si y=0, rebondir

    ; ── Rebond bord bas (y=127) ──
    CMP #Y_MAX
    BEQ @inverser_dy
    JMP @rebond_droite

@inverser_dy:
    ; Inverser DY : DY ← -DY (complément à deux)
    LDA #0
    SEC
    SBC BALLE_DY
    STA BALLE_DY

@rebond_droite:
    ; ── Rebond bord droit (x=127) ──
    LDA BALLE_X
    CMP #X_MAX
    BNE @collision_pad1
    LDA #0
    SEC
    SBC BALLE_DX
    STA BALLE_DX

@collision_pad1:
    ; ── Collision avec raquette 1 (x=X_PAD1=4) ──
    ; Condition : BALLE_X = X_PAD1
    ;          ET PAD1_Y <= BALLE_Y <= PAD1_Y + HAUTEUR_RAQUETTE
    LDA BALLE_X
    CMP #X_PAD1
    BNE @collision_pad2

    ; Tester si BALLE_Y >= PAD1_Y
    LDA BALLE_Y
    CMP PAD1_Y
    BCC @collision_pad2   ; Si BALLE_Y < PAD1_Y, pas de collision

    ; Tester si BALLE_Y <= PAD1_Y + HAUTEUR_RAQUETTE
    LDA PAD1_Y
    CLC
    ADC #HAUTEUR_RAQUETTE
    CMP BALLE_Y
    BCC @collision_pad2   ; Si PAD1_Y+H < BALLE_Y, pas de collision

    ; Collision ! Inverser DX et jouer un son
    LDA #0 : SEC : SBC BALLE_DX : STA BALLE_DX

    ; Son de rebond : Do4 court
    LDA #60             ; Note MIDI Do4
    LDX #0              ; Voix 0
    LDA #5 : STA $80    ; Durée : 5 frames
    LDA #60             ; Recharger la note (STA $80 ne change pas A, mais LDX si)
    JSR SYS_PLAY_NOTE
    JMP @fin_maj

@collision_pad2:
    ; ── Collision avec raquette 2 (x=X_PAD2=124) ──
    LDA BALLE_X
    CMP #X_PAD2
    BNE @fin_maj

    LDA BALLE_Y : CMP PAD2_Y : BCC @fin_maj
    LDA PAD2_Y : CLC : ADC #HAUTEUR_RAQUETTE : CMP BALLE_Y : BCC @fin_maj

    LDA #0 : SEC : SBC BALLE_DX : STA BALLE_DX

    LDA #62             ; Ré4
    LDX #0
    LDA #5 : STA $80
    LDA #62
    JSR SYS_PLAY_NOTE
    JMP @fin_maj

@reset_balle:
    ; La balle est sortie à gauche → reset
    LDA #64 : STA BALLE_X
    LDA #64 : STA BALLE_Y
    LDA #1  : STA BALLE_DX
    LDA #1  : STA BALLE_DY
    ; (ici on pourrait incrémenter le score de l'IA)

@fin_maj:
    RTS

; ════════════════════════════════════════════════════════
; ROUTINE : MAJ_IA
; L'IA déplace PAD2_Y pour suivre la balle
; ════════════════════════════════════════════════════════
MAJ_IA:
    ; Comparer le centre de la raquette avec la balle
    ; Centre raquette ≈ PAD2_Y + 8
    LDA PAD2_Y
    CLC
    ADC #8              ; Centre de la raquette
    CMP BALLE_Y
    BEQ @ia_centre      ; Si aligné, ne pas bouger

    BCS @ia_monter      ; Si centre > balle, monter

    ; Centre < balle → descendre
    LDA PAD2_Y
    CMP #(128 - HAUTEUR_RAQUETTE)
    BCS @ia_centre
    INC PAD2_Y
    JMP @ia_centre

@ia_monter:
    LDA PAD2_Y
    BEQ @ia_centre
    DEC PAD2_Y

@ia_centre:
    RTS

; ════════════════════════════════════════════════════════
; ROUTINE : DESSINER
; Efface et redessine toute la scène
; ════════════════════════════════════════════════════════
DESSINER:
    ; Effacer l'écran
    LDA #COLOR_BLACK
    JSR SYS_CLEAR

    ; ── Dessiner la balle (1 pixel blanc) ──
    LDA #COLOR_WHITE
    LDX BALLE_X
    LDY BALLE_Y
    JSR SYS_DRAW_PIXEL

    ; ── Dessiner la raquette 1 (ligne verticale) ──
    ; SYS_DRAW_LINE : A=couleur, $80=x1, $81=y1, $82=x2, $83=y2
    LDA #X_PAD1  : STA $80   ; x1 = 4
    LDA PAD1_Y   : STA $81   ; y1 = haut de la raquette
    LDA #X_PAD1  : STA $82   ; x2 = 4 (même colonne → ligne verticale)
    LDA PAD1_Y
    CLC
    ADC #HAUTEUR_RAQUETTE
    STA $83                   ; y2 = y1 + hauteur
    LDA #COLOR_WHITE
    JSR SYS_DRAW_LINE

    ; ── Dessiner la raquette 2 ──
    LDA #X_PAD2  : STA $80
    LDA PAD2_Y   : STA $81
    LDA #X_PAD2  : STA $82
    LDA PAD2_Y
    CLC
    ADC #HAUTEUR_RAQUETTE
    STA $83
    LDA #COLOR_WHITE
    JSR SYS_DRAW_LINE

    RTS

; ── Vecteur de démarrage ────────────────────────────────
.org $FFFC
.word RESET
```

### 9.3 Décortiquer les parties intéressantes

**La détection de collision :**

```asm
; Condition de collision balle/raquette :
;   BALLE_X = X_PAD1
;   ET BALLE_Y >= PAD1_Y
;   ET BALLE_Y <= PAD1_Y + HAUTEUR

; Test 1 : position X
LDA BALLE_X
CMP #X_PAD1
BNE @pas_de_collision   ; Si X ≠ 4, sortir

; Test 2 : borne inférieure (BALLE_Y >= PAD1_Y)
LDA BALLE_Y
CMP PAD1_Y
BCC @pas_de_collision   ; Si BALLE_Y < PAD1_Y (C=0), sortir

; Test 3 : borne supérieure (BALLE_Y <= PAD1_Y + HAUTEUR)
LDA PAD1_Y
CLC
ADC #HAUTEUR_RAQUETTE
CMP BALLE_Y             ; Comparer (PAD1_Y+H) avec BALLE_Y
BCC @pas_de_collision   ; Si PAD1_Y+H < BALLE_Y (C=0), sortir

; Si on arrive ici : collision confirmée
```

La séquence `CMP X : BCC label` est l'idiome "sauter si inférieur (non signé)". C'est votre `if (a < b)` en assembleur, et vous l'utiliserez des centaines de fois.

**L'inversion de direction en complément à deux :**

```asm
; Inverser BALLE_DX (peut être +1 ou $FF = -1)
LDA #0
SEC
SBC BALLE_DX    ; 0 - (+1) = $FF (-1)  OU  0 - $FF = +1
STA BALLE_DX
```

Le complément à deux fait que `-x = 0 - x = (255 - x) + 1`. `0 - 1 = 255 = $FF`, et `0 - 255 = 1`. L'inversion d'une vitesse, c'est juste une soustraction à partir de zéro.

[note]

 **👁️ Ce qu'on observe dans le débogueur :**
 - Mettez un breakpoint dans `@collision_pad1`
 - Vérifiez BALLE_X ($0200), BALLE_Y ($0201), PAD1_Y ($0204) à l'arrêt
 - Lisez BALLE_DX avant et après la collision : $01 → $FF ou $FF → $01
 - Regardez $D119 (SPU_STATUS) clignoter à chaque son de rebond
[/note]

---

### 📝 Exercice 8 — Améliorer Pong

**A. Score**

Ajoutez une variable `SCORE_IA` (initialisée à 0). Chaque fois que la balle sort à gauche, incrémentez le score. Affichez-le en haut à droite de l'écran en mode texte *avant* de passer en mode graphique... ou mieux : en mode graphique, utilisez `SYS_DRAW_TEXT` pour afficher le score avec `SYS_PRINT_NUM = $F024`.

**B. Vitesse croissante**

Après chaque rebond sur une raquette, ajoutez un compteur de rebonds. Tous les 5 rebonds, augmentez la vitesse de 1 (DX passe de 1 à 2, etc.). Pensez à gérer les directions négatives correctement.

**C. (Bonus) Deuxième joueur**

Remplacez l'IA par le joueur 2 (manette 2 via `PAD2_STATE = $D211`). Ajoutez aussi un score pour le joueur 1 (balle qui sort à droite). Affichez les deux scores.

---

## Chapitre 10 — Débogage et bonnes pratiques

### 10.1 Les bugs classiques et comment les trouver

**Bug 1 : Oublier CLC avant ADC**

```asm
; Code bugué
LDA POSITION_X
ADC #1         ; ← Si Carry=1 depuis avant, on ajoute 2 au lieu de 1 !
STA POSITION_X

; Code correct
LDA POSITION_X
CLC             ; ← Toujours, sans exception
ADC #1
STA POSITION_X
```

**Comment le trouver :** Placez un breakpoint juste avant l'ADC. Regardez le flag C dans le registre P. S'il vaut 1 alors que vous ne le voulez pas, voilà votre bug.

**Bug 2 : Oublier SEC avant SBC**

Même principe, même solution. `SEC` avant `SBC`, toujours.

**Bug 3 : Pile déséquilibrée**

```asm
MA_ROUTINE:
    PHA
    LDX #5
    CPX #3
    BEQ @cas_special
    PLA
    RTS

@cas_special:
    ; ← OUBLI : PLA avant RTS !
    RTS   ; La pile est déséquilibrée → RTS retourne à la MAUVAISE adresse
```

**Comment le trouver :** Regardez SP avant et après l'appel à la routine. Il doit être identique. S'il a changé, une instruction PHA/PLA est déséquilibrée.

**Bug 4 : Branche trop longue**

```asm
BEQ LABEL_TRES_LOIN   ; ← Erreur : distance > 127 octets
```

ca65 le détecte à l'assemblage ("branch out of range"). Solution : utiliser un JMP intermédiaire :

```asm
BNE @pas_egal      ; Sauter si PAS égal (condition inverse)
JMP LABEL_TRES_LOIN
@pas_egal:
```

**Bug 5 : Accès mémoire hors limites**

```asm
LDX #200
STA $4800,X   ; $4800 + 200 = $4AC8 → dans les attributs couleur, pas le texte !
```

Calculez toujours vos adresses maximales. En mode texte, `$4800 + 32*32 - 1 = $4BFF`. Un X > 255 deborderait même en dehors de ce qu'on peut exprimer (X est sur 8 bits : il déborde modulo 256).

### 10.2 Technique de débogage : afficher des valeurs

La technique la plus simple : afficher la valeur suspecte à l'écran.

```asm
SYS_PRINT_HEX = $F027  ; A=valeur → affiche 2 chiffres hex à la position curseur
SYS_PRINT_NUM = $F024  ; A=valeur → affiche le nombre décimal

; Afficher BALLE_X pour comprendre ce qui se passe
LDA BALLE_X
JSR SYS_PRINT_HEX

; Afficher un label pour s'y retrouver
LDA #'X' : JSR SYS_PRINT_CHAR
LDA #'=' : JSR SYS_PRINT_CHAR
LDA BALLE_X : JSR SYS_PRINT_HEX
LDA #' ' : JSR SYS_PRINT_CHAR
LDA #'Y' : JSR SYS_PRINT_CHAR
LDA #'=' : JSR SYS_PRINT_CHAR
LDA BALLE_Y : JSR SYS_PRINT_HEX
```

Le `SYS_PRINT_HEX` est plus pratique que `SYS_PRINT_NUM` pour déboguer : vous voyez la représentation hexadécimale directe, ce qui correspond à ce que vous voyez dans le débogueur.

### 10.3 Les breakpoints et le débogueur Chuck-IDE

Chuck-IDE propose un débogueur avec :

- **Breakpoints** : Insérez `BRK` dans le code pour stopper l'exécution à cet endroit. Quand `BRK` est atteint, le débogueur affiche l'état complet des registres et de la mémoire.
- **Step** : Exécuter instruction par instruction.
- **Inspection mémoire** : Regarder n'importe quelle adresse en temps réel.
- **Registres** : A, X, Y, PC, SP, P en permanence.

```asm
; Insérer un point d'arrêt
DEBUT_TEST:
    LDA BALLE_X
    BRK             ; ← Le débogueur s'arrête ici
    ; À cet instant, regardez : A contient BALLE_X, PC pointe ici
    CMP #64
    BNE @pas_centre
```

**La lecture des flags P en binaire :**

Quand le débogueur affiche P, il montre souvent la valeur hexadécimale. Convertissez-la pour voir les flags : P = $25 = %00100101, soit C=1, Z=0, I=1, D=0, B=0, 1=1, V=0, N=0.

### 10.4 Bonnes pratiques : code lisible et maintenable

**Documenter les routines :**

```asm
; ════════════════════════════════════════════
; ROUTINE : CALCULER_ADRESSE_TEXTE
; Calcule l'adresse mémoire d'une case texte.
;
; Entrée :
;   X = colonne (0–31)
;   Y = ligne (0–31)
;
; Sortie :
;   Y = offset dans la mémoire texte
;   (adresse réelle = $4800 + Y)
;
; Modifie : A, Y
; Ne modifie pas : X
; ════════════════════════════════════════════
```

**Regrouper les constantes en tête de fichier :**

```asm
; ── Routines système ───────────────────────
SYS_SET_MODE    = $F01B
SYS_CLEAR       = $F000
SYS_DRAW_PIXEL  = $F003
SYS_DRAW_LINE   = $F006
SYS_WAIT_VBLANK = $F057
SYS_PLAY_NOTE   = $F036
SYS_PRINT_CHAR  = $F01E
SYS_PRINT_NUM   = $F024
SYS_PRINT_HEX   = $F027

; ── Registres hardware ─────────────────────
VPU_CTRL    = $D000
PAD1_STATE  = $D210
PAD_CTRL    = $D212
MOUSE_X     = $D220
MOUSE_Y     = $D221
KEY_ASCII   = $D200
KEY_STATUS  = $D201

; ── Palette ────────────────────────────────
COLOR_BLACK  = 0
COLOR_WHITE  = 1
COLOR_RED    = 2
COLOR_GREEN  = 5
COLOR_YELLOW = 7
```

**Nommer clairement les labels :**

```asm
; ❌ Noms opaques
L1:
    JMP L2
L2:
    BNE L3

; ✅ Noms descriptifs
BOUCLE_PRINCIPALE:
    JMP LIRE_ENTREES
LIRE_ENTREES:
    BNE PAS_DE_TOUCHE
```

**Les labels locaux avec `@` :**

```asm
MA_ROUTINE:
    LDA #0
    BEQ @cas_zero       ; Label local : visible seulement dans cette routine
    JMP @fin
@cas_zero:
    ; ...
@fin:
    RTS

AUTRE_ROUTINE:
    ; @cas_zero ici est différent de celui ci-dessus
```

### 10.5 Optimisation : quand et comment

**Règle d'or :** N'optimisez pas tant que le programme fonctionne. Un programme lent et correct est infiniment préférable à un programme rapide et faux.

**Quand optimiser :** Seulement si vous mesurez un vrai problème de performance (budget de cycles dépassé, scintillement visible).

**Comment mesurer :** Utilisez le compteur de cycles du débogueur. Mesurez votre routine critique au début et à la fin pour compter les cycles consommés.

**Optimisations courantes :**

```asm
; ❌ Lent : variable en RAM normale (4 cycles)
LDA $0200
; ✅ Rapide : variable en Zero Page (3 cycles)
LDA $10

; ❌ Lent : multiplier par 8 avec additions
; A*8 = A+A+A+A+A+A+A+A → 7 ADC = 14 cycles
; ✅ Rapide : trois décalages
ASL A   ; *2
ASL A   ; *4
ASL A   ; *8   → 6 cycles

; ❌ Lent : lire la même case mémoire deux fois
LDA BALLE_X : STA $10
LDA BALLE_X : JSR UTILISER_X
; ✅ Rapide : une seule lecture
LDA BALLE_X : STA $10 : JSR UTILISER_X
```

---

### 📝 Exercice 9 — Débogage guidé

**A. Trouver le bug**

Le programme suivant est censé afficher "HI" en ligne 0 mais affiche quelque chose d'incorrect. Trouvez et corrigez les deux bugs :

```asm
SYS_SET_MODE = $F01B

.org $E000
RESET:
    LDA #0 : JSR SYS_SET_MODE

    ; Afficher 'H' en (0, 0)
    LDA #$48
    STA $4800

    ; Afficher 'I' en (1, 0)
    LDA #$49
    STA $4801

    ; Couleur rouge sur noir pour H : INK=2, PAPER=0 → %00000010
    LDA #%00000010
    STA $4C00

    ; Couleur pour I : INK=7 (jaune) sur PAPER=3 (cyan) → ???
    LDA #%00110111    ; ← BUG ICI ?
    STA $4C00         ; ← BUG ICI ?

    JMP *

.org $FFFC
.word RESET
```

*Indice 1 :* L'octet couleur est `PAPER*16 + INK`. Vérifiez le calcul pour "jaune sur cyan".
*Indice 2 :* Les deux attributs couleur doivent aller à des adresses différentes.

**B. Profiler la boucle**

Dans votre programme Pong, mesurez combien de cycles prend la routine `DESSINER`. Si elle dépasse 8000 cycles (environ la moitié du budget à 60 Hz), cherchez où réduire.

**C. (Bonus) Corriger la mélodie**

Reprenez le code "bugué" de la mélodie du chapitre 6 (avec le conflit entre X=index et X=voix). Proposez deux solutions différentes et implémentez celle que vous préférez.

---

## Annexe A — Tableau de référence rapide

### Instructions les plus utilisées

| Instruction | Effet | Flags modifiés |
|-------------|-------|----------------|
| `LDA #val` | A ← val | N, Z |
| `STA addr` | mem[addr] ← A | — |
| `LDX #val` / `LDY #val` | X/Y ← val | N, Z |
| `STX` / `STY` | mem ← X/Y | — |
| `TAX` / `TAY` | X/Y ← A | N, Z |
| `TXA` / `TYA` | A ← X/Y | N, Z |
| `PHA` / `PLA` | Empile/dépile A | (PLA: N, Z) |
| `CLC` : `ADC #n` | A ← A + n | N, Z, C, V |
| `SEC` : `SBC #n` | A ← A - n | N, Z, C, V |
| `AND #mask` | A ← A & mask | N, Z |
| `ORA #mask` | A ← A \| mask | N, Z |
| `EOR #mask` | A ← A ^ mask | N, Z |
| `ASL A` | A ← A * 2 | N, Z, C |
| `LSR A` | A ← A / 2 | N, Z, C |
| `CMP #val` | A - val (sans stocker) | N, Z, C |
| `BEQ label` | Sauter si Z=1 | — |
| `BNE label` | Sauter si Z=0 | — |
| `BCC label` | Sauter si C=0 (< non signé) | — |
| `BCS label` | Sauter si C=1 (>= non signé) | — |
| `BMI label` | Sauter si N=1 (négatif) | — |
| `BPL label` | Sauter si N=0 (positif) | — |
| `JSR addr` | Appel de routine | — |
| `RTS` | Retour de routine | — |
| `RTI` | Retour d'interruption | — |
| `INX` / `INY` | X/Y ← X/Y + 1 | N, Z |
| `DEX` / `DEY` | X/Y ← X/Y - 1 | N, Z |
| `SEI` / `CLI` | Bloquer/débloquer les IRQ | I |
| `JMP addr` | Saut absolu inconditionnel | — |
| `NOP` | Ne rien faire (2 cycles) | — |
| `BRK` | Breakpoint (arrêt dans IDE) | — |

### Adresses clés du Chuck-8

| Plage | Description |
|-------|-------------|
| `$0010–$007F` | Variables Zero Page (vos variables rapides) |
| `$0080–$008F` | Paramètres ABI pour les routines système |
| `$00F0–$00FF` | Pointeurs ZP 16 bits |
| `$0200–$03FF` | RAM programme (variables globales) |
| `$0400–$3FFF` | RAM libre (données, buffers) |
| `$4000–$5FFF` | Framebuffer A / Mémoire texte+sprites |
| `$4800–$4BFF` | Mémoire texte 32×32 (alias dans FB-A) |
| `$4C00–$4FFF` | Attributs couleur texte (alias dans FB-A) |
| `$5000–$5FFF` | Sprite Data (alias dans FB-A) |
| `$6000–$7FFF` | Framebuffer B |
| `$D000` | VPU_CTRL |
| `$D100–$D117` | SPU voix 0, 1, 2 |
| `$D200` | KEY_ASCII |
| `$D201` | KEY_STATUS |
| `$D210` | PAD1_STATE |
| `$D220` | MOUSE_X |
| `$E000` | Point d'entrée du programme |
| `$F000–$F06F` | Jump table API (37 routines) |
| `$FFFA–$FFFF` | Vecteurs NMI / RESET / IRQ |

### API système : adresses des routines

| Routine | Adresse | Paramètres |
|---------|---------|-----------|
| `SYS_CLEAR` | `$F000` | A = couleur |
| `SYS_DRAW_PIXEL` | `$F003` | A=couleur, X=x, Y=y |
| `SYS_DRAW_LINE` | `$F006` | A=couleur, $80=x1, $81=y1, $82=x2, $83=y2 |
| `SYS_DRAW_RECT` | `$F009` | A=couleur, $80=x, $81=y, $82=w, $83=h |
| `SYS_FILL_RECT` | `$F00C` | A=couleur, $80=x, $81=y, $82=w, $83=h |
| `SYS_DRAW_TEXT` | `$F00F` | A=couleur, X=x, Y=y, $80/$81=adresse |
| `SYS_FLIP` | `$F012` | — |
| `SYS_SET_MODE` | `$F01B` | A=mode (0=texte, 1=gfx) |
| `SYS_PRINT_CHAR` | `$F01E` | A=caractère |
| `SYS_PRINT_STR` | `$F021` | $80/$81=adresse chaîne |
| `SYS_PRINT_NUM` | `$F024` | A=nombre (0–255) |
| `SYS_PRINT_HEX` | `$F027` | A=valeur → affiche 2 hex |
| `SYS_PLAY_NOTE` | `$F036` | A=note MIDI, X=voix, $80=durée |
| `SYS_STOP_VOICE` | `$F039` | X=voix |
| `SYS_STOP_ALL` | `$F03C` | — |
| `SYS_GET_RAND` | `$F05A` | → A=valeur aléatoire 0–255 |
| `SYS_WAIT_VBLANK` | `$F057` | Bloque jusqu'au prochain VBlank |
| `SYS_MEMSET` | `$F060` | $80/$81=addr, A=valeur, X=longueur |

---

## Annexe B — Template de départ

Copiez ce template pour commencer n'importe quel programme :

```asm
; ╔═══════════════════════════════════════════════╗
; ║  NOM DU PROGRAMME                             ║
; ║  Description courte                           ║
; ╚═══════════════════════════════════════════════╝

; ── Routines système ──────────────────────────────
SYS_SET_MODE    = $F01B
SYS_CLEAR       = $F000
SYS_DRAW_PIXEL  = $F003
SYS_DRAW_LINE   = $F006
SYS_WAIT_VBLANK = $F057
SYS_PRINT_CHAR  = $F01E
SYS_PRINT_NUM   = $F024

; ── Registres hardware ────────────────────────────
VPU_CTRL    = $D000
PAD1_STATE  = $D210
PAD_CTRL    = $D212
KEY_ASCII   = $D200
KEY_STATUS  = $D201
MOUSE_X     = $D220
MOUSE_Y     = $D221
MOUSE_BTN   = $D224

; ── Couleurs ──────────────────────────────────────
COLOR_BLACK  = 0
COLOR_WHITE  = 1
COLOR_RED    = 2

; ── Variables en RAM ──────────────────────────────
.org $0200
; VARIABLE: .res 1

; ── Code principal ────────────────────────────────
.org $E000

RESET:
    ; Initialisation

BOUCLE:
    JSR SYS_WAIT_VBLANK

    ; Logique ici

    ; Demander le swap
    LDA VPU_CTRL
    ORA #%00000010
    STA VPU_CTRL

    JMP BOUCLE

; ── Vecteur de démarrage ──────────────────────────
.org $FFFC
.word RESET
```

---

## Annexe C — Notes MIDI utiles

| Note | MIDI | Hz approx |
|------|------|-----------|
| Do3 | 48 | 131 |
| Sol3 | 55 | 196 |
| Do4 | 60 | 262 |
| Mi4 | 64 | 330 |
| Sol4 | 67 | 392 |
| La4 | 69 | 440 |
| Do5 | 72 | 523 |
| Mi5 | 76 | 659 |
| Sol5 | 79 | 784 |

Chaque demi-ton = +1. Une octave = +12.

---

*Formation Chuck-8 v1.0 — Conforme aux spécifications Chuck-8 v1.1*