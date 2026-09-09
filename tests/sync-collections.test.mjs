import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import {
  PLAYLISTS, extractInitialData, extractClientContext, parsePlaylistData,
  fetchPlaylist, validateManifest, synchronize, writeManifestAtomic, readPrevious,
} from '../scripts/sync-collections.mjs';

const id = (n) => `v${String(n).padStart(10, '0')}`;
const legacy = (n, key = 'song') => ({ playlistVideoRenderer: {
  videoId: id(n), title: { runs: [{ text: `곡 ${n} "quoted" \\ path` }] },
  shortBylineText: { runs: [{ text: '카루메' }] },
  navigationEndpoint: { watchEndpoint: { playlistId: PLAYLISTS[key].playlistId } },
} });
const token = (value) => ({ continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: value } } } });
const data = (entries, key = 'song') => ({
  metadata: { playlistMetadataRenderer: { title: PLAYLISTS[key].title } },
  contents: { twoColumnBrowseResultsRenderer: { tabs: [{ tabRenderer: { selected: true, content: {
    sectionListRenderer: { contents: [{ itemSectionRenderer: { contents: [{ playlistVideoListRenderer: {
      playlistId: PLAYLISTS[key].playlistId, contents: entries,
    } }] } }] },
  } } }] } },
});
const clientConfig = {
  INNERTUBE_CONTEXT_CLIENT_NAME: 1,
  INNERTUBE_API_KEY: 'must-not-forward',
  INNERTUBE_CONTEXT: { client: { clientName: 'WEB', clientVersion: '2.20260909.00.00', gl: 'KR', visitorData: 'must-not-forward', remoteHost: 'must-not-forward' }, user: { token: 'must-not-forward' } },
};
const html = (value) => `<script>ytcfg.set(${JSON.stringify(clientConfig)});var ytInitialData = ${JSON.stringify(value)};</script>`;
const reply = (body, status = 200) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
const manifest = () => ({ version: 1, updatedAt: '2026-09-09T00:00:00.000Z', collections: Object.fromEntries(
  Object.keys(PLAYLISTS).map((key, index) => [key, { ...PLAYLISTS[key], tracks: [{
    id: id(index + 1), title: `Saved ${key}`, artist: '카루메', thumbnail: `https://i.ytimg.com/vi/${id(index + 1)}/mqdefault.jpg`, favorite: false,
  }] }]),
) });

test('parses JSON assignments without losing quoted text or reading inactive tabs', () => {
  const value = data([legacy(1)]);
  value.contents.twoColumnBrowseResultsRenderer.tabs.unshift({ tabRenderer: { content: { playlistVideoListRenderer: { playlistId: 'unrelated', contents: [legacy(99)] } } } });
  const extracted = extractInitialData(html(value));
  const parsed = parsePlaylistData(extracted, PLAYLISTS.song.playlistId);
  assert.equal(parsed.tracks.length, 1);
  assert.equal(parsed.tracks[0].title, '곡 1 "quoted" \\ path');
  assert.equal(parsed.tracks[0].favorite, false);
});

test('decodes escaped JavaScript string data, including nested JSON escapes and Unicode', () => {
  const value = data([legacy(1)]);
  value.metadata.playlistMetadataRenderer.title = "루메 It's Me 💛";
  const encoded = JSON.stringify(value).split('').map((char) => {
    const n = char.charCodeAt(0);
    return n < 128 ? `\\x${n.toString(16).padStart(2, '0')}` : `\\u${n.toString(16).padStart(4, '0')}`;
  }).join('');
  assert.deepEqual(extractInitialData(`<script>var ytInitialData = '${encoded}';</script>`), value);
  const mixed = JSON.stringify(value).split('').map((char) => {
    if (char === '\\') return '\\\\';
    if ('\"\'{}[]'.includes(char)) return `\\x${char.charCodeAt(0).toString(16).padStart(2, '0')}`;
    return char;
  }).join('');
  // Real pages combine ordinary backslash escapes with hexadecimal quote escapes.
  assert.deepEqual(extractInitialData(`<script>window['ytInitialData'] = '${mixed}';</script>`), value);
});

