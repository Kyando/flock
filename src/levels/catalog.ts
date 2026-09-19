import { parseBoard, type Board } from '../core/board.ts';
import type { LevelDef } from '../core/types.ts';

export interface CatalogEntry {
  def: LevelDef;
  board: Board;
  /** Fewest swipes, precomputed by `npm run levels -- --write`. */
  par: number;
}

// Levels are ordered by file name (01-..., 02-...).
const modules = import.meta.glob<LevelDef>('./*.json', { eager: true, import: 'default' });

export const CATALOG: CatalogEntry[] = Object.keys(modules)
  .sort()
  .flatMap((path) => {
    try {
      const def = modules[path];
      return [{ def, board: parseBoard(def), par: def.par ?? 0 }];
    } catch (err) {
      console.error(`Fase ignorada (${path}):`, err);
      return [];
    }
  });
