import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPlayerAudio, readPlayerAudio } from '../lib/player-audio.ts';

function youtubeAudio() {
  let volume = 100;
  let muted = false;
  const calls = [];
  return {
    calls,
    setVolume(value) { calls.push(['setVolume', value]); volume = value; },
    getVolume() { return volume; },
    mute() { calls.push(['mute']); muted = true; },
    unMute() { calls.push(['unMute']); muted = false; },
    isMuted() { return muted; },
  };
}
test('player volume commands support silent, intermediate and maximum volume', () => {
  const player = youtubeAudio();
  for (const volume of [0, 37, 100]) {
    applyPlayerAudio(player, { volume, muted: false });
    assert.deepEqual(readPlayerAudio(player), { volume, muted: false });
  }
  assert.deepEqual(player.calls, [0, 37, 100].flatMap(volume => [['setVolume', volume], ['unMute']]));
});
test('muting and unmuting retain the chosen volume instead of resetting to maximum', () => {
  const player = youtubeAudio();
  applyPlayerAudio(player, { volume: 24, muted: true });
  assert.deepEqual(readPlayerAudio(player), { volume: 24, muted: true });
  applyPlayerAudio(player, { volume: 24, muted: false });
  assert.deepEqual(readPlayerAudio(player), { volume: 24, muted: false });
});
test('native YouTube audio changes are read without sending overriding commands', () => {
  const player = youtubeAudio();
  player.setVolume(16);
  player.mute();
  player.calls.length = 0;
  assert.deepEqual(readPlayerAudio(player), { volume: 16, muted: true });
  assert.deepEqual(player.calls, []);
  player.getVolume = () => NaN;
  assert.equal(readPlayerAudio(player), null);
});
