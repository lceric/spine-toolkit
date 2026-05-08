'use client';

import { type MouseEvent, useCallback, useEffect, useRef, useState } from 'react';

type BackgroundTransparencyToolProps = {
  imageUrl?: string;
  imageName?: string;
  onImageProcessed: (blob: Blob, filename: string) => void;
};

type Rgb = {
  r: number;
  g: number;
  b: number;
};

type Point = {
  x: number;
  y: number;
};

const PREVIEW_SIZE = 260;
const PREVIEW_PROCESSING_MAX_SIZE = 1200;
const CHECKER_SIZE = 20;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const SPILL_RANGE = 56;

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片加载失败，请重新上传。'));
    image.src = src;
  });

const canvasToPngBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error('PNG 生成失败。'));
    }, 'image/png');
  });

const clampByte = (value: number) => Math.min(255, Math.max(0, Math.round(value)));

const getDistance = (r: number, g: number, b: number, color: Rgb) => {
  const dr = r - color.r;
  const dg = g - color.g;
  const db = b - color.b;

  return Math.sqrt(dr * dr + dg * dg + db * db);
};

const removeBackgroundSpill = (value: number, backgroundValue: number, alphaRatio: number, strength: number) => {
  const safeAlpha = Math.max(0.08, alphaRatio);
  const unblendedValue = (value - backgroundValue * (1 - safeAlpha)) / safeAlpha;
  const pushedValue = value + (unblendedValue - value) * strength;

  return clampByte(pushedValue);
};

const averageColors = (colors: Rgb[]): Rgb => ({
  r: clampByte(colors.reduce((sum, color) => sum + color.r, 0) / colors.length),
  g: clampByte(colors.reduce((sum, color) => sum + color.g, 0) / colors.length),
  b: clampByte(colors.reduce((sum, color) => sum + color.b, 0) / colors.length)
});

const readPixel = (data: Uint8ClampedArray, width: number, x: number, y: number): Rgb => {
  const index = (y * width + x) * 4;

  return {
    r: data[index],
    g: data[index + 1],
    b: data[index + 2]
  };
};

const detectCornerColor = (context: CanvasRenderingContext2D, width: number, height: number): Rgb => {
  const imageData = context.getImageData(0, 0, width, height);
  const maxX = width - 1;
  const maxY = height - 1;

  return averageColors([
    readPixel(imageData.data, width, 0, 0),
    readPixel(imageData.data, width, maxX, 0),
    readPixel(imageData.data, width, 0, maxY),
    readPixel(imageData.data, width, maxX, maxY)
  ]);
};

const createProcessedCanvas = (
  image: HTMLImageElement,
  backgroundColor: Rgb,
  tolerance: number,
  softness: number,
  edgeCleanup: number,
  maxSize?: number
) => {
  const scale = maxSize ? Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight)) : 1;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    return null;
  }

  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  const feather = Math.max(0, softness);
  const cleanupStrength = Math.min(1, Math.max(0, edgeCleanup / 100));
  const cleanupLimit = tolerance + feather + SPILL_RANGE;

  for (let index = 0; index < pixels.length; index += 4) {
    const distance = getDistance(pixels[index], pixels[index + 1], pixels[index + 2], backgroundColor);
    let alphaRatio = 1;

    if (distance <= tolerance) {
      pixels[index + 3] = 0;
    } else if (feather > 0 && distance <= tolerance + feather) {
      alphaRatio = (distance - tolerance) / feather;
      pixels[index + 3] = clampByte(pixels[index + 3] * alphaRatio);
    }

    if (pixels[index + 3] > 0 && cleanupStrength > 0 && distance <= cleanupLimit) {
      const cleanupRatio = Math.max(0, 1 - Math.max(0, distance - tolerance) / Math.max(1, cleanupLimit - tolerance));
      const spillStrength = cleanupStrength * cleanupRatio;
      const finalAlphaRatio = pixels[index + 3] / 255;

      pixels[index] = removeBackgroundSpill(pixels[index], backgroundColor.r, finalAlphaRatio, spillStrength);
      pixels[index + 1] = removeBackgroundSpill(pixels[index + 1], backgroundColor.g, finalAlphaRatio, spillStrength);
      pixels[index + 2] = removeBackgroundSpill(pixels[index + 2], backgroundColor.b, finalAlphaRatio, spillStrength);
    }
  }

  context.putImageData(imageData, 0, 0);

  return canvas;
};

