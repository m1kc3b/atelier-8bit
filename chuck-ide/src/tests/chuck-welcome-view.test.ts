/* ─────────────────────────────────────────────────────────────
   Tests — components/chuck-welcome-view.ts (ChuckWelcomeView)
   Vue d'accueil (hero + 3 CTA). Couvre : rendu, injection du compteur
   de challenges, et la navigation de chaque carte (free → ide-free +
   modal-close + tour si jamais vu ; challenges → tutos-requested +
   modal-show ; defis → ide-defi + modal-close).
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const challenges = { list: [{ id: 1 }, { id: 2 }, { id: 3 }] as any[] };
vi.mock('../features/challenges/challenges-service.js', () => ({
  challengesService: { getAll: async () => challenges.list },
}));

import { bus } from '../core/bus.js';
import '../components/chuck-welcome-view.js';

const SEEN_KEY = 'chuck8_tour_seen';
const flush = () => new Promise((r) => setTimeout(r, 0));

function mount(): HTMLElement {
  const el = document.createElement('chuck-welcome-view');
  document.body.appendChild(el);
  return el;
}
const card = (el: HTMLElement, choice: string) =>
  el.shadowRoot!.querySelector(`[data-choice="${choice}"]`) as HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  challenges.list = [{ id: 1 }, { id: 2 }, { id: 3 }];
});
afterEach(() => { document.body.innerHTML = ''; });

describe('ChuckWelcomeView — rendu', () => {
  it('affiche le hero et les trois cartes', () => {
    const el = mount();
    expect(el.shadowRoot!.querySelector('.hero h1')!.textContent).toContain('1980');
    expect(card(el, 'free')).not.toBeNull();
    expect(card(el, 'challenges')).not.toBeNull();
    expect(card(el, 'defis')).not.toBeNull();
  });

  it('injecte le nombre de challenges chargé en arrière-plan', async () => {
    const el = mount();
    await flush();
    expect(card(el, 'challenges').textContent).toContain('3');
  });
});

describe('ChuckWelcomeView — navigation', () => {
  it('carte « free » émet ide-free + modal-close et lance le tour si jamais vu', () => {
    const el = mount();
    const free = vi.fn(); const close = vi.fn(); const tour = vi.fn();
    bus.on('chuck:ide-free', free);
    bus.on('chuck:modal-close', close);
    bus.on('chuck:start-tour', tour);
    card(el, 'free').click();
    expect(free).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    expect(tour).toHaveBeenCalled();
  });

  it('carte « free » ne relance pas le tour s’il a déjà été vu', () => {
    localStorage.setItem(SEEN_KEY, '1');
    const el = mount();
    const tour = vi.fn();
    bus.on('chuck:start-tour', tour);
    card(el, 'free').click();
    expect(tour).not.toHaveBeenCalled();
  });

  it('carte « challenges » émet tutos-requested + modal-show challenges', () => {
    const el = mount();
    const tutos = vi.fn(); const show = vi.fn();
    bus.on('chuck:tutos-requested', tutos);
    bus.on('chuck:modal-show', show);
    card(el, 'challenges').click();
    expect(tutos).toHaveBeenCalled();
    expect(show).toHaveBeenCalledWith({ view: 'challenges' });
  });

  it('carte « defis » émet ide-defi + modal-close', () => {
    const el = mount();
    const defi = vi.fn(); const close = vi.fn();
    bus.on('chuck:ide-defi', defi);
    bus.on('chuck:modal-close', close);
    card(el, 'defis').click();
    expect(defi).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });
});