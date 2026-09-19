# Flock

A cozy sliding-tile puzzle prototype (Pudding Monsters × Herd). Swipe a sheep or hay bale and it slides until something stops it. Get every sheep into a pen. The in-game text is in Brazilian Portuguese.

**Play:** https://kyando.github.io/flock/

```bash
npm install
npm run dev      # the game
npm test         # rules + every level solvable in its stored par
npm run levels   # solves each level and prints the optimal solution (--write stores the par)
npm run deploy   # builds and publishes dist/ to the gh-pages branch
```

## Rules

| Piece / ground | Map | Behaviour |
| --- | --- | --- |
| Sheep | `s` (`S` = already on a pen) | Slides until blocked; must end on a pen `o`. |
| Jump | — | Swiping a sheep towards an adjacent sheep makes it leap over, land two tiles away and stop. A jump is its own move: a sliding sheep never jumps. |
| Hay bale | `h` | Slides like a sheep; a movable wall. Can't be jumped. |
| Rock | `#` | Blocks. |
| Mud | `~` | Whatever enters it stops. |
| Void | `_` | No ground; shapes the pasture. |

Levels live in `src/levels/*.json`, ordered by file name. To find new layouts:

```bash
node scripts/search-levels.ts 6x6 "ss oo ## h" --feature h --par 5-9
```

`--feature` keeps only layouts that become impossible (or longer) without that element; `--feature jump` checks jumping instead. Random placement rarely needs jumps, so fix adjacent sheep with `--base`:

```bash
node scripts/search-levels.ts 5x5 "oo # ~" --base ".....|.....|.ss..|.....|....." --feature jump --par 4-7
```
