import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '카루메 뮤직',
  icons: {
    icon: { url: './karume-pop.gif?v=2', type: 'image/gif' },
    shortcut: './karume-pop.gif?v=2',
  },
  description: '좋아하는 유튜브 곡으로 채우는 나만의 카루메 뮤직 플레이어',
  referrer: 'strict-origin-when-cross-origin',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
