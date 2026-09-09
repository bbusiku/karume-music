'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Heart,
  ListMusic,
  Plus,
  Shuffle,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Repeat,
  Repeat1,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  LoaderCircle,
  Music2,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useMusicPlayer } from '@/lib/use-music-player';
import { formatTime, type Track } from '@/lib/player';
const repeatLabels = { off: '반복 해제', one: '한 곡 반복', all: '전곡 반복' };
function Avatar({
  track,
  className = '',
}: {
  track?: Track;
  className?: string;
}) {
  return (
    <div className={`avatar ${track ? 'youtube-thumbnail' : ''} ${className}`}>
      <img
        src={track?.thumbnail || './karume-reference.png'}
        alt=""
        loading="lazy"
      />
    </div>
  );
}
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
  const [tab, setTab] = useState('all');
  const [characterOpen, setCharacterOpen] = useState(false);
  const openList = () => {
    p.pause();
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
  const selectTrack = (id: string) => {
    setList(false);
    if (!p.consent) p.accept();
    p.select(id);
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
  const renderQueue = (favorites: boolean) => {
    const tracks = p.library.tracks.filter((t) => !favorites || t.favorite);
    return tracks.length ? (
      <div className="queue-scroll">
        {tracks.map((track, i) => (
          <div
            key={track.id}
            className={`queue-row ${track.id === p.library.currentId ? 'current' : ''}`}
          >
            <button
              className="queue-select"
              onClick={() => selectTrack(track.id)}
              aria-label={`${track.title} 재생`}
              aria-current={
                track.id === p.library.currentId ? 'true' : undefined
              }
            >
              <span
                className={`row-number ${track.id === p.library.currentId ? 'selected' : ''}`}
              >
                {track.id === p.library.currentId ? (
                  <span className={`equalizer ${p.playing ? 'moving' : ''}`}>
                    <i />
                    <i />
                    <i />
                  </span>
                ) : (
                  String(i + 1).padStart(2, '0')
                )}
              </span>
              <Avatar track={track} />
              <span className="queue-copy">
                <strong>{track.title}</strong>
                <span>{track.artist}</span>
              </span>
              {track.favorite && (
                <Heart className="row-heart" fill="currentColor" />
              )}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="more-button"
                aria-label={`${track.title} 더 보기`}
              >
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="song-menu">
                <DropdownMenuItem onClick={() => p.favorite(track.id)}>
                  <Heart />
                  {track.favorite ? '즐겨찾기 해제' : '즐겨찾기 등록'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    window.open(
                      `https://www.youtube.com/watch?v=${track.id}`,
                      '_blank',
                      'noopener,noreferrer',
                    )
                  }
                >
                  <ExternalLink />
                  YouTube에서 열기
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => p.remove(track.id)}>
                  <Trash2 />
                  목록에서 삭제
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
    ) : (
      <div className="empty-state">
        {favorites ? <Heart /> : <ListMusic />}
        <h3>
          {favorites
            ? '아직 즐겨찾는 곡이 없어요'
            : '첫 번째 노래를 기다리고 있어요'}
        </h3>
        <p>
          {favorites
            ? '하트를 눌러 좋아하는 곡을 모아 보세요.'
            : '+ 버튼으로 유튜브 곡을 추가해 보세요.'}
        </p>
      </div>
    );
  };
  const trackTitle = p.current?.title || '아직 재생할 영상이 없어요';
  return (
    <main className={`retro-page ${embedded ? 'embed-mode' : ''}`}>
      <section className="retro-player" aria-label="카루메 뮤직 플레이어">
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
              <span>영상은 나중에 재생 목록에서 추가할 수 있어요</span>
            </div>
          )}
        </div>
        <div className="retro-track-copy">
          <h1 title={trackTitle}>{trackTitle}</h1>
          <p>Karume</p>
        </div>
        <div className="retro-actions">
          <button aria-label="재생 목록" title="재생 목록" onClick={openList}>
            <ListMusic />
          </button>
          <button
            className={p.current?.favorite ? 'favorite-on' : ''}
            aria-label={p.current?.favorite ? '즐겨찾기 해제' : '즐겨찾기 등록'}
            onClick={() => (p.current ? p.favorite() : p.setNotice('재생 목록에 영상이 추가되면 즐겨찾기할 수 있어요.'))}
          >
            {p.current?.favorite ? <span className="blue-heart">💙</span> : <Heart />}
          </button>
          <span className={`character-pop ${characterOpen ? 'open' : ''}`} aria-hidden={!characterOpen}>
            <img src="./karume-pop.gif" alt="" />
          </span>
          <button
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
          ><Shuffle /></button>
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
      <Sheet open={list} onOpenChange={setList}>
        <SheetContent className="playlist-panel">
          <SheetTitle>곡 목록</SheetTitle>
          <SheetDescription>
            나의 플레이리스트 · {p.library.tracks.length}곡
          </SheetDescription>
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(String(v))}
            className="queue-tabs"
          >
            <TabsList>
              <TabsTrigger value="all">전체 곡</TabsTrigger>
              <TabsTrigger value="favorites">
                <Heart size={15} />
                즐겨찾기
              </TabsTrigger>
            </TabsList>
            <TabsContent value="all">{renderQueue(false)}</TabsContent>
            <TabsContent value="favorites">{renderQueue(true)}</TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </main>
  );
}

