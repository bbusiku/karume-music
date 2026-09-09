import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCatalog } from '../lib/catalog.ts';
const id = 'abcdefghijk';
const data = () => ({ version: 1, updatedAt: '2026-09-10T00:00:00Z', collections: { song: { playlistId: 'PLJmCvCN8XgA8', tracks: [{ id, title: '새 영상', artist: 'karume', thumbnail: 'https://untrusted.test/image', favorite: true }] } } });

test('published snapshot adds real videos without trusting stored image URLs or favorites', () => {
  const tracks = parseCatalog(data(), 'song', 'PLJmCvCN8XgA8');
  assert.equal(tracks[0].title, '새 영상');
  assert.equal(tracks[0].thumbnail, `https://i.ytimg.com/vi/${id}/mqdefault.jpg`);
  assert.equal(tracks[0].favorite, false);
});
test('bad catalog and mismatched categories cannot replace a saved list', () => {
  for (const value of [null, {}, { ...data(), version: 2 }, { ...data(), updatedAt: 'bad date' }]) assert.equal(parseCatalog(value, 'song', 'PLJmCvCN8XgA8'), null);
  assert.equal(parseCatalog(data(), 'asmr', 'PLc06btbrmeCw'), null);
  assert.equal(parseCatalog(data(), 'song', 'another-playlist'), null);
  const duplicate = data();
  duplicate.collections.song.tracks.push(duplicate.collections.song.tracks[0]);
  assert.equal(parseCatalog(duplicate, 'song', 'PLJmCvCN8XgA8'), null);
});
test('a verified empty playlist can clear old published rows', () => {
  const value = data();
  value.collections.song.tracks = [];
  assert.deepEqual(parseCatalog(value, 'song', 'PLJmCvCN8XgA8'), []);
});
