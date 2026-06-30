/* components/chuck-editor.ts — Web Component <chuck-editor>.
   CodeMirror 6 dans le Shadow DOM + export .asm.
   Langage/coloration/breakpoints → features/asm/ ; styles → ./editor/. */

import { ChuckComponent } from "../core/base-component.js";

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
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { autocompletion, completionKeymap, acceptCompletion } from "@codemirror/autocomplete";

import {
  asm6502Language,
  chuckHighlight,
  breakpointField,
  breakpointGutter,
  chuckTheme,
  asm6502Completions,
  asm6502Hover,
} from "../features/asm/codemirror-asm.js";
import { DEFAULT_SOURCE } from "../features/asm/default-source.js";
import { STYLES } from "./editor/editor.styles.js";

export class ChuckEditor extends ChuckComponent {
  private _view!: EditorView;
  private _output!: HTMLDivElement;
  private _tabLabel!: HTMLSpanElement;

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
        <span id="tab-label">demo.asm</span>
        
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
            // Espace accepte la complétion si la popup est ouverte ;
            // sinon acceptCompletion renvoie false et l'espace s'insère normalement.
            { key: " ", run: acceptCompletion },
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
          // Info-bulles au survol
          asm6502Hover,
          // Thème
          chuckTheme,
          // Listener de changement
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              this.emit("chuck:code-changed", undefined);
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

    // ── Bus ───────────────────────────────────────────────
    this.sub("chuck:log", ({ text, level }) => this._log(text, level));

    this.sub("chuck:challenge-loaded", ({ challenge, code, track }) => {
      this._tabLabel.textContent = track
        ? `${track.trackId}_${challenge.id}.asm`
        : `defi_${String(challenge.id).padStart(2, "0")}.asm`;
      this.setSource(code);
      this._emitCursor();
      // Couleur figée selon le mode déduit de l'event (track → pong, sinon
      // challenges) — indépendant de l'ordre des listeners qui posent data-mode.
      this._log(`Défi #${challenge.id} — ${challenge.title}`, "mode", track ? "defi" : "tutos");
    });

    this.sub("chuck:ide-free", () => {
      // Mode libre : on charge le code de démonstration (bac à sable volatil).
      this._tabLabel.textContent = "demo.asm";
      this.setSource(DEFAULT_SOURCE);
      this._emitCursor();
    });

    // Défi du mois : charge le template de départ dans l'éditeur. On ne
    // remplace que si l'utilisateur n'a pas déjà commencé à coder, pour ne
    // pas écraser son travail s'il revient sur l'onglet instructions.
    this.sub("chuck:defi-loaded", ({ defi }) => {
      if (!defi) return;
      this._tabLabel.textContent = `defi_${defi.month}.asm`;
      if (defi.template && this.getSource().trim() === DEFAULT_SOURCE.trim()) {
        this.setSource(defi.template);
        this._emitCursor();
      }
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

  private _log(text: string, level: string, mode?: string): void {
    const ts = new Date().toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const span = document.createElement("span");
    span.className = `log log-${level}`;
    // Pour un message de lancement de mode : on FIGE la couleur du mode au
    // moment de l'écriture (couleur calculée, pas la variable --mode-color qui
    // évoluerait et recolorierait les anciennes lignes à chaque changement).
    // `mode` explicite si fourni (déduit de l'event), sinon data-mode courant.
    if (level === "mode") {
      const root = document.documentElement;
      const m = mode || root.dataset.mode || "free";
      const c = getComputedStyle(root).getPropertyValue(`--mode-${m}`).trim();
      if (c) span.style.color = c;
    }
    span.textContent = `[${ts}]  ${text}`;
    this._output.appendChild(span);
    this._output.appendChild(document.createElement("br"));
    this._output.scrollTop = this._output.scrollHeight;
  }

  protected teardown(): void {
    this._view?.destroy();
  }
}

customElements.define("chuck-editor", ChuckEditor);