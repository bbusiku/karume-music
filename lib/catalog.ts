import type { Track } from './player';

export function parseCatalog(value: unknown, key: 'song' | 'asmr', playlistId: string): Track[] | null {
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
