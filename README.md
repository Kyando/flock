# Flock

A cozy sliding-tile puzzle prototype (Pudding Monsters × Herd). Swipe a sheep, goat or hay bale and it slides until something stops it. Get every sheep into a pen. The in-game text is in Brazilian Portuguese.

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
| Sheep | `s` (`S` = already on a pen) | Slides; must end on a pen `o`. |
| Goat | `g` | Slides, and hops over a piece in its way when the tile beyond is free. |
| Hay bale | `h` | Slides; a movable wall. Ignores mushrooms. |
| Rock / Tree | `#` / `T` | Block. Rocks can be jumped over; trees can't. |
| Mud | `~` | Whatever enters it stops. |
| Arrows | `^ > v <` | Turn whatever passes over them. |
| Mushroom | `*` | Launches animals over the next tile (rock, water, gap or piece); if they can't land, they stop on it. |
| Water / void | `=` / `_` | Block sliding; water can be jumped over. |

Levels live in `src/levels/*.json`, ordered by file name. To find new layouts:

```bash
node scripts/search-levels.ts 6x6 "ss oo ## h" --feature h --par 5-9
```

`--feature` keeps only layouts that become impossible (or longer) without that element.
