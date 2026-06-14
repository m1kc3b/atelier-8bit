/* ─────────────────────────────────────────────────────────────
   Chuck IDE — components/chuck-display.ts
   Écran Chuck-8 : 128×128 pixels, 16 couleurs, 2 modes.

   Mode gfx  : framebuffer nibble-packed $4000–$5FFF
   Mode texte : tilemap $4800 + attributs $4C00 + charset $F800
   ───────────────────────────────────────────────────────────── */

import { ChuckComponent } from '../core/base-component.js';
import { bus } from '../core/bus.js';

// ── Palette Chuck-8 v1.0 (16 couleurs RGBA) ──────────────────
// Index = couleur, valeur = [R, G, B, 255]
const PALETTE: Uint8ClampedArray = new Uint8ClampedArray([
  // 0  Noir
  0x00, 0x00, 0x00, 0xFF,
  // 1  Blanc
  0xFF, 0xFF, 0xFF, 0xFF,
  // 2  Rouge
  0xCC, 0x00, 0x00, 0xFF,
  // 3  Cyan
  0x00, 0xCC, 0xCC, 0xFF,
  // 4  Violet
  0xCC, 0x00, 0xCC, 0xFF,
  // 5  Vert
  0x00, 0xCC, 0x00, 0xFF,
  // 6  Bleu
  0x00, 0x00, 0xCC, 0xFF,
  // 7  Jaune
  0xCC, 0xCC, 0x00, 0xFF,
  // 8  Orange
  0xCC, 0x88, 0x00, 0xFF,
  // 9  Brun
  0x88, 0x44, 0x00, 0xFF,
  // 10 Rose
  0xFF, 0x88, 0x88, 0xFF,
  // 11 Gris foncé
  0x44, 0x44, 0x44, 0xFF,
  // 12 Gris moyen
  0x88, 0x88, 0x88, 0xFF,
  // 13 Vert clair
  0x88, 0xFF, 0x88, 0xFF,
  // 14 Bleu clair
  0x88, 0x88, 0xFF, 0xFF,
  // 15 Gris clair
  0xCC, 0xCC, 0xCC, 0xFF,
]);

// Retourne [R, G, B, A] pour une couleur de palette
function palColor(idx: number): [number, number, number, number] {
  const i = (idx & 0x0F) * 4;
  return [PALETTE[i]!, PALETTE[i+1]!, PALETTE[i+2]!, PALETTE[i+3]!];
}

// ── Constantes mémoire Chuck-8 ────────────────────────────────
const FRAMEBUF_A   = 0x4000;  // mode gfx nibble-packed 128×128/2
const VRAM_TEXT    = 0x4800;  // mode texte 32×32 chars
const VRAM_ATTR    = 0x4C00;  // attributs couleur
const CHARSET_ROM  = 0xF800;  // charset 4×4 px, 96 chars, 4 octets/char
const CHAR_W       = 4;        // pixels par caractère (largeur)
const CHAR_H       = 4;        // pixels par caractère (hauteur)
const TEXT_COLS    = 32;
const TEXT_ROWS    = 32;
const SCREEN_W     = 128;
const SCREEN_H     = 128;
const GFX_STRIDE   = 64;       // octets par ligne (128px / 2)

