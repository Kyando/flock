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
 * - water: a stream; blocks sliding like void, but can be jumped over.
 * - rock: low obstacle, can be jumped over.  - tree: tall obstacle, never jumped.
 * - pen: a sheep resting here counts as herded.  - mud: whatever slides in, stops.
 * - arrow: turns whatever slides in.  - spring: launches animals over the next tile.
 */
export type Terrain =
  | { kind: 'grass' }
  | { kind: 'void' }
  | { kind: 'water' }
  | { kind: 'rock' }
  | { kind: 'tree' }
  | { kind: 'pen' }
  | { kind: 'mud' }
  | { kind: 'arrow'; dir: Dir }
  | { kind: 'spring' };

/** Things the player swipes. Sheep must reach the pens; goats hop over pieces; hay is a heavy block. */
export type PieceKind = 'sheep' | 'goat' | 'hay';

export interface LevelDef {
  id: string;
  title: string;
  /** One line shown under the title — usually introduces the level's new idea. */
  tip?: string;
  /** Marks the element a level introduces (shown as a "Novo" chip). */
  intro?: string;
  /**
   * ASCII map, one string per row. Legend:
   *  .  grass      _  void      =  water     #  rock      T  tree     o  pen     ~  mud
   *  ^ > v <  arrows          *  spring (mushroom)
   *  s  sheep      S  sheep already on a pen
   *  g  goat       h  hay bale
   */
  map: string[];
  /** Fewest swipes that solve it — written by `npm run levels -- --write`. */
  par?: number;
}
