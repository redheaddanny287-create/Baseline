import Phaser from 'phaser';
import { HEIGHT, WIDTH } from '../config';
import { Lineage } from '../sim/generations';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    this.add
      .text(WIDTH / 2, HEIGHT / 2 - 60, 'BASELINE', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '64px',
        color: '#f4ecd8',
      })
      .setOrigin(0.5);
    const dive = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 40, 'Dive', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '28px',
        color: '#0b1d2a',
        backgroundColor: '#ffb35c',
        padding: { x: 24, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    dive.on('pointerdown', () => {
      // A fresh chain of caretakers. The seed varies so each run's reef differs slightly.
      this.registry.set('lineage', new Lineage(Math.floor(Math.random() * 1e9)));
      this.registry.set('revealed', false);
      this.scene.start('Dive');
    });
  }
}
