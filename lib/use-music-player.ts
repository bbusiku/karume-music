'use client';
import { useEffect, useRef, useState } from 'react';
import {
  addTrack,
  adjacent,
  afterEnd,
  emptyLibrary,
  nextRepeat,
  removeTrack,
  restoreLibrary,
  selectCollection,
  starterTrack,
  toggleFavorite,
  toggleShuffle,
  type Library,
  type Track,
} from './player';
const repeatLabels = { off: '반복 해제', one: '한 곡 반복', all: '전 곡 반복' };
export type YTPlayer = {
  cuePlaylist: (options: { listType: 'playlist'; list: string; index?: number }) => void;
  getPlaylist: () => string[];
  loadVideoById: (id: string) => void;
  cueVideoById: (id: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (n: number, allow: boolean) => void;
  getDuration: () => number;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  getVideoData: () => { video_id: string; title?: string; author?: string };
  destroy: () => void;
};
declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, options: any) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}
let apiPromise: Promise<void> | null = null;
export function loadAPI(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const script = document.createElement('script');
    const timeout = setTimeout(() => {
      apiPromise = null;
      script.remove();
      reject(
        new Error(
          'YouTube에 연결하지 못했어요. 인터넷 연결을 확인하고 재생을 다시 눌러 주세요.',
        ),
      );
    }, 15000);
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      previous?.();
      resolve();
    };
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => {
      clearTimeout(timeout);
      script.remove();
      apiPromise = null;
      reject(
        new Error(
          'YouTube 플레이어를 불러오지 못했어요. 재생을 다시 눌러 주세요.',
        ),
      );
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}
const messages: Record<number, string> = {
  2: '올바르지 않은 영상입니다.',
  5: '이 브라우저에서 영상을 재생할 수 없어요.',
  100: '삭제되었거나 비공개인 영상입니다.',
  101: '이 영상은 외부 사이트 재생을 허용하지 않아요.',
  150: '이 영상은 외부 사이트 재생을 허용하지 않아요.',
  153: 'YouTube가 사이트 주소를 확인하지 못했어요. GitHub Pages 또는 일반 브라우저에서 열어 주세요.',
};
export function useMusicPlayer() {
  const [library, setLibrary] = useState<Library>(emptyLibrary);
  const state = useRef(library);
  state.current = library;
  const [hydrated, setHydrated] = useState(false);
  const [consent, setConsent] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [request, setRequest] = useState<{
    id: string;
    autoplay: boolean;
    nonce: number;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const player = useRef<YTPlayer | null>(null);
  const container = useRef<HTMLDivElement | null>(null);
  const armed = useRef(false);
  const desired = useRef(request);
  desired.current = request;
  const commit = (next: Library) => {
    state.current = next;
    setLibrary(next);
  };
  useEffect(() => {
    try {
      const restored = restoreLibrary(
        JSON.parse(localStorage.getItem('karume.library.v1') || 'null'),
      );
      commit(restored.tracks.length ? restored : addTrack(restored, starterTrack));
      setConsent(localStorage.getItem('karume.consent.v1') === 'yes');
    } catch {
      setNotice('저장된 목록을 읽지 못했어요. 새 목록으로 시작합니다.');
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem('karume.library.v1', JSON.stringify(library));
    } catch {
      setNotice(
        '저장 공간을 사용할 수 없어 이번 방문에서만 목록이 유지됩니다.',
      );
    }
  }, [library, hydrated]);
  const accept = () => {
    setConsent(true);
    try {
      localStorage.setItem('karume.consent.v1', 'yes');
    } catch {}
  };
  const select = (id: string, autoplay = true) => {
    if (!state.current.tracks.some((t) => t.id === id)) return;
    commit({ ...state.current, currentId: id });
    armed.current = false;
    setError('');
    setPosition(0);
    setDuration(0);
    setPlaying(false);
    setLoading(true);
    setRequest({ id, autoplay, nonce: Date.now() + Math.random() });
    if (!player.current) setAttempt((n) => n + 1);
  };
  const next = (direction: 1 | -1) => {
    const id = adjacent(state.current, direction);
    if (id) select(id);
  };
  const playCollection = (tracks: Track[], id: string) => {
    if (!tracks.some((track) => track.id === id)) return;
    commit(selectCollection(state.current, tracks, id));
    select(id);
  };
  const favoriteTrack = (track: Track) => {
    const s = state.current;
    const tracks = s.tracks.some((item) => item.id === track.id) ? s.tracks : [...s.tracks, track];
    commit(toggleFavorite({ ...s, tracks }, track.id));
  };
  const active = !!request && consent;
  useEffect(() => {
    if (!active || !container.current) return;
    let cancelled = false;
    let instance: YTPlayer | null = null;
    const mount = document.createElement('div');
    container.current.replaceChildren(mount);
    setLoading(true);
    loadAPI()
      .then(() => {
        if (cancelled) return;
        instance = new window.YT!.Player(mount, {
          width: '100%',
          height: '100%',
          playerVars: {
            playsinline: 1,
            origin: window.location.origin,
            controls: 1,
            rel: 0,
          },
          events: {
            onReady: () => {
              if (cancelled) return;
              player.current = instance;
              const data = instance!.getVideoData();
              if (data.video_id && data.title) {
                commit({
                  ...state.current,
                  tracks: state.current.tracks.map((t) =>
                    t.id === data.video_id
                      ? { ...t, title: data.title!, artist: data.author || t.artist }
                      : t,
                  ),
                });
              }
              setReady(true);
              setLoading(false);
            },
            onStateChange: (event: { data: number }) => {
              if (cancelled || !instance) return;
              const data = instance.getVideoData();
              if (data.video_id && data.video_id !== state.current.currentId)
                return;
              setPlaying(event.data === 1);
              setLoading(event.data === 3);
              if (event.data === 1) {
                armed.current = true;
                setError('');
                const d = instance.getDuration();
                if (d > 0) setDuration(d);
                if (data.title) {
                  commit({
                    ...state.current,
                    tracks: state.current.tracks.map((t) =>
                      t.id === data.video_id
                        ? {
                            ...t,
                            title: data.title!,
                            artist: data.author || t.artist,
                          }
                        : t,
                    ),
                  });
                }
              }
              if (event.data === 0 && armed.current) {
                armed.current = false;
                const id = afterEnd(state.current);
                if (id) select(id);
                else {
                  setPosition(instance.getDuration());
                  setNotice('곡 재생이 끝났어요.');
                }
              }
            },
            onError: (event: { data: number }) => {
              if (cancelled) return;
              armed.current = false;
              setPlaying(false);
              setLoading(false);
              setError(
                messages[event.data] ||
                  '재생할 수 없는 영상입니다. 다른 곡을 선택해 주세요.',
              );
            },
            onAutoplayBlocked: () => {
              if (cancelled) return;
              setPlaying(false);
              setLoading(false);
              setNotice('재생 버튼을 한 번 더 눌러 주세요.');
            },
          },
        });
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
      setReady(false);
      player.current = null;
      instance?.destroy();
    };
  }, [active, attempt]);
  useEffect(() => {
    if (!ready || !request || !player.current) return;
    setError('');
    armed.current = false;
    // Reuse the same iframe so native volume and mute choices survive track changes.
    if (request.autoplay) player.current.loadVideoById(request.id);
    else player.current.cueVideoById(request.id);
  }, [ready, request]);
  useEffect(() => {
    if (!ready) return;
    const timer = setInterval(() => {
      const p = player.current;
      if (!p) return;
      const d = p.getDuration();
      const n = p.getCurrentTime();
      if (Number.isFinite(d) && d > 0) setDuration(d);
      if (Number.isFinite(n)) setPosition(n);
    }, 350);
    return () => clearInterval(timer);
  }, [ready]);
  const togglePlay = () => {
    if (!state.current.currentId) return;
    if (!ready || !player.current || error) {
      select(state.current.currentId);
      return;
    }
    if (player.current.getPlayerState() === 1) player.current.pauseVideo();
    else player.current.playVideo();
  };
  const pause = () => {
    player.current?.pauseVideo();
    setPlaying(false);
  };
  const add = (track: Track) => {
    const duplicate = state.current.tracks.some((t) => t.id === track.id);
    commit(addTrack(state.current, track));
    setNotice(
      duplicate ? '이미 곡 목록에 있는 노래예요.' : '곡 목록에 추가했어요.',
    );
    return !duplicate;
  };
  const remove = (id: string) => {
    const wasCurrent = state.current.currentId === id;
    const nextState = removeTrack(state.current, id);
    commit(nextState);
    if (wasCurrent) {
      player.current?.stopVideo();
      setPlaying(false);
      setPosition(0);
      setDuration(0);
      setRequest(null);
      setError('');
    }
    setNotice('곡 목록에서 삭제했어요.');
  };
  const favorite = (id = state.current.currentId) => {
    if (id) commit(toggleFavorite(state.current, id));
  };
  const shuffle = () => {
    const next = toggleShuffle(state.current);
    commit(next);
    setNotice(next.shuffle ? '셔플 켜짐' : '셔플 꺼짐');
  };
  const setShuffle = (enabled: boolean) => {
    if (state.current.shuffle === enabled) {
      setNotice(enabled ? '셔플 켜짐' : '셔플 꺼짐');
      return;
    }
    const next = toggleShuffle(state.current);
    commit(next);
    setNotice(next.shuffle ? '셔플 켜짐' : '셔플 꺼짐');
  };
  const repeat = () => {
    const next = nextRepeat(state.current.repeat);
    commit({ ...state.current, repeat: next });
    setNotice(repeatLabels[next]);
  };
  const seek = (n: number) => {
    if (player.current && duration > 0) {
      player.current.seekTo(n, true);
      setPosition(n);
    }
  };
  return {
    library,
    current: library.tracks.find((t) => t.id === library.currentId),
    consent,
    accept,
    playing,
    loading,
    ready,
    error,
    notice,
    setNotice,
    position,
    duration,
    container,
    active,
    select,
    playCollection,
    favoriteTrack,
    next,
    togglePlay,
    pause,
    add,
    remove,
    favorite,
    shuffle,
    setShuffle,
    repeat,
    seek,
  };
}
