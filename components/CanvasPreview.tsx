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
type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
type SelectionHit = ResizeHandle | 'move' | 'outside';
type DragInteraction = {
  kind: 'create' | 'move' | 'resize';
  startPoint: Rect;
  startRect: Rect;
  handle?: ResizeHandle;
};

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 720;
const PREVIEW_PADDING = 28;
const HANDLE_SIZE = 10;
const MIN_SELECTION_SIZE = 4;

const cursorByHit: Record<SelectionHit, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
  move: 'move',
  outside: 'crosshair'
};

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

const containsPoint = (rect: Rect, point: Rect) =>
  point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;

const getSelectionHandles = (rect: Rect, size: number): Array<{ handle: ResizeHandle; rect: Rect }> => {
  const half = size / 2;
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;

  return [
    { handle: 'nw', rect: { x: rect.x - half, y: rect.y - half, width: size, height: size } },
    { handle: 'n', rect: { x: centerX - half, y: rect.y - half, width: size, height: size } },
    { handle: 'ne', rect: { x: right - half, y: rect.y - half, width: size, height: size } },
    { handle: 'e', rect: { x: right - half, y: centerY - half, width: size, height: size } },
    { handle: 'se', rect: { x: right - half, y: bottom - half, width: size, height: size } },
    { handle: 's', rect: { x: centerX - half, y: bottom - half, width: size, height: size } },
    { handle: 'sw', rect: { x: rect.x - half, y: bottom - half, width: size, height: size } },
    { handle: 'w', rect: { x: rect.x - half, y: centerY - half, width: size, height: size } }
  ];
};

const hitTestSelection = (point: Rect, rect: Rect, handleSize: number): SelectionHit => {
  const handleHit = getSelectionHandles(rect, handleSize).find((item) => containsPoint(item.rect, point));
  if (handleHit) {
    return handleHit.handle;
  }

  return containsPoint(rect, point) ? 'move' : 'outside';
};

const clampRectToImage = (rect: Rect, image: HTMLImageElement): Rect => {
  const width = Math.min(image.naturalWidth, Math.max(MIN_SELECTION_SIZE, rect.width));
  const height = Math.min(image.naturalHeight, Math.max(MIN_SELECTION_SIZE, rect.height));

  return {
    x: Math.min(image.naturalWidth - width, Math.max(0, rect.x)),
    y: Math.min(image.naturalHeight - height, Math.max(0, rect.y)),
    width,
    height
  };
};

const resizeRect = (startRect: Rect, startPoint: Rect, currentPoint: Rect, handle: ResizeHandle): Rect => {
  const deltaX = currentPoint.x - startPoint.x;
  const deltaY = currentPoint.y - startPoint.y;
  const next = { ...startRect };

  if (handle.includes('w')) {
    next.x = startRect.x + deltaX;
    next.width = startRect.width - deltaX;
  }
  if (handle.includes('e')) {
    next.width = startRect.width + deltaX;
  }
  if (handle.includes('n')) {
    next.y = startRect.y + deltaY;
    next.height = startRect.height - deltaY;
  }
  if (handle.includes('s')) {
    next.height = startRect.height + deltaY;
  }

  if (next.width < MIN_SELECTION_SIZE) {
    if (handle.includes('w')) {
      next.x = startRect.x + startRect.width - MIN_SELECTION_SIZE;
    }
    next.width = MIN_SELECTION_SIZE;
  }
  if (next.height < MIN_SELECTION_SIZE) {
    if (handle.includes('n')) {
      next.y = startRect.y + startRect.height - MIN_SELECTION_SIZE;
    }
    next.height = MIN_SELECTION_SIZE;
  }

  return next;
};

