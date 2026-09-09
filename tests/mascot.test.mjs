import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bounded, hiddenMascot, showMascot, returnMascot, holdMascot,
  dropMascot, stepMascot, mascotPose,
} from '../lib/mascot.ts';

const bounds = { left: 58, right: 582, top: 68, floor: 632 };
const anchor = { x: 545, y: 390 };
const advance = (s, seconds, target = anchor, b = bounds) => {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) s = stepMascot(s, 1 / 60, b, target);
  return s;
};
test('mascot emerges from plus, bounces on the floor, then walks', () => {
  let s = showMascot(hiddenMascot(), anchor);
  assert.equal(s.x, anchor.x);
  assert.equal(s.y, anchor.y);
  assert.ok(mascotPose(s).scale < 0.1);
  s = advance(s, 0.7);
  assert.equal(s.mode, 'falling');
  assert.ok(s.y < anchor.y);
  s = advance(s, 4);
  assert.equal(s.mode, 'walking');
  assert.equal(s.y, bounds.floor);
  const before = s.x;
  s = advance(s, 0.4);
  assert.notEqual(s.x, before);
});
test('a held mascot stays aloft, wiggles and lands after release', () => {
  let s = holdMascot({ ...showMascot(hiddenMascot(), anchor), x: 220, y: 180 });
  s = advance(s, 0.1);
  assert.equal(s.y, 180);
  assert.equal(s.mode, 'held');
  assert.notEqual(mascotPose(s).angle, 0);
  assert.equal(mascotPose(s, true).angle, 0);
  s = dropMascot(s);
  s = advance(s, 0.3);
  assert.ok(s.y > 180);
  s = advance(s, 4);
  assert.equal(s.mode, 'walking');
  assert.equal(s.y, bounds.floor);
});
test('return travels toward the latest plus position and becomes hidden', () => {
  let s = returnMascot({ ...hiddenMascot(), mode: 'walking', x: 100, y: bounds.floor });
  const movedAnchor = { x: 450, y: 300 };
  s = advance(s, 0.5, movedAnchor);
  assert.equal(s.mode, 'returning');
  assert.ok(s.y < bounds.floor);
  s = advance(s, 0.25, movedAnchor);
  assert.ok(mascotPose(s).scale < 0.5);
  s = advance(s, 0.2, movedAnchor);
  assert.equal(s.mode, 'hidden');
  assert.equal(s.x, movedAnchor.x);
  assert.equal(s.y, movedAnchor.y);
});
test('closing while held and reopening during return never leaves a stuck drag', () => {
  let s = holdMascot(showMascot(hiddenMascot(), anchor));
  s = returnMascot(s);
  assert.equal(dropMascot(s).mode, 'returning');
  s = advance(s, 0.2);
  const position = { x: s.x, y: s.y };
  s = showMascot(s, anchor);
  assert.equal(s.mode, 'falling');
  assert.equal(s.x, position.x);
  assert.equal(s.y, position.y);
  assert.equal(advance(s, 4).mode, 'walking');
});
test('walking turns at edges and a resized embed contains a dragged mascot', () => {
  let s = { ...hiddenMascot(), mode: 'walking', x: bounds.left, y: bounds.floor };
  s = stepMascot(s, 0.04, bounds, anchor);
  assert.equal(s.direction, 1);
  assert.equal(s.x, bounds.left);
  const narrow = { left: 58, right: 180, top: 68, floor: 220 };
  s = stepMascot({ ...s, mode: 'held', x: 700, y: 800 }, 0.016, narrow, anchor);
  assert.deepEqual({ x: s.x, y: s.y }, { x: 180, y: 220 });
  assert.deepEqual(bounded({ x: -100, y: -300 }, narrow), { x: 58, y: 68 });
});
test('returning from a background tab cannot produce an enormous physics jump', () => {
  const s = { ...hiddenMascot(), mode: 'falling', x: 220, y: 100 };
  const next = stepMascot(s, 300, bounds, anchor);
  assert.ok(next.y > 100 && next.y < 105);
  assert.equal(stepMascot(hiddenMascot(), 300, bounds, anchor).mode, 'hidden');
});
