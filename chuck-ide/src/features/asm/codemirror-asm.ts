/* features/asm/codemirror-asm.ts — config CodeMirror pour l'assembleur Chuck-8. */

import { EditorView, gutter, GutterMarker, hoverTooltip } from "@codemirror/view";
import { HighlightStyle } from "@codemirror/language";
import { StreamLanguage, type StreamParser } from "@codemirror/language";
import { StateField, StateEffect, RangeSet } from "@codemirror/state";
import { tags as t } from "@lezer/highlight";

import {
  OPCODES_6502,
  OPCODE_DOCS,
  CHUCK8_COMPLETIONS,
  DIRECTIVE_DOCS,
} from "./opcodes.js";

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

export const asm6502Language = StreamLanguage.define(asm6502Parser);


export const chuckHighlight = HighlightStyle.define([
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


class BreakpointMarker extends GutterMarker {
  toDOM(): Text {
    const span = document.createElement("span");
    span.className = "bp-dot";
    return span as unknown as Text;
  }
}
const bpMarker = new BreakpointMarker();

// StateEffect pour ajouter/supprimer un breakpoint
export const toggleBreakpoint = StateEffect.define<number>(); // line number (1-based)

// StateField qui maintient le Set des lignes avec breakpoint
export const breakpointField = StateField.define<RangeSet<GutterMarker>>({
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
export const breakpointGutter = gutter({
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


export const chuckTheme = EditorView.theme(
  {
    "&": {
      fontSize: "13px",
      height: "100%",
      background: "var(--bg, #0f0f0f)",
      color: "var(--text, #e2e2e2)",
      fontFamily: "'Hack','Fira Code','Cascadia Code','Consolas',monospace",
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

    // Info-bulles au survol
    ".cm-tooltip": {
      border: "1px solid var(--border, #2a2a2a)",
      borderRadius: "6px",
      background: "var(--surface, #1a1a1a)",
      boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
    },
    ".cm-chuck-tooltip": {
      padding: "8px 10px",
      maxWidth: "340px",
      fontFamily: "'Hack','Fira Code','Cascadia Code','Consolas',monospace",
    },
    ".cm-chuck-tooltip-title": {
      fontSize: "12.5px",
      fontWeight: "600",
      color: "var(--accent, #7c6af7)",
    },
    ".cm-chuck-tooltip-detail": {
      fontSize: "11px",
      color: "var(--text-dim, #999)",
      marginTop: "1px",
    },
    ".cm-chuck-tooltip-info": {
      fontSize: "11.5px",
      color: "var(--text, #e2e2e2)",
      marginTop: "5px",
      lineHeight: "1.5",
      whiteSpace: "normal",
    },
  },
  { dark: true },
);


const opcodeCompletions = [...OPCODES_6502].sort().map((op) => {
  const doc = OPCODE_DOCS[op];
  return {
    label: op,
    type: "keyword",
    detail: doc?.detail ?? "Instruction 6502",
    info: doc?.info ?? `Instruction 6502 : ${op}`,
  };
});


export function asm6502Completions(
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


const HOVER_DOCS = new Map<string, { detail: string; info: string }>();
for (const op of OPCODES_6502) {
  const doc = OPCODE_DOCS[op];
  HOVER_DOCS.set(op, {
    detail: doc?.detail ?? "Instruction 6502",
    info: doc?.info ?? `Instruction 6502 : ${op}`,
  });
}
for (const c of CHUCK8_COMPLETIONS) {
  HOVER_DOCS.set(c.label.toUpperCase(), {
    detail: c.detail ?? "",
    info: c.info ?? "",
  });
}
for (const [name, doc] of Object.entries(DIRECTIVE_DOCS)) {
  HOVER_DOCS.set(name.toUpperCase(), doc);
}

// Extension : affiche une info-bulle au survol d'un opcode, d'une fonction
// SYS_, d'un registre, d'une constante ou d'une directive.
export const asm6502Hover = hoverTooltip((view, pos) => {
  const { text, from: lineFrom } = view.state.doc.lineAt(pos);
  // Mot incluant un éventuel point initial (pour les directives) et underscores.
  const re = /\.?[A-Za-z_][A-Za-z0-9_]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = lineFrom + m.index;
    const end = start + m[0].length;
    if (pos < start || pos > end) continue;
    const doc = HOVER_DOCS.get(m[0].toUpperCase());
    if (!doc) return null;
    return {
      pos: start,
      end,
      above: true,
      create() {
        const dom = document.createElement("div");
        dom.className = "cm-chuck-tooltip";
        const title = document.createElement("div");
        title.className = "cm-chuck-tooltip-title";
        title.textContent = m![0];
        const detail = document.createElement("div");
        detail.className = "cm-chuck-tooltip-detail";
        detail.textContent = doc.detail;
        const info = document.createElement("div");
        info.className = "cm-chuck-tooltip-info";
        info.textContent = doc.info;
        dom.append(title, detail, info);
        return { dom };
      },
    };
  }
  return null;
});
