'use client';

import { MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { getGridBounds, getGridCells, type GridCell, type GridSettings, type Rect } from '@/lib/grid';

type CanvasPreviewProps = {
  imageUrl?: string;
  settings: GridSettings;
  mode: 'full' | 'grid';
  title: string;
  selectedCell?: GridCell | null;
  onSelectedCellChange?: (cell: GridCell | null) => void;
  onGridAreaSelect?: (rect: Rect) => void;
};

type ImageTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
  drawWidth: number;
  drawHeight: number;
};

type PreviewCell = GridCell & Rect;

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 720;
const PREVIEW_PADDING = 28;
const PREVIEW_GAP = 12;

const getImageTransform = (canvas: HTMLCanvasElement, image: HTMLImageElement): ImageTransform => {
  const scale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;

  return {
    scale,
    drawWidth,
    drawHeight,
    offsetX: (canvas.width - drawWidth) / 2,
    offsetY: (canvas.height - drawHeight) / 2
  };
};

const normalizeRect = (start: Rect, end: Rect): Rect => ({
  x: Math.min(start.x, end.x),
  y: Math.min(start.y, end.y),
  width: Math.abs(end.x - start.x),
  height: Math.abs(end.y - start.y)
});

const getCanvasPoint = (event: MouseEvent<HTMLCanvasElement>) => {
  const canvas = event.currentTarget;
  const rect = canvas.getBoundingClientRect();

  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height)
  };
};

const getGridPreviewCells = (canvas: HTMLCanvasElement, cells: GridCell[], settings: GridSettings): PreviewCell[] => {
  const rows = Math.max(1, Math.floor(settings.rows));
  const cols = Math.max(1, Math.floor(settings.cols));
  const cellWidth = Math.max(1, settings.cellWidth);
  const cellHeight = Math.max(1, settings.cellHeight);
  const availableWidth = canvas.width - PREVIEW_PADDING * 2 - PREVIEW_GAP * Math.max(0, cols - 1);
  const availableHeight = canvas.height - PREVIEW_PADDING * 2 - PREVIEW_GAP * Math.max(0, rows - 1);
  const previewScale = Math.min(availableWidth / (cols * cellWidth), availableHeight / (rows * cellHeight));
  const previewWidth = cols * cellWidth * previewScale + PREVIEW_GAP * Math.max(0, cols - 1);
  const previewHeight = rows * cellHeight * previewScale + PREVIEW_GAP * Math.max(0, rows - 1);
  const startX = (canvas.width - previewWidth) / 2;
  const startY = (canvas.height - previewHeight) / 2;

  return cells.map((cell) => ({
    ...cell,
    x: startX + cell.col * (cellWidth * previewScale + PREVIEW_GAP),
    y: startY + cell.row * (cellHeight * previewScale + PREVIEW_GAP),
    width: cell.width * previewScale,
    height: cell.height * previewScale
  }));
};

