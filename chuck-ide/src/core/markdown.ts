/* ─────────────────────────────────────────────────────────────
   Chuck IDE — core/markdown.ts

   Rendu Markdown centralisé, basé sur la librairie `marked`.
   Remplace les anciens parseurs maison (regex) éparpillés dans
   les composants. Deux helpers exposés :

     - renderMarkdown(src)        → bloc complet (titres, listes,
                                     paragraphes, code, tableaux…)
     - renderMarkdownInline(src)  → rendu sur une seule ligne, sans
                                     wrapper <p> (gras, italique,
                                     code inline, liens)

   La sortie HTML utilise les balises standard (<h2>, <strong>,
   <code>, <ul>, <pre>…) déjà stylées par le composant hôte.
   ───────────────────────────────────────────────────────────── */

import { Marked } from 'marked';

// Instance dédiée, configurée une seule fois.
const marked = new Marked({
  gfm:    true,   // tableaux, ~~strikethrough~~, autolinks…
  breaks: true,   // un saut de ligne simple → <br> (comportement
                  //  attendu par le contenu rédigé dans les défis)
});

/** Rend un fragment Markdown en HTML bloc. */
export function renderMarkdown(src: string): string {
  if (!src) return '';
  return marked.parse(src, { async: false }) as string;
}

/** Rend un fragment Markdown sur une seule ligne (sans <p> englobant). */
export function renderMarkdownInline(src: string): string {
  if (!src) return '';
  return marked.parseInline(src, { async: false }) as string;
}
/* ─────────────────────────────────────────────────────────────
   renderDocs — variante pour la modale de documentation.

   Différences avec renderMarkdown :
     - Bloc ```asm   → <div class="code-block"> avec bouton Copier
                        (le code, échappé, est encodé base64 dans
                        data-code pour réinjection dans l'éditeur).
     - Bloc ``` nu   → <pre class="pre-plain"> sans bouton
                        (diagrammes, cartes mémoire…).
     - [note]…[/note] → <blockquote> (syntaxe custom, préprocessée
                        avant marked pour éviter tout conflit
                        d'échappement).
   ───────────────────────────────────────────────────────────── */

// Encode une chaîne UTF-8 en base64 (équivalent btoa + échappement).
function toB64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

// Instance dédiée à la doc, avec renderer code custom.
const markedDocs = new Marked({
  gfm:    true,
  breaks: false,  // la doc utilise des paragraphes explicites
});

markedDocs.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }): string {
      const escaped = text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      if ((lang ?? '').toLowerCase() === 'asm') {
        const b64 = toB64(text);
        return `<div class="code-block">`
          + `<button class="copy-btn" data-code="${b64}" title="Copier dans l'éditeur">`
          + `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">`
          + `<rect x="9" y="9" width="13" height="13" rx="2"/>`
          + `<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>`
          + `</svg> Copier</button>`
          + `<pre>${escaped}</pre>`
          + `</div>`;
      }
      return `<pre class="pre-plain">${escaped}</pre>`;
    },
  },
});

/** Rend le Markdown de la documentation (blocs asm + notes custom). */
export function renderDocs(src: string): string {
  if (!src) return '';
  // Préprocesser [note]…[/note] → blockquote HTML, avant marked.
  const withNotes = src.replace(
    /\[note\]([\s\S]*?)\[\/note\]/g,
    (_m, inner: string) => `<blockquote>\n\n${inner.trim()}\n\n</blockquote>`
  );
  return markedDocs.parse(withNotes, { async: false }) as string;
}