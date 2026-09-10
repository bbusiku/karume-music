'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ListMusic,
  Plus,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Repeat,
  Repeat1,
  LoaderCircle,
  Music2,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import { useMusicPlayer } from '@/lib/use-music-player';
import { formatTime, type Track } from '@/lib/player';
import KarumeMascot from './karume-mascot';
import CollectionBrowser from './collection-browser';
import FavoriteHeart from './favorite-heart';
const repeatLabels = { off: '반복 해제', one: '한 곡 반복', all: '전 곡 반복' };
export default function Home() {
  const p = useMusicPlayer();
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => {
    const isEmbed =
      new URLSearchParams(window.location.search).get('embed') === '1' ||
      window.self !== window.top;
    setEmbedded(isEmbed);
    if (isEmbed) document.documentElement.dataset.embedPlayer = 'true';
    return () => {
      delete document.documentElement.dataset.embedPlayer;
    };
  }, []);
  useEffect(() => {
    if (!p.notice) return;
    const timer = window.setTimeout(() => p.setNotice(''), 1800);
    return () => window.clearTimeout(timer);
  }, [p.notice, p.setNotice]);
  const live = useRef(p);
  live.current = p;
  const [list, setList] = useState(false);
  const [characterOpen, setCharacterOpen] = useState(false);
  const characterButton = useRef<HTMLButtonElement>(null);
  const openList = () => {
    setList(true);
  };
  const play = () => {
    if (!p.current) {
      p.setNotice('재생 목록에 영상이 추가되면 재생할 수 있어요.');
      return;
    }
    if (!p.consent) p.accept();
    p.togglePlay();
  };
  const selectTrack = (tracks: Track[], id: string) => {
    setList(false);
    if (!p.consent) p.accept();
    p.playCollection(tracks, id);
  };
  useEffect(() => {
    const ctx = (document as any).modelContext;
    if (!ctx?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: any) => {
      try {
        Promise.resolve(
          ctx.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    };
    register({
      name: 'get_music_queue',
      title: '곡 목록 보기',
      description:
        'Read this browser’s music queue, current song and repeat/shuffle settings.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input: unknown) {
        if (!input || typeof input !== 'object' || Object.keys(input).length)
          throw new Error('Expected an empty object.');
        const s = live.current.library;
        return {
          tracks: s.tracks.map(({ id, title, artist, favorite }) => ({
            id,
            title,
            artist,
            favorite,
          })),
          currentId: s.currentId,
          shuffle: s.shuffle,
          repeat: s.repeat,
        };
      },
    });
    register({
      name: 'toggle_music_favorite',
      title: '곡 즐겨찾기 전환',
      description:
        'Toggle the favorite heart for one song already in the queue, updating the same state as the heart button.',
      inputSchema: {
        type: 'object',
        properties: { videoId: { type: 'string' } },
        required: ['videoId'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input: any) {
        if (
          !input ||
          typeof input.videoId !== 'string' ||
          Object.keys(input).some((k) => k !== 'videoId')
        )
          throw new Error('A videoId is required.');
        const track = live.current.library.tracks.find(
          (t) => t.id === input.videoId,
        );
        if (!track) throw new Error('Song is not in the queue.');
        live.current.favorite(track.id);
        await new Promise(requestAnimationFrame);
        return { videoId: track.id, favorite: !track.favorite };
      },
    });
    return () => lifecycle.abort();
  }, []);
  const legacyPlaceholder = p.current?.id === 'PVISi_M82xo' && p.current.title === '카루메 영상';
  const trackTitle = p.active && !legacyPlaceholder
    ? p.current?.title || '카루메 플레이어'
    : '카루메 플레이어';
  return (
    <main className={`retro-page ${embedded ? 'embed-mode' : ''}`}>
      <section className="retro-player" aria-label="카루메 플레이어">
        <div className="window-titlebar">
          <span title={trackTitle}>{trackTitle}</span>
          <span aria-hidden="true">−　□　×</span>
        </div>
        <div className="window-addressbar">
          <span aria-hidden="true">‹　›　↻　⌂　</span>
          <span className="address-star" aria-hidden="true">★</span>
          <a href="https://chzzk.naver.com/8f1942d6145656362a585633bc646e53" target="_blank" rel="noreferrer">
            https://chzzk.naver.com/8f1942d6145656362a585633bc646e53
          </a>
        </div>
        <div className={`retro-video ${p.active ? 'has-video' : ''}`}>
          {p.active ? (
            <div ref={p.container} className="youtube-player" />
          ) : (
            <div className="video-placeholder">
              <Music2 aria-hidden="true" />
              <span>재생 목록에서 듣고 싶은 영상을 골라 주세요</span>
            </div>
          )}
        </div>
        <div className="retro-track-copy">
          <h1 title={trackTitle}>{trackTitle}</h1>
          <p>karume</p>
        </div>
        <div className="retro-actions">
          <button aria-label="재생 목록" title="재생 목록" onClick={openList}>
            <ListMusic />
          </button>
          <FavoriteHeart
            identity={p.current?.id || 'empty'}
            active={!!p.current?.favorite}
            label={p.current?.favorite ? '즐겨찾기 해제' : '즐겨찾기 등록'}
            onToggle={() => (p.current ? p.favorite() : p.setNotice('재생 목록에 영상이 추가되면 즐겨찾기할 수 있어요.'))}
          />
          <button
            ref={characterButton}
            aria-label={characterOpen ? '캐릭터 숨기기' : '캐릭터 보기'}
            title={characterOpen ? '캐릭터 숨기기' : '캐릭터 보기'}
            aria-pressed={characterOpen}
            onClick={() => setCharacterOpen((open) => !open)}
          ><Plus /></button>
        </div>
        <div className="retro-timeline">
          <Slider
            className="seek"
            min={0}
            max={Math.max(p.duration, 1)}
            value={[Math.min(p.position, p.duration || 0)]}
            onValueChange={(v) => p.seek(Array.isArray(v) ? v[0] : v)}
            disabled={!p.ready || p.duration <= 0}
            aria-label="재생 위치"
          />
          <div className="times"><span>{formatTime(p.position)}</span><span>{formatTime(p.duration)}</span></div>
        </div>
        <div className="retro-transport">
          <button
            className={p.library.shuffle ? 'mode-on' : ''}
            aria-label={`셔플 ${p.library.shuffle ? '켜짐' : '꺼짐'}`}
            aria-pressed={p.library.shuffle}
            onClick={p.shuffle}
          >
            <svg className="shuffle-state-icon" viewBox="0 0 32 32" aria-hidden="true">
              <path d="M4 9h4c7 0 9 14 16 14h4M4 23h4c7 0 9-14 16-14h4" />
              <path d="m24 5 4 4-4 4m0 6 4 4-4 4" />
              {!p.library.shuffle && <path className="shuffle-slash" d="M3 3 29 29" />}
            </svg>
          </button>
          <button aria-label="이전 곡" disabled={!p.current} onClick={() => p.next(-1)}><SkipBack fill="currentColor" /></button>
          <button className="retro-play" aria-label={p.playing ? '일시정지' : '재생'} onClick={play}>
            {p.loading ? <LoaderCircle className="spin" /> : p.playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
          </button>
          <button aria-label="다음 곡" disabled={!p.current} onClick={() => p.next(1)}><SkipForward fill="currentColor" /></button>
          <button
            className={`repeat-button repeat-${p.library.repeat}`}
            aria-label={repeatLabels[p.library.repeat]}
            title={`${repeatLabels[p.library.repeat]} · 클릭하여 변경`}
            onClick={p.repeat}
          >
            {p.library.repeat === 'one' ? <Repeat1 /> : p.library.repeat === 'all' ? <span className="repeat-all"><Repeat /><b>A</b></span> : <span className="repeat-none"><b>A</b><i /></span>}
          </button>
        </div>
        {p.error && <div role="alert" className="playback-error"><p>{p.error}</p></div>}
        {p.notice && <output className="retro-toast" aria-live="polite">{p.notice}</output>}
      </section>
      <KarumeMascot open={characterOpen} anchor={characterButton} />
      <Sheet open={list} onOpenChange={setList}>
        <SheetContent className="playlist-panel collection-panel">
          <CollectionBrowser player={p} onSelect={selectTrack} />
        </SheetContent>
      </Sheet>
    </main>
  );
}
