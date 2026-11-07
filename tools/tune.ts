/**
 * Headless tuning harness. Plays whole runs with scripted caretakers and
 * prints true coral cover per generation, so the simulation can be tuned
 * in seconds without opening the game.
 *
 *   npm run tune
 */
import { Lineage, LIFE_TICKS, GENERATIONS, basketTarget } from '../src/sim/generations';

export type Policy = (lineage: Lineage, tick: number) => void;

/** Fill the basket the easy way: grazers first, nothing else. */
export const greedy: Policy = (l, t) => {
  if (t % 8 === 0 && l.food < basketTarget(l.generation)) {
    if (l.catchFish('grazer') === 0) l.catchFish('predator');
  }
};

/** Fill the basket from predators where possible, clear some urchins. */
export const balanced: Policy = (l, t) => {
  if (t % 8 === 0 && l.food < basketTarget(l.generation)) {
    if (l.catchFish('predator') === 0) l.catchFish('grazer');
  }
  if (t % 30 === 0) l.reef.clearUrchins(1);
};

/**
 * Greedy until the reveal (generation 3), then restore: protect young grazers,
 * clear urchins, plant coral, and accept a basket about half full.
 */
export const restorer: Policy = (l, t) => {
  if (l.generation < 2) return greedy(l, t);
  if (t === 0) l.reef.protect(8);
  if (t % 16 === 0 && l.food < basketTarget(l.generation) * 0.5) l.catchFish('grazer');
  if (t % 8 === 0) l.reef.clearUrchins(1);
  if (t % 20 === 0) {
    const patches = l.reef.state.patches;
    let best = 0;
    patches.forEach((p, i) => {
      if (p.rock > patches[best].rock) best = i;
    });
    l.reef.plant(best, 0.15);
  }
};

export interface RunResult {
  coral: number[];
  health: number[];
  algae: number[];
  meterAtEnd: number[];
  food: number[];
  collapsed: boolean;
  recovered: boolean;
}

export function run(policy: Policy, seed = 1): RunResult {
  const l = new Lineage(seed);
  const result: RunResult = { coral: [], health: [], algae: [], meterAtEnd: [], food: [], collapsed: false, recovered: false };
  for (let g = 0; g < GENERATIONS; g++) {
    for (let t = 0; t < LIFE_TICKS; t++) {
      policy(l, t);
      l.step();
    }
    result.meterAtEnd.push(l.meter);
    result.food.push(l.food);
    const k = l.endLife();
    result.coral.push(k.coral);
    result.health.push(k.trueHealth);
    result.algae.push(k.algae);
  }
  result.collapsed = l.collapsed;
  result.recovered = l.recovered;
  return result;
}

const isMain = process.argv[1]?.endsWith('tune.ts');
if (isMain) {
  const pct = (x: number) => `${Math.round(x * 100)}`.padStart(3) + '%';
  for (const [name, policy] of Object.entries({ greedy, balanced, restorer })) {
    const r = run(policy);
    console.log(`\n${name}`);
    console.log('  gen  health  coral  algae  meter  food');
    r.coral.forEach((c, g) =>
      console.log(`  ${g + 1}    ${pct(r.health[g])}   ${pct(c)}   ${pct(r.algae[g])}   ${pct(r.meterAtEnd[g])}  ${r.food[g]}/${basketTarget(g)}`),
    );
    console.log(`  collapsed: ${r.collapsed}  recovered: ${r.recovered}`);
  }
}
