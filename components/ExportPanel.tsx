'use client';

import { useMemo, useState } from 'react';
import { getGridCells, type CellOverrides, type GridCell, type GridSettings } from '@/lib/grid';

type ExportPanelProps = {
  imageUrl?: string;
  settings: GridSettings;
  cellOverrides?: CellOverrides;
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

const downloadBlob = (blob: Blob, filename: string) => {
  const anchor = document.createElement('a');
  const url = URL.createObjectURL(blob);

  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

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

const createCellCanvas = (image: HTMLImageElement, cell: GridCell) => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    return null;
  }

  canvas.width = Math.max(1, Math.floor(cell.width));
  canvas.height = Math.max(1, Math.floor(cell.height));
  context.drawImage(image, cell.x, cell.y, cell.width, cell.height, 0, 0, cell.width, cell.height);

  return canvas;
};

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});

const getCrc32 = (data: Uint8Array) => {
  let crc = 0xffffffff;

  data.forEach((byte) => {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  });

  return (crc ^ 0xffffffff) >>> 0;
};

const writeUint16 = (target: Uint8Array, offset: number, value: number) => {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
};

const writeUint32 = (target: Uint8Array, offset: number, value: number) => {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
};

const getDosDateTime = (date = new Date()) => ({
  time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
  date: ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
});

const getBlobPart = (data: Uint8Array) => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;

type ZipEntry = {
  name: string;
  data: Uint8Array;
};

const createZipBlob = (entries: ZipEntry[]) => {
  const encoder = new TextEncoder();
  const fileRecords: Uint8Array[] = [];
  const centralRecords: Uint8Array[] = [];
  const { time, date } = getDosDateTime();
  let offset = 0;

  entries.forEach((entry) => {
    const nameBytes = encoder.encode(entry.name);
    const crc = getCrc32(entry.data);
    const localHeader = new Uint8Array(30 + nameBytes.length);

    writeUint32(localHeader, 0, 0x04034b50);
    writeUint16(localHeader, 4, 20);
    writeUint16(localHeader, 6, 0x0800);
    writeUint16(localHeader, 8, 0);
    writeUint16(localHeader, 10, time);
    writeUint16(localHeader, 12, date);
    writeUint32(localHeader, 14, crc);
    writeUint32(localHeader, 18, entry.data.length);
    writeUint32(localHeader, 22, entry.data.length);
    writeUint16(localHeader, 26, nameBytes.length);
    localHeader.set(nameBytes, 30);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    writeUint32(centralHeader, 0, 0x02014b50);
    writeUint16(centralHeader, 4, 20);
    writeUint16(centralHeader, 6, 20);
    writeUint16(centralHeader, 8, 0x0800);
    writeUint16(centralHeader, 10, 0);
    writeUint16(centralHeader, 12, time);
    writeUint16(centralHeader, 14, date);
    writeUint32(centralHeader, 16, crc);
    writeUint32(centralHeader, 20, entry.data.length);
    writeUint32(centralHeader, 24, entry.data.length);
    writeUint16(centralHeader, 28, nameBytes.length);
    writeUint32(centralHeader, 42, offset);
    centralHeader.set(nameBytes, 46);

    fileRecords.push(localHeader, entry.data);
    centralRecords.push(centralHeader);
    offset += localHeader.length + entry.data.length;
  });

  const centralOffset = offset;
  const centralSize = centralRecords.reduce((sum, record) => sum + record.length, 0);
  const endRecord = new Uint8Array(22);

  writeUint32(endRecord, 0, 0x06054b50);
  writeUint16(endRecord, 8, entries.length);
  writeUint16(endRecord, 10, entries.length);
  writeUint32(endRecord, 12, centralSize);
  writeUint32(endRecord, 16, centralOffset);

  return new Blob([...fileRecords, ...centralRecords, endRecord].map(getBlobPart), { type: 'application/zip' });
};

export function ExportPanel({ imageUrl, settings, cellOverrides = {}, selectedCell }: ExportPanelProps) {
  const [partName, setPartName] = useState('part');
  const [status, setStatus] = useState('等待导出');
  const cells = useMemo(() => getGridCells(settings, cellOverrides), [cellOverrides, settings]);

  const exportCells = async (onlySelected: boolean) => {
    if (!imageUrl) {
      setStatus('请先上传图片。');
      return;
    }

    const image = await loadImage(imageUrl);
    const targets = onlySelected && selectedCell ? [selectedCell] : cells;

    targets.forEach((cell) => {
      const canvas = createCellCanvas(image, cell);

      if (!canvas) {
        return;
      }

      downloadCanvas(canvas, `${partName || 'part'}_${cell.row}_${cell.col}.png`);
    });

    setStatus(`已导出 ${targets.length} 个 PNG。`);
  };

  const exportZip = async () => {
    if (!imageUrl) {
      setStatus('请先上传图片。');
      return;
    }

    try {
      setStatus('正在生成 ZIP...');
      const image = await loadImage(imageUrl);
      const entries: ZipEntry[] = [];

      for (const cell of cells) {
        const canvas = createCellCanvas(image, cell);

        if (!canvas) {
          continue;
        }

        const blob = await canvasToPngBlob(canvas);
        entries.push({
          name: `${partName || 'part'}_${cell.row}_${cell.col}.png`,
          data: new Uint8Array(await blob.arrayBuffer())
        });
      }

      downloadBlob(createZipBlob(entries), `${partName || 'part'}_cells.zip`);
      setStatus(`已打包 ${entries.length} 个 PNG 到 ZIP。`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'ZIP 导出失败。');
    }
  };

  return (
    <section className="overflow-hidden rounded-[2rem] bg-slate-950 p-5 text-white shadow-panel ring-1 ring-slate-800">
      <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="relative">
          <h2 className="text-xl font-black">导出区域</h2>
          <p className="mt-1 text-sm text-slate-300">
            使用离屏 canvas 裁剪网格 cell，支持单独 PNG 或全部打包为 ZIP。
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
          <button
            type="button"
            onClick={exportZip}
            className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/25 transition hover:-translate-y-0.5 hover:bg-emerald-400"
          >
            ZIP 导出全部
          </button>
        </div>
      </div>
    </section>
  );
}