const getTransparentFilename = (filename?: string) => {
  if (!filename) {
    return 'transparent_background.png';
  }

  return filename.replace(/\.[^.]+$/, '') + '_transparent.png';
};

const drawCheckerboard = (context: CanvasRenderingContext2D, width: number, height: number, dark: boolean) => {
  context.fillStyle = dark ? '#111827' : '#e2e8f0';
  context.fillRect(0, 0, width, height);
  context.fillStyle = dark ? '#374151' : '#ffffff';

  for (let y = 0; y < height; y += CHECKER_SIZE) {
    for (let x = (y / CHECKER_SIZE) % 2 ? 0 : CHECKER_SIZE; x < width; x += CHECKER_SIZE * 2) {
      context.fillRect(x, y, CHECKER_SIZE, CHECKER_SIZE);
    }
  }
};

const drawCenteredPreview = (
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  sourceCanvas: HTMLCanvasElement,
  zoom: number,
  offset: Point
) => {
  const fitScale = Math.min(canvas.width / sourceCanvas.width, canvas.height / sourceCanvas.height);
  const scale = fitScale * zoom;
  const width = sourceCanvas.width * scale;
  const height = sourceCanvas.height * scale;

  context.imageSmoothingEnabled = zoom < 4;
  context.drawImage(
    sourceCanvas,
    (canvas.width - width) / 2 + offset.x,
    (canvas.height - height) / 2 + offset.y,
    width,
    height
  );
};

const getCanvasPointFromClient = (canvas: HTMLCanvasElement, clientX: number, clientY: number): Point => {
  const rect = canvas.getBoundingClientRect();

  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height)
  };
};

const getCanvasPoint = (event: MouseEvent<HTMLCanvasElement>): Point =>
  getCanvasPointFromClient(event.currentTarget, event.clientX, event.clientY);

