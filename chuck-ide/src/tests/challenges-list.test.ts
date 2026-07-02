/* ─────────────────────────────────────────────────────────────
   Tests — components/chuck-challenges-list.ts (ChuckChallengesList)
   Grille des challenges : progression, verrous (séquentiel/email),
   médailles, navigation au clic, échappement HTML.
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { bus } from '../core/bus.js';
import '../components/chuck-challenges-list.js';

const flush = () => new Promise((r) => setTimeout(r, 0));

function mount(): HTMLElement {
  const el = document.createElement('chuck-challenges-list');
  document.body.appendChild(el);
  return el;
}

function item(id: number, over: any = {}) {
  return {
    id, title: `Défi ${id}`, completed: false, medal: null,
    sequentialLocked: false, emailLocked: false, current: false,
    arenaName: undefined, estimatedMinutes: undefined, ...over,
  };
}

function sendList(_el: HTMLElement, items: any[]) {
  bus.emit('chuck:challenges-list', { items });
}

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { document.body.innerHTML = ''; });

describe('ChuckChallengesList — montage', () => {
  it('demande la liste au montage (chuck:tutos-requested)', () => {
    const req = vi.fn();
    bus.on('chuck:tutos-requested', req);
    mount();
    expect(req).toHaveBeenCalled();
  });

  it('affiche l’en-tête et la barre de progression', () => {
    const el = mount();
    expect(el.shadowRoot!.getElementById('grid')).not.toBeNull();
    expect(el.shadowRoot!.getElementById('progress-label')!.textContent).toBe('0 / 0');
  });
});

describe('ChuckChallengesList — rendu de la grille', () => {
  it('rend une carte par défi', async () => {
    const el = mount();
    sendList(el, [item(1), item(2), item(3)]);
    await flush();
    expect(el.shadowRoot!.querySelectorAll('.card[data-id]').length).toBe(3);
  });

  it('calcule la progression (complétés / total)', async () => {
    const el = mount();
    sendList(el, [item(1, { completed: true }), item(2, { completed: true }), item(3), item(4)]);
    await flush();
    expect(el.shadowRoot!.getElementById('progress-label')!.textContent).toBe('2 / 4');
    expect(el.shadowRoot!.getElementById('progress-fill')!.style.width).toBe('50%');
  });

  it('message vide si aucun défi', async () => {
    const el = mount();
    sendList(el, []);
    await flush();
    expect(el.shadowRoot!.getElementById('grid')!.textContent).toContain('Aucun défi');
  });

  it('carte complétée porte la classe et la médaille', async () => {
    const el = mount();
    sendList(el, [item(1, { completed: true, medal: '🥇' })]);
    await flush();
    const card = el.shadowRoot!.querySelector('.card[data-id="1"]')!;
    expect(card.classList.contains('completed')).toBe(true);
    expect(card.textContent).toContain('🥇');
  });

  it('carte verrouillée séquentiellement porte 🔒 et le tag requis', async () => {
    const el = mount();
    sendList(el, [item(3, { sequentialLocked: true })]);
    await flush();
    const card = el.shadowRoot!.querySelector('.card[data-id="3"]')!;
    expect(card.classList.contains('locked')).toBe(true);
    expect(card.textContent).toContain('🔒');
    expect(card.textContent).toContain('Défi 2 requis');
  });

  it('carte email-locked affiche 📧', async () => {
    const el = mount();
    sendList(el, [item(2, { emailLocked: true })]);
    await flush();
    expect(el.shadowRoot!.querySelector('.card[data-id="2"]')!.textContent).toContain('📧');
  });

  it('carte courante non complétée porte la classe current', async () => {
    const el = mount();
    sendList(el, [item(1, { current: true })]);
    await flush();
    expect(el.shadowRoot!.querySelector('.card[data-id="1"]')!.classList.contains('current')).toBe(true);
  });
});

describe('ChuckChallengesList — navigation', () => {
  it('clic sur une carte accessible émet chuck:goto-challenge', async () => {
    const el = mount();
    sendList(el, [item(1)]);
    await flush();
    const goto = vi.fn();
    bus.on('chuck:goto-challenge', goto);
    (el.shadowRoot!.querySelector('.card[data-id="1"]') as HTMLElement).click();
    expect(goto).toHaveBeenCalledWith({ id: 1 });
  });

  it('clic sur une carte verrouillée n’émet rien', async () => {
    const el = mount();
    sendList(el, [item(3, { sequentialLocked: true })]);
    await flush();
    const goto = vi.fn();
    bus.on('chuck:goto-challenge', goto);
    (el.shadowRoot!.querySelector('.card[data-id="3"]') as HTMLElement).click();
    expect(goto).not.toHaveBeenCalled();
  });
});

describe('ChuckChallengesList — sécurité', () => {
  it('échappe le HTML des titres (pas d’injection dans le DOM rendu)', async () => {
    const el = mount();
    sendList(el, [item(1, { title: '<img src=x onerror=alert(1)>' })]);
    await flush();
    // Le titre doit apparaître comme TEXTE, pas comme un élément <img> injecté.
    expect(el.shadowRoot!.querySelector('.card-title img')).toBeNull();
    expect(el.shadowRoot!.querySelector('.card-title')!.textContent).toContain('<img src=x');
  });
});