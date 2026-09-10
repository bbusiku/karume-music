'use client';
import { useState } from 'react';
import { ExternalLink, Heart, Headphones, ListMusic, Music2, Play, RefreshCw } from 'lucide-react';
import { SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { COLLECTIONS, type CollectionKey } from '@/lib/collections';
import { useCollection } from '@/lib/use-collection';
import type { Track } from '@/lib/player';
import type { useMusicPlayer } from '@/lib/use-music-player';
import FavoriteHeart from './favorite-heart';

export default function CollectionBrowser({ player, onSelect }: {
  player: ReturnType<typeof useMusicPlayer>;
  onSelect: (tracks: Track[], id: string) => void;
}) {
  const [category, setCategory] = useState<CollectionKey>('song');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const collection = useCollection(category);
  const config = COLLECTIONS[category];
  const tracks = collection.tracks.map((track) => ({ ...track, favorite: player.library.tracks.find((item) => item.id === track.id)?.favorite ?? false }));
  const shown = tracks.filter((track) => !favoritesOnly || track.favorite);
  return <>
    <header className="collection-header">
      <ListMusic aria-hidden="true" />
      <SheetTitle>재생 목록</SheetTitle>
      <SheetDescription className="sr-only">Song, ASMR, 애교송 중에서 원하는 영상을 재생하세요.</SheetDescription>
    </header>
    <nav className="collection-tabs" aria-label="재생목록 분류">
      {(Object.keys(COLLECTIONS) as CollectionKey[]).map((key) => <button key={key} aria-pressed={category === key} onClick={() => { setCategory(key); setFavoritesOnly(false); }}>
        {key === 'song' ? <Music2 aria-hidden="true" /> : key === 'asmr' ? <Headphones aria-hidden="true" /> : <span aria-hidden="true">🐱</span>}<span>{COLLECTIONS[key].label}</span>
      </button>)}
    </nav>
    <section className={`collection-detail collection-${category}`} aria-label={`${config.label} 영상 목록`}>
      <div className="collection-toolbar">
        <div className="collection-caption"><strong>{config.title}</strong><span>{tracks.length}개 영상</span></div>
        <div className="collection-toolbar-actions">
          <button className="collection-play-all" disabled={!tracks.length} onClick={() => onSelect(tracks, tracks[0].id)}><Play fill="currentColor" />모두 재생</button>
          <button className="collection-filter" aria-label="즐겨찾기만 보기" title="즐겨찾기만 보기" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly((value) => !value)}><Heart fill={favoritesOnly ? 'currentColor' : 'none'} /></button>
        </div>
      </div>
      <div className="collection-rows">
        {shown.length ? shown.map((track, index) => <div key={track.id} className={`collection-row ${player.library.currentId === track.id ? 'is-current' : ''}`}>
          <button className="collection-row-select" onClick={() => onSelect(tracks, track.id)} aria-label={`${track.title} 재생`} aria-current={player.library.currentId === track.id ? 'true' : undefined}>
            <span className="collection-row-number">{player.library.currentId === track.id ? <span className={`equalizer ${player.playing ? 'moving' : ''}`}><i /><i /><i /></span> : String(index + 1).padStart(2, '0')}</span>
            <img src={track.thumbnail} alt="" loading="lazy" />
            <span className="collection-row-copy"><strong>{track.title}</strong><span>karume</span></span>
          </button>
          <FavoriteHeart className="collection-heart" label={`${track.title} ${track.favorite ? '즐겨찾기 해제' : '즐겨찾기 등록'}`} active={track.favorite} onToggle={() => player.favoriteTrack(track)} />
        </div>) : <div className="collection-empty">{favoritesOnly ? <Heart /> : <ListMusic />}<p>{favoritesOnly ? '아직 즐겨찾는 영상이 없어요.' : '아직 등록된 영상이 없어요.'}</p></div>}
      </div>
      {collection.message && <p className="collection-error" role="status">{collection.message}</p>}
    </section>
    <footer className="collection-footer">
      <span>{favoritesOnly ? `즐겨찾기 ${shown.length}개` : `${shown.length}개 영상`}</span>
      <a href={`https://www.youtube.com/playlist?list=${config.playlistId}`} target="_blank" rel="noreferrer"><ExternalLink />YouTube</a>
      <button onClick={collection.retry} disabled={collection.status === 'refreshing'} aria-label="재생목록 새로고침" title="새로고침"><RefreshCw className={collection.status === 'refreshing' ? 'spin' : ''} /></button>
    </footer>
  </>;
}
