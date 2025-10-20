import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BloodChain - 献血记录存证',
  description: '基于区块链的公益型献血记录存证 DApp',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
