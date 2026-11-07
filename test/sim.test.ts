import { describe, expect, it } from 'vitest';
import { Lineage, LIFE_TICKS } from '../src/sim/generations';
import { Reef } from '../src/sim/reef';
import { greedy, restorer, run } from '../tools/tune';

describe('reef simulation', () => {
  it('is deterministic for a seed', () => {
    const a = new Reef(7);
    const b = new Reef(7);
    for (let i = 0; i < 500; i++) {
      a.step();
      b.step();
    }
    expect(a.state).toEqual(b.state);
  });

  it('stays healthy with nobody fishing', () => {
    const reef = new Reef(1);
    const start = reef.coralCover;
    for (let i = 0; i < LIFE_TICKS * 6; i++) reef.step();
    expect(reef.coralCover).toBeGreaterThan(start * 0.9);
  });

  it('keeps every patch a valid split of coral, algae and rock', () => {
    const r = run(greedy);
    expect(r.coral.every((c) => c >= 0 && c <= 1)).toBe(true);
    const reef = new Reef(3);
    for (let i = 0; i < 2000; i++) {
      reef.fish('grazer', 1);
      reef.step();
    }
    for (const p of reef.state.patches) {
      expect(p.coral + p.algae + p.rock).toBeCloseTo(1, 6);
      expect(Math.min(p.coral, p.algae, p.rock)).toBeGreaterThanOrEqual(0);
    }
  });

  it('collapses when every caretaker fills the basket with grazers', () => {
    expect(run(greedy).collapsed).toBe(true);
  });

  it('can be recovered past the original reef by a restoring player', () => {
    expect(run(restorer).recovered).toBe(true);
  });

  it('does not bounce back when grazers return to their old numbers (hysteresis)', () => {
    const healthy = new Reef(1);
    const originalGrazers = healthy.state.grazers;
    const reef = new Reef(1);
    // Overfish grazers until the reef flips.
    while (!(reef.coralCover < 0.3 && reef.algaeCover > 0.5)) {
      reef.fish('grazer', 2);
      reef.step();
    }
    reef.state.grazers = originalGrazers;
    for (let i = 0; i < LIFE_TICKS; i++) reef.step();
    expect(reef.coralCover).toBeLessThan(0.3);
  });
});

describe('the shifting baseline', () => {
  it('shows a full meter at the start of every life, even as the reef declines', () => {
    const l = new Lineage(1);
    for (let g = 0; g < 5; g++) {
      expect(l.meter).toBeCloseTo(1, 6);
      for (let t = 0; t < LIFE_TICKS; t++) {
        greedy(l, t);
        l.step();
      }
      l.endLife();
    }
    expect(l.meter).toBeCloseTo(1, 6);
    expect(l.trueHealth).toBeLessThan(0.7);
  });

  it('keeps one photo per life', () => {
    const r = new Lineage(1);
    r.endLife();
    r.endLife();
    expect(r.keepsakes.map((k) => k.generation)).toEqual([0, 1]);
    expect(r.keepsakes[0].patches).toHaveLength(40);
  });
});
