'use client';

type ImageUploaderProps = {
  imageName?: string;
  onImageSelect: (file: File) => void;
};

export function ImageUploader({ imageName, onImageSelect }: ImageUploaderProps) {
  return (
    <label className="group flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-indigo-200 bg-white/75 p-6 text-center shadow-sm transition hover:border-indigo-400 hover:bg-indigo-50/80">
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
      <span className="rounded-full bg-indigo-100 px-4 py-2 text-sm font-semibold text-indigo-700 transition group-hover:bg-indigo-600 group-hover:text-white">
        上传角色图片
      </span>
      <span className="mt-3 text-sm text-slate-500">
        {imageName ?? '支持 PNG、JPG、WebP；上传后可在 Canvas 中实时预览网格。'}
      </span>
    </label>
  );
}
