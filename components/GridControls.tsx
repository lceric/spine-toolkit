'use client';

import type { GridSettings } from '@/lib/grid';

type GridControlsProps = {
  settings: GridSettings;
  onChange: (settings: GridSettings) => void;
};

const fields: Array<{ key: keyof GridSettings; label: string; min?: number }> = [
  { key: 'originX', label: 'originX' },
  { key: 'originY', label: 'originY' },
  { key: 'cellWidth', label: 'cellWidth', min: 1 },
  { key: 'cellHeight', label: 'cellHeight', min: 1 },
  { key: 'gapX', label: 'gapX' },
  { key: 'gapY', label: 'gapY' },
  { key: 'rows', label: 'rows', min: 1 },
  { key: 'cols', label: 'cols', min: 1 }
];

export function GridControls({ settings, onChange }: GridControlsProps) {
  return (
    <section className="rounded-3xl bg-white/90 p-5 shadow-panel ring-1 ring-slate-200/70">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">参数面板</h2>
          <p className="text-sm text-slate-500">调整坐标、尺寸、间距、行列数，网格会实时更新。</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
        {fields.map((field) => (
          <label key={field.key} className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{field.label}</span>
            <input
              type="number"
              min={field.min}
              value={settings[field.key]}
              onChange={(event) => {
                const value = Number(event.target.value);
                onChange({
                  ...settings,
                  [field.key]: Number.isFinite(value) ? value : 0
                });
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
            />
          </label>
        ))}
      </div>
    </section>
  );
}