// ── Styles ────────────────────────────────────────────────────
const STYLES = /* css */`
  @import '/src/styles/tokens.css';

  :host {
    position: fixed;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--border-2);
    border-radius: var(--modal-radius);
    box-shadow: var(--modal-shadow);
    min-width: 200px;
    min-height: 140px;
    z-index: 100;
    opacity: 0;
    pointer-events: none;
    transform: scale(.97) translateY(4px);
    transition: opacity .15s, transform .15s;
    overflow: hidden;
    user-select: none;
  }
  :host(.visible) {
    opacity: 1;
    pointer-events: all;
    transform: scale(1) translateY(0);
  }

  .modal-bar {
    height: 34px;
    display: flex;
    align-items: center;
    padding: 0 10px;
    gap: 8px;
    background: var(--surface-2);
    border-bottom: 1px solid var(--border);
    cursor: grab;
    flex-shrink: 0;
  }
  .modal-bar:active { cursor: grabbing; }

  .modal-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: .08em;
    flex: 1;
  }

  .mode-badge {
    font-size: 9px;
    font-weight: 700;
    padding: 2px 5px;
    border-radius: 3px;
    letter-spacing: .05em;
    background: var(--surface-3);
    color: var(--text-muted);
  }
  .mode-badge.gfx  { background: var(--accent-dim); color: var(--accent); }
  .mode-badge.live { background: var(--green-dim);   color: var(--green);
                     animation: blink 1.1s infinite; }

  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }

  .close-btn {
    width: 20px; height: 20px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 4px;
    font-size: 14px;
    background: none; border: none; cursor: pointer;
    color: var(--text-muted);
    transition: background var(--t-fast), color var(--t-fast);
  }
  .close-btn:hover { background: var(--red-dim); color: var(--red); }

  .canvas-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px;
    background: #050505;
    flex: 1;
  }

  canvas {
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    /* Affiché à 384×384 (3×) ou 256×256 (2×) selon la place */
    width: 256px;
    height: 256px;
    border: 1px solid #1a1a1a;
    border-radius: 2px;
    display: block;
    cursor: crosshair;
  }

  .coords {
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--text-muted);
    text-align: center;
    padding: 3px 0 5px;
    background: #050505;
  }

  .resize-handle {
    position: absolute;
    bottom: 0; right: 0;
    width: 14px; height: 14px;
    cursor: se-resize;
    opacity: .3;
  }
  .resize-handle::after {
    content: '';
    position: absolute;
    bottom: 3px; right: 3px;
    width: 6px; height: 6px;
    border-right: 2px solid var(--text-dim);
    border-bottom: 2px solid var(--text-dim);
  }
`;

// ── Composant ─────────────────────────────────────────────────

export class ChuckDisplay extends ChuckComponent {
  canvas!:  HTMLCanvasElement;
  private _ctx!:      CanvasRenderingContext2D;
  private _imgData!:  ImageData;
  private _pixels!:   Uint8ClampedArray; // buffer RGBA 128×128×4
  private _mode:      number = 0;        // 0=texte 1=gfx
  

  protected render(): void {
    this.shadow.innerHTML = `<style>${STYLES}</style>
    <div class="modal-bar" id="bar">
      <span class="modal-title">Écran — 128 × 128</span>
      <span class="mode-badge" id="mode-badge">TXT</span>
      <span class="mode-badge live" id="live-badge" style="display:none">● LIVE</span>
      <button class="close-btn" id="close">✕</button>
    </div>
    <div class="canvas-wrap">
      <canvas id="screen" width="${SCREEN_W}" height="${SCREEN_H}"></canvas>
    </div>
    <div class="coords" id="coords">128 × 128 · 16 couleurs</div>
    <div class="resize-handle" id="resize"></div>`;
  }

