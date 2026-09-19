import { DELTA, type Dir, type LevelDef, type PieceKind, type Terrain } from './types.ts';

export interface Piece {
  /** Stable id (index in the level's starting list) so the UI can keep one element per piece. */
  id: number;
  kind: PieceKind;
  /** Cell index: y * width + x. */
  at: number;
}

export interface Board {
  def: LevelDef;
  width: number;
  height: number;
  terrain: Terrain[];
  start: Piece[];
  pens: number[];
}

/** One beat of a move, used by the UI to animate. */
export interface Step {
  at: number;
  how: 'slide' | 'jump';
}

export interface MoveResult {
  steps: Step[];
  /** Where the piece ends up (same as the start when it couldn't budge). */
  to: number;
  /** Why it stopped — handy for sound/feedback. */
  stop: 'blocked' | 'mud' | 'jump';
}

export interface Rules {
  /** Sheep may jump over an adjacent sheep. Off only to measure how much a level needs jumping. */
  jump: boolean;
}

const TERRAIN: Record<string, Terrain> = {
  '.': { kind: 'grass' },
  _: { kind: 'void' },
  '#': { kind: 'rock' },
  o: { kind: 'pen' },
  '~': { kind: 'mud' },
};
const PIECES: Record<string, [PieceKind, Terrain]> = {
  s: ['sheep', { kind: 'grass' }],
  S: ['sheep', { kind: 'pen' }],
  h: ['hay', { kind: 'grass' }],
};

export function parseBoard(def: LevelDef): Board {
  const height = def.map.length;
  const width = Math.max(...def.map.map((r) => r.length));
  if (!height || !width) throw new Error(`${def.id}: mapa vazio`);
  const terrain: Terrain[] = [];
  const start: Piece[] = [];
  def.map.forEach((row, y) => {
    for (let x = 0; x < width; x++) {
      const ch = row[x] ?? '_';
      const at = y * width + x;
      if (PIECES[ch]) {
        const [kind, ground] = PIECES[ch];
        start.push({ id: start.length, kind, at });
        terrain.push(ground);
      } else if (TERRAIN[ch]) {
        terrain.push(TERRAIN[ch]);
      } else {
        throw new Error(`${def.id}: caractere desconhecido "${ch}" em (${x}, ${y})`);
      }
    }
  });
  const pens = terrain.flatMap((t, i) => (t.kind === 'pen' ? [i] : []));
  const sheep = start.filter((p) => p.kind === 'sheep').length;
  if (!sheep) throw new Error(`${def.id}: nenhuma ovelha`);
  if (pens.length < sheep) throw new Error(`${def.id}: menos currais (${pens.length}) que ovelhas (${sheep})`);
  return { def, width, height, terrain, start, pens };
}

export const xy = (b: Board, at: number): [number, number] => [at % b.width, Math.floor(at / b.width)];

/** Neighbour cell in a direction, or -1 when off the board. */
export function step(b: Board, at: number, dir: Dir): number {
  const [x, y] = xy(b, at);
  const [dx, dy] = DELTA[dir];
  const nx = x + dx;
  const ny = y + dy;
  if (nx < 0 || ny < 0 || nx >= b.width || ny >= b.height) return -1;
  return ny * b.width + nx;
}

const isGround = (t: Terrain) => t.kind !== 'void' && t.kind !== 'rock';

/**
 * Moves `mover` in `dir`. `occupant(cell)` tells which piece kind is on a cell, if any.
 *
 * Rules:
 * - A jump is its own action: a sheep swiped towards an adjacent sheep leaps over it, lands two tiles
 *   away and stops there. It needs that landing tile to be free ground; otherwise nothing happens.
 * - Otherwise the piece slides tile by tile until the next tile is an edge, void, rock or another piece.
 *   Sliding never turns into a jump: a sheep that slides into another sheep just stops.
 * - Mud stops whatever enters it.
 */
export function simulate(
  b: Board,
  mover: PieceKind,
  from: number,
  dir: Dir,
  occupant: (cell: number) => PieceKind | null,
  rules: Rules = { jump: true },
): MoveResult {
  const free = (c: number) => c >= 0 && isGround(b.terrain[c]) && !occupant(c);
  const steps: Step[] = [];
  let at = from;

  const first = step(b, from, dir);
  if (rules.jump && mover === 'sheep' && first >= 0 && occupant(first) === 'sheep') {
    const land = step(b, first, dir);
    if (!free(land)) return { steps, to: from, stop: 'blocked' };
    return { steps: [{ at: land, how: 'jump' }], to: land, stop: 'jump' };
  }

  for (;;) {
    const next = step(b, at, dir);
    if (!free(next)) return { steps, to: at, stop: 'blocked' };
    at = next;
    steps.push({ at, how: 'slide' });
    if (b.terrain[at].kind === 'mud') return { steps, to: at, stop: 'mud' };
  }
}

/** Plain-data game state: where each piece is. Index = piece id. */
export type Positions = number[];

export const startPositions = (b: Board): Positions => b.start.map((p) => p.at);

export function move(b: Board, pos: Positions, id: number, dir: Dir, rules?: Rules): MoveResult {
  const kindAt = new Map<number, PieceKind>();
  pos.forEach((c, i) => i !== id && kindAt.set(c, b.start[i].kind));
  return simulate(b, b.start[id].kind, pos[id], dir, (c) => kindAt.get(c) ?? null, rules);
}

export function isSolved(b: Board, pos: Positions): boolean {
  return b.start.every((p, i) => p.kind !== 'sheep' || b.terrain[pos[i]].kind === 'pen');
}

export const sheepHome = (b: Board, pos: Positions): number =>
  b.start.filter((p, i) => p.kind === 'sheep' && b.terrain[pos[i]].kind === 'pen').length;

export const sheepCount = (b: Board): number => b.start.filter((p) => p.kind === 'sheep').length;