test('literal parser rejects executable expressions and malformed/bot/private pages', () => {
  globalThis.__playlistParserExecuted = false;
  assert.throws(() => extractInitialData('<script>var ytInitialData = (() => { globalThis.__playlistParserExecuted = true; return {}; })();</script>'), /Malformed/);
  assert.equal(globalThis.__playlistParserExecuted, false);
  delete globalThis.__playlistParserExecuted;
  assert.throws(() => extractInitialData("<html>Sign in to confirm you're not a bot</html>"), /bot/);
  assert.throws(() => extractInitialData('var ytInitialData = {"broken":'), /Malformed/);
  assert.throws(() => parsePlaylistData({ alerts: [{ alertRenderer: { type: 'ERROR', text: { simpleText: 'This playlist is private' } } }] }, PLAYLISTS.song.playlistId), /private/);
});

test('modern mobile lockups include only videos belonging to the requested playlist', () => {
  const lockup = (n, list) => ({ lockupViewModel: {
    contentType: 'LOCKUP_CONTENT_TYPE_VIDEO',
    metadata: { lockupMetadataViewModel: { title: { content: `ASMR ${n}` }, metadata: { contentMetadataViewModel: { metadataRows: [{ metadataParts: [{ text: { content: '카루메 𝐀𝐒𝐌𝐑' } }] }] } } } },
    rendererContext: { commandContext: { onTap: { innertubeCommand: { watchEndpoint: { videoId: id(n), playlistId: list } } } } },
  } });
  const value = { header: { pageHeaderRenderer: { pageTitle: '루메 ASMR' } }, contents: { singleColumnBrowseResultsRenderer: { tabs: [{ tabRenderer: { content: { sectionListRenderer: { contents: [{ itemSectionRenderer: { contents: [lockup(1, PLAYLISTS.asmr.playlistId), lockup(2, 'unrelated')] } }] } } } }] } } };
  const parsed = parsePlaylistData(value, PLAYLISTS.asmr.playlistId);
  assert.equal(parsed.title, '루메 ASMR');
  assert.deepEqual(parsed.tracks.map((track) => track.id), [id(1)]);
});

test('continues beyond 100 entries in order without duplicate IDs or credential forwarding', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    if (requests.length === 1) return reply(html(data([...Array.from({ length: 100 }, (_, n) => legacy(n)), token('NEXT')])));
    return reply({ onResponseReceivedActions: [{ appendContinuationItemsAction: { continuationItems: [legacy(99), ...Array.from({ length: 31 }, (_, n) => legacy(n + 100))] } }] });
  };
  const collection = await fetchPlaylist('song', { fetchImpl });
  assert.equal(collection.tracks.length, 131);
  assert.deepEqual(collection.tracks.map((track) => track.id), Array.from({ length: 131 }, (_, n) => id(n)));
  assert.equal(requests[1].options.method, 'POST');
  assert.deepEqual(JSON.parse(requests[1].options.body), { context: { client: { clientName: 'WEB', clientVersion: '2.20260909.00.00', hl: 'ko', gl: 'KR' } }, continuation: 'NEXT' });
  assert.doesNotMatch(JSON.stringify(requests[1]), /must-not-forward|Authorization|Cookie|[?&]key=/i);
});

test('legacy continuationContents pagination works, including final pages', async () => {
  let calls = 0;
  const result = await fetchPlaylist('song', { fetchImpl: async () => {
    calls += 1;
    if (calls === 1) return reply(html(data([legacy(1), token('ONE')])));
    if (calls === 2) return reply({ continuationContents: { playlistVideoListContinuation: { contents: [legacy(2)], continuations: [{ nextContinuationData: { continuation: 'TWO' } }] } } });
    return reply({ continuationContents: { playlistVideoListContinuation: { contents: [legacy(3)] } } });
  } });
  assert.deepEqual(result.tracks.map((track) => track.id), [id(1), id(2), id(3)]);
  assert.equal(calls, 3);
});

