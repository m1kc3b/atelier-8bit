/* ─────────────────────────────────────────────────────────────
   Chuck IDE — components/chuck-editor.ts
   Web Component <chuck-editor>
   Tâche 3.1 — CodeMirror 6 intégré dans le Shadow DOM
   Tâche 3.2 — Coloration syntaxique ASM 6502 + breakpoints gutter
   Tâche 6.2 — Export .asm
   ───────────────────────────────────────────────────────────── */

import { ChuckComponent } from "../core/base-component.js";

// ── CodeMirror 6 ─────────────────────────────────────────────
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  rectangularSelection,
  crosshairCursor,
  gutter,
  GutterMarker,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  indentOnInput,
  syntaxHighlighting,
  HighlightStyle,
} from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { StateField, StateEffect, RangeSet } from "@codemirror/state";
import { tags as t } from "@lezer/highlight";
import { StreamLanguage, type StreamParser } from "@codemirror/language";

// ─────────────────────────────────────────────────────────────
// TÂCHE 3.2 — Grammaire ASM 6502 (StreamParser)
// ─────────────────────────────────────────────────────────────

const OPCODES_6502 = new Set([
  "ADC",
  "AND",
  "ASL",
  "BCC",
  "BCS",
  "BEQ",
  "BIT",
  "BMI",
  "BNE",
  "BPL",
  "BRK",
  "BVC",
  "BVS",
  "CLC",
  "CLD",
  "CLI",
  "CLV",
  "CMP",
  "CPX",
  "CPY",
  "DEC",
  "DEX",
  "DEY",
  "EOR",
  "INC",
  "INX",
  "INY",
  "JMP",
  "JSR",
  "LDA",
  "LDX",
  "LDY",
  "LSR",
  "NOP",
  "ORA",
  "PHA",
  "PHP",
  "PLA",
  "PLP",
  "ROL",
  "ROR",
  "RTI",
  "RTS",
  "SBC",
  "SEC",
  "SED",
  "SEI",
  "STA",
  "STX",
  "STY",
  "TAX",
  "TAY",
  "TSX",
  "TXA",
  "TXS",
  "TYA",
]);

