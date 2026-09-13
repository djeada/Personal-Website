const { test, expect } = require('@playwright/test');
const { toroidalField, advanceParticle, advanceTrail } = require('../src/ring-universe.js');

const magnitude = v => Math.hypot(v.x, v.y, v.z);
const particle = charge => ({
  charge,
  position: { x: 3.25, y: 0, z: 0 },
  velocity: { x: 1, y: 0, z: 1.35 },
});

test('toroidal field is tangent to circles and scales as current / radius', () => {
  const p = { x: 2, y: 0.1, z: 2 };
  const b = toroidalField(p);
  expect(b.x * p.x + b.z * p.z).toBeCloseTo(0, 12);
  expect(b.y).toBe(0);
  expect(magnitude(toroidalField({ x: 4, y: 0.1, z: 4 }))).toBeCloseTo(magnitude(b) / 2, 12);
  expect(magnitude(toroidalField(p, 2))).toBeCloseTo(magnitude(b) * 2, 12);
});

for (const current of [0.4, 1, 2]) {
  test(`magnetic force preserves speed for both charges at current ${current}`, () => {
    for (const charge of [-1, 1]) {
      const p = particle(charge);
      const initialSpeed = magnitude(p.velocity);
      let maximumError = 0;
      for (let i = 0; i < 12000; i++) {
        advanceParticle(p, toroidalField(p.position, current), 1 / 120);
        maximumError = Math.max(maximumError, Math.abs(magnitude(p.velocity) - initialSpeed));
      }
      expect(maximumError).toBeLessThan(1e-11);
    }
  });
}

test('opposite charges bend in opposite directions from matched initial conditions', () => {
  const positive = particle(1);
  const negative = particle(-1);
  for (const p of [positive, negative]) advanceParticle(p, toroidalField(p.position), 1 / 120);
  expect(positive.velocity.y).toBeLessThan(0);
  expect(negative.velocity.y).toBeGreaterThan(0);
  expect(positive.velocity.y).toBeCloseTo(-negative.velocity.y, 12);
});

test('boundary resets keep outgoing trails until invisible and fade new ones in', () => {
  const initial = particle(1);
  const p = {
    ...initial,
    initialPosition: { ...initial.position }, initialVelocity: { ...initial.velocity },
    history: Array.from({ length: 480 }, () => ({ ...initial.position })),
    age: 0, opacity: 0, cursor: 0, retiring: false,
  };
  let resets = 0;
  let maximumOpacityChange = 0;
  for (let i = 0; i < 2400; i++) {
    const previousAge = p.age;
    const previousOpacity = p.opacity;
    const wasRetiring = p.retiring;
    const previousCursor = p.cursor;
    const previousPosition = { ...p.position };
    advanceTrail(p, 0.4, 1 / 120);
    maximumOpacityChange = Math.max(maximumOpacityChange, Math.abs(p.opacity - previousOpacity));
    if (p.age < previousAge) {
      resets++;
      expect(p.opacity).toBe(0);
      expect(p.position).toEqual(p.initialPosition);
      expect(p.history.every(v => v.x === p.position.x && v.y === p.position.y && v.z === p.position.z)).toBe(true);
    } else if (wasRetiring) {
      expect(p.cursor).toBe(previousCursor);
      expect(p.position).toEqual(previousPosition);
    }
  }
  expect(resets).toBeGreaterThan(0);
  expect(maximumOpacityChange).toBeLessThan(0.02);
});

test('uniform-field orbit closes at the expected cyclotron period', () => {
  const p = { charge: 1, position: { x: 0, y: 0, z: 0 }, velocity: { x: 1, y: 0, z: 0 } };
  const b = { x: 0, y: 0, z: 7 };
  const period = 2 * Math.PI / 7;
  let maximumDistance = 0;
  for (let i = 0; i < 2400; i++) {
    advanceParticle(p, b, period / 2400);
    maximumDistance = Math.max(maximumDistance, magnitude(p.position));
  }
  expect(magnitude(p.position)).toBeLessThan(1e-5);
  expect(maximumDistance / 2).toBeCloseTo(1 / 7, 5);
});
