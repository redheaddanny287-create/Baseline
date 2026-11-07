import Phaser from 'phaser';

/**
 * Procedural reef drawing, shared by the live dive and the keepsake photos.
 * Colour saturation follows *true* reef health, so the art never lies even
 * when the meter does.
 */

export const PALETTE = {
  waterTop: 0x1f6f8b,
  waterBottom: 0x0b2f45,
  sand: 0xd9c08c,
  rock: 0x8a8378,
  coral: [0xff7a6b, 0xffb35c, 0xe85d9c, 0xffd36e],
  algae: 0x6b7f3a,
  grazer: 0x4fd1e8,
  grazerFin: 0xffe066,
  predator: 0x2f5d8a,
  urchin: 0x1d1426,
  diver: 0xfff3d6,
};

/** Mix a colour toward its own grey by (1 - saturation). */
export function desaturate(color: number, saturation: number): number {
  const s = Phaser.Math.Clamp(saturation, 0, 1.2);
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const grey = 0.3 * r + 0.59 * g + 0.11 * b;
  const mix = (c: number) => Phaser.Math.Clamp(Math.round(grey + (c - grey) * s), 0, 255);
  return (mix(r) << 16) | (mix(g) << 8) | mix(b);
}

/** Turn true health (1 = generation 1) into a saturation for the art. */
export function healthToSaturation(trueHealth: number): number {
  return Phaser.Math.Clamp(0.15 + 0.85 * trueHealth, 0.1, 1.15);
}

/**
 * Draw a row of reef patches into a rectangle. Each patch gets coral branches
 * proportional to its coral cover and algae fuzz for the rest.
 */
export function drawReef(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  coral: number[],
  algae: number[],
  saturation: number,
): void {
  const n = coral.length;
  const pw = w / n;
  g.fillStyle(desaturate(PALETTE.sand, saturation), 1);
  g.fillRect(x, y + h * 0.75, w, h * 0.25);

  for (let i = 0; i < n; i++) {
    const px = x + i * pw;
    const base = y + h * 0.78;
    // Rock mound under everything.
    g.fillStyle(desaturate(PALETTE.rock, saturation), 1);
    g.fillEllipse(px + pw / 2, base, pw * 1.1, h * 0.22);

    // Algae: a fuzzy carpet, taller the more algae there is.
    const a = algae[i] ?? 0;
    if (a > 0.02) {
      g.fillStyle(desaturate(PALETTE.algae, saturation), 0.9);
      const blades = Math.ceil(a * 6);
      for (let b = 0; b < blades; b++) {
        const bx = px + ((b + 0.5) / blades) * pw;
        g.fillTriangle(bx - 2, base, bx + 2, base, bx + Math.sin(i + b) * 3, base - a * h * 0.45);
      }
    }

    // Coral: branching stalks, height and count by cover.
    const c = coral[i] ?? 0;
    if (c > 0.02) {
      const color = desaturate(PALETTE.coral[i % PALETTE.coral.length], saturation);
      g.lineStyle(Math.max(2, pw * 0.18), color, 1);
      const stalks = 1 + Math.round(c * 2);
      for (let s = 0; s < stalks; s++) {
        const sx = px + ((s + 0.5) / stalks) * pw;
        const top = base - c * h * 0.7 - ((i * 7 + s * 3) % 5) * 2;
        g.lineBetween(sx, base, sx, top);
        g.lineBetween(sx, (base + top) / 2, sx - pw * 0.25, top + 6);
        g.lineBetween(sx, (base + top) / 2 + 4, sx + pw * 0.25, top + 10);
      }
    }
  }
}

/** Draw a keepsake photo: frame, water, reef and a few fish dots. */
export function drawPhoto(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  coral: number[],
  trueHealth: number,
  fish: number,
): void {
  const sat = healthToSaturation(trueHealth);
  g.fillStyle(0xf4ecd8, 1);
  g.fillRect(x - 6, y - 6, w + 12, h + 22);
  g.fillStyle(desaturate(PALETTE.waterTop, sat), 1);
  g.fillRect(x, y, w, h);
  drawReef(g, x, y + h * 0.35, w, h * 0.65, coral, coral.map(() => 0), sat);
  g.fillStyle(desaturate(PALETTE.grazer, sat), 1);
  const dots = Math.min(24, Math.round(fish / 2));
  for (let i = 0; i < dots; i++) {
    const fx = x + 8 + ((i * 37) % (w - 16));
    const fy = y + 8 + ((i * 23) % (h * 0.4));
    g.fillEllipse(fx, fy, 6, 3);
  }
}

/** Build the small textures used for fish, urchins and the diver. */
export function makeTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('grazer')) return;
  const g = scene.add.graphics();

  g.fillStyle(PALETTE.grazer, 1);
  g.fillEllipse(10, 6, 18, 10);
  g.fillStyle(PALETTE.grazerFin, 1);
  g.fillTriangle(0, 1, 0, 11, 5, 6);
  g.generateTexture('grazer', 20, 12);
  g.clear();

  g.fillStyle(PALETTE.predator, 1);
  g.fillEllipse(20, 10, 38, 18);
  g.fillTriangle(0, 1, 0, 19, 8, 10);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(32, 8, 2);
  g.generateTexture('predator', 40, 20);
  g.clear();

  g.lineStyle(2, PALETTE.urchin, 1);
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
    g.lineBetween(10, 10, 10 + Math.cos(a) * 9, 10 + Math.sin(a) * 9);
  }
  g.fillStyle(PALETTE.urchin, 1);
  g.fillCircle(10, 10, 5);
  g.generateTexture('urchin', 20, 20);
  g.clear();

  g.fillStyle(PALETTE.diver, 1);
  g.fillCircle(12, 12, 9);
  g.fillStyle(0x1f6f8b, 1);
  g.fillRect(8, 8, 9, 5);
  g.fillStyle(0xffb35c, 1);
  g.fillRect(2, 18, 6, 10);
  g.generateTexture('diver', 24, 30);
  g.clear();

  g.lineStyle(2, 0xf4ecd8, 0.9);
  g.strokeCircle(22, 22, 20);
  for (let i = -16; i <= 16; i += 8) {
    g.lineBetween(22 + i, 4, 22 + i, 40);
    g.lineBetween(4, 22 + i, 40, 22 + i);
  }
  g.generateTexture('net', 44, 44);
  g.destroy();
}