const asm6502Parser: StreamParser<null> = {
  name: "asm6502",
  startState: () => null,
  token(stream) {
    // Commentaires
    if (stream.match(/^;.*/)) return "comment";
    // Whitespace
    if (stream.eatSpace()) return null;
    // Labels (mot suivi de :)
    if (stream.match(/^[A-Za-z_][A-Za-z0-9_]*(?=\s*:)/)) return "labelName";
    // Mnémoniques
    const opMatch = stream.match(/^([A-Za-z]{2,4})/);
    if (opMatch) {
      if (OPCODES_6502.has((opMatch as RegExpMatchArray)[0].toUpperCase()))
        return "keyword";
      return "variableName";
    }
    // Adresse hex $xxxx
    if (stream.match(/^\$[0-9a-fA-F]+/)) return "number";
    // Binaire %xxxxxxxx
    if (stream.match(/^%[01]+/)) return "number";
    // Décimal
    if (stream.match(/^\d+/)) return "number";
    // Chaîne / char
    if (stream.match(/^'.'|^"[^"]*"/)) return "string";
    // Directives .byte .org DCB
    if (stream.match(/^\.[A-Za-z]+/)) return "meta";
    if (stream.match(/^(?:DCB|DB)\b/i)) return "meta";
    // Registres X Y A
    if (stream.match(/^[XYA](?=\s*[,);\n]|$)/)) return "typeName";
    // Opérateurs & ponctuation
    if (stream.match(/^[#(),]/)) return "operator";
    stream.next();
    return null;
  },
};

const asm6502Language = StreamLanguage.define(asm6502Parser);

// Mapping tokens → highlight style
const chuckHighlight = HighlightStyle.define([
  { tag: t.comment, color: "#3dd68c", fontStyle: "italic" },
  { tag: t.keyword, color: "#569cd6", fontWeight: "600" }, // opcodes
  { tag: t.number, color: "#b5cea8" }, // hex/dec/bin
  { tag: t.string, color: "#ce9178" },
  { tag: t.meta, color: "#c586c0" }, // directives
  { tag: t.labelName, color: "#dcdcaa" }, // labels
  { tag: t.typeName, color: "#4ec9b0" }, // X Y A
  { tag: t.operator, color: "#d4d4d4" },
  { tag: t.variableName, color: "#9cdcfe" },
]);

// ─────────────────────────────────────────────────────────────
// TÂCHE 3.2 — Gutter Breakpoints
// ─────────────────────────────────────────────────────────────

// Marqueur visuel — rond rouge dans la gouttière
class BreakpointMarker extends GutterMarker {
  toDOM(): Text {
    const span = document.createElement("span");
    span.className = "bp-dot";
    return span as unknown as Text;
  }
}
const bpMarker = new BreakpointMarker();

// StateEffect pour ajouter/supprimer un breakpoint
const toggleBreakpoint = StateEffect.define<number>(); // line number (1-based)

// StateField qui maintient le Set des lignes avec breakpoint
const breakpointField = StateField.define<RangeSet<GutterMarker>>({
  create: () => RangeSet.empty,
  update(markers, tr) {
    markers = markers.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(toggleBreakpoint)) {
        const line = tr.state.doc.line(effect.value);
        let found = false;
        markers.between(line.from, line.from, () => {
          found = true;
        });
        markers = found
          ? markers.update({ filter: (from) => from !== line.from })
          : markers.update({ add: [bpMarker.range(line.from)] });
      }
    }
    return markers;
  },
});

// Gouttière breakpoint — clic pour toggler
const breakpointGutter = gutter({
  class: "cm-breakpoints",
  markers: (view) => view.state.field(breakpointField),
  initialSpacer: () => bpMarker,
  domEventHandlers: {
    mousedown(view, line) {
      view.dispatch({
        effects: toggleBreakpoint.of(view.state.doc.lineAt(line.from).number),
      });
      return true;
    },
  },
});

// ─────────────────────────────────────────────────────────────
// Thème CodeMirror (aligné sur les tokens CSS de Chuck IDE)
// ─────────────────────────────────────────────────────────────

const chuckTheme = EditorView.theme(
  {
    "&": {
      fontSize: "13px",
      height: "100%",
      background: "var(--bg, #0f0f0f)",
      color: "var(--text, #e2e2e2)",
      fontFamily:
        "'JetBrains Mono','Fira Code','Cascadia Code','Consolas',monospace",
    },
    ".cm-content": {
      caretColor: "var(--accent, #7c6af7)",
      padding: "0",
      lineHeight: "1.75",
    },
    ".cm-scroller": { overflow: "auto" },
    ".cm-focused": { outline: "none" },

    // Sélection
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      background: "rgba(124,106,247,0.25)",
    },
    ".cm-selectionMatch": { background: "rgba(124,106,247,0.15)" },

    // Ligne active
    ".cm-activeLine": { background: "rgba(255,255,255,0.03)" },
    ".cm-activeLineGutter": { background: "rgba(255,255,255,0.04)" },

    // Numéros de ligne
    ".cm-lineNumbers": {
      color: "var(--text-muted, #555)",
      minWidth: "42px",
      paddingRight: "8px",
    },
    ".cm-lineNumbers .cm-activeLineGutter": {
      color: "var(--text-dim, #999)",
    },

    // Gouttière principale
    ".cm-gutters": {
      background: "var(--bg, #0f0f0f)",
      borderRight: "1px solid var(--border, #2a2a2a)",
      color: "var(--text-muted, #555)",
    },

    // Gutter breakpoints
    ".cm-breakpoints": {
      width: "16px",
      paddingLeft: "2px",
      cursor: "pointer",
    },
    ".bp-dot": {
      display: "inline-block",
      width: "10px",
      height: "10px",
      borderRadius: "50%",
      background: "#f87171",
      boxShadow: "0 0 4px #f87171aa",
      marginTop: "5px",
    },

    // Curseur
    ".cm-cursor": { borderLeftColor: "var(--accent, #7c6af7)" },

    // Scrollbar
    ".cm-scroller::-webkit-scrollbar": { width: "6px", height: "6px" },
    ".cm-scroller::-webkit-scrollbar-track": { background: "transparent" },
    ".cm-scroller::-webkit-scrollbar-thumb": {
      background: "#2f2f2f",
      borderRadius: "3px",
    },
  },
  { dark: true },
);