test('pagination loops, unknown shapes, ambiguous tokens, and limits fail instead of truncating', async () => {
  let calls = 0;
  await assert.rejects(fetchPlaylist('song', { fetchImpl: async () => {
    calls += 1;
    return calls === 1 ? reply(html(data([legacy(1), token('LOOP')]))) : reply({ onResponseReceivedActions: [{ appendContinuationItemsAction: { continuationItems: [legacy(2), token('LOOP')] } }] });
  } }), /repeated/);
  await assert.rejects(fetchPlaylist('song', { maxPages: 1, fetchImpl: async () => reply(html(data([legacy(1), token('MORE')]))) }), /page limit/);
  assert.throws(() => parsePlaylistData({ unexpected: [] }, PLAYLISTS.song.playlistId, { continuation: true }), /Unrecognized/);
  assert.throws(() => parsePlaylistData(data([legacy(1), token('A'), token('B')]), PLAYLISTS.song.playlistId), /Ambiguous/);
  assert.throws(() => extractClientContext('ytcfg.set({"INNERTUBE_API_KEY":"not-a-context"});'), /context/);
});

test('normal refresh preserves the previous failed category; strict refresh rejects without mutating it', async () => {
  const previous = manifest();
  const untouched = structuredClone(previous);
  const fetchImpl = async (url) => url.includes(PLAYLISTS.song.playlistId) ? reply(html(data([legacy(8)]))) : reply('Unavailable', 503);
  const normal = await synchronize({ previous, fetchImpl, now: '2026-09-10T00:00:00Z' });
  assert.deepEqual(normal.refreshed, ['song']);
  assert.deepEqual(normal.manifest.collections.asmr, previous.collections.asmr);
  assert.equal(normal.manifest.collections.song.tracks[0].id, id(8));
  assert.equal(normal.failures[0].key, 'asmr');
  await assert.rejects(synchronize({ previous, fetchImpl, strict: true }), /output was not changed/);
  await assert.rejects(synchronize({ fetchImpl }), /output was not changed/);
  assert.deepEqual(previous, untouched);
});

test('complete fetch failure retains the last-good manifest and timestamp', async () => {
  const previous = manifest();
  const result = await synchronize({ previous, fetchImpl: async () => { throw new Error('network unavailable'); } });
  assert.equal(result.unchanged, true);
  assert.deepEqual(result.manifest, previous);
});

test('empty, unrelated, malformed video data and invalid manifests cannot replace catalogs', async () => {
  await assert.rejects(fetchPlaylist('song', { fetchImpl: async () => reply(html(data([]))) }), /no accessible/);
  await assert.rejects(fetchPlaylist('song', { fetchImpl: async () => reply(html(data([legacy(1)], 'asmr'))) }), /wrong playlist/);
  const broken = data([legacy(1)]);
  broken.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents[0].itemSectionRenderer.contents[0].playlistVideoListRenderer.contents[0].playlistVideoRenderer.videoId = 'bad-id';
  assert.throws(() => parsePlaylistData(broken, PLAYLISTS.song.playlistId), /Malformed/);
  const value = manifest();
  value.collections.song.tracks.push(value.collections.song.tracks[0]);
  assert.throws(() => validateManifest(value), /duplicate/);
  value.collections.song.tracks.pop();
  value.collections.song.tracks[0].thumbnail = 'https://unrelated.invalid/tracker';
  assert.throws(() => validateManifest(value), /Noncanonical/);
});

test('atomic write validates first; prior published catalog wins over older local seeds', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'karume-catalog-test-'));
  try {
    const output = join(directory, 'collections.json');
    const local = manifest();
    await writeManifestAtomic(output, local);
    const initialBytes = await readFile(output, 'utf8');
    await assert.rejects(writeManifestAtomic(output, { version: 9 }), /Invalid/);
    assert.equal(await readFile(output, 'utf8'), initialBytes);
    const published = structuredClone(local);
    published.updatedAt = '2026-09-10T00:00:00.000Z';
    published.collections.asmr.tracks[0].title = 'Published newer title';
    const result = await readPrevious(output, { fetchImpl: async () => reply(published), log: () => {} });
    assert.deepEqual(result, published);
    await writeFile(output, '{broken');
    assert.deepEqual(await readPrevious(output, { fetchImpl: async () => reply(published), log: () => {} }), published);
  } finally {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith('karume-catalog-test-'));
    await rm(directory, { recursive: true, force: true });
  }
});
