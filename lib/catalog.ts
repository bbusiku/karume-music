import type { Track } from './player';
import type { CollectionKey } from './collections';

export function parseCatalog(value: unknown, key: CollectionKey, playlistId: string): Track[] | null {
  if (!value || typeof value !== 'object') return null;
  const catalog = value as Record<string, any>;
  if (catalog.version !== 1 || typeof catalog.updatedAt !== 'string' || !Number.isFinite(Date.parse(catalog.updatedAt))) return null;
  const collection = catalog.collections?.[key];
  if (!collection || collection.playlistId !== playlistId || !Array.isArray(collection.tracks) || collection.tracks.length > 5000) return null;
  const tracks: Track[] = [];
  const seen = new Set<string>();
  for (const item of collection.tracks) {
    if (!item || typeof item.id !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(item.id) ||
        typeof item.title !== 'string' || !item.title.trim() || typeof item.artist !== 'string' || seen.has(item.id)) return null;
    seen.add(item.id);
    tracks.push({ id: item.id, title: item.title.slice(0, 300), artist: item.artist.slice(0, 150), thumbnail: `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`, favorite: false });
  }
  return tracks;
}

// The build includes its refreshed catalog, so Play works before opening the list.
// A later catalog saved by the list may be newer than an already-loaded bundle.
export function startupSongs(published: unknown, cached: unknown, playlistId: string, fallback: Track[]): Track[] {
  const bundled = parseCatalog(published, 'song', playlistId);
  const saved = parseCatalog(cached, 'song', playlistId);
  if (saved && (!bundled || Date.parse((cached as { updatedAt: string }).updatedAt) > Date.parse((published as { updatedAt: string }).updatedAt))) return saved;
  return bundled ?? fallback;
}
