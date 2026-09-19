import { isSolved, move, sheepCount, sheepHome, startPositions, type Board, type MoveResult, type Positions } from '../core/board.ts';
import type { Dir } from '../core/types.ts';
import type { LevelProgress } from './save.ts';

/** Stars for a finished run: par earns three, a little over par two, anything else one. */
export function starsFor(moves: number, par: number): number {
  if (moves <= par) return 3;
  if (moves <= par + Math.max(2, Math.ceil(par / 2))) return 2;
  return 1;
}

/** One level being played: positions, undo history and the move counter. */
export class Session {
  readonly board: Board;
  readonly par: number;
  readonly progress: LevelProgress;
  private readonly persist: () => void;
  pos: Positions;
  private history: Positions[] = [];

  constructor(board: Board, par: number, progress: LevelProgress, persist: () => void) {
    this.board = board;
    this.par = par;
    this.progress = progress;
    this.persist = persist;
    this.pos = startPositions(board);
  }

  get moves(): number {
    return this.history.length;
  }

  get solved(): boolean {
    return isSolved(this.board, this.pos);
  }

  get home(): number {
    return sheepHome(this.board, this.pos);
  }

  get sheep(): number {
    return sheepCount(this.board);
  }

  get canUndo(): boolean {
    return this.history.length > 0;
  }

  pieceAt(cell: number): number {
    return this.pos.indexOf(cell);
  }

  /** What a swipe would do, without doing it. */
  preview(id: number, dir: Dir): MoveResult {
    return move(this.board, this.pos, id, dir);
  }

  /** Applies a swipe. Returns null when the piece can't budge (no move is spent). */
  swipe(id: number, dir: Dir): MoveResult | null {
    if (this.solved) return null;
    const r = move(this.board, this.pos, id, dir);
    if (r.to === this.pos[id]) return null;
    this.history.push(this.pos);
    this.pos = this.pos.slice();
    this.pos[id] = r.to;
    if (this.solved) this.finish();
    return r;
  }

  undo(): boolean {
    const prev = this.history.pop();
    if (!prev) return false;
    this.pos = prev;
    return true;
  }

  restart(): void {
    this.history = [];
    this.pos = startPositions(this.board);
  }

  private finish(): void {
    const p = this.progress;
    p.done = true;
    p.best = p.best === null ? this.moves : Math.min(p.best, this.moves);
    p.stars = Math.max(p.stars, starsFor(this.moves, this.par));
    this.persist();
  }
}
