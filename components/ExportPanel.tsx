'use client';

import { useMemo, useState } from 'react';
import { getGridCells, type GridCell, type GridSettings } from '@/lib/grid';

type ExportPanelProps = {
  imageUrl?: string;
  settings: GridSettings;
  selectedCell?: GridCell | null;
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片加载失败，请重新上传。'));
    image.src = src;
  });

const downloadCanvas = (canvas: HTMLCanvasElement, filename: string) => {
  const anchor = document.createElement('a');
  anchor.href = canvas.toDataURL('image/png');
  anchor.download = filename;
  anchor.click();
};

export function ExportPanel({ imageUrl, settings, selectedCell }: ExportPanelProps) {
  const [partName, setPartName] = useState('part');
  const [status, setStatus] = useState('等待导出');
  const cells = useMemo(() => getGridCells(settings), [settings]);

  const exportCells = async (onlySelected: boolean) => {
    if (!imageUrl) {
      setStatus('请先上传图片。');
      return;
    }

    const image = await loadImage(imageUrl);
    const targets = onlySelected && selectedCell ? [selectedCell] : cells;

    targets.forEach((cell) => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) {
        return;
      }

      canvas.width = Math.max(1, Math.floor(cell.width));
      canvas.height = Math.max(1, Math.floor(cell.height));
      context.drawImage(
        image,
        cell.x,
        cell.y,
        cell.width,
        cell.height,
        0,
        0,
        cell.width,
        cell.height
      );
      downloadCanvas(canvas, `${partName || 'part'}_${cell.row}_${cell.col}.png`);
    });

    setStatus(`已导出 ${targets.length} 个 PNG。`);
  };

  return (
    <section className="overflow-hidden rounded-[2rem] bg-slate-950 p-5 text-white shadow-panel ring-1 ring-slate-800">
      <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="relative">
          <h2 className="text-xl font-black">导出区域</h2>
          <p className="mt-1 text-sm text-slate-300">
            使用离屏 canvas 逐个裁剪网格 cell，命名格式为 name_row_col.png。
          </p>
          <label className="mt-4 block max-w-sm space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">部件名称</span>
            <input
              value={partName}
              onChange={(event) => setPartName(event.target.value.trim())}
              placeholder="part"
              className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/20"
            />
          </label>
          <p className="mt-3 text-sm text-indigo-200">{status}</p>
        </div>
        <div className="relative flex flex-wrap gap-3 lg:justify-end">
          <button
            type="button"
            onClick={() => exportCells(true)}
            disabled={!selectedCell}
            className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
          >
            导出选中 cell
          </button>
          <button
            type="button"
            onClick={() => exportCells(false)}
            className="rounded-2xl bg-indigo-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-500/30 transition hover:-translate-y-0.5 hover:bg-indigo-400"
          >
            导出全部 {cells.length} 个 PNG
          </button>
        </div>
      </div>
    </section>
  );
}
