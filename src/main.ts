import Phaser from 'phaser';
import { TitleScene } from './scenes/TitleScene';
import { DiveScene } from './scenes/DiveScene';
import { HandoverScene } from './scenes/HandoverScene';
import { EndScene } from './scenes/EndScene';
import { HEIGHT, WIDTH } from './config';


new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: '#0b1d2a',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [TitleScene, DiveScene, HandoverScene, EndScene],
});
