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