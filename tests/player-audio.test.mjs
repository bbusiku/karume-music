import test from 'node:test';
import assert from 'node:assert/strict';
import { keepFullVolume } from '../lib/player-audio.ts';
import { emptyLibrary, restoreLibrary } from '../lib/player.ts';

test('fresh visits and legacy saved volumes always initialize at 100', () => {
  assert.equal(emptyLibrary.volume, 100);
  for (const volume of [0, 1, 70, 99, 100, 900, null, undefined]) {
    assert.equal(restoreLibrary({ volume }).volume, 100);
  }
});

test('playback restores lowered or muted volume without redundant full-volume commands', () => {
  let volume = 30;
  let muted = true;
  const calls = [];
  const player = {
    getVolume: () => volume,
    isMuted: () => muted,
    setVolume: (next) => { calls.push(['volume', next]); volume = next; },
    unMute: () => { calls.push(['unmute']); muted = false; },
  };
  keepFullVolume(player);
  assert.deepEqual(calls, [['volume', 100], ['unmute']]);
  keepFullVolume(player);
  assert.equal(calls.length, 2);
  muted = true;
  keepFullVolume(player);
  assert.deepEqual(calls.at(-1), ['unmute']);
  volume = 0;
  keepFullVolume(player);
  assert.deepEqual(calls.at(-1), ['volume', 100]);
});
