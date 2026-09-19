import { xy, type MoveResult } from '../core/board.ts';
import { DELTA, DIRS, type Dir, type PieceKind, type Terrain } from '../core/types.ts';
import type { Session } from '../game/session.ts';
import { h, reducedMotion, svg } from './dom.ts';
import { burst, replay } from './fx.ts';
import { ICONS } from './icons.ts';
import type { Sfx } from './sfx.ts';

export interface LevelViewOptions {
  session: Session;
  number: number;
  total: number;
  sfx: Sfx;
  onSolved(): void;
}

export const PIECE_GLYPH: Record<PieceKind, string> = { sheep: '🐑', hay: '🌾' };
export const PIECE_NAME: Record<PieceKind, string> = { sheep: 'Ovelha', hay: 'Fardo de feno' };
const KEY_DIR: Record<string, Dir> = {
  ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left',
  w: 'up', d: 'right', s: 'down', a: 'left',
};

/** Milliseconds per animated beat. */
const T_SLIDE = 70;
const T_JUMP = 300;

/** Renders one terrain tile's contents (the tile itself is styled by its class). */
export function tileArt(t: Terrain): Node | null {
  switch (t.kind) {
    case 'rock':
      return h('span', { class: 'prop' }, '🪨');
    case 'pen':
      return h('span', { class: 'pen-mark', 'aria-hidden': 'true' });
    default:
      return null;
  }
}

interface Gesture {
  pointer: number;
  id: number;
  x: number;
  y: number;
}

export class LevelView {
  readonly el: HTMLElement;
  private readonly s: Session;
  private readonly opts: LevelViewOptions;
  private readonly wrap: HTMLElement;
  private readonly field: HTMLElement;
  private readonly pieces: HTMLElement[] = [];
  private readonly facing: number[] = [];
  private readonly undoBtn: HTMLButtonElement;
  private readonly movesEl: HTMLElement;
  private readonly homeEl: HTMLElement;
  private readonly resizeObserver: ResizeObserver;
  private cell = 64;
  private busy = false;
  private gesture: Gesture | null = null;
  private selected = -1;

  constructor(opts: LevelViewOptions) {
    this.opts = opts;
    this.s = opts.session;
    const b = this.s.board;
    const def = b.def;

    const heading = h(
      'header',
      { class: 'chapter' },
      h(
        'p',
        { class: 'eyebrow' },
        h('span', {}, `Fase ${opts.number} de ${opts.total}`),
        this.s.progress.done ? h('span', { class: 'stars-mini', title: 'Sua melhor marca' }, starRow(this.s.progress.stars)) : null,
      ),
      h('h1', {}, def.title),
      def.tip ? h('p', { class: 'subtitle' }, def.intro ? h('span', { class: 'chip' }, 'Novo') : null, def.tip) : null,
    );

    // Field: terrain tiles in a grid (the ground layer draws the pasture outline), pieces absolutely positioned on top.
    const ground = h('div', { class: 'ground', 'aria-hidden': 'true' });
    this.field = h('div', { class: 'field', role: 'application', 'aria-label': 'Pasto. Deslize os animais e o feno.' }, ground);
    this.field.style.setProperty('--cols', String(b.width));
    this.field.style.setProperty('--rows', String(b.height));
    b.terrain.forEach((t, i) => {
      const [x, y] = xy(b, i);
      const classes = ['tile', `tile--${t.kind}`, (x + y) % 2 ? 'alt' : ''];
      // Rounded outer corners only where the pasture ends.
      if (t.kind !== 'void') {
        const open = (dx: number, dy: number) => {
          const nx = x + dx;
          const ny = y + dy;
          return nx < 0 || ny < 0 || nx >= b.width || ny >= b.height || b.terrain[ny * b.width + nx].kind === 'void';
        };
        if (open(0, -1) && open(-1, 0)) classes.push('r-tl');
        if (open(0, -1) && open(1, 0)) classes.push('r-tr');
        if (open(0, 1) && open(-1, 0)) classes.push('r-bl');
        if (open(0, 1) && open(1, 0)) classes.push('r-br');
      }
      ground.append(h('div', { class: classes.filter(Boolean).join(' '), style: `grid-area: ${y + 1} / ${x + 1}` }, tileArt(t)));
    });
    b.start.forEach((p) => {
      const el = h(
        'button',
        { type: 'button', class: `piece piece--${p.kind}`, 'data-id': String(p.id) },
        h('span', { class: 'piece-shadow', 'aria-hidden': 'true' }),
        h('span', { class: 'piece-body' }, h('span', { class: 'piece-glyph', 'aria-hidden': 'true' }, PIECE_GLYPH[p.kind])),
        h('span', { class: 'piece-dirs', 'aria-hidden': 'true' }, ...DIRS.map((d) => h('i', { class: `dir dir--${d}` }))),
      );
      el.addEventListener('focus', () => this.select(p.id));
      el.addEventListener('blur', () => this.select(-1));
      el.addEventListener('keydown', (e) => this.onKey(e, p.id));
      this.pieces.push(el);
      this.facing.push(1);
      this.field.append(el);
    });
    this.field.addEventListener('pointerdown', (e) => this.onDown(e));
    this.field.addEventListener('pointermove', (e) => this.onMove(e));
    this.field.addEventListener('pointerup', (e) => this.onUp(e));
    this.field.addEventListener('pointercancel', () => this.endGesture());
    this.wrap = h('div', { class: 'field-wrap' }, this.field);

    // Status + tools
    this.homeEl = h('span', { class: 'hud-home' });
    this.movesEl = h('span', { class: 'hud-moves' });
    const hud = h('div', { class: 'hud', role: 'status', 'aria-live': 'polite' }, this.homeEl, this.movesEl);
    const tool = (text: string, glyph: string, onClick: () => void) =>
      h('button', { type: 'button', class: 'btn btn--tool', onclick: onClick }, svg(glyph), h('span', { class: 'btn-label' }, text));
    this.undoBtn = tool('Desfazer', ICONS.undo, () => this.undo());
    const tools = h('nav', { class: 'tools', 'aria-label': 'Ferramentas' }, tool('Recomeçar', ICONS.restart, () => this.restart()), this.undoBtn);

    this.el = h('main', { class: 'stage' }, heading, this.wrap, h('footer', { class: 'dock' }, hud, tools));

    this.resizeObserver = new ResizeObserver(() => this.fit());
    this.resizeObserver.observe(this.wrap);
    this.sync();
  }

