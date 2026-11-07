import Phaser from 'phaser';
import { HEIGHT, WIDTH } from '../config';
import { Lineage } from '../sim/generations';
import { drawPhoto } from '../ui/reefArt';

/** The reveal happens when this generation's caretaker arrives (0-based: the third caretaker). */
export const REVEAL_GENERATION = 2;

/**
 * Between lives: the beach hut, where every caretaker's photo hangs on a shelf.
 * At the start of generation 3 the first photo is held up beside the reef as it
 * is now, with no words.
 */
export class HandoverScene extends Phaser.Scene {
  constructor() {
    super('Handover');
  }

  create(): void {
    const lineage = this.registry.get('lineage') as Lineage;
    this.cameras.main.setBackgroundColor('#3b2a1e');
    this.cameras.main.fadeIn(400);

    const g = this.add.graphics();
    // Shelf of photos, oldest on the left.
    const pw = 120;
    const ph = 70;
    lineage.keepsakes.forEach((k, i) => {
      const x = 60 + i * (pw + 30);
      drawPhoto(g, x, 60, pw, ph, k.patches, k.trueHealth, k.grazers + k.predators * 3);
    });
    g.fillStyle(0x6b4a32, 1);
    g.fillRect(40, 60 + ph + 18, WIDTH - 80, 10);

    const revealNow = lineage.generation === REVEAL_GENERATION && !this.registry.get('revealed');
    if (revealNow) {
      this.registry.set('revealed', true);
      this.reveal(lineage);
    } else {
      this.prompt();
    }
  }

  /** The wordless side-by-side: the first photo next to the reef as it is today. */
  private reveal(lineage: Lineage): void {
    const first = lineage.keepsakes[0];
    const now = lineage.reef;
    const g = this.add.graphics().setAlpha(0);
    const w = 360;
    const h = 210;
    drawPhoto(g, 90, 220, w, h, first.patches, first.trueHealth, first.grazers + first.predators * 3);
    drawPhoto(
      g,
      WIDTH - 90 - w,
      220,
      w,
      h,
      now.state.patches.map((p) => p.coral),
      lineage.trueHealth,
      now.state.grazers + now.state.predators * 3,
    );
    this.tweens.add({ targets: g, alpha: 1, duration: 1200, hold: 3500, onComplete: () => this.prompt() });
  }

  private prompt(): void {
    const t = this.add
      .text(WIDTH / 2, HEIGHT - 50, 'Dive', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '24px',
        color: '#0b1d2a',
        backgroundColor: '#ffb35c',
        padding: { x: 20, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    t.on('pointerdown', () => this.scene.start('Dive'));
  }
}
