'use client';

import { useEffect, useMemo, useState } from 'react';
import { CanvasPreview } from '@/components/CanvasPreview';
import { ExportPanel } from '@/components/ExportPanel';
import { GridControls } from '@/components/GridControls';
import { ImageUploader } from '@/components/ImageUploader';
import { ToolDock } from '@/components/ToolDock';
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
  const totalCells = useMemo(
    () => Math.max(1, settings.rows) * Math.max(1, settings.cols),
    [settings.cols, settings.rows]
  );

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
    <main className="mx-auto flex min-h-screen max-w-[92rem] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
      <header className="overflow-hidden rounded-[2.5rem] border border-white/70 bg-white/80 p-5 shadow-panel ring-1 ring-slate-200/70 backdrop-blur-xl sm:p-7">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem] xl:items-stretch">
          <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white sm:p-8">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-500/30 blur-3xl" />
            <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-fuchsia-400/20 blur-3xl" />
            <div className="relative">
              <p className="text-sm font-black uppercase tracking-[0.32em] text-indigo-300">Spine Toolkit</p>
              <h1 className="mt-4 max-w-5xl text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                角色图片网格拆分与 PNG 导出
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300">
                上传完整角色图，框选原图网格区域后快速校准 origin、cell、gap 与 rows/cols；右侧实时预览拆分结果并支持逐格导出。
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white ring-1 ring-white/10">
                  当前工具 · 网格拆分
                </span>
                <span className="rounded-full bg-indigo-400/15 px-4 py-2 text-sm font-bold text-indigo-100 ring-1 ring-indigo-300/20">
                  {totalCells} cells ready
                </span>
              </div>
            </div>
          </div>
          <ImageUploader imageName={imageName} onImageSelect={handleImageSelect} />
        </div>
      </header>

      <ToolDock />

      <section className="grid flex-1 gap-6 xl:grid-cols-[minmax(28rem,0.92fr)_minmax(34rem,1.08fr)] xl:items-start">
        <div className="grid gap-6">
          <CanvasPreview
            imageUrl={imageUrl}
            settings={settings}
            mode="full"
            title="原图框选"
            onGridAreaSelect={handleGridAreaSelect}
          />
          <GridControls settings={settings} onChange={setSettings} />
        </div>

        <div className="grid gap-6 xl:sticky xl:top-6">
          <CanvasPreview
            imageUrl={imageUrl}
            settings={settings}
            mode="grid"
            title="拆分预览"
            selectedCell={selectedCell}
            onSelectedCellChange={setSelectedCell}
          />
          <ExportPanel imageUrl={imageUrl} settings={settings} selectedCell={selectedCell} />
        </div>
      </section>
    </main>
  );
}
