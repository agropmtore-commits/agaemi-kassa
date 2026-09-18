// README §5.7 — qəbz şəkli cihazda sıxılır: uzun tərəf ≤ 1 200 px, JPEG ≈ 100–200 KB. Yalnız brauzerdə işləyir.

export const MAX_IMAGE_PX = 1200;
export const JPEG_QUALITY = 0.8;

export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
}

/** Şəkli JPEG-ə çevirib kiçildir. Artıq kiçikdirsə də JPEG-ə çevrilir (HEIC və s. problem olmasın). */
export async function compressImage(file: Blob, maxPx = MAX_IMAGE_PX, quality = JPEG_QUALITY): Promise<CompressedImage> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width, height) : Object.assign(document.createElement('canvas'), { width, height });
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
    if (!ctx) throw new Error('Canvas dəstəklənmir');
    ctx.drawImage(bitmap, 0, 0, width, height);
    // `instanceof OffscreenCanvas` yalnız qlobal mövcud olanda yoxlanır — köhnə Safari/Firefox-da ReferenceError olmasın
    const isOffscreen = typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas;
    const blob = isOffscreen
      ? await (canvas as OffscreenCanvas).convertToBlob({ type: 'image/jpeg', quality })
      : await new Promise<Blob>((resolve, reject) =>
          (canvas as HTMLCanvasElement).toBlob((b: Blob | null) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', quality),
        );
    return { blob, width, height };
  } finally {
    bitmap.close();
  }
}
