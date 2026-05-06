import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Spine Toolkit Grid Slicer',
  description: 'Upload a character image, preview slicing grids, and export PNG parts.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
