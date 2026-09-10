import type { Track } from './player';

export type CollectionKey = 'song' | 'asmr' | 'aegyo';
export type Collection = {
  key: CollectionKey;
  label: string;
  title: string;
  playlistId: string;
  tracks: Track[];
};

const tracks = (artist: string, entries: [string, string][]): Track[] =>
  entries.map(([id, title]) => ({
    id, title, artist,
    thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    favorite: false,
  }));

// Offline seeds; the published catalog supplies the hourly refreshed lists.
export const COLLECTIONS: Record<CollectionKey, Collection> = {
  song: {
    key: 'song', label: 'Song', title: '루메 노래', playlistId: 'PLJmCvCN8XgA8',
    tracks: tracks('karume', [
      ['umPTQV8-Xu8', '카루메 - 팬클럽'],
      ['JHaKin9q0U0', '카루메   나랑 같이 걸을래'],
      ['IVjfeh8tGpQ', '카루메 - 카타포'],
      ['K43HyZCMjl0', "카루메 - It's Me"],
      ['DZUIrrCOpTQ', '카루메 - 여름아 부탁해'],
      ['tYBN7wapt_I', '카루메 - 모든 날, 모든 순간'],
      ['Frgbs3YiwWU', '카루메 - 코이'],
    ]),
  },
  asmr: {
    key: 'asmr', label: 'ASMR', title: '루메 ASMR', playlistId: 'PLc06btbrmeCw',
    tracks: tracks('카루메 𝐀𝐒𝐌𝐑', [
      ['e9hejfxT9mI', '[ ASMR / 이어리킹 ] 3DIO 마이크 산 기념 첫 ASMR'],
      ['7yABnUZu95k', '[ ASMR / 이어리킹 ] ASMR 2일차 뉴비'],
      ['Ry7ypCffw-A', '[ ASMR / 이어리킹 ] 3일차 사탕, 젤리, 꿀 먹기'],
      ['jjX0kEKzj1U', '[ ASMR / 이어리킹 ] 4일차 ASMR'],
      ['YiLtAZCEM8Y', '[ ASMR / 이어리킹 ] 드디어 ASMR이 와써'],
      ['qheFP4qEoa0', '[ 이어리킹 / ASMR ] 루메의 귀 파주는(?) 가게'],
      ['DLO96T_9r8c', '[ 3DIO/ASMR ] 음식 이것저것 먹기 ASMR / 2026 02 03'],
      ['nPgaeGNuDPY', '[ 3DIO/ASMR ] 발렌타인데이 기념 ASMR / 2026 02 14'],
      ['0DOd7ikQtL4', '【 3DIO ASMR 】이것저것 해달라는거 해주기 / 2026 03 04'],
      ['eSFDdmfWvl0', '【 3DIO ASMR 】남자친구 자취방에 놀러간 여자친구 ASMR'],
      ['UH5sO9gcbWg', '아픈 상태로 하는 ASMR'],
      ['CZ8M8XLgc8o', 'ASMR 세팅 다시 받아와써염'],
      ['jXuxOq-xqTk', '전심전력 ASMR'],
      ['3-ODdhZK5GI', '오랜만에 ASMR'],
      ['zGk1Wtsg3AA', '치지직에서 내려간 ASMR'],
    ]),
  },
  aegyo: {
    key: 'aegyo', label: '애교송', title: '루메 애교송', playlistId: 'PLFK4yXX5LyZQ',
    tracks: tracks('루메얌', [
      ['ObfH_MGtT6w', '카루메 - 귀요미 송'],
      ['UHFW8muIyTc', '카루메 - 살구송'],
      ['ge8-kwOXvPs', '카루메 - 내꺼 하는 법'],
    ]),
  },
};