// ─────────────────────────────────────────────────────────────
// Autocompletion — opcodes 6502
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// Descriptions des opcodes pour l'autocomplétion
// ─────────────────────────────────────────────────────────────
const OPCODE_DOCS: Record<string, { detail: string; info: string }> = {
  // Chargement
  LDA: {
    detail: "Charge → A",
    info: "LDA val — Charge une valeur dans l'Accumulateur. Flags: N, Z",
  },
  LDX: {
    detail: "Charge → X",
    info: "LDX val — Charge une valeur dans le registre X. Flags: N, Z",
  },
  LDY: {
    detail: "Charge → Y",
    info: "LDY val — Charge une valeur dans le registre Y. Flags: N, Z",
  },
  // Stockage
  STA: {
    detail: "Stocke A → mém",
    info: "STA addr — Écrit l'Accumulateur en mémoire.",
  },
  STX: {
    detail: "Stocke X → mém",
    info: "STX addr — Écrit le registre X en mémoire.",
  },
  STY: {
    detail: "Stocke Y → mém",
    info: "STY addr — Écrit le registre Y en mémoire.",
  },
  // Transferts
  TAX: { detail: "A → X", info: "TAX — Copie A dans X. Flags: N, Z" },
  TAY: { detail: "A → Y", info: "TAY — Copie A dans Y. Flags: N, Z" },
  TXA: { detail: "X → A", info: "TXA — Copie X dans A. Flags: N, Z" },
  TYA: { detail: "Y → A", info: "TYA — Copie Y dans A. Flags: N, Z" },
  TXS: { detail: "X → SP", info: "TXS — Copie X dans le Stack Pointer." },
  TSX: {
    detail: "SP → X",
    info: "TSX — Copie le Stack Pointer dans X. Flags: N, Z",
  },
  // Arithmétique
  ADC: {
    detail: "A + val + C → A",
    info: "ADC val — Addition avec Carry. Toujours CLC avant ! Flags: N, V, Z, C",
  },
  SBC: {
    detail: "A - val - C → A",
    info: "SBC val — Soustraction avec Carry. Toujours SEC avant ! Flags: N, V, Z, C",
  },
  // Incréments
  INX: { detail: "X + 1", info: "INX — Incrémente X de 1. Flags: N, Z" },
  INY: { detail: "Y + 1", info: "INY — Incrémente Y de 1. Flags: N, Z" },
  DEX: { detail: "X - 1", info: "DEX — Décrémente X de 1. Flags: N, Z" },
  DEY: { detail: "Y - 1", info: "DEY — Décrémente Y de 1. Flags: N, Z" },
  INC: {
    detail: "mém + 1",
    info: "INC addr — Incrémente une valeur en mémoire. Flags: N, Z",
  },
  DEC: {
    detail: "mém - 1",
    info: "DEC addr — Décrémente une valeur en mémoire. Flags: N, Z",
  },
  // Comparaisons
  CMP: {
    detail: "Compare A",
    info: "CMP val — Compare A sans modifier A. Flags: N, Z, C",
  },
  CPX: {
    detail: "Compare X",
    info: "CPX val — Compare X sans modifier X. Flags: N, Z, C",
  },
  CPY: {
    detail: "Compare Y",
    info: "CPY val — Compare Y sans modifier Y. Flags: N, Z, C",
  },
  // Sauts
  JMP: {
    detail: "Saute à label",
    info: "JMP addr — Saut inconditionnel. Ex: JMP BOUCLE",
  },
  JSR: {
    detail: "Appelle fonction",
    info: "JSR addr — Jump to Subroutine. Sauvegarde PC sur la pile.",
  },
  RTS: {
    detail: "Retour fonction",
    info: "RTS — Return from Subroutine. Récupère PC depuis la pile.",
  },
  RTI: {
    detail: "Retour interrupt",
    info: "RTI — Return from Interrupt. Restaure PC et P depuis la pile.",
  },
  // Branchements
  BEQ: {
    detail: "Saute si Z=1",
    info: 'BEQ label — Saute si résultat nul (Z=1). "Branch if Equal"',
  },
  BNE: {
    detail: "Saute si Z=0",
    info: 'BNE label — Saute si résultat non nul (Z=0). "Branch if Not Equal"',
  },
  BCC: {
    detail: "Saute si C=0",
    info: 'BCC label — Saute si Carry clair (A < val). "Branch if Carry Clear"',
  },
  BCS: {
    detail: "Saute si C=1",
    info: 'BCS label — Saute si Carry positionné. "Branch if Carry Set"',
  },
  BMI: {
    detail: "Saute si N=1",
    info: 'BMI label — Saute si négatif (bit 7 = 1). "Branch if Minus"',
  },
  BPL: {
    detail: "Saute si N=0",
    info: 'BPL label — Saute si positif (bit 7 = 0). "Branch if Plus"',
  },
  BVC: {
    detail: "Saute si V=0",
    info: "BVC label — Saute si pas de débordement signé.",
  },
  BVS: {
    detail: "Saute si V=1",
    info: "BVS label — Saute si débordement signé.",
  },
  // Logique
  AND: {
    detail: "A ET val → A",
    info: "AND val — ET logique bit à bit. Masque les bits. Flags: N, Z",
  },
  ORA: {
    detail: "A OU val → A",
    info: "ORA val — OU inclusif bit à bit. Fusionne les bits. Flags: N, Z",
  },
  EOR: {
    detail: "A XOR val → A",
    info: "EOR val — OU exclusif. Inverse les bits masqués. Flags: N, Z",
  },
  BIT: {
    detail: "Test bits",
    info: "BIT addr — Teste les bits sans modifier A. Flags: N=bit7, V=bit6, Z=A&mém",
  },
  // Décalages
  ASL: {
    detail: "Déc gauche × 2",
    info: "ASL — Décalage gauche = × 2. Bit 7 → Carry. Flags: N, Z, C",
  },
  LSR: {
    detail: "Déc droite ÷ 2",
    info: "LSR — Décalage droit = ÷ 2. Bit 0 → Carry. Flags: N, Z, C",
  },
  ROL: {
    detail: "Rotation gauche",
    info: "ROL — Rotation gauche. Carry → bit 0, bit 7 → Carry.",
  },
  ROR: {
    detail: "Rotation droite",
    info: "ROR — Rotation droite. Carry → bit 7, bit 0 → Carry.",
  },
  // Pile
  PHA: { detail: "A → pile", info: "PHA — Push A sur la pile. Sauvegarde A." },
  PLA: {
    detail: "pile → A",
    info: "PLA — Pull A depuis la pile. Restaure A. Flags: N, Z",
  },
  PHP: { detail: "P → pile", info: "PHP — Push Processor Status sur la pile." },
  PLP: {
    detail: "pile → P",
    info: "PLP — Pull Processor Status depuis la pile.",
  },
  // Flags
  CLC: {
    detail: "Efface Carry",
    info: "CLC — Clear Carry. Toujours avant ADC !",
  },
  SEC: {
    detail: "Active Carry",
    info: "SEC — Set Carry. Toujours avant SBC !",
  },
  CLV: { detail: "Efface oVerflow", info: "CLV — Clear oVerflow flag." },
  CLD: { detail: "Efface Decimal", info: "CLD — Clear Decimal mode." },
  SED: { detail: "Active Decimal", info: "SED — Set Decimal mode (BCD)." },
  CLI: { detail: "Efface Interrupt", info: "CLI — Clear Interrupt disable." },
  SEI: { detail: "Active Interrupt", info: "SEI — Set Interrupt disable." },
  // Contrôle
  NOP: {
    detail: "Ne fait rien",
    info: "NOP — No Operation. Gaspille 2 cycles CPU.",
  },
  BRK: {
    detail: "Arrêt",
    info: "BRK — Break. Arrête le programme dans Chuck IDE.",
  },
};