export function BackgroundTransparencyTool({
  imageUrl,
  imageName,
  onImageProcessed
}: BackgroundTransparencyToolProps) {
  const previewRef = useRef<HTMLCanvasElement>(null);
  const lastDragPointRef = useRef<Point | null>(null);
  const [backgroundColor, setBackgroundColor] = useState<Rgb>({ r: 255, g: 255, b: 255 });
  const [tolerance, setTolerance] = useState(24);
  const [softness, setSoftness] = useState(18);
  const [edgeCleanup, setEdgeCleanup] = useState(68);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewOffset, setPreviewOffset] = useState<Point>({ x: 0, y: 0 });
  const [isDraggingPreview, setIsDraggingPreview] = useState(false);
  const [useDarkPreview, setUseDarkPreview] = useState(false);
  const [status, setStatus] = useState('上传图片后可将纯色背景转为透明。');

  const updatePreviewZoom = useCallback((nextZoom: number, anchor: Point = { x: PREVIEW_SIZE / 2, y: PREVIEW_SIZE / 2 }) => {
    const safeNextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    const zoomRatio = safeNextZoom / previewZoom;

    setPreviewOffset((currentOffset) => ({
      x: anchor.x - (anchor.x - currentOffset.x - PREVIEW_SIZE / 2) * zoomRatio - PREVIEW_SIZE / 2,
      y: anchor.y - (anchor.y - currentOffset.y - PREVIEW_SIZE / 2) * zoomRatio - PREVIEW_SIZE / 2
    }));
    setPreviewZoom(safeNextZoom);
  }, [previewZoom]);

  useEffect(() => {
    const canvas = previewRef.current;
    const context = canvas?.getContext('2d');

    if (!canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    drawCheckerboard(context, canvas.width, canvas.height, useDarkPreview);

    if (!imageUrl) {
      context.fillStyle = useDarkPreview ? '#cbd5e1' : '#64748b';
      context.font = '700 14px sans-serif';
      context.textAlign = 'center';
      context.fillText('等待图片', canvas.width / 2, canvas.height / 2);
      setStatus('上传图片后可将纯色背景转为透明。');
      return;
    }

    let cancelled = false;

    loadImage(imageUrl)
      .then((image) => {
        if (cancelled) {
          return;
        }

        const sourceCanvas = document.createElement('canvas');
        const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });

        if (!sourceContext) {
          return;
        }

        sourceCanvas.width = image.naturalWidth;
        sourceCanvas.height = image.naturalHeight;
        sourceContext.drawImage(image, 0, 0);
        const detectedColor = detectCornerColor(sourceContext, image.naturalWidth, image.naturalHeight);
        setBackgroundColor(detectedColor);

        const previewCanvas = createProcessedCanvas(
          image,
          detectedColor,
          tolerance,
          softness,
          edgeCleanup,
          PREVIEW_PROCESSING_MAX_SIZE
        );
        if (!previewCanvas) {
          return;
        }

        drawCenteredPreview(context, canvas, previewCanvas, previewZoom, previewOffset);
        setStatus('已自动取四角平均色，可调整容差后应用。');
      })
      .catch((error) => setStatus(error instanceof Error ? error.message : '预览生成失败。'));

    return () => {
      cancelled = true;
    };
  }, [edgeCleanup, imageUrl, previewOffset, previewZoom, softness, tolerance, useDarkPreview]);

  useEffect(() => {
    setPreviewZoom(1);
    setPreviewOffset({ x: 0, y: 0 });
    lastDragPointRef.current = null;
    setIsDraggingPreview(false);
  }, [imageUrl]);

  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) {
      return;
    }

    const handlePreviewWheel = (event: globalThis.WheelEvent) => {
      if (!imageUrl) {
        return;
      }

      event.preventDefault();
      const point = getCanvasPointFromClient(canvas, event.clientX, event.clientY);
      updatePreviewZoom(previewZoom + (event.deltaY < 0 ? 0.35 : -0.35), point);
    };

    canvas.addEventListener('wheel', handlePreviewWheel, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handlePreviewWheel);
    };
  }, [imageUrl, previewZoom, updatePreviewZoom]);

  const handlePreviewMouseDown = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!imageUrl || previewZoom <= 1) {
      return;
    }

    lastDragPointRef.current = getCanvasPoint(event);
    setIsDraggingPreview(true);
  };

  const handlePreviewMouseMove = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingPreview || !lastDragPointRef.current) {
      return;
    }

    const point = getCanvasPoint(event);
    const lastPoint = lastDragPointRef.current;

    setPreviewOffset((currentOffset) => ({
      x: currentOffset.x + point.x - lastPoint.x,
      y: currentOffset.y + point.y - lastPoint.y
    }));
    lastDragPointRef.current = point;
  };

  const stopPreviewDrag = () => {
    lastDragPointRef.current = null;
    setIsDraggingPreview(false);
  };

  const resetPreviewView = () => {
    setPreviewZoom(1);
    setPreviewOffset({ x: 0, y: 0 });
  };

  const applyTransparency = async () => {
    if (!imageUrl) {
      setStatus('请先上传图片。');
      return;
    }

    try {
      setStatus('正在生成透明 PNG...');
      const image = await loadImage(imageUrl);
      const canvas = createProcessedCanvas(image, backgroundColor, tolerance, softness, edgeCleanup);

      if (!canvas) {
        setStatus('Canvas 初始化失败。');
        return;
      }

      onImageProcessed(await canvasToPngBlob(canvas), getTransparentFilename(imageName));
      setStatus('已应用透明背景，后续拆分会保留透明通道。');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '透明背景处理失败。');
    }
  };

  return (
    <section
      id="background-transparency-tool"
      className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-panel ring-1 ring-slate-200/70 backdrop-blur"
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-950">背景透明化</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            自动取图片四角纯色作为背景色，将接近颜色的像素转为透明，适合先清底再做网格分离。
          </p>
        </div>
        <span className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-black text-white shadow-lg shadow-emerald-500/20">
          PNG Alpha
        </span>
      </div>

      <div className="grid gap-5 md:grid-cols-[16.25rem_minmax(0,1fr)]">
        <div className="grid gap-3">
          <div className="relative">
            <canvas
              ref={previewRef}
              width={PREVIEW_SIZE}
              height={PREVIEW_SIZE}
              className="aspect-square w-full rounded-[1.4rem] border border-slate-200 bg-slate-100 shadow-inner ring-1 ring-white"
              style={{ cursor: previewZoom > 1 ? (isDraggingPreview ? 'grabbing' : 'grab') : 'zoom-in' }}
              onMouseDown={handlePreviewMouseDown}
              onMouseMove={handlePreviewMouseMove}
              onMouseUp={stopPreviewDrag}
              onMouseLeave={stopPreviewDrag}
            />
            <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-slate-950/80 px-2.5 py-1 text-xs font-black text-white">
              {Math.round(previewZoom * 100)}%
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => updatePreviewZoom(previewZoom - 0.5)}
              disabled={!imageUrl || previewZoom <= MIN_ZOOM}
              className="rounded-2xl bg-white px-3 py-2.5 text-xs font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              缩小
            </button>
            <button
              type="button"
              onClick={() => updatePreviewZoom(previewZoom + 0.5)}
              disabled={!imageUrl || previewZoom >= MAX_ZOOM}
              className="rounded-2xl bg-white px-3 py-2.5 text-xs font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              放大
            </button>
            <button
              type="button"
              onClick={() => setUseDarkPreview((currentValue) => !currentValue)}
              className={`rounded-2xl px-3 py-2.5 text-xs font-black transition ${
                useDarkPreview
                  ? 'bg-slate-950 text-white shadow-lg shadow-slate-900/20'
                  : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              深色背景
            </button>
            <button
              type="button"
              onClick={resetPreviewView}
              className="rounded-2xl bg-white px-3 py-2.5 text-xs font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
            >
              重置视图
            </button>
          </div>
        </div>
        <div className="grid content-start gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
              <span className="text-sm font-bold text-slate-800">背景色</span>
              <span className="mt-2 flex items-center gap-3 text-xs font-semibold text-slate-500">
                <span
                  className="h-8 w-8 rounded-xl border border-slate-200 shadow-inner"
                  style={{ backgroundColor: `rgb(${backgroundColor.r}, ${backgroundColor.g}, ${backgroundColor.b})` }}
                />
                RGB {backgroundColor.r}, {backgroundColor.g}, {backgroundColor.b}
              </span>
            </label>
            <label className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-slate-800">容差</span>
                <span className="text-xs font-black text-slate-500">{tolerance}</span>
              </div>
              <input
                type="range"
                min={0}
                max={120}
                value={tolerance}
                onChange={(event) => setTolerance(Number(event.target.value))}
                className="h-2 w-full cursor-pointer accent-emerald-600"
              />
            </label>
            <label className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-slate-800">边缘柔化</span>
                <span className="text-xs font-black text-slate-500">{softness}</span>
              </div>
              <input
                type="range"
                min={0}
                max={80}
                value={softness}
                onChange={(event) => setSoftness(Number(event.target.value))}
                className="h-2 w-full cursor-pointer accent-emerald-600"
              />
            </label>
            <label className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-slate-800">去毛边</span>
                <span className="text-xs font-black text-slate-500">{edgeCleanup}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={edgeCleanup}
                onChange={(event) => setEdgeCleanup(Number(event.target.value))}
                className="h-2 w-full cursor-pointer accent-emerald-600"
              />
            </label>
            <div className="flex flex-col justify-between gap-3 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold leading-6 text-slate-500">{status}</p>
              <button
                type="button"
                onClick={applyTransparency}
                disabled={!imageUrl}
                className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/25 transition hover:-translate-y-0.5 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
              >
                应用为透明 PNG
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
