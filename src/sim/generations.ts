import { Reef, TICKS_PER_SECOND } from './reef';

export const LIFE_SECONDS = 90;
export const LIFE_TICKS = LIFE_SECONDS * TICKS_PER_SECOND;
export const GENERATIONS = 6;

/** Food the village needs in a given generation (0-based). The village grows each time. */
export function basketTarget(generation: number): number {
  return 22 + generation * 4;
}

export interface Keepsake {
  generation: number;
  /** True coral cover when the photo was taken (0..1). */
  coral: number;
  /** True reef health against generation 1 when the photo was taken. */
  trueHealth: number;
  /** Fish visible in the photo. */
  grazers: number;
  predators: number;
  algae: number;
  /** Per-patch coral cover, so the photo can be redrawn exactly. */
  patches: number[];
}

/**
 * Runs the chain of caretakers. Holds the "lying" meter: each life's 100%
 * is the reef as that caretaker found it, not as it once was.
 */
export class Lineage {
  readonly reef: Reef;
  generation = 0;
  lifeTick = 0;
  food = 0;
  /** Reef health when the current caretaker arrived. The shifting baseline. */
  baseline: number;
  /** Reef health at the very start of generation 1. The honest baseline. */
  readonly original: number;
  readonly keepsakes: Keepsake[] = [];

  constructor(seed = 1) {
    this.reef = new Reef(seed);
    this.original = this.reef.health;
    this.baseline = this.original;
  }

  /** What the HUD shows: health relative to how this caretaker found the reef. */
  get meter(): number {
    return Math.min(1, this.reef.health / this.baseline);
  }

  /** The truth the meter hides: health against generation 1. Drives colour and music. */
  get trueHealth(): number {
    return Math.min(1.25, this.reef.health / this.original);
  }

  get lifeOver(): boolean {
    return this.lifeTick >= LIFE_TICKS;
  }

  get finished(): boolean {
    return this.generation >= GENERATIONS;
  }

  /** Reef has tipped into the degraded state (low coral, algae dominant). */
  get collapsed(): boolean {
    return this.reef.coralCover < 0.3 && this.reef.algaeCover > 0.5;
  }

  /** Recovery ending: pushed back past where generation 1 started. */
  get recovered(): boolean {
    return this.reef.health >= this.original;
  }

  step(): void {
    if (this.lifeOver || this.finished) return;
    this.reef.step();
    this.lifeTick++;
  }

  catchFish(species: 'grazer' | 'predator', count = 1): number {
    const gained = this.reef.fish(species, count);
    this.food += gained;
    return gained;
  }

  /** End the current life: take the photo, hand over to the next caretaker. */
  endLife(): Keepsake {
    const keepsake: Keepsake = {
      generation: this.generation,
      coral: this.reef.coralCover,
      trueHealth: this.trueHealth,
      grazers: Math.round(this.reef.state.grazers + this.reef.state.protectedGrazers),
      predators: Math.round(this.reef.state.predators),
      algae: this.reef.algaeCover,
      patches: this.reef.state.patches.map((p) => p.coral),
    };
    this.keepsakes.push(keepsake);
    this.reef.releaseProtected();
    // Time passes between caretakers: the reef keeps going without anyone tending it.
    for (let i = 0; i < LIFE_TICKS; i++) this.reef.step();
    this.generation++;
    this.lifeTick = 0;
    this.food = 0;
    this.baseline = Math.max(0.01, this.reef.health);
    return keepsake;
  }
}
