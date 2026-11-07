import Phaser from 'phaser';
import { HEIGHT, SEABED_Y, WIDTH } from '../config';
import { Lineage, LIFE_TICKS, basketTarget } from '../sim/generations';
import { TICKS_PER_SECOND } from '../sim/reef';
import { PALETTE, desaturate, drawReef, healthToSaturation, makeTextures } from '../ui/reefArt';

type Kind = 'grazer' | 'predator' | 'urchin';

interface Critter {
  sprite: Phaser.GameObjects.Image;
  kind: Kind;
  vx: number;
  vy: number;
}

const MAX_VISIBLE: Record<Kind, number> = { grazer: 40, predator: 12, urchin: 40 };
const REACH = 46;
const DIVER_SPEED = 220;
const PLANTS_PER_LIFE = 6;
/** Planting unlocks once the reveal has happened (start of generation 3). */
const PLANT_FROM_GENERATION = 2;
/** Debug: `?speed=10` runs the reef ten times faster, for testing whole runs. */
const SPEED = Number(new URLSearchParams(location.search).get('speed')) || 1;

/** One 90-second life on the reef. */
export class DiveScene extends Phaser.Scene {
  private lineage!: Lineage;
  private reefGfx!: Phaser.GameObjects.Graphics;
  private waterGfx!: Phaser.GameObjects.Graphics;
  private hudGfx!: Phaser.GameObjects.Graphics;
  private diver!: Phaser.GameObjects.Image;
  private target = new Phaser.Math.Vector2(WIDTH / 2, 200);
  private pending: Critter | null = null;
  private critters: Critter[] = [];
  private tickAcc = 0;
  private netUsed = false;
  private plantsLeft = PLANTS_PER_LIFE;
  private basketText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private ending = false;

  constructor() {
    super('Dive');
  }

  create(): void {
    makeTextures(this);
    this.lineage = this.registry.get('lineage') as Lineage;
    this.critters = [];
    this.pending = null;
    this.tickAcc = 0;
    this.netUsed = false;
    this.plantsLeft = PLANTS_PER_LIFE;
    this.ending = false;

    this.waterGfx = this.add.graphics();
    this.reefGfx = this.add.graphics();
    this.diver = this.add.image(WIDTH / 2, 120, 'diver').setDepth(10);
    this.target.set(WIDTH / 2, 200);
    this.hudGfx = this.add.graphics().setDepth(20);

    const style = { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '18px', color: '#f4ecd8' };
    this.basketText = this.add.text(WIDTH - 24, 18, '', style).setOrigin(1, 0).setDepth(21);
    this.add.text(24, 14, 'REEF', { ...style, fontSize: '14px' }).setDepth(21);
    this.hint = this.add
      .text(WIDTH / 2, HEIGHT - 14, this.hintText(), { ...style, fontSize: '13px', color: '#cfe7ee' })
      .setOrigin(0.5, 1)
      .setDepth(21);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointer(p.worldX, p.worldY));
    this.input.keyboard?.on('keydown-N', () => this.useNet());
    this.input.keyboard?.on('keydown-P', () => this.plantHere());

