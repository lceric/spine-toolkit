'use client';

import { MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { getGridCells, type GridCell, type GridSettings } from '@/lib/grid';

type CanvasPreviewProps = {
  imageUrl?: string;
  settings: GridSettings;
  mode: 'full' | 'grid';
  title: string;
  selectedCell?: GridCell | null;
  onSelectedCellChange?: (cell: GridCell | null) => void;
};

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 720;

export function CanvasPreview({
  imageUrl,
  settings,
  mode,
  title,
  selectedCell,
  onSelectedCellChange
}: CanvasPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [hoveredCell, setHoveredCell] = useState<GridCell | null>(null);
  const cells = useMemo(() => getGridCells(settings), [settings]);

  useEffect(() => {
    if (!imageUrl) {
      setImage(null);
      return;
    }

    const nextImage = new Image();
    nextImage.onload = () => setImage(nextImage);
    nextImage.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#f8fafc';
    context.fillRect(0, 0, canvas.width, canvas.height);

    if (!image) {
      context.fillStyle = '#94a3b8';
      context.font = '600 20px sans-serif';
      context.textAlign = 'center';
      context.fillText('上传图片后开始预览', canvas.width / 2, canvas.height / 2);
      return;
    }

    const scale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const offsetX = (canvas.width - drawWidth) / 2;
    const offsetY = (canvas.height - drawHeight) / 2;

    context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

    if (mode === 'grid') {
      context.save();
      context.translate(offsetX, offsetY);
      context.scale(scale, scale);

      cells.forEach((cell) => {
        const active =
          (hoveredCell?.row === cell.row && hoveredCell?.col === cell.col) ||
          (selectedCell?.row === cell.row && selectedCell?.col === cell.col);

        context.fillStyle = active ? 'rgba(99, 102, 241, 0.28)' : 'rgba(14, 165, 233, 0.08)';
        context.strokeStyle = active ? '#f97316' : '#2563eb';
        context.lineWidth = active ? 3 / scale : 1.5 / scale;
        context.fillRect(cell.x, cell.y, cell.width, cell.height);
        context.strokeRect(cell.x, cell.y, cell.width, cell.height);
      });

      context.restore();
    }
  }, [cells, hoveredCell, image, mode, selectedCell]);

  const getCellFromEvent = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!image) {
      return null;
    }

    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const scaleToCanvasX = canvas.width / rect.width;
    const scaleToCanvasY = canvas.height / rect.height;
    const canvasX = (event.clientX - rect.left) * scaleToCanvasX;
    const canvasY = (event.clientY - rect.top) * scaleToCanvasY;
    const imageScale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const drawWidth = image.naturalWidth * imageScale;
    const drawHeight = image.naturalHeight * imageScale;
    const imageX = (canvasX - (canvas.width - drawWidth) / 2) / imageScale;
    const imageY = (canvasY - (canvas.height - drawHeight) / 2) / imageScale;

    return cells.find(
      (cell) =>
        imageX >= cell.x &&
        imageX <= cell.x + cell.width &&
        imageY >= cell.y &&
        imageY <= cell.y + cell.height
    ) ?? null;
  };

  return (
    <section className="rounded-[2rem] bg-white/90 p-4 shadow-panel ring-1 ring-slate-200/70">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {mode === 'grid' && (
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
            {cells.length} cells
          </span>
        )}
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="aspect-square w-full rounded-3xl border border-slate-200 bg-slate-50 shadow-inner"
        onMouseMove={(event) => mode === 'grid' && setHoveredCell(getCellFromEvent(event))}
        onMouseLeave={() => setHoveredCell(null)}
        onClick={(event) => mode === 'grid' && onSelectedCellChange?.(getCellFromEvent(event))}
      />
      {mode === 'grid' && (
        <p className="mt-3 text-sm text-slate-500">
          Hover / click 高亮单元格：{hoveredCell ? `row ${hoveredCell.row}, col ${hoveredCell.col}` : '暂无'}
        </p>
      )}
    </section>
  );
}
