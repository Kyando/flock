import type { PieceKind, Terrain } from '../core/types.ts';
import { emptyProgress, loadSave, writeSave, type ThemeChoice } from '../game/save.ts';
import { Session, starsFor } from '../game/session.ts';
import { CATALOG } from '../levels/catalog.ts';
import { h, svg } from './dom.ts';
import { ICONS } from './icons.ts';
import { LevelView, PIECE_GLYPH, starRow, tileArt } from './level-view.ts';
import { openModal, toast } from './overlay.ts';
import { Sfx } from './sfx.ts';

const GAME_NAME = 'Flock';
const THEME_LABEL: Record<ThemeChoice, string> = { system: 'do sistema', light: 'claro', dark: 'escuro' };

const iconButton = (label: string, glyph: string, onClick: () => void) =>
  h('button', { type: 'button', class: 'icon-btn', 'aria-label': label, title: label, onclick: onClick }, svg(glyph));

/** A tiny standalone tile for the help legend. */
function legendTile(t: Terrain, piece?: PieceKind): HTMLElement {
  return h(
    'span',
    { class: `legend-tile tile tile--${t.kind}` },
    tileArt(t),
    piece ? h('span', { class: `legend-piece piece--${piece}` }, h('span', { class: 'piece-glyph' }, PIECE_GLYPH[piece])) : null,
  );
}

export class App {
  private readonly save = loadSave();
  private readonly sfx = new Sfx(this.save.settings.sound);
  private readonly main: HTMLElement;
  private readonly soundBtn: HTMLButtonElement;
  private view: LevelView | null = null;
  private index = 0;

  constructor(root: HTMLElement) {
    this.applyTheme();
    this.soundBtn = iconButton('Som', ICONS.soundOn, () => this.toggleSound());
    this.updateSoundIcon();

    const header = h(
      'header',
      { class: 'topbar' },
      h('div', { class: 'topbar-side' }, iconButton('Fases', ICONS.book, () => this.openLevels())),
      h('div', { class: 'brand' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, '🐑'), GAME_NAME),
      h(
        'div',
        { class: 'topbar-side end' },
        iconButton('Como jogar', ICONS.help, () => this.openHelp()),
        this.soundBtn,
        iconButton('Tema', ICONS.theme, () => this.cycleTheme()),
      ),
    );
    this.main = h('div', { class: 'main' });
    root.append(header, this.main);

    if (!CATALOG.length) {
      this.main.append(h('p', { class: 'empty' }, 'Nenhuma fase válida encontrada em src/levels.'));
      return;
    }
    const last = CATALOG.findIndex((l) => l.def.id === this.save.settings.lastLevel);
    const firstOpen = CATALOG.findIndex((l) => !this.save.levels[l.def.id]?.done);
    this.openLevel(last >= 0 ? last : Math.max(0, firstOpen));

    if (!this.save.settings.seenHelp) {
      this.save.settings.seenHelp = true;
      this.persist();
      this.openHelp();
    }
    // Keyboard shortcuts for desktop play.
    window.addEventListener('keydown', (e) => {
      if (document.querySelector('dialog[open]') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'z' || e.key === 'Backspace') this.view?.undo();
      if (e.key === 'r') this.view?.restart();
    });
  }

  private persist(): void {
    writeSave(this.save);
  }

  private openLevel(index: number): void {
    this.view?.destroy();
    this.index = index;
    const entry = CATALOG[index];
    const progress = (this.save.levels[entry.def.id] ??= emptyProgress());
    const session = new Session(entry.board, entry.par, progress, () => this.persist());
    this.view = new LevelView({
      session,
      number: index + 1,
      total: CATALOG.length,
      sfx: this.sfx,
      onSolved: () => this.showWin(session),
    });
    this.main.replaceChildren(this.view.el);
    this.save.settings.lastLevel = entry.def.id;
    this.persist();
  }

  // ── modals ──────────────────────────────────────────────────────────────

  private openLevels(): void {
    const modal = openModal({
      title: 'Fases',
      className: 'modal--levels',
      body: h(
        'ol',
        { class: 'levels' },
        ...CATALOG.map((entry, i) => {
          const progress = this.save.levels[entry.def.id];
          const classes = ['level-card', i === this.index && 'is-current', progress?.done && 'is-done'];
          const kinds = [...new Set(entry.board.start.map((p) => p.kind))];
          return h(
            'li',
            {},
            h(
              'button',
              {
                type: 'button',
                class: classes.filter(Boolean).join(' '),
                onclick: () => {
                  modal.close();
                  this.openLevel(i);
                },
              },
              h('span', { class: 'level-num' }, String(i + 1)),
              h('span', { class: 'level-title' }, entry.def.title),
              h('span', { class: 'level-meta' }, `${entry.board.width}×${entry.board.height} · meta ${entry.par} ${kinds.map((k) => PIECE_GLYPH[k]).join('')}`),
              h('span', { class: 'level-stars', 'aria-label': `${progress?.stars ?? 0} estrelas` }, starRow(progress?.stars ?? 0)),
            ),
          );
        }),
      ),
    });
  }

