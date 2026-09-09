'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
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
  Volume2,
  VolumeX,
  Search,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  LoaderCircle,
  Check,
  KeyRound,
  X,
  Music2,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useMusicPlayer } from '@/lib/use-music-player';
import {
  formatTime,
  parseVideoId,
  searchYouTube,
  trackFromUrl,
  type Track,
} from '@/lib/player';
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
  const [search, setSearch] = useState(false);
  const [info, setInfo] = useState(false);
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [key, setKey] = useState('');
  const [keyDraft, setKeyDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<Track[]>([]);
  const [searchError, setSearchError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    try {
      const value = sessionStorage.getItem('karume.youtube-key') || '';
      setKey(value);
      setKeyDraft(value);
    } catch {}
    return () => controller.current?.abort();
  }, []);
  const openSearch = () => {
    p.pause();
    setList(false);
    setSearch(true);
  };
  const openList = () => {
    p.pause();
    setList(true);
  };
  const closeSearch = (open: boolean) => {
    setSearch(open);
    if (!open) {
      controller.current?.abort();
      setBusy(false);
    }
  };
  const play = () => {
    if (!p.current) {
      openSearch();
      return;
    }
    if (!p.consent) {
      setInfo(true);
      return;
    }
    p.togglePlay();
  };
  const selectTrack = (id: string) => {
    setList(false);
    if (!p.consent) {
      setInfo(true);
      return;
    }
    p.select(id);
  };
  const saveKey = () => {
    const cleaned = keyDraft.trim();
    setKey(cleaned);
    try {
      if (cleaned) sessionStorage.setItem('karume.youtube-key', cleaned);
      else sessionStorage.removeItem('karume.youtube-key');
    } catch {}
    setSearchError('');
    p.setNotice(cleaned ? '검색 설정을 저장했어요.' : 'API 키를 지웠어요.');
  };
  const runSearch = async (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    if (!p.consent) {
      setSearchError('아래 이용 안내에 동의한 후 검색해 주세요.');
      return;
    }
    controller.current?.abort();
    const task = new AbortController();
    controller.current = task;
    setBusy(true);
    setSearchError('');
    setResults([]);
    setSearched(false);
    try {
      const id = parseVideoId(query);
      if (!id && /^https?:\/\//i.test(query))
        throw new Error('유튜브 영상 링크를 입력해 주세요.');
      const found = id
        ? [await trackFromUrl(query, task.signal)]
        : await searchYouTube(query, key, task.signal);
      if (task.signal.aborted) return;
      setResults(found);
      setSearched(true);
    } catch (e) {
      if (!task.signal.aborted) setSearchError((e as Error).message);
    } finally {
      if (!task.signal.aborted) setBusy(false);
    }
  };
  const accept = () => {
    p.accept();
    setSearchError('');
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
  const privacy = (
    <div className="privacy-copy">
      <p>
        곡 목록과 즐겨찾기는 이 브라우저에 저장됩니다. 검색용 API 키는 현재 탭의
        세션에만 보관되며 소스 코드에 포함되지 않습니다.
      </p>
      <p>
        검색·영상 정보 조회·재생을 이용하면 검색어, 영상 정보 및 연결 정보가
        Google/YouTube에 전달됩니다. YouTube의 쿠키와 데이터 처리가 적용될 수
        있습니다.
      </p>
      <p>
        <a
          href="https://www.youtube.com/t/terms"
          target="_blank"
          rel="noreferrer"
        >
          YouTube 이용약관
        </a>{' '}
        ·{' '}
        <a
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noreferrer"
        >
          Google 개인정보처리방침
        </a>
      </p>
      {!p.consent && (
        <button className="primary small" onClick={accept}>
          동의하고 계속
        </button>
      )}
    </div>
  );
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
        {!favorites && (
          <button className="primary small" onClick={openSearch}>
            <Plus size={19} />곡 추가
          </button>
        )}
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
            <button className="video-placeholder" onClick={openSearch}>
              <Music2 aria-hidden="true" />
              <span>영상은 곡을 추가하면 여기에서 재생돼요</span>
            </button>
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
            onClick={() => (p.current ? p.favorite() : openSearch())}
          >
            <Heart fill={p.current?.favorite ? 'currentColor' : 'none'} />
          </button>
          <button aria-label="곡 추가" title="곡 추가" onClick={openSearch}><Plus /></button>
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
          <button aria-label="이전 곡" disabled={!p.current} onClick={() => (p.consent ? p.next(-1) : setInfo(true))}><SkipBack fill="currentColor" /></button>
          <button className="retro-play" aria-label={p.playing ? '일시정지' : '재생'} onClick={play}>
            {p.loading ? <LoaderCircle className="spin" /> : p.playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
          </button>
          <button aria-label="다음 곡" disabled={!p.current} onClick={() => (p.consent ? p.next(1) : setInfo(true))}><SkipForward fill="currentColor" /></button>
          <button
            className={`repeat-button repeat-${p.library.repeat}`}
            aria-label={repeatLabels[p.library.repeat]}
            title={`${repeatLabels[p.library.repeat]} · 클릭하여 변경`}
            onClick={p.repeat}
          >
            {p.library.repeat === 'one' ? <Repeat1 /> : p.library.repeat === 'all' ? <span className="repeat-all"><Repeat /><b>A</b></span> : <span className="repeat-none">A<span>→</span></span>}
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
          <button className="add-to-queue" onClick={openSearch}>
            <Plus size={22} />곡 추가
          </button>
        </SheetContent>
      </Sheet>
      <Dialog open={search} onOpenChange={closeSearch}>
        <DialogContent className="search-dialog">
          <DialogTitle>좋아하는 곡을 찾아볼까요?</DialogTitle>
          <DialogDescription>
            YouTube에서 검색하거나 영상 링크를 붙여 넣어 주세요.
          </DialogDescription>
          <form onSubmit={runSearch} className="search-form">
            <Search />
            <input
              aria-label="유튜브 검색어 또는 영상 링크"
              placeholder="노래, 아티스트 또는 유튜브 링크"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={500}
            />
            <button
              className="primary"
              type="submit"
              disabled={busy || !query.trim()}
            >
              {busy ? (
                <LoaderCircle className="spin" size={20} />
              ) : (
                <Search size={20} />
              )}
              <span>검색</span>
            </button>
          </form>
          {!p.consent && (
            <section className="consent-box">
              <h3>시작하기 전에</h3>
              {privacy}
            </section>
          )}
          <details className="key-settings">
            <summary>
              <KeyRound size={17} />
              {key
                ? '검색 설정 · API 키 연결됨'
                : '검색 설정 · API 키 등록하기'}
            </summary>
            <p>
              검색에는 YouTube Data API 키가 필요해요. 영상 링크는 키 없이
              추가할 수 있어요.
            </p>
            <div className="key-input-row">
              <input
                type="password"
                autoComplete="off"
                aria-label="YouTube Data API 키"
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                placeholder="YouTube API 키 입력"
              />
              <button className="secondary" onClick={saveKey}>
                저장
              </button>
            </div>
            <p className="small-note">
              이 탭의 세션에만 저장됩니다. 빈칸으로 저장하면 키가 삭제됩니다.
            </p>
            <a href="./setup.html" target="_blank" rel="noopener noreferrer">
              API 키 발급·GitHub 배포 방법 <ExternalLink size={13} />
            </a>
          </details>
          {searchError && (
            <p role="alert" className="search-error">
              {searchError}
            </p>
          )}
          <div className="search-results" aria-busy={busy}>
            {busy ? (
              <div className="empty-state">
                <LoaderCircle className="spin" />
                <p>YouTube에서 찾고 있어요…</p>
              </div>
            ) : results.length ? (
              results.map((track) => {
                const added = p.library.tracks.some((t) => t.id === track.id);
                return (
                  <div className="search-result" key={track.id}>
                    <Avatar track={track} />
                    <div>
                      <strong>{track.title}</strong>
                      <span>{track.artist}</span>
                      <a
                        href={`https://www.youtube.com/watch?v=${track.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        YouTube <ExternalLink size={11} />
                      </a>
                    </div>
                    <button
                      className={`result-add ${added ? 'added' : ''}`}
                      aria-label={
                        added ? `${track.title} 추가됨` : `${track.title} 추가`
                      }
                      disabled={added}
                      onClick={() => p.add(track)}
                    >
                      {added ? <Check /> : <Plus />}
                      <span>{added ? '추가됨' : '추가'}</span>
                    </button>
                  </div>
                );
              })
            ) : searched ? (
              <div className="empty-state">
                <Search />
                <h3>검색 결과가 없어요</h3>
                <p>다른 노래 제목이나 아티스트로 검색해 보세요.</p>
              </div>
            ) : (
              <div className="search-start">
                <Music2 />
                <p>오늘 듣고 싶은 노래는 무엇인가요?</p>
                <span>추가한 곡은 곡 목록에서 선택해 재생할 수 있어요.</span>
              </div>
            )}
          </div>
          <output className="dialog-status" aria-live="polite">
            {p.notice}
          </output>
        </DialogContent>
      </Dialog>
      <Dialog open={info} onOpenChange={setInfo}>
        <DialogContent className="info-dialog">
          <DialogTitle>카루메 뮤직 이용 안내</DialogTitle>
          <DialogDescription>
            내 브라우저에 담아 두는 유튜브 플레이리스트
          </DialogDescription>
          {privacy}
          <p>
            한 곡 반복 → 전곡 반복 → 반복 해제 순서로 바뀝니다. 반복 해제는 현재
            곡이 끝나면 멈춥니다. 목록이나 검색창을 열거나 다른 탭으로 이동하면
            영상은 일시정지됩니다.
          </p>
          <p>
            지역·연령 제한이나 영상 소유자의 설정에 따라 일부 영상은 여기서
            재생할 수 없습니다.
          </p>
          <a href="./setup.html" target="_blank" rel="noreferrer">
            검색 설정 및 GitHub 배포 안내 <ExternalLink size={14} />
          </a>
          <button className="secondary" onClick={() => setInfo(false)}>
            닫기
          </button>
        </DialogContent>
      </Dialog>
    </main>
  );
}