const getGridPreviewCells = (canvas: HTMLCanvasElement, cells: GridCell[], settings: GridSettings): PreviewCell[] => {
  const rows = Math.max(1, Math.floor(settings.rows));
  const cols = Math.max(1, Math.floor(settings.cols));
  const cellWidth = Math.max(1, settings.cellWidth);
  const cellHeight = Math.max(1, settings.cellHeight);
  const gapX = Math.max(0, settings.gapX);
  const gapY = Math.max(0, settings.gapY);
  const sourceWidth = cols * cellWidth + Math.max(0, cols - 1) * gapX;
  const sourceHeight = rows * cellHeight + Math.max(0, rows - 1) * gapY;
  const availableWidth = canvas.width - PREVIEW_PADDING * 2;
  const availableHeight = canvas.height - PREVIEW_PADDING * 2;
  const previewScale = Math.min(availableWidth / sourceWidth, availableHeight / sourceHeight);
  const previewWidth = sourceWidth * previewScale;
  const previewHeight = sourceHeight * previewScale;
  const startX = (canvas.width - previewWidth) / 2;
  const startY = (canvas.height - previewHeight) / 2;

  return cells.map((cell) => ({
    ...cell,
    x: startX + cell.col * (cellWidth + gapX) * previewScale,
    y: startY + cell.row * (cellHeight + gapY) * previewScale,
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
  const [dragInteraction, setDragInteraction] = useState<DragInteraction | null>(null);
  const [draftRect, setDraftRect] = useState<Rect | null>(null);
  const [canvasCursor, setCanvasCursor] = useState('crosshair');
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
    const backgroundGradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    backgroundGradient.addColorStop(0, '#f8fafc');
    backgroundGradient.addColorStop(1, '#eef2ff');
    context.fillStyle = backgroundGradient;
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
    const activeRect = draftRect ?? gridBounds;
    context.drawImage(image, transform.offsetX, transform.offsetY, transform.drawWidth, transform.drawHeight);
    context.save();
    context.translate(transform.offsetX, transform.offsetY);
    context.scale(transform.scale, transform.scale);
    context.fillStyle = dragInteraction ? 'rgba(249, 115, 22, 0.16)' : 'rgba(99, 102, 241, 0.12)';
    context.strokeStyle = dragInteraction ? '#f97316' : '#6366f1';
    context.lineWidth = (dragInteraction ? 3 : 2) / transform.scale;
    context.setLineDash(dragInteraction ? [] : [8 / transform.scale, 6 / transform.scale]);
    context.fillRect(activeRect.x, activeRect.y, activeRect.width, activeRect.height);
    context.strokeRect(activeRect.x, activeRect.y, activeRect.width, activeRect.height);
    context.setLineDash([]);

    const handleSize = HANDLE_SIZE / transform.scale;
    context.fillStyle = '#ffffff';
    context.strokeStyle = '#4f46e5';
    context.lineWidth = 2 / transform.scale;
    getSelectionHandles(activeRect, handleSize).forEach((item) => {
      context.fillRect(item.rect.x, item.rect.y, item.rect.width, item.rect.height);
      context.strokeRect(item.rect.x, item.rect.y, item.rect.width, item.rect.height);
    });

    context.restore();
  }, [cells, draftRect, dragInteraction, gridBounds, hoveredCell, image, mode, selectedCell, settings]);

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

  const getInteractionRect = (interaction: DragInteraction, point: Rect) => {
    if (!image) {
      return null;
    }

    if (interaction.kind === 'create') {
      return clampRectToImage(normalizeRect(interaction.startPoint, point), image);
    }

    if (interaction.kind === 'move') {
      return clampRectToImage(
        {
          ...interaction.startRect,
          x: interaction.startRect.x + point.x - interaction.startPoint.x,
          y: interaction.startRect.y + point.y - interaction.startPoint.y
        },
        image
      );
    }

    if (!interaction.handle) {
      return null;
    }

    return clampRectToImage(resizeRect(interaction.startRect, interaction.startPoint, point, interaction.handle), image);
  };

  const commitRect = (rect: Rect | null) => {
    if (rect && rect.width >= MIN_SELECTION_SIZE && rect.height >= MIN_SELECTION_SIZE) {
      onGridAreaSelect?.(rect);
    }
  };

  const handleMouseDown = (event: MouseEvent<HTMLCanvasElement>) => {
    if (mode !== 'full' || !image) {
      return;
    }

    const point = getImagePointFromEvent(event);
    const canvas = event.currentTarget;
    if (!point) {
      return;
    }

    const transform = getImageTransform(canvas, image);
    const hit = hitTestSelection(point, gridBounds, HANDLE_SIZE / transform.scale);
    const interaction: DragInteraction =
      hit === 'outside'
        ? { kind: 'create', startPoint: point, startRect: { ...point, width: 0, height: 0 } }
        : hit === 'move'
          ? { kind: 'move', startPoint: point, startRect: gridBounds }
          : { kind: 'resize', startPoint: point, startRect: gridBounds, handle: hit };

    setDragInteraction(interaction);
    setDraftRect(interaction.startRect);
    setCanvasCursor(hit === 'outside' ? 'crosshair' : cursorByHit[hit]);
  };

  const handleMouseMove = (event: MouseEvent<HTMLCanvasElement>) => {
    if (mode === 'grid') {
      setHoveredCell(getCellFromEvent(event));
      return;
    }

    if (!image) {
      return;
    }

    const point = getImagePointFromEvent(event);
    if (!point) {
      return;
    }

    if (dragInteraction) {
      const nextRect = getInteractionRect(dragInteraction, point);
      setDraftRect(nextRect);
      return;
    }

    const transform = getImageTransform(event.currentTarget, image);
    const hit = hitTestSelection(point, gridBounds, HANDLE_SIZE / transform.scale);
    setCanvasCursor(cursorByHit[hit]);
  };

  const handleMouseUp = (event: MouseEvent<HTMLCanvasElement>) => {
    if (mode !== 'full' || !dragInteraction) {
      return;
    }

    const point = getImagePointFromEvent(event);
    const selectedRect = point ? getInteractionRect(dragInteraction, point) : draftRect;
    commitRect(selectedRect);
    setDraftRect(null);
    setDragInteraction(null);
  };

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 p-4 shadow-panel ring-1 ring-slate-200/70 backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-xl font-black text-slate-950">{title}</h2>
          {mode === 'full' && (
            <p className="mt-1 text-sm leading-6 text-slate-500">
              拖拽空白处重新框选；拖动框体移动；拖动 8 个控制点调整大小。
            </p>
          )}
          {mode === 'grid' && (
            <p className="mt-1 text-sm leading-6 text-slate-500">按行列展示每个 cell 的裁剪结果。</p>
          )}
        </div>
        {mode === 'grid' && (
          <span className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-black text-white shadow-lg shadow-indigo-500/20">
            {cells.length} cells
          </span>
        )}
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="aspect-square w-full rounded-[1.75rem] border border-slate-200 bg-slate-50 shadow-inner ring-1 ring-white"
        style={{ cursor: mode === 'full' ? canvasCursor : 'default' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setHoveredCell(null);
          setDraftRect(null);
          setDragInteraction(null);
          setCanvasCursor('crosshair');
        }}
        onClick={(event) => mode === 'grid' && onSelectedCellChange?.(getCellFromEvent(event))}
      />
      {mode === 'grid' && (
        <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500 ring-1 ring-slate-200/70">
          Hover / click 高亮单元格：{hoveredCell ? `row ${hoveredCell.row}, col ${hoveredCell.col}` : '暂无'}
        </p>
      )}
    </section>
  );
}
