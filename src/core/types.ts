export type Dir = 'up' | 'down' | 'left' | 'right';

export const DIRS: readonly Dir[] = ['up', 'right', 'down', 'left'];
export const DELTA: Record<Dir, readonly [dx: number, dy: number]> = {
  up: [0, -1],
  right: [1, 0],
  down: [0, 1],
  left: [-1, 0],
};

/**
 * Ground under the pieces.
 * - grass: plain floor.  - void: no ground (off the pasture), blocks like the edge.
 * - rock: blocks.  - pen: a sheep resting here counts as herded.  - mud: whatever slides in, stops.
 */
export type Terrain = { kind: 'grass' } | { kind: 'void' } | { kind: 'rock' } | { kind: 'pen' } | { kind: 'mud' };

/** Things the player swipes. Sheep must reach the pens and can jump over each other; hay is a heavy block. */
export type PieceKind = 'sheep' | 'hay';

export interface LevelDef {
  id: string;
  title: string;
  /** One line shown under the title — usually introduces the level's new idea. */
  tip?: string;
  /** Marks the element a level introduces (shown as a "Novo" chip). */
  intro?: string;
  /**
   * ASCII map, one string per row. Legend:
   *  .  grass      _  void      #  rock      o  pen      ~  mud
   *  s  sheep      S  sheep already on a pen      h  hay bale
   */
  map: string[];
  /** Fewest swipes that solve it — written by `npm run levels -- --write`. */
  par?: number;
}
