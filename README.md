# Crochet Lab — interactive crochet alpha 0.2

**GitHub Pages:** https://alexaxel.github.io/crochet/

Built static website is committed to `main/docs/` automatically by `.github/workflows/build-pages.yml` whenever application code on `main` changes. GitHub Pages source: **Deploy from a branch → main → /docs**. No local dev server is necessary to view the public prototype. The Vite production base path is `/crochet/`. To rebuild manually use `npm run build:pages`.


This is a **real, command-driven stitch graph** with a single procedurally rendered yarn path, not a sprite grid or a stitch GIF. It is a research prototype for a relaxing, top-down Steam crochet game. UI is in Russian.


**Try in browser (StackBlitz GitHub import):** [Open alpha branch](https://stackblitz.com/github/AlexAxel/crochet/tree/alpha/stitched-yarn-prototype?startScript=dev). This uses StackBlitz WebContainers, not a deployed static website; browser compatibility is not yet verified.

## Run

Requires Node.js >= 20.

    npm install
    npm run dev

Open the URL printed by Vite (usually http://localhost:5173). Build and test:

    npm test
    npm run build

## What to try

An example of 14 foundation chains, two 13-SC rows, two explicitly tracked turning chains, and 8 stitches of a third row is loaded immediately. The first chain next to the hook is reserved for turning height: the first SC enters the second chain. Continue with keyboard shortcuts:

| Key | Action | Model semantics |
| --- | --- | --- |
| Space | Chain | Creates one live chained loop; only before first row |
| Enter | Turn | Start the next row once all bases were consumed/skipped |
| 1 | Single crochet (SC) | One output stitch through one base stitch |
| 2 | Increase | Two individually modelled SC stitches through the same base |
| 3 | SC2TOG decrease | One output stitch drawn through two adjacent bases |
| 4 | Skip base | Deliberate mistake; no output stitch |
| Backspace / Ctrl+Z | Unravel | Undo one semantic operation by deterministic replay |
| Ctrl+Y / Ctrl+Shift+Z | Redo | Restore the operation |

Use **Start from zero** to crochet a new foundation chain. Drag the cloth to orbit; scroll to zoom. **Show graph** displays the graph nodes plus a ring around the next foundation. Color swatches alter a procedural yarn material. **Copy JSON** exports the complete command history and stitch graph.

## Architecture / what is actually implemented

- src/core/model.ts — authoritative, deterministic stitch graph; each stitch carries the exact IDs of penetrated parent loop(s) and its primitive instruction trace.
- src/core/geometry.ts — converts a graph and ordered stitch sequence into **one continuous** XYZ yarn path. Stitches in an increase share one parent; a decrease passes through TWO separate parents. Their center positions derive from parents, not fixed per-frame sprites.
- src/render/YarnScene.ts — Three.js WebGL, 3D tube with procedural twisted-fiber canvas texture, free-end thread, procedural hook and skein, orbit controls, animation of newly generated length.
- src/main.ts — actual keyboard command dispatch, replay/undo/redo, debugging controls.
- tests/model.test.ts — structural tests: parent IDs, replay, increase, decrease, skipped stitches, deterministic continuous line.

## Experimental limitations — important for expert review

This is **NOT YET** a verified physically exact crochet simulator. The *graph semantics* are explicit and testable, but the 3D path is an **approximate, stylised local route** through each stitch. It DOES NOT yet enforce exact crossings between every yarn segment and the front/back strands of its parent, preserve knot topology during smoothing, calculate tension/elasticity, simulate the crochet hook insertion animation step by step, or interpret arbitrary published sock patterns. A graph can pass all current automated tests while its yarn geometry is still physically wrong.

**Expert acceptance for a future alpha** should compare a photographed real 10-chain/2-row sample against the same sequence in the viewer, then trace the yarn segment by segment, verify front/back and under/over ordering, and verify the shape after increase, decrease and unravel. Until that test passes, do not market this as equivalent to all real-world patterns.

The command graph and geometry are separate specifically so we can replace the approximate geometric templates with validated ones. Add new primitives and typed geometrical operations as separate modules; do not bake stitch images into the UI. No external GPL algorithm or source code was copied.

No image assets or 3D artist are required for this stage.

## Immersive board and training (0.2)

The prototype is now a fullscreen tabletop with floating tool HUD. Expert-facing stage-by-stage walkthrough explains where the hook enters, what strand is caught, how many live loops are on the hook, and when a finished stitch is committed. Use **1. Как делается ВП?** to clear the demo and start a chain lesson, or **2. Как делается СБН?** to load eight chains and start SC from the second chain from hook. While staging, Space/Enter/ArrowRight advance; ArrowLeft goes back; Escape cancels. No command is written until the final stage.

Uncheck **Поэтапный разбор новых операций** for relaxing one-press-per-stitch gameplay. Click **Последняя петля** to zoom, and use the speed slider to slow yarn reveal.

The schematic lesson visualization is **not computed from the 3D yarn path**; it remains instructional, and the 3D path remains approximate. Passing graph tests does not prove correct knot topology. See EXPERT_REVIEW.md.