  destroy(): void {
    this.resizeObserver.disconnect();
  }

  // ── layout ──────────────────────────────────────────────────────────────

  private fit(): void {
    const b = this.s.board;
    const { width, height } = this.wrap.getBoundingClientRect();
    if (!width || !height) return;
    const cell = Math.floor(Math.min(width / b.width, height / b.height, 104));
    this.cell = Math.max(30, cell);
    this.field.style.setProperty('--cell', `${this.cell}px`);
    this.placeAll();
  }

  private px(at: number): [number, number] {
    const [x, y] = xy(this.s.board, at);
    return [x * this.cell, y * this.cell];
  }

  private place(id: number, at = this.s.pos[id]): void {
    const [x, y] = this.px(at);
    this.pieces[id].style.transform = `translate(${x}px, ${y}px)`;
  }

  private placeAll(): void {
    this.s.pos.forEach((at, id) => this.place(id, at));
  }

  private sync(): void {
    const s = this.s;
    const b = s.board;
    s.pos.forEach((at, id) => {
      const el = this.pieces[id];
      const kind = b.start[id].kind;
      const [x, y] = xy(b, at);
      el.classList.toggle('is-home', kind === 'sheep' && b.terrain[at].kind === 'pen');
      el.setAttribute('aria-label', `${PIECE_NAME[kind]}, linha ${y + 1}, coluna ${x + 1}`);
      el.style.setProperty('--face', String(this.facing[id]));
    });
    this.homeEl.replaceChildren(h('b', {}, `${s.home}/${s.sheep}`), ' no curral');
    this.movesEl.replaceChildren('Movimentos ', h('b', {}, String(s.moves)), h('span', { class: 'par' }, ` · meta ${s.par}`));
    this.undoBtn.disabled = !s.canUndo || s.solved;
    this.field.classList.toggle('is-solved', s.solved);
    if (this.selected >= 0) this.showDirs(this.selected);
  }

  // ── input ───────────────────────────────────────────────────────────────

