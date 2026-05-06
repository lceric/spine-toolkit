'use client';

type ImageUploaderProps = {
  imageName?: string;
  onImageSelect: (file: File) => void;
};

export function ImageUploader({ imageName, onImageSelect }: ImageUploaderProps) {
  return (
    <label className="group flex min-h-[17rem] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[2rem] border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/80 to-fuchsia-50/70 p-6 text-center shadow-sm ring-1 ring-white/70 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-panel">
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onImageSelect(file);
          }
        }}
      />
      <span className="grid h-16 w-16 place-items-center rounded-3xl bg-white text-3xl shadow-inner ring-1 ring-indigo-100 transition group-hover:scale-105">
        ⤴
      </span>
      <span className="mt-5 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-indigo-500/25 transition group-hover:bg-slate-950">
        上传角色图片
      </span>
      <span className="mt-4 max-w-xs text-sm leading-6 text-slate-500">
        {imageName ?? '支持 PNG、JPG、WebP；上传后即可在 Canvas 中框选并实时预览网格。'}
      </span>
    </label>
  );
}