export function CanvasPreview({
  imageUrl,
  settings,
  mode,
  title,
  selectedCell,
  onSelectedCellChange,
  onGridAreaSelect
}: CanvasPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [hoveredCell, setHoveredCell] = useState<GridCell | null>(null);
  const [dragStart, setDragStart] = useState<Rect | null>(null);
  const [dragCurrent, setDragCurrent] = useState<Rect | null>(null);
  const cells = useMemo(() => getGridCells(settings), [settings]);
  const gridBounds = useMemo(() => getGridBounds(settings), [settings]);

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

    if (mode === 'grid') {
      const previewCells = getGridPreviewCells(canvas, cells, settings);

      previewCells.forEach((previewCell) => {
        const sourceCell = cells.find((cell) => cell.row === previewCell.row && cell.col === previewCell.col);
        if (!sourceCell) {
          return;
        }

        const active =
          (hoveredCell?.row === sourceCell.row && hoveredCell?.col === sourceCell.col) ||
          (selectedCell?.row === sourceCell.row && selectedCell?.col === sourceCell.col);

        context.save();
        context.fillStyle = active ? 'rgba(99, 102, 241, 0.18)' : '#ffffff';
        context.strokeStyle = active ? '#f97316' : '#2563eb';
        context.lineWidth = active ? 4 : 2;
        context.shadowColor = 'rgba(15, 23, 42, 0.12)';
        context.shadowBlur = 14;
        context.shadowOffsetY = 8;
        context.fillRect(previewCell.x, previewCell.y, previewCell.width, previewCell.height);
        context.drawImage(
          image,
          sourceCell.x,
          sourceCell.y,
          sourceCell.width,
          sourceCell.height,
          previewCell.x,
          previewCell.y,
          previewCell.width,
          previewCell.height
        );
        context.shadowColor = 'transparent';
        context.strokeRect(previewCell.x, previewCell.y, previewCell.width, previewCell.height);
        context.restore();
      });

      return;
    }

    const transform = getImageTransform(canvas, image);
    context.drawImage(image, transform.offsetX, transform.offsetY, transform.drawWidth, transform.drawHeight);
    context.save();
    context.translate(transform.offsetX, transform.offsetY);
    context.scale(transform.scale, transform.scale);
    context.fillStyle = 'rgba(99, 102, 241, 0.12)';
    context.strokeStyle = '#6366f1';
    context.lineWidth = 2 / transform.scale;
    context.setLineDash([8 / transform.scale, 6 / transform.scale]);
    context.fillRect(gridBounds.x, gridBounds.y, gridBounds.width, gridBounds.height);
    context.strokeRect(gridBounds.x, gridBounds.y, gridBounds.width, gridBounds.height);

    if (dragStart && dragCurrent) {
      const dragRect = normalizeRect(dragStart, dragCurrent);
      context.setLineDash([]);
      context.fillStyle = 'rgba(249, 115, 22, 0.16)';
      context.strokeStyle = '#f97316';
      context.lineWidth = 3 / transform.scale;
      context.fillRect(dragRect.x, dragRect.y, dragRect.width, dragRect.height);
      context.strokeRect(dragRect.x, dragRect.y, dragRect.width, dragRect.height);
    }

    context.restore();
  }, [cells, dragCurrent, dragStart, gridBounds, hoveredCell, image, mode, selectedCell, settings]);

  const getImagePointFromEvent = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!image) {
      return null;
    }

    const canvas = event.currentTarget;
    const transform = getImageTransform(canvas, image);
    const point = getCanvasPoint(event);
    const x = (point.x - transform.offsetX) / transform.scale;
    const y = (point.y - transform.offsetY) / transform.scale;

    return {
      x: Math.min(image.naturalWidth, Math.max(0, x)),
      y: Math.min(image.naturalHeight, Math.max(0, y)),
      width: 0,
      height: 0
    };
  };

  const getCellFromEvent = (event: MouseEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const point = getCanvasPoint(event);
    const previewCells = getGridPreviewCells(canvas, cells, settings);

    return previewCells.find(
      (cell) =>
        point.x >= cell.x &&
        point.x <= cell.x + cell.width &&
        point.y >= cell.y &&
        point.y <= cell.y + cell.height
    ) ?? null;
  };

  const handleMouseDown = (event: MouseEvent<HTMLCanvasElement>) => {
    if (mode !== 'full') {
      return;
    }

    const point = getImagePointFromEvent(event);
    if (point) {
      setDragStart(point);
      setDragCurrent(point);
    }
  };

  const handleMouseMove = (event: MouseEvent<HTMLCanvasElement>) => {
    if (mode === 'grid') {
      setHoveredCell(getCellFromEvent(event));
      return;
    }

    if (dragStart) {
      const point = getImagePointFromEvent(event);
      if (point) {
        setDragCurrent(point);
      }
    }
  };

  const handleMouseUp = (event: MouseEvent<HTMLCanvasElement>) => {
    if (mode !== 'full' || !dragStart) {
      return;
    }

    const point = getImagePointFromEvent(event);
    const selectedRect = point ? normalizeRect(dragStart, point) : null;
    setDragStart(null);
    setDragCurrent(null);

    if (selectedRect && selectedRect.width >= 4 && selectedRect.height >= 4) {
      onGridAreaSelect?.(selectedRect);
    }
  };

  return (
    <section className="rounded-[2rem] bg-white/90 p-4 shadow-panel ring-1 ring-slate-200/70">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          {mode === 'full' && (
            <p className="text-sm text-slate-500">在原图上拖拽框选网格区域，松开后自动更新参数。</p>
          )}
          {mode === 'grid' && <p className="text-sm text-slate-500">按行列展示每个 cell 的裁剪结果。</p>}
        </div>
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
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setHoveredCell(null);
          setDragStart(null);
          setDragCurrent(null);
        }}
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
