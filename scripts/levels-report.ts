/**
 * Solves every level in src/levels and prints its par and an optimal solution.
 *   npm run levels                     (all levels; fails if a stored par is stale)
 *   node scripts/levels-report.ts 03   (levels whose file starts with 03)
 *   npm run levels -- --write          (also stores each level's par in its JSON)
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseBoard, type Board } from '../src/core/board.ts';
import { solve } from '../src/core/solver.ts';
import type { LevelDef } from '../src/core/types.ts';

const dir = join(import.meta.dirname, '../src/levels');
const write = process.argv.includes('--write');
const filter = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? '';
const ARROW = { up: '↑', right: '→', down: '↓', left: '←' } as const;
const NAME = { sheep: 'ovelha', goat: 'cabra', hay: 'feno' } as const;

/** Names pieces by kind and reading order: "ovelha 2", "feno". */
function names(b: Board): string[] {
  const count: Record<string, number> = {};
  const totals: Record<string, number> = {};
  b.start.forEach((p) => (totals[p.kind] = (totals[p.kind] ?? 0) + 1));
  return b.start.map((p) => {
    count[p.kind] = (count[p.kind] ?? 0) + 1;
    return totals[p.kind] > 1 ? `${NAME[p.kind]} ${count[p.kind]}` : NAME[p.kind];
  });
}

let failed = false;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json') && f.startsWith(filter)).sort()) {
  const def = JSON.parse(readFileSync(join(dir, file), 'utf8')) as LevelDef;
  try {
    const b = parseBoard(def);
    const t0 = performance.now();
    const sol = solve(b, undefined, 2_000_000);
    const ms = Math.round(performance.now() - t0);
    if (!sol) {
      failed = true;
      console.log(`✗ ${file}  SEM SOLUÇÃO`);
      continue;
    }
    const stale = def.par !== sol.par;
    if (write && stale) writeFileSync(join(dir, file), JSON.stringify({ ...def, par: sol.par }, null, 2) + '\n');
    else if (stale) failed = true;
    const mark = stale ? (write ? '  (par gravado)' : `  ≠ par no JSON: ${def.par ?? '—'}`) : '';
    const label = names(b);
    const moves = sol.moves.map((m) => `${label[m.id]} ${ARROW[m.dir]}`).join(', ');
    console.log(`✓ ${file}  ${b.width}×${b.height}  par ${sol.par}  (${sol.explored} estados, ${ms}ms)${mark}\n    ${moves}`);
  } catch (err) {
    failed = true;
    console.log(`✗ ${file}  ${(err as Error).message}`);
  }
}
if (failed) process.exitCode = 1;
