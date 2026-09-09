import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyLibrary,
  parseVideoId,
  addTrack,
  removeTrack,
  toggleFavorite,
  toggleShuffle,
  adjacent,
  afterEnd,
  nextRepeat,
  restoreLibrary,
  searchYouTube,
  trackFromUrl,
  selectCollection,
} from '../lib/player.ts';
const ids = ['abcdefghijk', '12345678901', 'ABCDEFGHIJK'];
const track = (id) => ({
  id,
  title: `Song ${id}`,
  artist: 'Artist',
  thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
  favorite: false,
});
const queue = () =>
  ids.reduce((s, id) => addTrack(s, track(id)), { ...emptyLibrary });
test('YouTube watch/share/short/live/music URLs and video IDs', () => {
  for (const url of [
    ids[0],
    `https://www.youtube.com/watch?v=${ids[0]}&list=other`,
    `https://youtu.be/${ids[0]}?si=abc`,
    `https://youtube.com/shorts/${ids[0]}`,
    `https://youtube.com/live/${ids[0]}`,
    `https://music.youtube.com/watch?v=${ids[0]}`,
  ])
    assert.equal(parseVideoId(url), ids[0]);
});
test('reject lookalike hosts, malformed IDs, non-http URLs and playlist-only links', () => {
  for (const url of [
    `https://youtube.com.evil.test/watch?v=${ids[0]}`,
    `javascript:${ids[0]}`,
    'hello',
    'https://youtube.com/playlist?list=123',
    `ftp://youtube.com/watch?v=${ids[0]}`,
  ])
    assert.equal(parseVideoId(url), null);
});
test('adding is unique and preserves selection', () => {
  const s = queue();
  assert.equal(s.currentId, ids[0]);
  assert.equal(addTrack(s, track(ids[0])), s);
  assert.equal(s.tracks.length, 3);
});
test('favorite toggles on and off without losing other state', () => {
  let s = queue();
  s = toggleFavorite(s, ids[0]);
  assert.equal(s.tracks[0].favorite, true);
  s = toggleFavorite(s, ids[0]);
  assert.equal(s.tracks[0].favorite, false);
  assert.deepEqual(s.order, ids);
});
test('repeat cycles off → one → all → off', () => {
  let r = 'off';
  for (const expected of ['one', 'all', 'off']) {
    r = nextRepeat(r);
    assert.equal(r, expected);
  }
});
test('repeat OFF plays each queued song once and stops at the end', () => {
  const s = queue();
  assert.equal(afterEnd(s), ids[1]);
  assert.equal(afterEnd({ ...s, currentId: ids[2] }), null);
});

test('collection selection scopes shuffle/next and preserves favorites across categories', () => {
  const s = toggleFavorite(queue(), ids[1]);
  const chosen = selectCollection(s, [track(ids[1]), track(ids[2])], ids[2]);
  assert.deepEqual(chosen.order, [ids[1], ids[2]]);
  assert.equal(chosen.tracks.find((t) => t.id === ids[1]).favorite, true);
  assert.equal(adjacent(chosen, 1), ids[1]);
  const shuffled = toggleShuffle(chosen, () => 0);
  assert.deepEqual(shuffled.order, [ids[2], ids[1]]);
  assert.deepEqual(toggleShuffle(shuffled).order, [ids[1], ids[2]]);
  assert.deepEqual(restoreLibrary(shuffled).queueIds, [ids[1], ids[2]]);
  assert.deepEqual(restoreLibrary(shuffled).order, [ids[2], ids[1]]);
  assert.equal(afterEnd(shuffled), ids[1]);
  assert.equal(afterEnd({ ...shuffled, currentId: ids[1] }), null);
});
test('repeat ONE stays on selected song with shuffle enabled', () => {
  const s = { ...queue(), repeat: 'one', shuffle: true };
  assert.equal(afterEnd(s), ids[0]);
});
test('repeat ALL advances and wraps to the first song', () => {
  let s = { ...queue(), repeat: 'all' };
  assert.equal(afterEnd(s), ids[1]);
  s.currentId = ids[2];
  assert.equal(afterEnd(s), ids[0]);
});
test('next and previous wrap in queue order', () => {
  const s = queue();
  assert.equal(adjacent(s, -1), ids[2]);
  assert.equal(adjacent(s, 1), ids[1]);
});
test('shuffle visits each track once per cycle and unshuffle restores original order', () => {
  let s = toggleShuffle(queue(), () => 0);
  assert.deepEqual(s.order, [ids[0], ids[2], ids[1]]);
  assert.equal(s.currentId, ids[0]);
  const visited = new Set();
  for (let i = 0; i < 3; i++) {
    visited.add(s.currentId);
    s = { ...s, currentId: adjacent(s, 1) };
  }
  assert.equal(visited.size, 3);
  s = toggleShuffle(s);
  assert.deepEqual(s.order, ids);
  assert.equal(s.shuffle, false);
});
test('deleting selected song chooses next and deleting last clears selection', () => {
  let s = removeTrack(queue(), ids[0]);
  assert.equal(s.currentId, ids[1]);
  assert.equal(s.order.includes(ids[0]), false);
  s = removeTrack(removeTrack(s, ids[1]), ids[2]);
  assert.equal(s.currentId, null);
  assert.equal(adjacent(s, 1), null);
});
test('one-song queues and empty queues are safe', () => {
  const s = addTrack({ ...emptyLibrary }, track(ids[0]));
  assert.equal(adjacent(s, -1), ids[0]);
  assert.equal(afterEnd({ ...s, repeat: 'all' }), ids[0]);
  assert.equal(afterEnd({ ...emptyLibrary, repeat: 'all' }), null);
});
test('restore validates corrupt data, strips unsafe thumbnails, de-duplicates and clamps volume', () => {
  const s = restoreLibrary({
    tracks: [track(ids[0]), track(ids[0]), { id: 'bad' }],
    currentId: 'missing',
    order: ['missing', ids[0], ids[0]],
    shuffle: true,
    volume: 900,
    repeat: 'evil',
  });
  assert.equal(s.tracks.length, 1);
  assert.deepEqual(s.order, [ids[0]]);
  assert.equal(s.volume, 100);
  assert.equal(s.repeat, 'off');
  assert.equal(s.currentId, ids[0]);
  assert.deepEqual(restoreLibrary(null), emptyLibrary);
});
test('search maps only embeddable YouTube videos and handles quota failures', async (t) => {
  let captured;
  t.mock.method(globalThis, 'fetch', async (url) => {
    captured = new URL(url);
    return new Response(
      JSON.stringify({
        items: [
          {
            id: { videoId: ids[0] },
            snippet: { title: 'Song', channelTitle: 'Artist' },
          },
        ],
      }),
    );
  });
  const found = await searchYouTube('song', 'test-key');
  assert.equal(captured.searchParams.get('videoEmbeddable'), 'true');
  assert.equal(captured.searchParams.get('type'), 'video');
  assert.equal(found[0].id, ids[0]);
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ error: { errors: [{ reason: 'quotaExceeded' }] } }),
      { status: 403 },
    );
  await assert.rejects(searchYouTube('song', 'test-key'), /한도/);
});
test('missing search key fails before making a request', async () => {
  await assert.rejects(searchYouTube('song', ''), /API 키/);
});
test('link addition works without API key and metadata failures have a real-ID fallback', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('{}', { status: 404 }),
  );
  const result = await trackFromUrl(`https://youtu.be/${ids[0]}`);
  assert.equal(result.id, ids[0]);
  assert.equal(result.title, `YouTube · ${ids[0]}`);
});
