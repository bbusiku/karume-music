export type AudioSettings = { volume: number; muted: boolean };
export type VolumePlayer = {
  setVolume: (volume: number) => void;
  getVolume: () => number;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
};

export function applyPlayerAudio(player: VolumePlayer, settings: AudioSettings) {
  player.setVolume(Math.round(Math.max(0, Math.min(100, settings.volume))));
  if (settings.muted) player.mute();
  else player.unMute();
}

export function readPlayerAudio(player: VolumePlayer): AudioSettings | null {
  const volume = player.getVolume();
  const muted = player.isMuted();
  if (!Number.isFinite(volume) || typeof muted !== 'boolean') return null;
  return { volume: Math.round(Math.max(0, Math.min(100, volume))), muted };
}
