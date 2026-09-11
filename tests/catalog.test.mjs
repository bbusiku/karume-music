import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCatalog, startupSongs } from '../lib/catalog.ts';
const id = 'abcdefghijk';
const data = () => ({ version: 1, updatedAt: '2026-09-10T00:00:00Z', collections: { song: { playlistId: 'PLJmCvCN8XgA8', tracks: [{ id, title: '새 영상', artist: 'karume', thumbnail: 'https://untrusted.test/image', favorite: true }] } } });

test('startup chooses the newer valid catalog and never resurrects an empty playlist', () => {
  const published = data();
  const cached = data();
  cached.updatedAt = '2026-09-11T00:00:00Z';
  cached.collections.song.tracks[0].title = '최신 영상';
  assert.equal(startupSongs(published, cached, 'PLJmCvCN8XgA8', [])[0].title, '최신 영상');
  cached.updatedAt = '2026-09-09T00:00:00Z';
  assert.equal(startupSongs(published, cached, 'PLJmCvCN8XgA8', [])[0].title, '새 영상');
  published.collections.song.tracks = [];
  assert.deepEqual(startupSongs(published, cached, 'PLJmCvCN8XgA8', [{ id }]), []);
  cached.updatedAt = '2026-09-12T00:00:00Z';
  cached.collections.song.tracks = [];
  assert.deepEqual(startupSongs(data(), cached, 'PLJmCvCN8XgA8', [{ id }]), []);
});
test('startup uses a valid catalog or offline fallback when saved data is invalid', () => {
  const fallback = [{ id }];
  assert.equal(startupSongs(null, null, 'PLJmCvCN8XgA8', fallback), fallback);
  assert.equal(startupSongs(null, data(), 'PLJmCvCN8XgA8', fallback)[0].title, '새 영상');
  assert.equal(startupSongs(data(), { ...data(), updatedAt: 'invalid' }, 'PLJmCvCN8XgA8', fallback)[0].title, '새 영상');
});

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

test('new 애교송 snapshots load independently of old two-category caches', () => {
  const value = data();
  assert.equal(parseCatalog(value, 'aegyo', 'PLFK4yXX5LyZQ'), null);
  value.collections.aegyo = { playlistId: 'PLFK4yXX5LyZQ', tracks: [{ id: 'ObfH_MGtT6w', title: '카루메 - 귀요미 송', artist: '루메얌' }] };
  assert.equal(parseCatalog(value, 'aegyo', 'PLFK4yXX5LyZQ')[0].id, 'ObfH_MGtT6w');
  assert.equal(parseCatalog(value, 'song', 'PLJmCvCN8XgA8')[0].id, id);
});
