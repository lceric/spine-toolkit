'use client';

import type { GridSettings } from '@/lib/grid';

type GridControlsProps = {
  settings: GridSettings;
  onChange: (settings: GridSettings) => void;
};

type FieldConfig = {
  key: keyof GridSettings;
  label: string;
  min: number;
  max: number;
  step: number;
  hint: string;
};

const fields: FieldConfig[] = [
  { key: 'originX', label: 'Origin X', min: 0, max: 4096, step: 1, hint: '网格起点横坐标' },
  { key: 'originY', label: 'Origin Y', min: 0, max: 4096, step: 1, hint: '网格起点纵坐标' },
  { key: 'cellWidth', label: 'Cell Width', min: 1, max: 1024, step: 1, hint: '单元格宽度' },
  { key: 'cellHeight', label: 'Cell Height', min: 1, max: 1024, step: 1, hint: '单元格高度' },
  { key: 'gapX', label: 'Gap X', min: 0, max: 256, step: 1, hint: '横向间距' },
  { key: 'gapY', label: 'Gap Y', min: 0, max: 256, step: 1, hint: '纵向间距' },
  { key: 'rows', label: 'Rows', min: 1, max: 32, step: 1, hint: '行数' },
  { key: 'cols', label: 'Cols', min: 1, max: 32, step: 1, hint: '列数' }
];

const clamp = (value: number, field: FieldConfig) => Math.min(field.max, Math.max(field.min, value));

export function GridControls({ settings, onChange }: GridControlsProps) {
  const updateSetting = (field: FieldConfig, nextValue: number) => {
    const value = clamp(Number.isFinite(nextValue) ? nextValue : field.min, field);
    onChange({
      ...settings,
      [field.key]: field.key === 'rows' || field.key === 'cols' ? Math.round(value) : value
    });
  };

  return (
    <section className="rounded-3xl bg-white/90 p-5 shadow-panel ring-1 ring-slate-200/70">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">参数面板</h2>
          <p className="text-sm text-slate-500">
            拖动 slider 精调参数，或在左侧原图中框选网格区域后自动回填 origin 与 cell 尺寸。
          </p>
        </div>
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
          实时预览
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {fields.map((field) => (
          <label key={field.key} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <span className="block text-sm font-bold text-slate-800">{field.label}</span>
                <span className="text-xs text-slate-500">{field.hint}</span>
              </div>
              <input
                type="number"
                min={field.min}
                max={field.max}
                step={field.step}
                value={settings[field.key]}
                onChange={(event) => updateSetting(field, Number(event.target.value))}
                className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
            </div>
            <input
              type="range"
              min={field.min}
              max={field.max}
              step={field.step}
              value={settings[field.key]}
              onChange={(event) => updateSetting(field, Number(event.target.value))}
              className="h-2 w-full cursor-pointer accent-indigo-600"
            />
          </label>
        ))}
      </div>
    </section>
  );
}