    this.syncCritters();
    this.redraw();
  }

  private hintText(): string {
    const parts = ['click fish to catch', 'click urchins to clear', 'N: nursery net'];
    if (this.lineage.generation >= PLANT_FROM_GENERATION) parts.push(`P: plant coral (${this.plantsLeft})`);
    return parts.join('   ·   ');
  }

  private onPointer(x: number, y: number): void {
    if (this.ending) return;
    const hit = this.critters.find((c) => Phaser.Math.Distance.Between(x, y, c.sprite.x, c.sprite.y) < 22);
    this.pending = hit ?? null;
    this.target.set(x, Phaser.Math.Clamp(y, 40, SEABED_Y + 60));
  }

  private useNet(): void {
    if (this.netUsed || this.ending) return;
    this.netUsed = true;
    this.lineage.reef.protect(8);
    this.add.image(this.diver.x, this.diver.y, 'net').setAlpha(0.8).setDepth(5);
  }

  private plantHere(): void {
    if (this.ending || this.lineage.generation < PLANT_FROM_GENERATION || this.plantsLeft <= 0) return;
    const patches = this.lineage.reef.state.patches;
    const index = Phaser.Math.Clamp(Math.floor((this.diver.x / WIDTH) * patches.length), 0, patches.length - 1);
    if (this.diver.y < SEABED_Y - 80) return; // must be near the seabed
    this.lineage.reef.plant(index, 0.15);
    this.plantsLeft--;
    this.hint.setText(this.hintText());
    this.redraw();
  }

  update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    this.moveDiver(dt);
    this.moveCritters(dt);
    if (this.ending) return;

    this.tickAcc += dt * TICKS_PER_SECOND * SPEED;
    let stepped = false;
    while (this.tickAcc >= 1 && !this.lineage.lifeOver) {
      this.lineage.step();
      this.tickAcc -= 1;
      stepped = true;
    }
    if (stepped) {
      this.syncCritters();
      this.redraw();
    }
    if (this.lineage.lifeOver) this.endLife();
  }

  private moveDiver(dt: number): void {
    const d = Phaser.Math.Distance.Between(this.diver.x, this.diver.y, this.target.x, this.target.y);
    if (d > 2) {
      const step = Math.min(d, DIVER_SPEED * dt);
      const a = Phaser.Math.Angle.Between(this.diver.x, this.diver.y, this.target.x, this.target.y);
      this.diver.x += Math.cos(a) * step;
      this.diver.y += Math.sin(a) * step;
      this.diver.setFlipX(Math.cos(a) < 0);
    }
    if (this.pending && !this.ending) {
      const c = this.pending;
      this.target.set(c.sprite.x, c.sprite.y);
      if (Phaser.Math.Distance.Between(this.diver.x, this.diver.y, c.sprite.x, c.sprite.y) < REACH) {
        this.act(c);
        this.pending = null;
      }
    }
  }

  private act(c: Critter): void {
    if (c.kind === 'urchin') {
      if (this.lineage.reef.clearUrchins(1) === 0) return;
    } else if (this.lineage.catchFish(c.kind, 1) === 0) {
      return;
    }
    this.tweens.add({
      targets: c.sprite,
      y: c.kind === 'urchin' ? c.sprite.y + 30 : 0,
      alpha: 0,
      duration: 400,
      onComplete: () => c.sprite.destroy(),
    });
    this.critters = this.critters.filter((x) => x !== c);
    this.syncCritters();
    this.redraw();
  }

  private moveCritters(dt: number): void {
    for (const c of this.critters) {
      if (c.kind === 'urchin') continue;
      const s = c.sprite;
      // Fish shy away from the diver.
      const d = Phaser.Math.Distance.Between(s.x, s.y, this.diver.x, this.diver.y);
      if (d < 90) {
        const a = Phaser.Math.Angle.Between(this.diver.x, this.diver.y, s.x, s.y);
        c.vx += Math.cos(a) * 120 * dt;
        c.vy += Math.sin(a) * 120 * dt;
      }
      c.vx = Phaser.Math.Clamp(c.vx + (Math.random() - 0.5) * 30 * dt, -90, 90);
      c.vy = Phaser.Math.Clamp(c.vy + (Math.random() - 0.5) * 20 * dt, -30, 30);
      s.x += c.vx * dt;
      s.y += c.vy * dt;
      if (s.x < 10 || s.x > WIDTH - 10) c.vx *= -1;
      if (s.y < 60 || s.y > SEABED_Y + 20) c.vy *= -1;
      s.x = Phaser.Math.Clamp(s.x, 10, WIDTH - 10);
      s.y = Phaser.Math.Clamp(s.y, 60, SEABED_Y + 20);
      s.setFlipX(c.vx < 0);
    }
  }

  /** Keep the number of visible animals in line with the simulation. */
  private syncCritters(): void {
    const s = this.lineage.reef.state;
    const want: Record<Kind, number> = {
      grazer: Math.min(MAX_VISIBLE.grazer, Math.round(s.grazers)),
      predator: Math.min(MAX_VISIBLE.predator, Math.round(s.predators)),
      urchin: Math.min(MAX_VISIBLE.urchin, Math.round(s.urchins)),
    };
    for (const kind of Object.keys(want) as Kind[]) {
      const have = this.critters.filter((c) => c.kind === kind);
      for (let i = have.length; i < want[kind]; i++) this.spawn(kind);
      for (let i = want[kind]; i < have.length; i++) {
        const c = have[i];
        c.sprite.destroy();
        this.critters = this.critters.filter((x) => x !== c);
      }
    }
  }

  private spawn(kind: Kind): void {
    const x = Phaser.Math.Between(20, WIDTH - 20);
    const y = kind === 'urchin' ? Phaser.Math.Between(SEABED_Y + 30, SEABED_Y + 70) : Phaser.Math.Between(80, SEABED_Y);
    const sprite = this.add.image(x, y, kind).setDepth(kind === 'urchin' ? 4 : 6);
    this.critters.push({ sprite, kind, vx: Phaser.Math.Between(-40, 40), vy: 0 });
  }

  private redraw(): void {
    const l = this.lineage;
    const sat = healthToSaturation(l.trueHealth);

    // Water: tinted by true health.
    const w = this.waterGfx;
    w.clear();
    w.fillGradientStyle(
      desaturate(PALETTE.waterTop, sat),
      desaturate(PALETTE.waterTop, sat),
      desaturate(PALETTE.waterBottom, sat),
      desaturate(PALETTE.waterBottom, sat),
      1,
    );
    w.fillRect(0, 0, WIDTH, HEIGHT);
    w.fillStyle(0xffffff, 0.05 * sat);
    for (let i = 0; i < 5; i++) w.fillTriangle(120 + i * 180, 0, 180 + i * 180, 0, 60 + i * 200, SEABED_Y);

    const patches = l.reef.state.patches;
    this.reefGfx.clear();
    drawReef(
      this.reefGfx,
      0,
      SEABED_Y - 60,
      WIDTH,
      HEIGHT - SEABED_Y + 60,
      patches.map((p) => p.coral),
      patches.map((p) => p.algae),
      sat,
    );
    for (const c of this.critters) c.sprite.setTint(desaturate(0xffffff, sat));

    // HUD: the lying meter, the basket and the fading light (time left).
    const h = this.hudGfx;
    h.clear();
    h.fillStyle(0x000000, 0.35);
    h.fillRoundedRect(68, 16, 204, 20, 6);
    h.fillStyle(0x7ee081, 1);
    h.fillRoundedRect(70, 18, 200 * l.meter, 16, 5);
    const left = 1 - l.lifeTick / LIFE_TICKS;
    h.fillStyle(0xfff3d6, 0.6);
    h.fillRect(0, 0, WIDTH * left, 4);
    this.basketText.setText(`basket ${l.food} / ${basketTarget(l.generation)}`);
  }

  private endLife(): void {
    if (this.ending) return;
    this.ending = true;
    this.pending = null;
    const flash = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xffffff, 0).setDepth(30);
    this.tweens.add({
      targets: flash,
      alpha: { from: 0.9, to: 0 },
      duration: 600,
      onComplete: () => {
        this.lineage.endLife();
        this.cameras.main.fadeOut(500, 11, 29, 42);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start(this.lineage.finished ? 'End' : 'Handover');
        });
      },
    });
  }
}
