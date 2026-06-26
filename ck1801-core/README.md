# ck1801-core

Cœur émulateur de l'ISA **CK-1801** (console fictive Chuck-8), implémentation
normative de `CK-1801_reference.md` **v2.0.1-FINAL**.

## Statut

**Cœur CPU : prêt pour la production.** Périmètre couvert et durci :

- décodeur basé sur la **table plate générée** (Annexe A) — source unique
  `data/opcodes.tsv`, aucune divergence possible entre décodage et assemblage ;
- ALU factorisée avec sémantique **borrow unifiée** (§2.1), règle V exacte (§2.2) ;
- flags par instruction conformes au tableau §2.3 ;
- comptage de cycles exact (§5–§12), branchements pris/non pris ;
- pile (§12) avec wrap + `STKERR` (§13) ;
- contrôle de flux complet (§11), interruptions §15 (entrée + `RET` conditionnel) ;
- séquence de boot §14 (dont `VPU_MODE←0`) ;
- mémoire 64 Kio conforme §16, règles déterministes §13 (zone clavier RO, $D309 RO,
  zone non mappée → $00) ;
- **garantie « zéro panic »** sur toute entrée programme (§13, Annexe C), prouvée
  exhaustivement (voir Tests).

**Hors périmètre de ce module** (à venir séparément) : périphériques VPU/SPU/I-O,
routines `SYS` (effets vidéo/son), RNG/LFSR système, timer matériel, cible WASM.
`SYS #n` est présent au niveau ISA et coûte ses **8 cycles de base** sans exécuter
de routine (§18), conformément à la spec ; `SEI`/`CLI` pilotent le masque d'IRQ.

## Architecture

```
data/gen_opcodes.py   Génère opcodes.tsv (source unique, vérifiée sans collision)
data/opcodes.tsv      Table plate normative (177 opcodes, 79 réservés)
build.rs              Génère depuis le TSV : table de décodage OPCODES,
                      table d'assemblage ASM_RESOLVE, tailles OP_SIZES
src/isa.rs            Types ISA (Reg, Mnemonic, Mode, OpInfo, flags)
src/alu.rs            ALU factorisée (add_core/sub_core, borrow par complément)
src/memory.rs         Bus mémoire 64 Kio + règles §13 + drapeaux debug $D309
src/cpu.rs            État CPU, décodeur, boucle d'exécution, interruptions
src/asm/              Assembleur (lexer, parser 2 passes, émission little-endian)
```

## Conformité — décisions tranchées pendant l'implémentation

Toutes répercutées dans la spec (v2.0.1-FINAL), sans changement de comportement :

1. **HLT** : coût = cycles jusqu'à la prochaine frontière VBlank ; cadence VBlank
   fournie par le harnais ; reprise à l'instruction suivante (pas un arrêt).
2. **Sortie d'interruption** : pas de `RTI` ; `RET` restaure FL ssi l'entrée était
   une interruption (marqueur `is_irq` empilé).
3. **SYS** : `8 + cycles(routine)` ; au stade cœur, seules les 8 cycles de base.
4. **ROL/ROR** : rotation 9 bits à travers C (le C entrant entre dans le bit libéré).

## Tests

`cargo test -p ck1801-core` — **61 tests**, dont :

- `alu_flags` : balayages **exhaustifs** 256×256 de l'ALU contre un oracle
  indépendant (add/sub/borrow/V), table de flags §2.3 ;
- `coverage` : **chaque mnémonique** (42/42) exercé par un test d'exécution réel ;
- `execution` : cycles exacts, pièges (destination à droite, carry=borrow,
  IX sans flags), cas limites §13, JSR/RET, interruptions ;
- `assembler` : round-trips assemblage→exécution prouvant la cohérence
  émission/décodage ;
- `hardening` : **preuve exhaustive d'absence de panic** sur les 256 opcodes ×
  états × queues d'octets ; fuzz de 400 programmes aléatoires × 5000 pas ;
  déterminisme (même entrée → même état) ; conformité boot §14.

La CI (`.github/workflows/build-core.yml`) impose en plus : `clippy -D warnings`,
`rustfmt --check`, build release, et vérifie que `opcodes.tsv` reste régénérable
depuis le générateur (anti-divergence de la source unique).

## Limitations connues

- L'assembleur est volontairement minimal : expressions à un seul terme (pas
  d'arithmétique `LABEL+n`), pas de `.equ`, choix zp/abs auto sur valeur littérale
  (un label est traité en 16 bits). Suffisant pour tester le cœur ; à étoffer pour
  des programmes réels.
- Couverture instrumentée (tarpaulin) à exécuter en CI sur toolchain récente ;
  l'environnement de développement initial était limité à Rust 1.75.
