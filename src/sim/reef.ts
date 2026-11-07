import { createRng } from './rng';

/**
 * The reef simulation. Pure and deterministic: no rendering, no wall clock.
 *
 * Ground is a ring of patches, each split between coral, algae and bare rock.
 * Three animal populations act on it:
 *  - grazers eat algae (and are the village's easiest catch),
 *  - predators eat urchins (slow, worth more food),
 *  - urchins graze a little but bore into coral, raising its mortality.
 *
 * The tipping point: with too few grazers, algae spreads over bare rock and
 * coral, and the reef flips to an algae-dominated state that stays put even
 * when grazers return to their old numbers (hysteresis). Fish habitat shrinks
 * with coral, which deepens the trap.
 */

export const TICKS_PER_SECOND = 4;

export interface Patch {
  coral: number;
  algae: number;
  /** Bare rock; always 1 - coral - algae. */
  rock: number;
}

export interface ReefParams {
  patchCount: number;
  /** Reef-years that pass per simulated second. */
  yearsPerSecond: number;
  /** Coral growth over bare rock, per year (Mumby et al. 2007 use r = 1). */
  coralGrowth: number;
  /** Natural coral mortality per year (Mumby: 0.44). */
  coralMortality: number;
  /** Extra coral mortality per year from urchins boring, at urchinRef urchins. */
  urchinBore: number;
  /** Algae overgrowing coral, per year (Mumby: 0.1). */
  algaeOvergrowth: number;
  /** Algae spreading over bare rock, per year (Mumby: 0.8). */
  algaeSpread: number;
  /** Grazing (fraction of grazeable area cleared per year) at grazerRef grazers. */
  grazing: number;
  grazerRef: number;
  urchinRef: number;
  /** Fish and urchin growth rates per second. */
  grazerGrowth: number;
  predatorGrowth: number;
  urchinGrowth: number;
  /** Carrying capacities at full coral habitat. */
  grazerCapacity: number;
  predatorCapacity: number;
  urchinCapacity: number;
  /** Urchins eaten per predator per second, at urchinRef urchins. */
  predation: number;
}

/**
 * Ground dynamics follow the coral / macroalgae / bare-rock model of
 * Mumby, Hastings & Edwards (2007, Nature 450:98), which has two stable states
 * and hysteresis over a range of grazing. Fish and urchins are game additions.
 */
export const DEFAULT_PARAMS: ReefParams = {
  patchCount: 40,
  yearsPerSecond: 0.08,
  coralGrowth: 1,
  coralMortality: 0.3,
  urchinBore: 0.2,
  algaeOvergrowth: 0.1,
  algaeSpread: 0.8,
  grazing: 0.35,
  grazerRef: 40,
  urchinRef: 40,
  grazerGrowth: 0.012,
  predatorGrowth: 0.01,
  urchinGrowth: 0.012,
  grazerCapacity: 60,
  predatorCapacity: 14,
  urchinCapacity: 60,
  predation: 0.04,
};

export interface ReefState {
  patches: Patch[];
  grazers: number;
  predators: number;
  urchins: number;
  /** Grazers under a nursery net this life: they breed but can't be caught. */
  protectedGrazers: number;
  tick: number;
}

export type Species = 'grazer' | 'predator';

export const FOOD_VALUE: Record<Species, number> = { grazer: 1, predator: 3 };

export class Reef {
  readonly params: ReefParams;
  state: ReefState;

  constructor(seed = 1, params: Partial<ReefParams> = {}) {
    this.params = { ...DEFAULT_PARAMS, ...params };
    const rng = createRng(seed);
    const patches: Patch[] = [];
    for (let i = 0; i < this.params.patchCount; i++) {
      // Lush start: ~65% coral, a little algae, the rest bare rock.
      const coral = clamp01(0.65 + (rng() - 0.5) * 0.16);
      const algae = clamp01(Math.min(1 - coral, 0.03 + rng() * 0.04));
      patches.push({ coral, algae, rock: 1 - coral - algae });
    }
    const c = mean(patches.map((p) => p.coral));
    this.state = {
      patches,
      grazers: this.params.grazerCapacity * c * 0.9,
      predators: this.params.predatorCapacity * c * 0.9,
      urchins: 12,
      protectedGrazers: 0,
      tick: 0,
    };
  }

  get coralCover(): number {
    return mean(this.state.patches.map((p) => p.coral));
  }

