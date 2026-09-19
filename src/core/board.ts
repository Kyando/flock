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
  how: 'slide' | 'hop' | 'spring';
  /** Direction of travel after this step (arrows can turn it). */
  dir: Dir;
}

export interface MoveResult {
  steps: Step[];
  /** Where the piece ends up (same as the start when it couldn't budge). */
  to: number;
  /** Why it stopped — handy for sound/feedback. */
  stop: 'blocked' | 'mud' | 'spring' | 'loop';
}

const TERRAIN: Record<string, Terrain> = {
  '.': { kind: 'grass' },
  _: { kind: 'void' },
  '=': { kind: 'water' },
  '#': { kind: 'rock' },
  T: { kind: 'tree' },
  o: { kind: 'pen' },
  '~': { kind: 'mud' },
  '^': { kind: 'arrow', dir: 'up' },
  '>': { kind: 'arrow', dir: 'right' },
  v: { kind: 'arrow', dir: 'down' },
  '<': { kind: 'arrow', dir: 'left' },
  '*': { kind: 'spring' },
};
const PIECES: Record<string, [PieceKind, Terrain]> = {
  s: ['sheep', { kind: 'grass' }],
  S: ['sheep', { kind: 'pen' }],
  g: ['goat', { kind: 'grass' }],
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

const isGround = (t: Terrain) => t.kind !== 'void' && t.kind !== 'water' && t.kind !== 'rock' && t.kind !== 'tree';

/**
 * Slides `mover` in `dir` until something stops it. `occupied(cell)` tells whether another piece is there.
 *
 * Rules:
 * - Pieces slide tile by tile until the next tile is an edge, void, rock, tree or another piece.
 * - Mud stops whatever enters it. Arrows turn whatever enters them.
 * - Springs launch animals (not hay) over the next tile — a rock, water, gap or piece, but not a tree —
 *   and they keep sliding from where they land. If the landing tile is taken, they stop on the spring.
 * - Goats hop over a piece in their way when the tile beyond is free, and keep sliding.
 */
export function simulate(
  b: Board,
  mover: PieceKind,
  from: number,
  dir: Dir,
  occupied: (cell: number) => boolean,
): MoveResult {
  const free = (c: number) => c >= 0 && isGround(b.terrain[c]) && !occupied(c);
  const steps: Step[] = [];
  const seen = new Set<string>();
  let at = from;
  let heading = dir;

  const finish = (stop: MoveResult['stop']): MoveResult => ({ steps, to: at, stop });

  for (;;) {
    const key = `${at}:${heading}`;
    if (seen.has(key)) return finish('loop');
    seen.add(key);

    const next = step(b, at, heading);
    if (free(next)) {
      at = next;
      steps.push({ at, how: 'slide', dir: heading });
    } else {
      const beyond = next >= 0 ? step(b, next, heading) : -1;
      if (mover === 'goat' && next >= 0 && occupied(next) && free(beyond)) {
        at = beyond;
        steps.push({ at, how: 'hop', dir: heading });
      } else {
        return finish('blocked');
      }
    }

    // Tile effects on arrival. A spring can chain into another tile's effect, hence the loop.
    for (;;) {
      const t = b.terrain[at];
      if (t.kind === 'mud') return finish('mud');
      if (t.kind === 'arrow') {
        heading = t.dir;
        steps[steps.length - 1].dir = heading;
        break;
      }
      if (t.kind === 'spring' && mover !== 'hay') {
        const over = step(b, at, heading);
        const land = over >= 0 ? step(b, over, heading) : -1;
        if (b.terrain[over]?.kind === 'tree' || !free(land)) return finish('spring');
        at = land;
        steps.push({ at, how: 'spring', dir: heading });
        continue;
      }
      break;
    }
  }
}

/** Plain-data game state: where each piece is. Index = piece id. */
export type Positions = number[];

export const startPositions = (b: Board): Positions => b.start.map((p) => p.at);

export function move(b: Board, pos: Positions, id: number, dir: Dir): MoveResult {
  const others = new Set(pos.filter((_, i) => i !== id));
  return simulate(b, b.start[id].kind, pos[id], dir, (c) => others.has(c));
}

export function isSolved(b: Board, pos: Positions): boolean {
  return b.start.every((p, i) => p.kind !== 'sheep' || b.terrain[pos[i]].kind === 'pen');
}

export const sheepHome = (b: Board, pos: Positions): number =>
  b.start.filter((p, i) => p.kind === 'sheep' && b.terrain[pos[i]].kind === 'pen').length;

export const sheepCount = (b: Board): number => b.start.filter((p) => p.kind === 'sheep').length;
