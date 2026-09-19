import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { move, parseBoard, startPositions, type Board } from '../src/core/board.ts';
import { solve } from '../src/core/solver.ts';
import type { Dir, LevelDef } from '../src/core/types.ts';
import { Session, starsFor } from '../src/game/session.ts';
import { emptyProgress } from '../src/game/save.ts';

const board = (...map: string[]) => parseBoard({ id: 't', title: 't', map });
const cell = (b: Board, x: number, y: number) => y * b.width + x;
const go = (b: Board, id: number, dir: Dir) => move(b, startPositions(b), id, dir);

describe('sliding', () => {
  it('slides until the edge, a rock or another piece', () => {
    const b = board('s..o', '...o', 's.#o');
    expect(go(b, 0, 'right').to).toBe(cell(b, 3, 0));
    expect(go(b, 1, 'right').to).toBe(cell(b, 1, 2));
    expect(go(b, 0, 'down').to).toBe(cell(b, 0, 1));
  });

  it("doesn't move when blocked right away", () => {
    const b = board('s#o');
    expect(go(b, 0, 'right').to).toBe(cell(b, 0, 0));
    expect(go(b, 0, 'right').steps).toHaveLength(0);
  });

  it('treats void and water as walls', () => {
    expect(go(board('s._o'), 0, 'right').to).toBe(1);
    expect(go(board('s.=o'), 0, 'right').to).toBe(1);
  });

  it('stops in mud', () => {
    const b = board('s.~..o');
    const r = go(b, 0, 'right');
    expect(r.to).toBe(2);
    expect(r.stop).toBe('mud');
  });

  it('turns on arrows and stops on one when the new way is blocked', () => {
    const b = board('s.v', '...', '..o');
    expect(go(b, 0, 'right').to).toBe(cell(b, 2, 2));
    const c = board('s.v', '..#', '..o');
    expect(go(c, 0, 'right').to).toBe(cell(c, 2, 0));
  });

  it('gives up on arrow loops instead of spinning forever', () => {
    const b = board('s>v', '.^<', '..o');
    const r = go(b, 0, 'right');
    expect(r.stop).toBe('loop');
  });
});

describe('jumping', () => {
  it('springs launch animals over a rock, water or a piece', () => {
    expect(go(board('s*#..o'), 0, 'right').to).toBe(5);
    expect(go(board('s*=..o'), 0, 'right').to).toBe(5);
    const r = go(board('s*h.#o'), 0, 'right');
    expect(r.to).toBe(3);
    expect(r.steps.map((st) => st.how)).toEqual(['slide', 'spring']);
  });

  it("springs don't clear trees, and the animal waits on the spring when it can't land", () => {
    expect(go(board('s*T..o'), 0, 'right').to).toBe(1);
    expect(go(board('s*##.o'), 0, 'right').to).toBe(1);
  });

  it('hay rolls over springs like grass', () => {
    const b = board('h*.#', 's..o');
    expect(go(b, 0, 'right').to).toBe(2);
  });

  it('goats hop over pieces but not rocks', () => {
    const b = board('gs..o');
    expect(go(b, 0, 'right').to).toBe(4);
    expect(go(b, 0, 'right').steps.map((s) => s.how)).toEqual(['hop', 'slide', 'slide']);
    expect(go(board('g#...', 's...o'), 0, 'right').to).toBe(0);
  });

  it("sheep don't hop", () => {
    expect(go(board('sh..o'), 0, 'right').to).toBe(0);
  });
});

describe('solver and session', () => {
  it('finds the shortest solution', () => {
    const b = board('#....', '..s..', '.....', '....#', 'o....');
    expect(solve(b)?.par).toBe(2);
  });

  it('counts moves, undoes and records the best run', () => {
    const b = board('s..o');
    const progress = emptyProgress();
    const s = new Session(b, 1, progress, () => {});
    expect(s.swipe(0, 'left')).toBeNull();
    expect(s.moves).toBe(0);
    s.swipe(0, 'right');
    expect(s.solved).toBe(true);
    expect(progress).toMatchObject({ done: true, best: 1, stars: 3 });
    s.undo();
    expect(s.solved).toBe(false);
  });

  it('awards stars around par', () => {
    expect(starsFor(5, 5)).toBe(3);
    expect(starsFor(8, 5)).toBe(2);
    expect(starsFor(9, 5)).toBe(1);
  });
});

describe('shipped levels', () => {
  const dir = join(import.meta.dirname, '../src/levels');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    it(`${file} is solvable in its stored par`, () => {
      const def = JSON.parse(readFileSync(join(dir, file), 'utf8')) as LevelDef;
      const sol = solve(parseBoard(def), undefined, 2_000_000);
      expect(sol?.par).toBe(def.par);
    });
  }
});