  private pieceFromEvent(e: PointerEvent): number {
    const btn = (e.target as Element).closest<HTMLElement>('.piece');
    if (btn) return Number(btn.dataset.id);
    // Forgiving touch: a press on a tile holding a piece grabs it.
    const r = this.field.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / this.cell);
    const y = Math.floor((e.clientY - r.top) / this.cell);
    const b = this.s.board;
    if (x < 0 || y < 0 || x >= b.width || y >= b.height) return -1;
    return this.s.pieceAt(y * b.width + x);
  }

  private onDown(e: PointerEvent): void {
    if (this.gesture || this.s.solved) return;
    const id = this.pieceFromEvent(e);
    if (id < 0) {
      this.pieces[this.selected]?.blur();
      return;
    }
    e.preventDefault();
    this.field.setPointerCapture(e.pointerId);
    this.gesture = { pointer: e.pointerId, id, x: e.clientX, y: e.clientY };
    this.pieces[id].focus({ preventScroll: true });
    this.pieces[id].classList.add('is-grabbed');
    this.opts.sfx.pick();
  }

  private onMove(e: PointerEvent): void {
    const g = this.gesture;
    if (!g || e.pointerId !== g.pointer) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    const threshold = Math.max(14, this.cell * 0.28);
    if (Math.hypot(dx, dy) < threshold) return;
    const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    this.endGesture();
    this.swipe(g.id, dir);
  }

  private onUp(e: PointerEvent): void {
    if (this.gesture?.pointer === e.pointerId) this.endGesture();
  }

  private endGesture(): void {
    const g = this.gesture;
    if (!g) return;
    this.pieces[g.id].classList.remove('is-grabbed');
    if (this.field.hasPointerCapture(g.pointer)) this.field.releasePointerCapture(g.pointer);
    this.gesture = null;
  }

  private onKey(e: KeyboardEvent, id: number): void {
    const dir = KEY_DIR[e.key];
    if (!dir) return;
    e.preventDefault();
    this.swipe(id, dir);
  }

  private select(id: number): void {
    if (this.selected >= 0) this.pieces[this.selected].classList.remove('is-selected');
    this.selected = id;
    if (id >= 0) {
      this.pieces[id].classList.add('is-selected');
      this.showDirs(id);
    }
  }

  /** Little chevrons around the selected piece show which ways it can go. */
  private showDirs(id: number): void {
    const el = this.pieces[id];
    for (const d of DIRS) {
      const r = this.s.preview(id, d);
      el.querySelector(`.dir--${d}`)?.classList.toggle('on', !this.s.solved && r.to !== this.s.pos[id]);
    }
  }

  // ── actions ─────────────────────────────────────────────────────────────

  private async swipe(id: number, dir: Dir): Promise<void> {
    if (this.busy || this.s.solved) return;
    const from = this.s.pos[id];
    const r = this.s.swipe(id, dir);
    const el = this.pieces[id];
    if (!r) {
      this.nudge(el, dir);
      this.opts.sfx.nope();
      return;
    }
    this.busy = true;
    if (dir === 'left' || dir === 'right') this.facing[id] = dir === 'right' ? -1 : 1;
    el.style.setProperty('--face', String(this.facing[id]));
    if (r.stop === 'jump') this.opts.sfx.hop();
    else this.opts.sfx.slide();
    await this.animate(id, from, r);
    this.busy = false;
    this.land(id, r);
    this.sync();
    if (this.s.solved) this.celebrate();
  }

  private animate(id: number, from: number, r: MoveResult): Promise<void> {
    const el = this.pieces[id];
    if (reducedMotion()) {
      this.place(id);
      return Promise.resolve();
    }
    const [x0, y0] = this.px(from);
    const [x1, y1] = this.px(r.to);
    let anim: Animation;
    if (r.stop === 'jump') {
      // One arc over the other sheep: up, a little bigger, and down two tiles away.
      const lift = this.cell * 0.55;
      anim = el.animate(
        [
          { transform: `translate(${x0}px, ${y0}px) scale(1)` },
          { transform: `translate(${(x0 + x1) / 2}px, ${(y0 + y1) / 2 - lift}px) scale(1.18)`, offset: 0.5 },
          { transform: `translate(${x1}px, ${y1}px) scale(1)` },
        ],
        { duration: T_JUMP, easing: 'ease-in-out' },
      );
    } else {
      anim = el.animate([{ transform: `translate(${x0}px, ${y0}px)` }, { transform: `translate(${x1}px, ${y1}px)` }], {
        duration: Math.max(1, r.steps.length * T_SLIDE),
        easing: 'linear',
      });
    }
    el.classList.add('is-moving');
    this.place(id);
    return anim.finished.then(
      () => el.classList.remove('is-moving'),
      () => el.classList.remove('is-moving'),
    );
  }

  private land(id: number, r: MoveResult): void {
    const el = this.pieces[id];
    const body = el.querySelector('.piece-body')!;
    const kind = this.s.board.start[id].kind;
    replay(body, r.stop === 'mud' ? 'splat' : 'land');
    if (r.stop === 'mud') this.opts.sfx.mud();
    else this.opts.sfx.thud();
    if (kind === 'sheep' && this.s.board.terrain[r.to].kind === 'pen' && !this.s.solved) this.opts.sfx.baa();
  }

  private nudge(el: HTMLElement, dir: Dir): void {
    if (reducedMotion()) return;
    const [dx, dy] = DELTA[dir];
    const k = this.cell * 0.12;
    el.querySelector('.piece-body')!.animate(
      [{ transform: 'translate(0, 0)' }, { transform: `translate(${dx * k}px, ${dy * k}px)` }, { transform: 'translate(0, 0)' }],
      { duration: 180, easing: 'ease-out' },
    );
  }

  private celebrate(): void {
    this.pieces[this.selected]?.blur();
    const r = this.field.getBoundingClientRect();
    this.opts.sfx.win();
    burst(r.left + r.width / 2, r.top + r.height / 2, ['🐑', '✨', '🌼', '💛']);
    window.setTimeout(() => this.opts.onSolved(), reducedMotion() ? 200 : 900);
  }

  undo(): void {
    if (this.busy || !this.s.undo()) return;
    this.opts.sfx.pick();
    this.glideAll();
  }

  restart(): void {
    if (this.busy || !this.s.canUndo) return;
    this.s.restart();
    this.opts.sfx.pick();
    this.glideAll();
  }

  /** Short straight glide back to the stored positions (undo / restart). */
  private glideAll(): void {
    this.pieces.forEach((el, id) => {
      const before = el.style.transform;
      this.place(id);
      if (!reducedMotion() && before !== el.style.transform) {
        el.animate([{ transform: before }, { transform: el.style.transform }], { duration: 180, easing: 'ease-out' });
      }
    });
    this.sync();
  }
}

export function starRow(n: number, total = 3): string {
  return '★'.repeat(n) + '☆'.repeat(total - n);
}
