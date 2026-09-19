import { isSolved, move, startPositions, type Board, type Positions } from './board.ts';
import { DIRS, type Dir } from './types.ts';

export interface SolverMove {
  id: number;
  dir: Dir;
}

export interface Solution {
  /** Fewest swipes that herd every sheep (the level's par). */
  par: number;
  moves: SolverMove[];
  /** Distinct positions explored — a rough "how big is this puzzle" number. */
  explored: number;
}

/** Pieces of the same kind are interchangeable, so the key sorts positions per kind. */
function keyOf(b: Board, pos: Positions): string {
  const groups: Record<string, number[]> = {};
  b.start.forEach((p, i) => (groups[p.kind] ??= []).push(pos[i]));
  return Object.keys(groups)
    .sort()
    .map((k) => groups[k].sort((a, c) => a - c).join(','))
    .join('|');
}

/** Breadth-first search over swipes. Returns null when the level can't be solved within `limit` states. */
export function solve(b: Board, from: Positions = startPositions(b), limit = 400_000): Solution | null {
  if (isSolved(b, from)) return { par: 0, moves: [], explored: 1 };
  const parent = new Map<string, { prev: string; move: SolverMove } | null>();
  const startKey = keyOf(b, from);
  parent.set(startKey, null);
  let frontier: [string, Positions][] = [[startKey, from]];

  while (frontier.length) {
    const next: [string, Positions][] = [];
    for (const [key, pos] of frontier) {
      for (let id = 0; id < pos.length; id++) {
        for (const dir of DIRS) {
          const r = move(b, pos, id, dir);
          if (r.to === pos[id]) continue;
          const np = pos.slice();
          np[id] = r.to;
          const nk = keyOf(b, np);
          if (parent.has(nk)) continue;
          parent.set(nk, { prev: key, move: { id, dir } });
          if (isSolved(b, np)) return { ...trace(parent, nk), explored: parent.size };
          if (parent.size > limit) return null;
          next.push([nk, np]);
        }
      }
    }
    frontier = next;
  }
  return null;
}

function trace(parent: Map<string, { prev: string; move: SolverMove } | null>, key: string) {
  const moves: SolverMove[] = [];
  for (let link = parent.get(key); link; link = parent.get(link.prev)) moves.unshift(link.move);
  return { par: moves.length, moves };
}