  private openHelp(): void {
    const item = (tile: HTMLElement, name: string, text: string) =>
      h('li', { class: 'legend-item' }, tile, h('span', {}, h('b', {}, name), ' ', text));
    openModal({
      title: 'Como jogar',
      className: 'modal--help',
      body: h(
        'div',
        { class: 'help' },
        h('p', {}, 'Leve cada ', h('b', {}, 'ovelha'), ' até um ', h('b', {}, 'curral'), '. Arraste o dedo sobre um animal ou fardo: ele desliza até bater em algo.'),
        h(
          'ul',
          { class: 'legend' },
          item(legendTile({ kind: 'pen' }, 'sheep'), 'Ovelha e curral.', 'Toda ovelha precisa terminar num curral.'),
          item(legendTile({ kind: 'grass' }, 'hay'), 'Feno.', 'Desliza como os bichos e serve de parede.'),
          item(legendTile({ kind: 'grass' }, 'goat'), 'Cabra.', 'Pula por cima de quem estiver na frente.'),
          item(legendTile({ kind: 'rock' }), 'Pedra.', 'Bloqueia, mas dá para pular por cima.'),
          item(legendTile({ kind: 'tree' }), 'Árvore.', 'Alta demais: ninguém pula.'),
          item(legendTile({ kind: 'mud' }), 'Lama.', 'Quem entra, para.'),
          item(legendTile({ kind: 'arrow', dir: 'right' }), 'Seta.', 'Vira quem passa por ela.'),
          item(legendTile({ kind: 'spring' }), 'Cogumelo.', 'Lança os bichos uma casa adiante.'),
          item(legendTile({ kind: 'water' }), 'Riacho.', 'Só se atravessa pulando.'),
        ),
        h('p', { class: 'help-foot' }, 'Resolva na ', h('b', {}, 'meta'), ' de movimentos para ganhar ★★★. No teclado: Tab escolhe, setas deslizam, Z desfaz.'),
      ),
      actions: [h('button', { type: 'button', class: 'btn btn--primary', onclick: (e: Event) => (e.target as HTMLElement).closest('dialog')?.close() }, 'Vamos lá')],
    });
  }

  private showWin(session: Session): void {
    const number = this.index + 1;
    const hasNext = number < CATALOG.length;
    const stars = starsFor(session.moves, session.par);
    const stat = (value: number, label: string) => h('div', { class: 'stat' }, h('strong', {}, String(value)), h('span', {}, label));

    const share = () => {
      const text = `${GAME_NAME} · Fase ${number}\n${starRow(stars)} ${session.moves} movimentos (meta ${session.par})\n${'🐑'.repeat(session.sheep)}`;
      navigator.clipboard?.writeText(text).then(
        () => toast('Resultado copiado!'),
        () => toast('Não foi possível copiar'),
      );
    };

    const modal = openModal({
      title: 'Rebanho reunido!',
      className: 'modal--win',
      body: h(
        'div',
        { class: 'win' },
        h('div', { class: 'win-stars', 'aria-label': `${stars} de 3 estrelas` }, ...[1, 2, 3].map((i) => h('span', { class: i <= stars ? 'on' : '' }, '★'))),
        h('p', {}, stars === 3 ? 'Na meta! Pastor de primeira.' : `Dá para fazer em ${session.par}. Quer tentar de novo?`),
        h('div', { class: 'stats' }, stat(session.moves, 'movimentos'), stat(session.par, 'meta')),
      ),
      actions: [
        h('button', { type: 'button', class: 'btn', onclick: share }, svg(ICONS.share), h('span', {}, 'Compartilhar')),
        h('button', { type: 'button', class: 'btn', onclick: () => { modal.close(); this.openLevel(this.index); } }, svg(ICONS.restart), h('span', {}, 'De novo')),
        hasNext
          ? h('button', { type: 'button', class: 'btn btn--primary', onclick: () => { modal.close(); this.openLevel(this.index + 1); } }, h('span', {}, 'Próxima'), svg(ICONS.arrow))
          : h('button', { type: 'button', class: 'btn btn--primary', onclick: () => { modal.close(); this.openLevels(); } }, h('span', {}, 'Fases')),
      ],
    });
  }

  // ── settings ────────────────────────────────────────────────────────────

  private applyTheme(): void {
    const theme = this.save.settings.theme;
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }

  private cycleTheme(): void {
    const order: ThemeChoice[] = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(this.save.settings.theme) + 1) % order.length];
    this.save.settings.theme = next;
    this.applyTheme();
    this.persist();
    toast(`Tema ${THEME_LABEL[next]}`);
  }

  private toggleSound(): void {
    this.save.settings.sound = !this.save.settings.sound;
    this.sfx.enabled = this.save.settings.sound;
    this.updateSoundIcon();
    this.persist();
    if (this.sfx.enabled) this.sfx.baa();
  }

  private updateSoundIcon(): void {
    this.soundBtn.replaceChildren(svg(this.save.settings.sound ? ICONS.soundOn : ICONS.soundOff));
    this.soundBtn.setAttribute('aria-pressed', String(this.save.settings.sound));
  }
}
