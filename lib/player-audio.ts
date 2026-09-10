type VolumePlayer = {
  getVolume: () => number;
  setVolume: (volume: number) => void;
  isMuted: () => boolean;
  unMute: () => void;
};

// Pin the embedded player's volume; device and browser sound controls stay external.
export function keepFullVolume(player: VolumePlayer) {
  if (player.getVolume() !== 100) player.setVolume(100);
  if (player.isMuted()) player.unMute();
}