const opcodeCompletions = [...OPCODES_6502].sort().map((op) => {
  const doc = OPCODE_DOCS[op];
  return {
    label: op,
    type: "keyword",
    detail: doc?.detail ?? "Instruction 6502",
    info: doc?.info ?? `Instruction 6502 : ${op}`,
  };
});

// ── Constantes Chuck-8 Platform pour l'autocomplétion ────────────────────────
const CHUCK8_COMPLETIONS = [
  // ── API Système ─────────────────────────────────────────────
  {
    label: "SYS_CLEAR",
    detail: "$F000 · efface écran",
    info: "JSR SYS_CLEAR — A=couleur. Efface le framebuffer.",
  },
  {
    label: "SYS_DRAW_PIXEL",
    detail: "$F003 · dessine pixel",
    info: "JSR SYS_DRAW_PIXEL — A=couleur, X=px, Y=py.",
  },
  {
    label: "SYS_DRAW_LINE",
    detail: "$F006 · ligne",
    info: "JSR SYS_DRAW_LINE — A=couleur, $80/$81=x0/y0, $82/$83=x1/y1.",
  },
  {
    label: "SYS_DRAW_RECT",
    detail: "$F009 · rectangle",
    info: "JSR SYS_DRAW_RECT — A=couleur, $80=x $81=y $82=w $83=h (contour).",
  },
  {
    label: "SYS_FILL_RECT",
    detail: "$F00C · rect rempli",
    info: "JSR SYS_FILL_RECT — mêmes paramètres que DRAW_RECT.",
  },
  {
    label: "SYS_FLIP",
    detail: "$F018 · swap buffers",
    info: "JSR SYS_FLIP — Swap framebuffer A↔B au prochain VBlank.",
  },
  {
    label: "SYS_SET_MODE",
    detail: "$F01B · mode vidéo",
    info: "JSR SYS_SET_MODE — A=0 (texte) A=1 (graphique).",
  },
  {
    label: "SYS_PRINT_CHAR",
    detail: "$F01E · affiche char",
    info: "JSR SYS_PRINT_CHAR — A=char ASCII. Avance le curseur.",
  },
  {
    label: "SYS_PRINT_STR",
    detail: "$F021 · affiche chaîne",
    info: "JSR SYS_PRINT_STR — $80/$81=adresse chaîne null-terminated.",
  },
  {
    label: "SYS_PRINT_NUM",
    detail: "$F024 · affiche nombre",
    info: "JSR SYS_PRINT_NUM — A=entier 8-bit en décimal.",
  },
  {
    label: "SYS_PRINT_HEX",
    detail: "$F027 · affiche hex",
    info: 'JSR SYS_PRINT_HEX — A=valeur → affiche "$XX".',
  },
  {
    label: "SYS_SET_CURSOR",
    detail: "$F02A · positionne curseur",
    info: "JSR SYS_SET_CURSOR — X=colonne, Y=ligne (mode texte).",
  },
  {
    label: "SYS_SET_COLOR",
    detail: "$F030 · couleur texte",
    info: "JSR SYS_SET_COLOR — A=ink<<4|paper. Bits 7-4=ink, bits 3-0=paper.",
  },
  {
    label: "SYS_SCROLL_UP",
    detail: "$F033 · scroll texte",
    info: "JSR SYS_SCROLL_UP — Fait défiler le texte d'une ligne.",
  },
  {
    label: "SYS_PLAY_NOTE",
    detail: "$F036 · joue note",
    info: "JSR SYS_PLAY_NOTE — A=note MIDI (21-108), X=voix, $80=durée.",
  },
  {
    label: "SYS_STOP_VOICE",
    detail: "$F039 · arrête voix",
    info: "JSR SYS_STOP_VOICE — X=voix (0-2).",
  },
  {
    label: "SYS_STOP_ALL",
    detail: "$F03C · arrête tout",
    info: "JSR SYS_STOP_ALL — Coupe toutes les voix.",
  },
  {
    label: "SYS_READ_PAD",
    detail: "$F048 · lit manette",
    info: "JSR SYS_READ_PAD — A=0 (pad1) ou 1 (pad2). Retourne état dans A.",
  },
  {
    label: "SYS_READ_KEY",
    detail: "$F04B · lit clavier",
    info: "JSR SYS_READ_KEY — Retourne ASCII dans A (0 si aucune touche).",
  },
  {
    label: "SYS_WAIT_KEY",
    detail: "$F04E · attend touche",
    info: "JSR SYS_WAIT_KEY — Bloque jusqu'à pression. Retourne ASCII dans A.",
  },
  {
    label: "SYS_READ_MOUSE",
    detail: "$F051 · lit souris",
    info: "JSR SYS_READ_MOUSE — Retourne X=mouseX, Y=mouseY, A=boutons.",
  },
  {
    label: "SYS_WAIT_VBLANK",
    detail: "$F057 · sync 60 Hz",
    info: "JSR SYS_WAIT_VBLANK — Bloque jusqu'au prochain VBlank (NMI). Sync frame.",
  },
  {
    label: "SYS_RAND",
    detail: "$F05A · octet aléatoire",
    info: "JSR SYS_RAND — Retourne octet pseudo-aléatoire dans A.",
  },
  {
    label: "SYS_RAND16",
    detail: "$F05D · 16-bit aléatoire",
    info: "JSR SYS_RAND16 — Retourne 16-bit dans A (lo) + X (hi).",
  },
  {
    label: "SYS_MEMCPY",
    detail: "$F060 · copie mémoire",
    info: "JSR SYS_MEMCPY — $80/$81=src, $82/$83=dst, $84/$85=len.",
  },
  {
    label: "SYS_MEMSET",
    detail: "$F063 · remplit mémoire",
    info: "JSR SYS_MEMSET — $80/$81=dst, A=val, $82/$83=len.",
  },
  {
    label: "SYS_FRAME_NUM",
    detail: "$F069 · numéro frame",
    info: "JSR SYS_FRAME_NUM — Retourne compteur frames: A=lo, X=hi.",
  },
  // ── Registres VPU ───────────────────────────────────────────
  {
    label: "VPU_CTRL",
    detail: "$D000 · contrôle VPU",
    info: "bit7=enable, bit1=flip, bit0=mode(0=TXT/1=GFX).",
  },
  {
    label: "VPU_BORDER",
    detail: "$D001 · couleur bordure",
    info: "Couleur de la bordure (0-15).",
  },
  {
    label: "VPU_SCROLL_X",
    detail: "$D002 · scroll X",
    info: "Décalage horizontal 0-127 (mode gfx).",
  },
  {
    label: "VPU_SCROLL_Y",
    detail: "$D003 · scroll Y",
    info: "Décalage vertical 0-127.",
  },
  {
    label: "VPU_STATUS",
    detail: "$D004 · état VPU",
    info: "Lecture : bit7=vblank, bit0=frame pair/impair.",
  },
  {
    label: "VPU_CURSOR_X",
    detail: "$D00B · curseur col",
    info: "Colonne du curseur texte (0-31).",
  },
  {
    label: "VPU_CURSOR_Y",
    detail: "$D00C · curseur ligne",
    info: "Ligne du curseur texte (0-31).",
  },
  {
    label: "VPU_INK",
    detail: "$D00D · couleur texte",
    info: "Couleur du texte (0-15).",
  },
  {
    label: "VPU_PAPER",
    detail: "$D00E · couleur fond",
    info: "Couleur du fond texte (0-15).",
  },
  {
    label: "VPU_CHAR_OUT",
    detail: "$D00F · char direct",
    info: "STA VPU_CHAR_OUT — affiche le char A au curseur et avance.",
  },
  // ── Registres INPUT ─────────────────────────────────────────
  {
    label: "KEY_ASCII",
    detail: "$D200 · touche ASCII",
    info: "Lecture : code ASCII de la touche courante (0 si aucune).",
  },
  {
    label: "KEY_STATUS",
    detail: "$D201 · état clavier",
    info: "bit7=touche enfoncée. Écriture $00 = acquitter.",
  },
  {
    label: "KEY_MOD",
    detail: "$D202 · modificateurs",
    info: "bit0=Shift, bit1=Ctrl, bit2=Alt.",
  },
  {
    label: "PAD1_STATE",
    detail: "$D210 · manette 1",
    info: "Bits PAD_A PAD_B PAD_SELECT PAD_START PAD_RIGHT PAD_LEFT PAD_DOWN PAD_UP. 0=enfoncé.",
  },
  {
    label: "PAD2_STATE",
    detail: "$D211 · manette 2",
    info: "Même format que PAD1_STATE.",
  },
  {
    label: "MOUSE_X",
    detail: "$D220 · souris X",
    info: "Position X souris (0-127 gfx, 0-31 txt).",
  },
  { label: "MOUSE_Y", detail: "$D221 · souris Y", info: "Position Y souris." },
  {
    label: "MOUSE_BTN",
    detail: "$D224 · boutons souris",
    info: "bit0=gauche, bit1=droit (0=enfoncé).",
  },
  // ── Registres SYSTEM ────────────────────────────────────────
  {
    label: "SYS_RAND",
    detail: "$D306 · PRNG",
    info: "Lecture : octet pseudo-aléatoire (LFSR 16-bit). Écriture : seed.",
  },
  {
    label: "SYS_FRAME_LO",
    detail: "$D304 · frames lo",
    info: "Octet bas du compteur de frames.",
  },
  {
    label: "SYS_FRAME_HI",
    detail: "$D305 · frames hi",
    info: "Octet haut du compteur de frames.",
  },
  // ── Couleurs ────────────────────────────────────────────────
  { label: "COLOR_BLACK", detail: "0", info: "Couleur 0 : Noir  #000000" },
  { label: "COLOR_WHITE", detail: "1", info: "Couleur 1 : Blanc #FFFFFF" },
  { label: "COLOR_RED", detail: "2", info: "Couleur 2 : Rouge #CC0000" },
  { label: "COLOR_CYAN", detail: "3", info: "Couleur 3 : Cyan  #00CCCC" },
  { label: "COLOR_PURPLE", detail: "4", info: "Couleur 4 : Violet #CC00CC" },
  { label: "COLOR_GREEN", detail: "5", info: "Couleur 5 : Vert  #00CC00" },
  { label: "COLOR_BLUE", detail: "6", info: "Couleur 6 : Bleu  #0000CC" },
  { label: "COLOR_YELLOW", detail: "7", info: "Couleur 7 : Jaune #CCCC00" },
  { label: "COLOR_ORANGE", detail: "8", info: "Couleur 8 : Orange #CC8800" },
  { label: "COLOR_BROWN", detail: "9", info: "Couleur 9 : Brun  #884400" },
  { label: "COLOR_PINK", detail: "10", info: "Couleur 10 : Rose #FF8888" },
  {
    label: "COLOR_DKGRAY",
    detail: "11",
    info: "Couleur 11 : Gris foncé #444444",
  },
  {
    label: "COLOR_MDGRAY",
    detail: "12",
    info: "Couleur 12 : Gris moyen #888888",
  },
  {
    label: "COLOR_LTGREEN",
    detail: "13",
    info: "Couleur 13 : Vert clair #88FF88",
  },
  {
    label: "COLOR_LTBLUE",
    detail: "14",
    info: "Couleur 14 : Bleu clair #8888FF",
  },
  {
    label: "COLOR_LTGRAY",
    detail: "15",
    info: "Couleur 15 : Gris clair #CCCCCC",
  },
  // ── Boutons manette ─────────────────────────────────────────
  {
    label: "PAD_A",
    detail: "%10000000",
    info: "Bit bouton A (bit7). Test : LDA PAD1_STATE : EOR #$FF : AND #PAD_A",
  },
  { label: "PAD_B", detail: "%01000000", info: "Bit bouton B (bit6)." },
  { label: "PAD_SELECT", detail: "%00100000", info: "Bit Select (bit5)." },
  { label: "PAD_START", detail: "%00010000", info: "Bit Start (bit4)." },
  { label: "PAD_RIGHT", detail: "%00001000", info: "Bit Droite (bit3)." },
  { label: "PAD_LEFT", detail: "%00000100", info: "Bit Gauche (bit2)." },
  { label: "PAD_DOWN", detail: "%00000010", info: "Bit Bas (bit1)." },
  { label: "PAD_UP", detail: "%00000001", info: "Bit Haut (bit0)." },
  // ── Zones mémoire ───────────────────────────────────────────
  {
    label: "FRAMEBUF_A",
    detail: "$4000",
    info: "Framebuffer A (actif) — 128×128 px nibble-packed.",
  },
  {
    label: "FRAMEBUF_B",
    detail: "$6000",
    info: "Framebuffer B (backbuffer pour double buffering).",
  },
  {
    label: "VRAM_TEXT",
    detail: "$4800",
    info: "Mémoire texte — 32×32 chars. Adresse = $4800 + ligne*32 + col.",
  },
  {
    label: "VRAM_ATTR",
    detail: "$4C00",
    info: "Attributs couleur texte. Bits 7-4=paper, 3-0=ink.",
  },
  {
    label: "ZP_PARAMS",
    detail: "$0080",
    info: "Zone paramètres ABI (ZP $80–$EF). Utilisée pour passer des arguments aux routines.",
  },
  {
    label: "ZP_PTR0",
    detail: "$00F0",
    info: "Pointeur 0 (lo=$F0, hi=$F1). Utilisé pour l'adressage indirect.",
  },
  { label: "ZP_PTR1", detail: "$00F2", info: "Pointeur 1 (lo=$F2, hi=$F3)." },
].map((c) => ({ ...c, type: "variable" as const }));

