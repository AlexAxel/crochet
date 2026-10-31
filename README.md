# Crochet — PixiJS 2.5D rebuild

**Play:** https://alexaxel.github.io/crochet/

## Previous version preserved

The complete Alpha 0.6 source is frozen in [archive/alpha-0.6-pre-rebuild](https://github.com/AlexAxel/crochet/tree/archive/alpha-0.6-pre-rebuild).

This is a **new implementation**, not another coordinate adjustment in the old Three.js or XPBD code. The gameplay entrypoint now imports only the new semantic timeline and PixiJS artwork; the original files remain as inactive history.

## New architecture

- **src/core/chainSession.ts**: semantic crochet operation flow (slip knot and one live loop; hook approach, yarn over, draw through, seat). Every completed operation adds one immutable chain link. Rapid keypresses queue up to 20 stitches; undo and reset are deterministic.
- **src/render/PixiTable.ts**: original PixiJS 8 tabletop artwork; front loops and rear bumps hand-drawn as interleaving rounded strands with shaded cotton-like threads and no old 3D geometry. Table pan and zoom-to-cursor.
- **index.html, src/main.ts and src/style.css**: separate minimal studio with hideable hook and red contact point, speed, five colors and sound.

## References checked BEFORE rebuilding

- [Annie's: How to Work Into the Chain](https://www.anniesattic.com/stitch-guide/crochet-guide/crochet-how-tos/how-to-work-into-the-chain) — real front V and back bump anatomy.
- [Made From Yarn: Chain Stitch Anatomy](https://madefromyarn.com/crochet-chain-stitch/) — macro photography of actual links, starting knot and working yarn.
- [Crochet Foundry: Chain Anatomy](https://crochetfoundryblog.com/ch-chain-crochet-tutorial/) — anatomy of front/back loops and lower bump.
- [Crochet.com: How to Chain](https://www.crochet.com/learning-center/basic-stitches/chain) — yarn-over and pull-through in steps.
- [Vogue Knitting: First Steps](https://www.vogueknitting.com/pattern-help/how-to/learn-to-crochet/first-steps/) — turning the hook and controlling tension.
- [VeryPink Knits slow-motion crochet video](https://www.youtube.com/watch?v=DOxxeaELAS4) — reference for moving yarn and hook.
- [Yarn Forge on GitHub](https://github.com/benjamin-cates/yarn-forge) — useful *stitch graph* reference, NOT a ready-made visual hook simulator.
- [Cornell Stitch Meshes](https://www.cs.cornell.edu/projects/stitchmeshes/) — research into existing knitted textiles, NOT a chain-stitch animation engine.

No reference image is shipped as a copied game asset. The visible braid is drawn programmatically.

## Acceptance criteria

1. Start with a slip knot, loose tail and one active loop on the hook; completed chain count is zero.
2. One yarn-over and pull-through produces exactly one CH. One working loop remains.
3. Ten to twenty consecutive stitches accumulate into a compact interlocking braid rather than detached rings. Previous links never vanish or deform due to a physics glitch.
4. Repeated key 1 queues stitches; 2/Backspace undoes; R resets; Space reserved. Mouse drags the desk; scroll zooms toward pointer.

**Limitation:** this is a stylized deterministic visual reconstruction, not a numerically exact yarn-fiber path. The automated tests prove operation counts and stable links, **not** full crochet realism. The visual result still needs review against source photographs and a crochet expert.

## Development

Run npm install, npm test, npm run build or npm run build:pages. After merging to main, GitHub Actions compiles docs and GitHub Pages publishes the game.
