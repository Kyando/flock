/**
 * Builds the game and publishes dist/ to the gh-pages branch (GitHub Pages).
 *   npm run deploy
 */
import { execSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const run = (cmd: string, cwd = root) => execSync(cmd, { cwd, stdio: 'inherit' });
const read = (cmd: string) => execSync(cmd, { cwd: root }).toString().trim();

const remote = read('git remote get-url origin');
const sha = read('git rev-parse --short HEAD');

run('npm run build');

const dir = mkdtempSync(join(tmpdir(), 'flock-pages-'));
try {
  cpSync(join(root, 'dist'), dir, { recursive: true });
  writeFileSync(join(dir, '.nojekyll'), '');
  run('git init -q -b gh-pages', dir);
  run('git add -A', dir);
  run(`git commit -q -m "Deploy ${sha}"`, dir);
  run(`git push -f ${remote} gh-pages`, dir);
  console.log(`\nPublicado: gh-pages ← ${sha}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
