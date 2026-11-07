import Phaser from 'phaser';
import { HEIGHT, WIDTH } from '../config';
import { Lineage } from '../sim/generations';
import { drawPhoto } from '../ui/reefArt';

/** Both endings: the whole shelf of photos, then a way back to the title. */
export class EndScene extends Phaser.Scene {
  constructor() {
    super('End');
  }

  create(): void {
    const lineage = this.registry.get('lineage') as Lineage;
    this.cameras.main.setBackgroundColor(lineage.recovered ? '#1f6f8b' : '#2b2b2b');
    this.cameras.main.fadeIn(800);

    const g = this.add.graphics();
    const pw = 130;
    const ph = 80;
    lineage.keepsakes.forEach((k, i) => {
      const x = 40 + i * (pw + 22);
      drawPhoto(g, x, 150, pw, ph, k.patches, k.trueHealth, k.grazers + k.predators * 3);
    });

    const line = lineage.recovered ? 'The reef came back.' : lineage.collapsed ? 'The reef is gone.' : 'The reef held on.';
    const style = { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '32px', color: '#f4ecd8' };
    this.add.text(WIDTH / 2, 80, line, style).setOrigin(0.5);

    const again = this.add
      .text(WIDTH / 2, HEIGHT - 70, 'Again', { ...style, fontSize: '22px', color: '#0b1d2a', backgroundColor: '#ffb35c', padding: { x: 20, y: 8 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    again.on('pointerdown', () => this.scene.start('Title'));
  }
}
