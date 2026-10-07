# City occupancy and navigation checks

These checks transpile the real TypeScript modules with a minimal Cocos stub. They cover the single-owner occupancy model, 16px navigation, wall/gate masks, building core collision, A*, relocation transactions, and fixed-slot drag gestures. They do not cover engine event delivery or rendering.

Run with Node.js and TypeScript 5.8.3 available:

```sh
node tests/building-relocation.cjs
```

If TypeScript is installed outside the project, set `TYPESCRIPT_PATH` to its package directory (the directory containing its package.json). No game dependency needs to be installed or changed.

Creator 3.8.8 preview checks still required:
- Confirm 12 empty slots, 4 gates, wall corners, mirrored east pieces, and hidden empty art under occupied slots.
- Walk through empty slots and gates; verify building cores and solid walls cannot be crossed.
- Drag each placed building onto a legal slot, its original slot, an occupied slot, UI, and outside the city.
- Test click without dragging, dragging away and back, Esc/right click, Space+left pan, window blur and release outside the canvas.
- Test viewport zoom/edge scrolling while dragging, two squads with active routes, and floor transition after a successful move.
- Confirm the same barracks squad and enabled/economy state survive; base/resource objects and all wall/gate owners remain intact.

Defaults: an 8 screen-pixel drag threshold; green/red ghost; no relocation cost. Original building and occupancy remain in place until a valid drop. Touch-only relocation is not implemented in this mouse-first version.
