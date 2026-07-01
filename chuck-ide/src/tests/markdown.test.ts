/* ─────────────────────────────────────────────────────────────
   Tests — core/markdown.ts
   Couvre : renderMarkdown (bloc, gras, code, listes, breaks), 
   renderMarkdownInline (sans <p>), renderDocs (bloc ```asm avec bouton
   Copier + data-code base64, bloc nu → pre-plain, [note] → blockquote,
   échappement HTML), et le cas chaîne vide.
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect } from 'vitest';
import { renderMarkdown, renderMarkdownInline, renderDocs } from '../core/markdown.js';

describe('renderMarkdown', () => {
  it('renvoie une chaîne vide pour une entrée vide', () => {
    expect(renderMarkdown('')).toBe('');
  });

  it('rend un titre de niveau 2', () => {
    expect(renderMarkdown('## Titre')).toContain('<h2');
  });

  it('rend le gras', () => {
    expect(renderMarkdown('**fort**')).toContain('<strong>fort</strong>');
  });

  it('rend une liste à puces', () => {
    const html = renderMarkdown('- a\n- b');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>');
  });

  it('rend le code inline', () => {
    expect(renderMarkdown('`LDA`')).toContain('<code>LDA</code>');
  });

  it('convertit un saut de ligne simple en <br> (breaks: true)', () => {
    expect(renderMarkdown('ligne1\nligne2')).toContain('<br');
  });
});

describe('renderMarkdownInline', () => {
  it('renvoie une chaîne vide pour une entrée vide', () => {
    expect(renderMarkdownInline('')).toBe('');
  });

  it('n’enveloppe pas dans un <p>', () => {
    const html = renderMarkdownInline('**fort**');
    expect(html).toContain('<strong>fort</strong>');
    expect(html).not.toContain('<p>');
  });

  it('rend liens et code inline', () => {
    expect(renderMarkdownInline('[x](https://e.com)')).toContain('<a href="https://e.com"');
    expect(renderMarkdownInline('`x`')).toContain('<code>x</code>');
  });
});

describe('renderDocs', () => {
  it('renvoie une chaîne vide pour une entrée vide', () => {
    expect(renderDocs('')).toBe('');
  });

  it('rend un bloc ```asm avec un bouton Copier et data-code base64', () => {
    const html = renderDocs('```asm\nLDA #1\n```');
    expect(html).toContain('class="code-block"');
    expect(html).toContain('class="copy-btn"');
    expect(html).toContain('data-code="');
    // data-code décode bien vers le source d’origine
    const m = html.match(/data-code="([^"]+)"/);
    expect(m).toBeTruthy();
    const decoded = decodeURIComponent(escape(atob(m![1])));
    expect(decoded).toContain('LDA #1');
  });

  it('rend un bloc de code nu en pre-plain sans bouton', () => {
    const html = renderDocs('```\n+----+\n```');
    expect(html).toContain('class="pre-plain"');
    expect(html).not.toContain('copy-btn');
  });

  it('transforme [note]…[/note] en blockquote', () => {
    const html = renderDocs('[note]Attention au Carry[/note]');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('Attention au Carry');
  });

  it('échappe le HTML à l’intérieur des blocs de code', () => {
    const html = renderDocs('```asm\nLDA <tag>\n```');
    expect(html).toContain('&lt;tag&gt;');
    expect(html).not.toContain('<tag>');
  });
});