'use client';

import { useEffect, useState } from 'react';
import { CanvasPreview } from '@/components/CanvasPreview';
import { ExportPanel } from '@/components/ExportPanel';
import { GridControls } from '@/components/GridControls';
import { ImageUploader } from '@/components/ImageUploader';
import type { GridCell, GridSettings, Rect } from '@/lib/grid';

const defaultSettings: GridSettings = {
  originX: 0,
  originY: 0,
  cellWidth: 128,
  cellHeight: 128,
  gapX: 0,
  gapY: 0,
  rows: 4,
  cols: 4
};

export default function Home() {
  const [settings, setSettings] = useState<GridSettings>(defaultSettings);
  const [imageUrl, setImageUrl] = useState<string>();
  const [imageName, setImageName] = useState<string>();
  const [selectedCell, setSelectedCell] = useState<GridCell | null>(null);

  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  const handleImageSelect = (file: File) => {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
    setImageName(file.name);
    setImageUrl(URL.createObjectURL(file));
    setSelectedCell(null);
  };

  const handleGridAreaSelect = (rect: Rect) => {
    setSettings((currentSettings) => {
      const cols = Math.max(1, currentSettings.cols);
      const rows = Math.max(1, currentSettings.rows);
      const availableWidth = Math.max(1, rect.width - currentSettings.gapX * Math.max(0, cols - 1));
      const availableHeight = Math.max(1, rect.height - currentSettings.gapY * Math.max(0, rows - 1));

      return {
        ...currentSettings,
        originX: Math.round(rect.x),
        originY: Math.round(rect.y),
        cellWidth: Math.max(1, Math.round(availableWidth / cols)),
        cellHeight: Math.max(1, Math.round(availableHeight / rows))
      };
    });
    setSelectedCell(null);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="rounded-[2rem] bg-white/80 p-6 shadow-panel ring-1 ring-slate-200/70 backdrop-blur">
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-indigo-500">Spine Toolkit</p>
        <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_24rem] lg:items-center">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
              角色图片网格拆分与 PNG 导出
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              上传完整角色图，设置 origin、cell、gap 与 rows/cols，左侧保留完整预览，右侧实时显示可交互网格拆分效果。
            </p>
          </div>
          <ImageUploader imageName={imageName} onImageSelect={handleImageSelect} />
        </div>
      </header>

      <div className="grid flex-1 gap-6 lg:grid-cols-2">
        <CanvasPreview
          imageUrl={imageUrl}
          settings={settings}
          mode="full"
          title="左侧原图 / 网格区域框选"
          onGridAreaSelect={handleGridAreaSelect}
        />
        <CanvasPreview
          imageUrl={imageUrl}
          settings={settings}
          mode="grid"
          title="右侧网格拆分预览"
          selectedCell={selectedCell}
          onSelectedCellChange={setSelectedCell}
        />
      </div>

      <div className="grid gap-6">
        <GridControls settings={settings} onChange={setSettings} />
        <ExportPanel imageUrl={imageUrl} settings={settings} selectedCell={selectedCell} />
      </div>
    </main>
  );
}
