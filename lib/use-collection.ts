'use client';
import { useCallback, useEffect, useState } from 'react';
import { COLLECTIONS, type CollectionKey } from './collections';
import { parseCatalog } from './catalog';
import type { Track } from './player';

type View = { key: CollectionKey; tracks: Track[]; status: 'ready' | 'refreshing' | 'error'; message: string };
const CACHE = 'karume.published-collections.v1';

export function useCollection(key: CollectionKey) {
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const [view, setView] = useState<View>(() => ({ key, tracks: COLLECTIONS[key].tracks, status: 'ready', message: '' }));

  useEffect(() => {
    let disposed = false;
    let controller: AbortController | null = null;
    let tracks = COLLECTIONS[key].tracks;
    const expectedId = COLLECTIONS[key].playlistId;
    try {
      const cached = parseCatalog(JSON.parse(localStorage.getItem(CACHE) || 'null'), key, expectedId);
      if (cached) tracks = cached;
    } catch {}
    setView({ key, tracks, status: 'ready', message: '' });

    const refresh = async () => {
      if (disposed) return;
      controller?.abort();
      const request = new AbortController();
      controller = request;
      const timeout = setTimeout(() => request.abort(), 12000);
      setView({ key, tracks, status: 'refreshing', message: '' });
      try {
        // GitHub refreshes this published snapshot even when no browser is open.
        const url = new URL('./collections.json', window.location.href);
        url.searchParams.set('v', String(Date.now()));
        const response = await fetch(url, { signal: request.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('catalog unavailable');
        const catalog: unknown = await response.json();
        const next = parseCatalog(catalog, key, expectedId);
        if (!next) throw new Error('invalid catalog');
        if (disposed || controller !== request) return;
        tracks = next;
        try { localStorage.setItem(CACHE, JSON.stringify(catalog)); } catch {}
        setView({ key, tracks, status: 'ready', message: '' });
      } catch {
        if (!disposed && controller === request) setView({ key, tracks, status: 'error', message: '목록을 확인하지 못했어요. 저장된 목록을 표시합니다.' });
      } finally { clearTimeout(timeout); }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 5 * 60 * 1000);
    const resume = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', resume);
    return () => { disposed = true; controller?.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', resume); };
  }, [key, attempt]);

  const current = view.key === key ? view : { key, tracks: COLLECTIONS[key].tracks, status: 'ready' as const, message: '' };
  return { ...current, retry };
}