  /** Fish abundance against a healthy reef's stock (0..~1). Predators count triple: they're big. */
  get fishIndex(): number {
    const p = this.params;
    const s = this.state;
    const ref = 0.8 * (p.grazerCapacity + 3 * p.predatorCapacity);
    return Math.min(1, (s.grazers + s.protectedGrazers + 3 * s.predators) / ref);
  }

  /** Overall reef health: mostly coral, partly fish. This is what the meter measures. */
  get health(): number {
    return 0.6 * this.coralCover + 0.4 * this.fishIndex;
  }

  get algaeCover(): number {
    return mean(this.state.patches.map((p) => p.algae));
  }

  /** Grazing pressure g in the Mumby model, from the live grazer (and urchin) population. */
  get grazingPressure(): number {
    const p = this.params;
    const s = this.state;
    const fish = (s.grazers + s.protectedGrazers) / p.grazerRef;
    return p.grazing * (fish + 0.2 * (s.urchins / p.urchinRef));
  }

  /** Advance one tick (1 / TICKS_PER_SECOND seconds). */
  step(): void {
    const p = this.params;
    const s = this.state;
    const dt = 1 / TICKS_PER_SECOND;
    const years = p.yearsPerSecond * dt;
    const n = s.patches.length;
    const coral = this.coralCover;
    const g = this.grazingPressure;
    const mortality = p.coralMortality + p.urchinBore * (s.urchins / p.urchinRef);

    s.patches = s.patches.map((patch, i) => {
      const left = s.patches[(i - 1 + n) % n].coral;
      const right = s.patches[(i + 1) % n].coral;
      const local = (patch.coral * 2 + left + right) / 4;
      const C = patch.coral;
      const M = patch.algae;
      const T = Math.max(0, 1 - C - M);

      const dC = p.coralGrowth * T * local - mortality * C - p.algaeOvergrowth * M * C;
      const dM = p.algaeOvergrowth * M * C - (g * M) / (M + T + 1e-6) + p.algaeSpread * M * T;

      // Algae never fully vanishes from a reef: a trace re-seeds it.
      let c = clamp01(C + dC * years);
      let m = clamp01(Math.max(0.002, M + dM * years));
      m = Math.min(m, 1 - c);
      return { coral: c, algae: m, rock: 1 - c - m };
    });

    // Populations: coral is habitat, so fish capacity shrinks with it.
    const habitat = 0.15 + coral;
    s.grazers += logistic(s.grazers, p.grazerGrowth, p.grazerCapacity * habitat) * dt;
    s.protectedGrazers += logistic(s.protectedGrazers, p.grazerGrowth, p.grazerCapacity * habitat * 0.3) * dt;
    s.predators += logistic(s.predators, p.predatorGrowth, p.predatorCapacity * habitat) * dt;
    const eaten = Math.min(s.urchins, s.predators * p.predation * (s.urchins / p.urchinRef) * dt);
    s.urchins += logistic(s.urchins, p.urchinGrowth, p.urchinCapacity) * dt - eaten;

    s.grazers = Math.max(0, s.grazers);
    s.predators = Math.max(0, s.predators);
    s.urchins = Math.max(0, s.urchins);
    s.tick++;
  }

  /** Catch up to `count` fish of a species. Returns the food gained. */
  fish(species: Species, count = 1): number {
    const key = species === 'grazer' ? 'grazers' : 'predators';
    const caught = Math.min(count, Math.floor(this.state[key]));
    this.state[key] -= caught;
    return caught * FOOD_VALUE[species];
  }

  /** Pry up to `count` urchins off the reef. Returns how many were removed. */
  clearUrchins(count = 1): number {
    const removed = Math.min(count, Math.floor(this.state.urchins));
    this.state.urchins -= removed;
    return removed;
  }

  /** Put a nursery net over young grazers for the rest of this life. */
  protect(count = 6): void {
    const moved = Math.min(count, Math.floor(this.state.grazers));
    this.state.grazers -= moved;
    this.state.protectedGrazers += moved;
  }

  /** Release protected grazers back into the catchable pool (at the end of a life). */
  releaseProtected(): void {
    this.state.grazers += this.state.protectedGrazers;
    this.state.protectedGrazers = 0;
  }

  /** Wedge a coral fragment onto a patch's bare rock. */
  plant(index: number, amount = 0.15): void {
    const patch = this.state.patches[index];
    if (!patch) return;
    const added = Math.min(amount, patch.rock);
    patch.coral += added;
    patch.rock -= added;
  }
}

function logistic(n: number, rate: number, capacity: number): number {
  if (capacity <= 0) return -n * rate;
  return rate * n * (1 - n / capacity);
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
