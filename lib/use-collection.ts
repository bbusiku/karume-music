'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { COLLECTIONS, type CollectionKey } from './collections';
import { trackFromUrl, videoIdPattern, type Track } from './player';
import { loadAPI, type YTPlayer } from './use-music-player';

type Status = 'ready' | 'refreshing' | 'error';
type Catalog = { tracks: Track[]; updatedAt: number | null };
type View = Catalog & { key: CollectionKey | null; status: Status; message: string };
const HOUR = 60 * 60 * 1000;
const CACHE_PREFIX = 'karume.collection.v1.';
const failureMessage = '최신 목록을 불러오지 못했어요. 저장된 목록으로 계속 재생할 수 있어요.';

function cleanTrack(value: unknown): Track | null {
  if (!value || typeof value !== 'object') return null;
  const track = value as Partial<Track>;
  if (typeof track.id !== 'string' || !videoIdPattern.test(track.id) ||
      typeof track.title !== 'string' || !track.title.trim() || track.title.length > 300 ||
      typeof track.artist !== 'string' || !track.artist.trim() || track.artist.length > 150) return null;
  return {
    id: track.id, title: track.title, artist: track.artist,
    thumbnail: `https://i.ytimg.com/vi/${track.id}/mqdefault.jpg`, favorite: false,
  };
}

function readCatalog(key: CollectionKey): Catalog {
  const seed = { tracks: COLLECTIONS[key].tracks, updatedAt: null };
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_PREFIX + key) || 'null');
    if (!saved || saved.playlistId !== COLLECTIONS[key].playlistId ||
        typeof saved.updatedAt !== 'number' || !Number.isFinite(saved.updatedAt) ||
        saved.updatedAt <= 0 || saved.updatedAt > Date.now() + 60000 ||
        !Array.isArray(saved.tracks) || !saved.tracks.length || saved.tracks.length > 500) return seed;
    const tracks = saved.tracks.map(cleanTrack) as (Track | null)[];
    if (tracks.some((track) => !track) || new Set(tracks.map((track) => track!.id)).size !== tracks.length) return seed;
    return { tracks: tracks as Track[], updatedAt: saved.updatedAt };
  } catch { return seed; }
}

function placeholder(id: string): Track {
  return { id, title: `YouTube · ${id}`, artist: 'YouTube', thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, favorite: false };
}

