/**
 * Random level search: drops pieces and props on a pasture, keeps layouts whose optimal solution
 * falls in a par range and that really need the featured element. A starting point for hand-tuning.
 *
 *   node scripts/search-levels.ts <w>x<h> "<items>" [--par 4-8] [--feature ~] [--tries 4000] [--seed 1] [--base "row|row"]
 *   node scripts/search-levels.ts 6x6 "ss oo ## h" --feature h --par 5-9
 *
 * Items use the map legend (s S h o # ~ _). `--feature X` keeps only layouts that become unsolvable (or longer)
 * when every X is turned into grass; `--feature jump` does the same with jumping turned off. `--base` gives a
 * fixed map to drop items on.
 */
import { parseBoard } from '../src/core/board.ts';
import { solve } from '../src/core/solver.ts';

const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const [size = '6x6', items = 'ss oo ###'] = args;
const [w, h] = size.split('x').map(Number);
const glyphs = items.replace(/\s+/g, '').split('');
const [minPar, maxPar] = opt('par', '4-9').split('-').map(Number);
const feature = opt('feature', '');
const tries = Number(opt('tries', '4000'));
const base = opt('base', '');
let seed = Number(opt('seed', '1'));
const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;

const PIECE_ON = { s: '.', S: 'o', h: '.' } as Record<string, string>;
const found = new Map<string, { par: number; without: string; map: string[]; explored: number }>();

for (let t = 0; t < tries; t++) {
  const cells = base ? base.split('|').join('').split('') : Array.from({ length: w * h }, () => '.');
  const free = cells.flatMap((c, i) => (c === '.' ? [i] : []));
  for (const g of glyphs) {
    const k = Math.floor(rand() * free.length);
    cells[free[k]] = g;
    free.splice(k, 1);
  }
  const map = Array.from({ length: h }, (_, y) => cells.slice(y * w, y * w + w).join(''));
  const key = map.join('|');
  if (found.has(key)) continue;
  let sol;
  try {
    sol = solve(parseBoard({ id: 'search', title: '', map }), undefined, 80_000);
  } catch {
    continue;
  }
  if (!sol || sol.par < minPar || sol.par > maxPar) continue;
  let without = '';
  if (feature) {
    const noJump = feature === 'jump';
    const plain = noJump ? map : map.map((r) => r.split('').map((c) => (c === feature ? (PIECE_ON[c] ?? '.') : c)).join(''));
    try {
      const alt = solve(parseBoard({ id: 'alt', title: '', map: plain }), undefined, 80_000, { jump: !noJump });
      if (alt && alt.par <= sol.par) continue;
      without = alt ? `sem ${feature}: par ${alt.par}` : `sem ${feature}: impossível`;
    } catch {
      without = `sem ${feature}: inválido`;
    }
  }
  found.set(key, { par: sol.par, without, map, explored: sol.explored });
}

const best = [...found.values()].sort((a, b) => b.par - a.par || a.explored - b.explored).slice(0, 8);
for (const b of best) console.log(`par ${b.par} (${b.explored} estados) ${b.without}\n${JSON.stringify(b.map)}\n`);
if (!best.length) console.log('Nada encontrado — tente outro tamanho, itens ou --par.');