function asm6502Completions(
  context: import("@codemirror/autocomplete").CompletionContext,
) {
  const word = context.matchBefore(/[A-Za-z_]+/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  const q = word.text.toUpperCase();
  const all = [...opcodeCompletions, ...CHUCK8_COMPLETIONS];
  return {
    from: word.from,
    options: all.filter((c) => c.label.toUpperCase().startsWith(q)),
  };
}

// ─────────────────────────────────────────────────────────────
// Styles Shadow DOM (wrapper + console)
// ─────────────────────────────────────────────────────────────

const STYLES = /* css */ `
  @import '/src/styles/tokens.css';

  :host {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    background: var(--bg);
    border-right: 1px solid var(--border);
    overflow: hidden;
  }

  /* ── Tab bar ─────────────────────────────────────────────── */
  .tab-bar {
    height: 34px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: flex-end;
    flex-shrink: 0;
  }
  .tab {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 0 16px;
    height: 100%;
    font-size: 12px;
    color: var(--text-muted);
    border-right: 1px solid var(--border);
    cursor: default;
    user-select: none;
    position: relative;
  }
  .tab.active { color: var(--text); background: var(--bg); }
  .tab.active::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 1px;
    background: var(--accent);
  }
  .tab-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); opacity: .7; }

  .tab-export {
    margin-left: auto;
    font-size: 11px;
    color: var(--text-muted);
    padding: 1px 6px;
    border-radius: 3px;
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-ui);
    transition: background var(--t-fast), color var(--t-fast);
  }
  .tab-export:hover { background: var(--surface-3); color: var(--text); }

  /* ── CodeMirror host ─────────────────────────────────────── */
  #cm-host {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  #cm-host .cm-editor {
    flex: 1;
    min-height: 0;
    height: 100%;
  }

  /* ── Console ─────────────────────────────────────────────── */
  .console-strip {
    height: var(--console-h);
    min-height: 60px;
    background: var(--surface);
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }
  .console-header {
    height: 28px;
    display: flex;
    align-items: center;
    padding: 0 14px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .console-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .1em;
    color: var(--text-muted);
  }
  .console-clear {
    margin-left: auto;
    font-size: 10px;
    color: var(--text-muted);
    padding: 2px 8px;
    border-radius: 4px;
    cursor: pointer;
    background: none;
    border: none;
    font-family: var(--font-ui);
    transition: background var(--t-fast), color var(--t-fast);
  }
  .console-clear:hover { background: var(--surface-3); color: var(--text); }
  .console-output {
    flex: 1;
    overflow-y: auto;
    padding: 6px 14px 8px;
    font-family: var(--font-mono);
    font-size: 11.5px;
    line-height: 1.6;
  }
  .log      { display: block; }
  .log-ok   { color: var(--green); }
  .log-err  { color: var(--red); }
  .log-info { color: var(--cyan); }
  .log-hex  { color: var(--amber); }
  .log-dim  { color: var(--text-muted); }

  ::-webkit-scrollbar       { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--surface-4); border-radius: 3px; }
`;

// ─────────────────────────────────────────────────────────────
// Code de démo Chuck-8 Platform v1.0
// ─────────────────────────────────────────────────────────────

const DEFAULT_SOURCE = `; ══════════════════════════════════════════════════
;  CHUCK-8 COMPUTER — Programme de démonstration
;  Dessine des pixels aléatoires sur l'écran
; ══════════════════════════════════════════════════

SYS_CLEAR      = $F000
SYS_DRAW_PIXEL = $F003
SYS_RAND       = $F05A
VPU_CTRL       = $D000

  .org $E000

INIT:
  LDA #$81
  STA VPU_CTRL

  LDA #0
  JSR SYS_CLEAR

LOOP:
  ; Couleur aléatoire (évite le noir)
  JSR SYS_RAND
  AND #$0F
  BEQ LOOP

  PHA

  ; X aléatoire (0-127)
  JSR SYS_RAND
  AND #$7F
  TAX

  ; Y aléatoire (0-127)
  JSR SYS_RAND
  AND #$7F
  TAY

  PLA
  JSR SYS_DRAW_PIXEL

  JMP LOOP
`;

// ─────────────────────────────────────────────────────────────
// Web Component
// ─────────────────────────────────────────────────────────────

export class ChuckEditor extends ChuckComponent {
  private _view!: EditorView;
  private _output!: HTMLDivElement;
  private _tabLabel!: HTMLSpanElement;
  private _currentId = 0;
  private _autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  // ── API publique ────────────────────────────────────────
  getSource(): string {
    return this._view?.state.doc.toString() ?? "";
  }

  setSource(code: string): void {
    if (!this._view) return;
    this._view.dispatch({
      changes: { from: 0, to: this._view.state.doc.length, insert: code },
    });
  }

  getBreakpoints(): number[] {
    if (!this._view) return [];
    const markers = this._view.state.field(breakpointField);
    const lines: number[] = [];
    const iter = markers.iter();
    while (iter.value) {
      lines.push(this._view.state.doc.lineAt(iter.from).number);
      iter.next();
    }
    return lines;
  }

  // ── Render ──────────────────────────────────────────────
  protected render(): void {
    this.shadow.innerHTML = `<style>${STYLES}</style>
    <div class="tab-bar">
      <div class="tab active">
        <span class="tab-dot"></span>
        <span id="tab-label">untitled.asm</span>
        <button class="tab-export" id="export-btn" title="Télécharger .asm">↓ .asm</button>
      </div>
    </div>
    <div id="cm-host"></div>
    <div class="console-strip">
      <div class="console-header">
        <span class="console-title">Console</span>
        <button class="console-clear" id="clear-btn">Effacer</button>
      </div>
      <div class="console-output" id="output"></div>
    </div>`;
  }

  // ── Setup ───────────────────────────────────────────────
  protected setup(): void {
    this._output = this.shadow.getElementById("output") as HTMLDivElement;
    this._tabLabel = this.shadow.getElementById("tab-label") as HTMLSpanElement;
    const cmHost = this.shadow.getElementById("cm-host")!;

    // ── Construire l'EditorView ─────────────────────────
    this._view = new EditorView({
      state: EditorState.create({
        doc: DEFAULT_SOURCE,
        extensions: [
          // Histoire
          history(),
          // Keymaps
          keymap.of([
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
            ...completionKeymap,
            indentWithTab,
          ]),
          // UI
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          drawSelection(),
          rectangularSelection(),
          crosshairCursor(),
          highlightSelectionMatches(),
          indentOnInput(),
          // Breakpoints
          breakpointField,
          breakpointGutter,
          // Langue + coloration
          asm6502Language,
          syntaxHighlighting(chuckHighlight),
          // Autocompletion
          autocompletion({ override: [asm6502Completions] }),
          // Thème
          chuckTheme,
          // Listener de changement
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              this.emit("chuck:code-changed", undefined);
              this._scheduleAutosave();
            }
            if (update.selectionSet) {
              this._emitCursor();
            }
          }),
        ],
      }),
      parent: cmHost,
    });

    // ── Contrôles ────────────────────────────────────────
    this.shadow.getElementById("clear-btn")?.addEventListener("click", () => {
      this._output.innerHTML = "";
      this._log("Console effacée.", "dim");
    });

    this.shadow
      .getElementById("export-btn")
      ?.addEventListener("click", () => this._exportAsm());

    // ── Bus ───────────────────────────────────────────────
    this.sub("chuck:log", ({ text, level }) => this._log(text, level));

    this.sub("chuck:challenge-loaded", ({ challenge, code }) => {
      this._currentId = challenge.id;
      this._tabLabel.textContent = `jour_${String(challenge.id).padStart(2, "0")}.asm`;
      this.setSource(code);
      this._emitCursor();
      this._log(`Défi #${challenge.id} — ${challenge.title}`, "info");
    });

    // Erreur d'assemblage → log + surlignage de la ligne fautive
    this.sub(
      "chuck:assemble-err" as any,
      ({ line, err }: { line: number; err: string }) => {
        const location = line > 0 ? `Ligne ${line} — ` : "";
        this._log(`✗ ${location}${err}`, "err");

        // Décorations Monaco — inchangées
        const editor = (this as any)._editor;
        if (!editor) return;
        if ((this as any)._errDecorations) {
          editor.deltaDecorations((this as any)._errDecorations, []);
        }
        if (line > 0) {
          (this as any)._errDecorations = editor.deltaDecorations(
            [],
            [
              {
                range: new (window as any).monaco.Range(line, 1, line, 999),
                options: {
                  isWholeLine: true,
                  className: "editor-error-line",
                  glyphMarginClassName: "editor-error-glyph",
                  overviewRuler: { color: "var(--red)", position: 1 },
                },
              },
            ],
          );
        }
      },
    );

    // Quand le code change : effacer les décorations d'erreur
    this.sub("chuck:code-changed", () => {
      const editor = (this as any)._editor;
      if (editor && (this as any)._errDecorations) {
        editor.deltaDecorations((this as any)._errDecorations, []);
        (this as any)._errDecorations = null;
      }
    });

    // Mettre le focus sur l'éditeur au chargement
    requestAnimationFrame(() => this._view.focus());
  }

  // ── Autosave (Tâche 2.3) ────────────────────────────────
  private _scheduleAutosave(): void {
    if (this._autosaveTimer) clearTimeout(this._autosaveTimer);
    this._autosaveTimer = setTimeout(() => {
      if (this._currentId > 0) {
        this.emit("chuck:autosave", {
          id: this._currentId,
          code: this.getSource(),
        });
      }
    }, 800);
  }

  // ── Export .asm (Tâche 6.2) ─────────────────────────────
  private _exportAsm(): void {
    const code = this.getSource();
    const filename =
      this._currentId > 0
        ? `chuck_day_${this._currentId}.asm`
        : "programme.asm";
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    this._log(`"${filename}" téléchargé.`, "ok");
  }

  // ── Helpers ──────────────────────────────────────────────
  private _emitCursor(): void {
    if (!this._view) return;
    const head = this._view.state.selection.main.head;
    const line = this._view.state.doc.lineAt(head);
    this.emit("chuck:cursor-moved", {
      line: line.number,
      col: head - line.from + 1,
    });
  }

  private _log(text: string, level: string): void {
    const ts = new Date().toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const span = document.createElement("span");
    span.className = `log log-${level}`;
    span.textContent = `[${ts}]  ${text}`;
    this._output.appendChild(span);
    this._output.appendChild(document.createElement("br"));
    this._output.scrollTop = this._output.scrollHeight;
  }

  protected teardown(): void {
    if (this._autosaveTimer) clearTimeout(this._autosaveTimer);
    this._view?.destroy();
  }
}

customElements.define("chuck-editor", ChuckEditor);