  protected setup(): void {
    this.canvas  = this.shadow.getElementById('screen') as HTMLCanvasElement;
    this._ctx    = this.canvas.getContext('2d')!;
    this._imgData = this._ctx.createImageData(SCREEN_W, SCREEN_H);
    this._pixels  = this._imgData.data;

    // Fond noir initial
    this._clearPixels(0);
    this._flush();

    // Fermer
    this.shadow.getElementById('close')!
      .addEventListener('click', () => this.hide());

    // Coordonnées au survol
    this.canvas.addEventListener('mousemove', (e) => {
      const r  = this.canvas.getBoundingClientRect();
      const px = Math.floor((e.clientX - r.left)  / r.width  * SCREEN_W);
      const py = Math.floor((e.clientY - r.top)   / r.height * SCREEN_H);
      this.shadow.getElementById('coords')!.textContent =
        `x=${px} y=${py} · ${this._mode === 0 ? 'TXT' : 'GFX'}`;
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.shadow.getElementById('coords')!.textContent =
        `128 × 128 · 16 couleurs`;
    });

    // Bus
    this.sub('chuck:cpu-halted', () => this._setLive(false));
    this.sub('chuck:cpu-reset',  () => { this._setLive(false); this._clearPixels(0); this._flush(); });
    this.sub('chuck:run',        () => this._setLive(true));
    this.sub('chuck:stop',       () => this._setLive(false));

    // Réception VRAM depuis l'émulateur
    // L'émulateur envoie toute la VRAM $4000–$7FFF dans bytes
    this.sub('chuck:memory-data', ({ address, bytes }) => {
      if (address !== 0x4000) return; // on n'attend que le snapshot complet
      // Reconstruit un tableau 64 Ko partiel pour les lookups d'adresses
      // On alloue un buffer avec offset $4000 pour que les index soient cohérents
      const ram = new Uint8Array(0x10000);
      ram.set(bytes, address);
      if (this._mode === 0) {
        this._renderText(ram);
      } else {
        this._renderGfx(ram);
      }
      this._flush();
    });

    // Mode vidéo
    (this as any)._sub_vpu = bus.on('chuck:vpu-mode' as any, ({ mode }: { mode: number }) => {
      this._mode = mode;
      this._updateModeBadge();
    });

    // Drag + resize
    makeDraggable(this, this.shadow.getElementById('bar')!);
    makeResizable(this, this.shadow.getElementById('resize')!);
  }

  // ── API publique ─────────────────────────────────────────────

  show():   void { this.classList.add('visible'); }
  hide():   void { this.classList.remove('visible'); }
  toggle(): void { this.classList.toggle('visible'); }

  /** Mise à jour complète depuis un snapshot de la RAM WASM */
  fullRedraw(ram: Uint8Array, mode: number): void {
    this._mode = mode;
    this._updateModeBadge();
    if (mode === 0) {
      this._renderText(ram);
    } else {
      this._renderGfx(ram);
    }
    this._flush();
  }

  // ── Rendu mode graphique ──────────────────────────────────────

  private _renderGfx(ram: Uint8Array): void {
    for (let y = 0; y < SCREEN_H; y++) {
      for (let x = 0; x < SCREEN_W; x += 2) {
        const addr  = FRAMEBUF_A + y * GFX_STRIDE + x / 2;
        const byte  = ram[addr] ?? 0;
        const colorL = (byte >> 4) & 0x0F;  // pixel x   (nibble haut)
        const colorR =  byte       & 0x0F;  // pixel x+1 (nibble bas)
        this._setPixel(x,   y, colorL);
        this._setPixel(x+1, y, colorR);
      }
    }
  }

  // ── Rendu mode texte ──────────────────────────────────────────

  private _renderText(ram: Uint8Array): void {
    for (let row = 0; row < TEXT_ROWS; row++) {
      for (let col = 0; col < TEXT_COLS; col++) {
        const textAddr = VRAM_TEXT + row * 32 + col;
        const attrAddr = VRAM_ATTR + row * 32 + col;
        const ch    = ram[textAddr] ?? 0x20;
        const attr  = ram[attrAddr] ?? 0x01; // défaut blanc sur noir
        const ink   =  attr & 0x0F;
        const paper = (attr >> 4) & 0x0F;

        this._renderChar(ch, col * CHAR_W, row * CHAR_H, ink, paper, ram);
      }
    }
  }

