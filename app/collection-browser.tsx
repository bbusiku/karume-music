'use client';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, Heart, Headphones, LoaderCircle, Music2, Play, RefreshCw } from 'lucide-react';
import { SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { COLLECTIONS, type CollectionKey } from '@/lib/collections';
import { useCollection } from '@/lib/use-collection';
import type { Track } from '@/lib/player';
import type { useMusicPlayer } from '@/lib/use-music-player';

export default function CollectionBrowser({ player, onSelect }: {
  player: ReturnType<typeof useMusicPlayer>;
  onSelect: (tracks: Track[], id: string) => void;
}) {
  const [category, setCategory] = useState<CollectionKey | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const collection = useCollection(category, onSelect);
  const config = category ? COLLECTIONS[category] : null;
  const tracks = collection.tracks.map((track) => ({
    ...track,
    favorite: player.library.tracks.find((item) => item.id === track.id)?.favorite ?? false,
  }));
  const shown = tracks.filter((track) => !favoritesOnly || track.favorite);
  return <>
    <header className="collection-header">
      {category && <button className="collection-back" onClick={() => { setCategory(null); setFavoritesOnly(false); }} aria-label="분류 선택으로 돌아가기"><ArrowLeft /></button>}
      <div><SheetTitle>{config?.label || '곡 목록'}</SheetTitle><SheetDescription>{config?.title || '듣고 싶은 목록을 골라 주세요'}</SheetDescription></div>
    </header>
    {!config ? <div className="collection-categories">
      {(Object.keys(COLLECTIONS) as CollectionKey[]).map((key) => {
        const item = COLLECTIONS[key];
        return <button key={key} className={`collection-card collection-${key}`} onClick={() => setCategory(key)}>
          <img src={item.tracks[0].thumbnail} alt="" />
          <span className="collection-card-info"><span className="collection-card-label">{key === 'song' ? <Music2 /> : <Headphones />}{item.label}</span><span>{item.title}</span></span>
          <ArrowRight className="collection-card-arrow" />
        </button>;
      })}
    </div> : <div className={`collection-detail collection-${category}`}>
      <aside className="collection-summary">
        <div className="collection-preview" ref={collection.container} />
        <h2>{config.title}</h2>
        <p className="collection-count">{tracks.length}개 영상 · Karume</p>
        <button className="collection-play-all" disabled={!tracks.length} onClick={() => onSelect(tracks, tracks[0].id)}><Play fill="currentColor" />모두 재생</button>
        <div className="collection-links">
          <a href={`https://www.youtube.com/playlist?list=${config.playlistId}`} target="_blank" rel="noreferrer"><ExternalLink />YouTube</a>
          <button onClick={collection.retry} disabled={collection.status === 'refreshing'} aria-label="재생목록 새로고침" title="새로고침"><RefreshCw className={collection.status === 'refreshing' ? 'spin' : ''} /></button>
        </div>
        <p className="collection-sync" role="status">{collection.status === 'refreshing' ? <><LoaderCircle className="spin" />목록 확인 중…</> : collection.message || '목록을 열어 두면 1시간마다 갱신해요.'}</p>
      </aside>
      <section className="collection-videos" aria-label={`${config.label} 영상 목록`}>
        <div className="collection-list-toolbar"><span>{favoritesOnly ? '즐겨찾는 영상' : '재생 순서'}</span><button aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly((value) => !value)}><Heart fill={favoritesOnly ? 'currentColor' : 'none'} />즐겨찾기</button></div>
        <div className="collection-rows">
          {shown.length ? shown.map((track, index) => <div key={track.id} className={`collection-row ${player.library.currentId === track.id ? 'is-current' : ''}`}>
            <button className="collection-row-select" onClick={() => onSelect(tracks, track.id)} aria-label={`${track.title} 재생`} aria-current={player.library.currentId === track.id ? 'true' : undefined}>
              <span className="collection-row-number">{player.library.currentId === track.id ? <span className={`equalizer ${player.playing ? 'moving' : ''}`}><i /><i /><i /></span> : String(index + 1).padStart(2, '0')}</span>
              <img src={track.thumbnail} alt="" loading="lazy" />
              <span className="collection-row-copy"><strong>{track.title}</strong><span>{track.artist}</span></span>
            </button>
            <button className="collection-heart" aria-label={`${track.title} ${track.favorite ? '즐겨찾기 해제' : '즐겨찾기 등록'}`} aria-pressed={track.favorite} onClick={() => player.favoriteTrack(track)}>{track.favorite ? <span aria-hidden="true">💙</span> : <Heart />}</button>
          </div>) : <div className="collection-empty"><Heart /><p>아직 즐겨찾는 영상이 없어요.</p><span>영상 옆의 하트를 눌러 모아 보세요.</span></div>}
        </div>
      </section>
    </div>}
  </>;
}
