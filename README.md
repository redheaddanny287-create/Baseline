# Baseline

A coral reef, six caretakers, and a health meter that quietly lies.

Baseline is our entry for [GitHub Game Off 2026](https://itch.io/jam/game-off-2026) (theme: **SHIFT**). You tend a reef for one 90-second life, then hand it to the next caretaker. Each caretaker's "100% healthy" is the reef they inherited, so slow decline hides in plain sight: a *shifting baseline*. Photos left by earlier caretakers are the only way to see what has been lost, and once the reef tips into an algae-covered state, getting it back takes more than undoing the damage.

## Play

Click or tap to swim. Click fish to catch them for the village's basket, click urchins to pry them off the reef. `N` drops a nursery net over young fish (once per life). From the third caretaker on, `P` plants a coral fragment where you are.

## Develop

```sh
npm install
npm run dev      # local dev server
npm test         # simulation tests
npm run tune     # headless runs of whole games with scripted caretakers
npm run build    # production build in dist/ (upload the zip of dist/ to itch.io)
```

Add `?speed=10` to the URL to run the reef ten times faster while testing.

### Layout

- `src/sim/` — the reef simulation and the chain of caretakers. Pure, seeded and deterministic; no rendering.
- `src/scenes/` — Title, Dive, Handover (with the reveal), End.
- `src/ui/` — procedural reef art. Colour follows the reef's *true* health.
- `tools/tune.ts` — tuning harness used by the tests.

The coral/algae dynamics follow Mumby, Hastings & Edwards (2007), *Thresholds and the resilience of Caribbean coral reefs*, Nature 450:98–101, which has two stable states and hysteresis. Fish, urchins and everything else are game design.

## Credits

Made by Happyhustle with AI-assisted development (Claude). Built with [Phaser](https://phaser.io).

## License

MIT