  /**
   * Affiche un caractère 4×4 à la position pixel (px, py).
   * Le charset Chuck-8 est à $F800 : 96 chars × 4 octets
   * Chaque octet = 1 ligne de 4 pixels (bits 7-4 = pixels 0-3)
   */
  private _renderChar(
    ch: number, px: number, py: number,
    ink: number, paper: number, ram: Uint8Array
  ): void {
    // Caractères imprimables $20–$7F → index 0–95
    const charIdx = Math.max(0, Math.min(95, (ch & 0x7F) - 0x20));
    const base    = CHARSET_ROM + charIdx * 4;

    for (let row = 0; row < CHAR_H; row++) {
      const lineByte = ram[base + row] ?? 0;
      for (let bit = 0; bit < CHAR_W; bit++) {
        // bit 7-4 = pixels 0-3 (MSB = pixel le plus à gauche)
        const isSet = (lineByte >> (7 - bit)) & 1;
        this._setPixel(px + bit, py + row, isSet ? ink : paper);
      }
    }
  }

  // ── Primitives pixel ──────────────────────────────────────────

  private _setPixel(x: number, y: number, colorIdx: number): void {
    if (x < 0 || x >= SCREEN_W || y < 0 || y >= SCREEN_H) return;
    const off    = (y * SCREEN_W + x) * 4;
    const ci     = (colorIdx & 0x0F) * 4;
    this._pixels[off]     = PALETTE[ci]!;
    this._pixels[off + 1] = PALETTE[ci + 1]!;
    this._pixels[off + 2] = PALETTE[ci + 2]!;
    this._pixels[off + 3] = 0xFF;
  }

  private _clearPixels(colorIdx: number): void {
    const [r, g, b] = palColor(colorIdx);
    for (let i = 0; i < this._pixels.length; i += 4) {
      this._pixels[i]     = r;
      this._pixels[i + 1] = g;
      this._pixels[i + 2] = b;
      this._pixels[i + 3] = 0xFF;
    }
  }

  private _flush(): void {
    this._ctx.putImageData(this._imgData, 0, 0);
  }

  // ── État ─────────────────────────────────────────────────────

  private _setLive(on: boolean): void {
    const live = this.shadow.getElementById('live-badge') as HTMLElement;
    live.style.display = on ? 'block' : 'none';
  }

  private _updateModeBadge(): void {
    const badge = this.shadow.getElementById('mode-badge')!;
    badge.textContent = this._mode === 0 ? 'TXT' : 'GFX';
    badge.className   = `mode-badge${this._mode === 1 ? ' gfx' : ''}`;
  }
}

customElements.define('chuck-display', ChuckDisplay);

// ── Utilitaires partagés drag / resize ───────────────────────

export function makeDraggable(host: HTMLElement, handle: HTMLElement): void {
  let dragging = false, ox = 0, oy = 0;

  handle.addEventListener('mousedown', (e) => {
    if ((e.target as Element).closest('button')) return;
    dragging = true;
    const r = host.getBoundingClientRect();
    ox = e.clientX - r.left;
    oy = e.clientY - r.top;
    host.style.transition = 'none';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const x = Math.max(0, Math.min(window.innerWidth  - host.offsetWidth,  e.clientX - ox));
    const y = Math.max(0, Math.min(window.innerHeight - host.offsetHeight, e.clientY - oy));
    host.style.left = `${x}px`;
    host.style.top  = `${y}px`;
    host.style.right = 'auto';
  });

  document.addEventListener('mouseup', () => {
    if (dragging) {
      dragging = false;
      host.style.transition = '';
      document.body.style.userSelect = '';
    }
  });
}

export function makeResizable(host: HTMLElement, handle: HTMLElement): void {
  let resizing = false, sw = 0, sh = 0, sx = 0, sy = 0;

  handle.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    resizing = true;
    sw = host.offsetWidth;  sh = host.offsetHeight;
    sx = e.clientX;         sy = e.clientY;
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!resizing) return;
    host.style.width  = `${Math.max(200, sw + e.clientX - sx)}px`;
    host.style.height = `${Math.max(160, sh + e.clientY - sy)}px`;
  });

  document.addEventListener('mouseup', () => {
    if (resizing) { resizing = false; document.body.style.userSelect = ''; }
  });
}