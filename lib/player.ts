export type Track = {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  favorite: boolean;
};
export type RepeatMode = 'off' | 'one' | 'all';
export type Library = {
  tracks: Track[];
  currentId: string | null;
  order: string[];
  queueIds?: string[];
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number;
};
export const emptyLibrary: Library = {
  tracks: [],
  currentId: null,
  order: [],
  shuffle: false,
  repeat: 'off',
  volume: 100,
};
export const starterTrack: Track = {
  id: 'PVISi_M82xo',
  title: '카루메 영상',
  artist: 'Karume',
  thumbnail: 'https://i.ytimg.com/vi/PVISi_M82xo/mqdefault.jpg',
  favorite: false,
};
export const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;
export function parseVideoId(input: string): string | null {
  const value = input.trim();
  if (videoIdPattern.test(value)) return value;
  try {
    const u = new URL(value);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    let id: string | null = null;
    if (host === 'youtu.be') id = u.pathname.split('/')[1];
    else if (
      [
        'youtube.com',
        'm.youtube.com',
        'music.youtube.com',
        'youtube-nocookie.com',
      ].includes(host)
    )
      id =
        u.pathname === '/watch'
          ? u.searchParams.get('v')
          : /^\/(shorts|embed|live)\//.test(u.pathname)
            ? u.pathname.split('/')[2]
            : null;
    return id && videoIdPattern.test(id) ? id : null;
  } catch {
    return null;
  }
}
export function mix(ids: string[], random = Math.random): string[] {
  const copy = [...ids];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
export function toggleShuffle(s: Library, random = Math.random): Library {
  const shuffle = !s.shuffle;
  const ids = s.queueIds ?? s.tracks.map((t) => t.id);
  return {
    ...s,
    shuffle,
    order: shuffle
      ? [
          ...(s.currentId && ids.includes(s.currentId) ? [s.currentId] : []),
          ...mix(
            ids.filter((id) => id !== s.currentId),
            random,
          ),
        ]
      : [...ids],
  };
}
export function adjacent(s: Library, direction: 1 | -1): string | null {
  if (!s.order.length) return null;
  const i = s.order.indexOf(s.currentId || '');
  return s.order[
    (Math.max(i, 0) + direction + s.order.length) % s.order.length
  ];
}
export function afterEnd(s: Library): string | null {
  const index = s.order.indexOf(s.currentId || '');
  return s.repeat === 'off'
    ? (index >= 0 ? s.order[index + 1] || null : null)
    : s.repeat === 'one'
      ? s.currentId
      : adjacent(s, 1);
}
export function nextRepeat(mode: RepeatMode): RepeatMode {
  return mode === 'off' ? 'one' : mode === 'one' ? 'all' : 'off';
}
export function addTrack(s: Library, track: Track): Library {
  if (s.tracks.some((t) => t.id === track.id)) return s;
  return {
    ...s,
    tracks: [...s.tracks, track],
    order: [...s.order, track.id],
    ...(s.queueIds ? { queueIds: [...s.queueIds, track.id] } : {}),
    currentId: s.currentId || track.id,
  };
}
export function removeTrack(s: Library, id: string): Library {
  const tracks = s.tracks.filter((t) => t.id !== id);
  const order = s.order.filter((x) => x !== id);
  return {
    ...s,
    tracks,
    order,
    ...(s.queueIds ? { queueIds: s.queueIds.filter((x) => x !== id) } : {}),
    currentId:
      s.currentId === id
        ? order[Math.min(s.order.indexOf(id), order.length - 1)] || null
        : s.currentId,
  };
}
export function toggleFavorite(s: Library, id: string): Library {
  return {
    ...s,
    tracks: s.tracks.map((t) =>
      t.id === id ? { ...t, favorite: !t.favorite } : t,
    ),
  };
}
export function selectCollection(s: Library, tracks: Track[], id: string): Library {
  if (!tracks.some((track) => track.id === id)) return s;
  const existing = new Map(s.tracks.map((track) => [track.id, track]));
  for (const track of tracks) {
    existing.set(track.id, { ...track, favorite: existing.get(track.id)?.favorite ?? track.favorite });
  }
  const queueIds = [...new Set(tracks.map((track) => track.id))];
  return {
    ...s,
    tracks: [...existing.values()],
    queueIds,
    currentId: id,
    order: s.shuffle ? [id, ...mix(queueIds.filter((item) => item !== id))] : queueIds,
  };
}
export function restoreLibrary(value: unknown): Library {
  if (!value || typeof value !== 'object') return { ...emptyLibrary };
  const s = value as Partial<Library>;
  const seen = new Set<string>();
  const tracks: Track[] = Array.isArray(s.tracks)
    ? s.tracks
        .filter(
          (t): t is Track =>
            !!t &&
            typeof t.id === 'string' &&
            videoIdPattern.test(t.id) &&
            typeof t.title === 'string' &&
            typeof t.artist === 'string',
        )
        .filter((t) => {
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        })
        .slice(0, 500)
        .map((t) => ({
          id: t.id,
          title: t.title.slice(0, 300),
          artist: t.artist.slice(0, 150),
          thumbnail: `https://i.ytimg.com/vi/${t.id}/mqdefault.jpg`,
          favorite: t.favorite === true,
        }))
    : [];
  const ids = tracks.map((t) => t.id);
  const queueIds = Array.isArray(s.queueIds)
    ? [...new Set(s.queueIds.filter((id) => ids.includes(id)))]
    : undefined;
  const activeIds = queueIds?.length ? queueIds : ids;
  const order = Array.isArray(s.order)
    ? [
        ...new Set(s.order.filter((id) => activeIds.includes(id))),
        ...activeIds.filter((id) => !s.order!.includes(id)),
      ]
    : activeIds;
  return {
    tracks,
    currentId: activeIds.includes(s.currentId || '') ? s.currentId! : activeIds[0] || null,
    order: s.shuffle === true ? order : activeIds,
    ...(queueIds?.length ? { queueIds } : {}),
    shuffle: s.shuffle === true,
    repeat: s.repeat === 'one' || s.repeat === 'all' ? s.repeat : 'off',
    volume: 100,
  };
}
export function formatTime(seconds: number): string {
  const n = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}
export function decodeText(text: string): string {
  if (typeof document === 'undefined') return text;
  const area = document.createElement('textarea');
  area.innerHTML = text;
  return area.value;
}
export async function searchYouTube(
  query: string,
  key: string,
  signal?: AbortSignal,
): Promise<Track[]> {
  if (!key.trim())
    throw new Error('검색 설정에서 YouTube API 키를 먼저 입력해 주세요.');
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true',
    videoSyndicated: 'true',
    relevanceLanguage: 'ko',
    maxResults: '20',
    q: query.trim(),
    key: key.trim(),
  });
  let response: Response;
  try {
    response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params}`,
      { signal },
    );
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new Error('인터넷 연결을 확인하고 다시 검색해 주세요.');
  }
  const data = (await response.json()) as {
    error?: { errors?: { reason?: string }[] };
    items?: {
      id?: { videoId?: string };
      snippet: { title: string; channelTitle: string };
    }[];
  };
  if (!response.ok) {
    const reason = data.error?.errors?.[0]?.reason;
    throw new Error(
      reason === 'quotaExceeded' || reason === 'dailyLimitExceeded'
        ? '오늘의 YouTube 검색 한도를 모두 사용했어요. 유튜브 링크로 추가할 수 있어요.'
        : response.status === 400 || response.status === 403
          ? 'API 키, YouTube Data API 사용 설정, 허용된 웹사이트 주소를 확인해 주세요.'
          : 'YouTube 검색에 실패했어요. 잠시 후 다시 시도해 주세요.',
    );
  }
  return (data.items || [])
    .filter((item: any) => videoIdPattern.test(item.id?.videoId || ''))
    .map((item: any) => ({
      id: item.id.videoId,
      title: decodeText(item.snippet.title),
      artist: decodeText(item.snippet.channelTitle),
      thumbnail: `https://i.ytimg.com/vi/${item.id.videoId}/mqdefault.jpg`,
      favorite: false,
    }));
}
export async function trackFromUrl(
  value: string,
  signal?: AbortSignal,
): Promise<Track> {
  const id = parseVideoId(value);
  if (!id) throw new Error('올바른 유튜브 영상 링크를 입력해 주세요.');
  try {
    const r = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`,
      { signal },
    );
    if (!r.ok) throw new Error('metadata');
    const data = (await r.json()) as { title: string; author_name: string };
    return {
      id,
      title: data.title,
      artist: data.author_name,
      thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      favorite: false,
    };
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    return {
      id,
      title: `YouTube · ${id}`,
      artist: 'YouTube',
      thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      favorite: false,
    };
  }
}
