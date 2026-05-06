'use client';

type ToolDockItem = {
  id: string;
  label: string;
  caption: string;
  icon: string;
  active?: boolean;
  disabled?: boolean;
};

const tools: ToolDockItem[] = [
  {
    id: 'grid-split',
    label: '网格拆分',
    caption: '当前工具',
    icon: '▦',
    active: true
  },
  {
    id: 'skeleton-check',
    label: '骨骼检查',
    caption: '即将上线',
    icon: '◇',
    disabled: true
  },
  {
    id: 'atlas-pack',
    label: '图集整理',
    caption: '即将上线',
    icon: '◫',
    disabled: true
  }
];

export function ToolDock() {
  return (
    <nav aria-label="Spine Toolkit 工具坞" className="flex justify-center">
      <div className="flex items-end gap-3 rounded-[2rem] border border-white/70 bg-white/75 p-3 shadow-dock ring-1 ring-slate-200/70 backdrop-blur-2xl">
        {tools.map((tool) => (
          <button
            key={tool.id}
            type="button"
            disabled={tool.disabled}
            aria-current={tool.active ? 'page' : undefined}
            className={`group relative flex min-w-[5.25rem] flex-col items-center gap-2 rounded-[1.45rem] px-3 py-3 text-center transition duration-200 ${
              tool.active
                ? 'bg-slate-950 text-white shadow-xl shadow-indigo-500/20 -translate-y-1'
                : 'text-slate-500 hover:-translate-y-1 hover:bg-white disabled:hover:translate-y-0 disabled:hover:bg-transparent'
            } disabled:cursor-not-allowed disabled:opacity-55`}
          >
            <span
              className={`grid h-12 w-12 place-items-center rounded-2xl text-2xl font-black transition ${
                tool.active
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/35'
                  : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-500'
              }`}
            >
              {tool.icon}
            </span>
            <span className="text-xs font-black leading-none">{tool.label}</span>
            <span
              className={`text-[0.65rem] font-bold leading-none ${
                tool.active ? 'text-indigo-100' : 'text-slate-400'
              }`}
            >
              {tool.caption}
            </span>
            {tool.active && <span className="absolute -bottom-1.5 h-1.5 w-1.5 rounded-full bg-indigo-400" />}
          </button>
        ))}
      </div>
    </nav>
  );
}