export function useCollection(
  key: CollectionKey | null,
  onPlay?: (tracks: Track[], id: string) => void,
) {
  const container = useRef<HTMLDivElement | null>(null);
  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;
  const retryRef = useRef<() => void>(() => {});
  const retry = useCallback(() => retryRef.current(), []);
  const [view, setView] = useState<View>({ key: null, tracks: [], updatedAt: null, status: 'ready', message: '' });

  useEffect(() => {
    if (!key) { retryRef.current = () => {}; return; }
    const host = container.current;
    if (!host) return;
    const collection = COLLECTIONS[key];
    let catalog = readCatalog(key);
    let disposed = false;
    let instance: YTPlayer | null = null;
    let ready = false;
    let creating = false;
    let forceRefresh = !catalog.updatedAt || Date.now() - catalog.updatedAt >= HOUR;
    let generation = 0;
    let cycle = 0;
    let controller: AbortController | null = null;
    let waiting = false;
    let cued = false;
    let poll: ReturnType<typeof setInterval> | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let bootDeadline: ReturnType<typeof setTimeout> | undefined;
    const publish = (status: Status, message = '') => {
      if (!disposed) setView({ key, ...catalog, status, message });
    };
    publish(forceRefresh ? 'refreshing' : 'ready');

    const clearCycle = () => {
      cycle += 1;
      waiting = false;
      clearInterval(poll);
      clearTimeout(deadline);
      controller?.abort();
      controller = null;
    };
    const fail = () => { clearCycle(); publish('error', failureMessage); };
    const idsFromPlayer = (): string[] => {
      try {
        const ids: unknown = instance?.getPlaylist();
        return Array.isArray(ids) ? [...new Set(ids.filter((id): id is string => typeof id === 'string' && videoIdPattern.test(id)))].slice(0, 500) : [];
      } catch { return []; }
    };

    const resolveTitles = async (ids: string[], signal: AbortSignal) => {
      const existing = new Map([...collection.tracks, ...catalog.tracks].map((track) => [track.id, track]));
      const output = new Array<Track>(ids.length);
      let next = 0;
      let missing = 0;
      await Promise.all(Array.from({ length: Math.min(4, ids.length) }, async () => {
        while (next < ids.length && !signal.aborted) {
          const index = next++;
          const id = ids[index];
          const request = new AbortController();
          const abort = () => request.abort();
          signal.addEventListener('abort', abort, { once: true });
          const timer = setTimeout(abort, 6000);
          let track: Track | null = null;
          try { track = cleanTrack(await trackFromUrl(id, request.signal)); }
          catch { /* Keep a known title if one metadata request is unavailable. */ }
          finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
          if (signal.aborted) return;
          if (!track || track.title === `YouTube · ${id}`) {
            track = existing.get(id) || placeholder(id);
            if (!existing.has(id)) missing += 1;
          }
          output[index] = track;
        }
      }));
      return { tracks: output, missing };
    };

    const inspect = () => {
      if (disposed || !waiting || !cued || !controller) return;
      const ids = idsFromPlayer();
      if (!ids.length) return;
      waiting = false;
      clearInterval(poll);
      const activeCycle = cycle;
      const signal = controller.signal;
      void resolveTitles(ids, signal).then(({ tracks, missing }) => {
        if (disposed || signal.aborted || activeCycle !== cycle) return;
        clearTimeout(deadline);
        controller = null;
        catalog = { tracks, updatedAt: Date.now() };
        try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ playlistId: collection.playlistId, ...catalog })); } catch {}
        publish('ready', missing ? '일부 영상 제목은 YouTube에서 잠시 불러오지 못했어요.' : '');
      }).catch(() => { if (!disposed && !signal.aborted && activeCycle === cycle) fail(); });
    };

    const refresh = () => {
      if (disposed) return;
      forceRefresh = true;
      if (!ready || !instance) { publish('refreshing'); void createPlayer(); return; }
      clearCycle();
      controller = new AbortController();
      waiting = true;
      cued = false;
      publish('refreshing');
      deadline = setTimeout(fail, 35000);
      poll = setInterval(inspect, 350);
      try { instance.cuePlaylist({ listType: 'playlist', list: collection.playlistId, index: 0 }); }
      catch { fail(); }
    };

    const createPlayer = async () => {
      if (disposed || creating) return;
      creating = true;
      ready = false;
      const activeGeneration = ++generation;
      clearTimeout(bootDeadline);
      try { instance?.destroy(); } catch {}
      instance = null;
      const mount = document.createElement('div');
      host.replaceChildren(mount);
      const valid = () => !disposed && activeGeneration === generation;
      bootDeadline = setTimeout(() => {
        if (!valid()) return;
        generation += 1;
        creating = false;
        try { instance?.destroy(); } catch {}
        instance = null;
        fail();
      }, 25000);
      try {
        await loadAPI();
        if (!valid()) return;
        instance = new window.YT!.Player(mount, {
          width: '100%', height: '100%',
          playerVars: { playsinline: 1, origin: window.location.origin, controls: 1, rel: 0, autoplay: 0 },
          events: {
            onReady: () => {
              if (!valid() || !instance) return;
              clearTimeout(bootDeadline);
              creating = false;
              ready = true;
              if (forceRefresh) refresh();
              else {
                try { instance.cuePlaylist({ listType: 'playlist', list: collection.playlistId, index: 0 }); }
                catch { fail(); }
              }
            },
            onStateChange: (event: { data: number }) => {
              if (!valid() || !instance) return;
              if (event.data === 5) { cued = true; inspect(); }
              if (event.data !== 1) return;
              // A choice in YouTube's native list is handed to the main player.
              instance.pauseVideo();
              const data = instance.getVideoData();
              if (!videoIdPattern.test(data.video_id || '') || !onPlayRef.current) return;
              const known = new Map(catalog.tracks.map((track) => [track.id, track]));
              const current = cleanTrack({ id: data.video_id, title: data.title, artist: data.author });
              if (current) known.set(current.id, current);
              const ids = idsFromPlayer();
              const tracks = ids.length ? ids.map((id) => known.get(id) || placeholder(id)) : [...catalog.tracks];
              if (!tracks.some((track) => track.id === data.video_id)) tracks.push(current || placeholder(data.video_id));
              onPlayRef.current(tracks, data.video_id);
            },
            onError: () => {
              if (!valid()) return;
              if (waiting && idsFromPlayer().length) { cued = true; inspect(); }
              else if (controller || !catalog.updatedAt) fail();
            },
          },
        });
      } catch {
        if (!valid()) return;
        clearTimeout(bootDeadline);
        creating = false;
        fail();
      }
    };

    retryRef.current = refresh;
    void createPlayer();
    const interval = setInterval(refresh, HOUR);
    const visible = () => {
      if (!document.hidden && (!catalog.updatedAt || Date.now() - catalog.updatedAt >= HOUR) && !controller && !creating) refresh();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      disposed = true;
      generation += 1;
      retryRef.current = () => {};
      clearCycle();
      clearTimeout(bootDeadline);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', visible);
      try { instance?.destroy(); } catch {}
      host.replaceChildren();
    };
  }, [key]);

  // Category switches never flash the previous category's catalog while effects run.
  const current = view.key === key ? view : {
    tracks: key ? COLLECTIONS[key].tracks : [], updatedAt: null, status: 'ready' as Status, message: '',
  };
  return { tracks: current.tracks, status: current.status, message: current.message, updatedAt: current.updatedAt, container, retry };
}
