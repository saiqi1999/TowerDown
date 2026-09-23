# Building relocation logic checks

These checks transpile the real TypeScript modules with a minimal Cocos stub. They cover placement transactions and mouse gesture state, not engine event delivery or rendering.

Run with Node.js and TypeScript 5.8.3 available:

```sh
node tests/building-relocation.cjs
```

If TypeScript is installed outside the project, set `TYPESCRIPT_PATH` to its package directory (the directory containing its package.json). No game dependency needs to be installed or changed.

Creator 3.8.8 preview checks still required:
- Drag each placed building onto legal dirt, its original footprint, occupied land, grass, UI, and outside the map.
- Test click without dragging, dragging away and back, Esc/right click, Space+left pan, window blur and release outside the canvas.
- Test viewport zoom/edge scrolling while dragging, two squads with active routes, and floor transition after a successful move.
- Confirm the same barracks squad and enabled/economy state survive; base/resource objects remain fixed.

Defaults: an 8 screen-pixel drag threshold; green/red ghost; no relocation cost. Original building and occupancy remain in place until a valid drop. Touch-only relocation is not implemented in this mouse-first version.
