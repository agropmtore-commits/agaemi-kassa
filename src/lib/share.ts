// Faylı telefonun paylaşma menyusu ilə göndər (Telegram, Drive, WhatsApp…) və ya yüklə (kompüter).
// Chromium yalnız müəyyən fayl növlərini paylaşır (text/*, csv, şəkil, pdf…) — .json/.zip/.xlsx paylaşılmır:
// canShare() "bəli" desə də share() NotAllowedError atır. Ona görə uğursuz paylaşma yükləməyə keçir.

export type DeliverMethod = 'share' | 'download';
export type DeliverResult = 'shared' | 'downloaded' | 'downloaded_fallback' | 'aborted';

export function canShareFiles(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';
}

function download(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function deliverFile(file: File, method: DeliverMethod): Promise<DeliverResult> {
  if (method === 'share' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'aborted'; // istifadəçi imtina etdi
      download(file); // növ dəstəklənmir / paylaşma icazəsi yoxdur — heç olmasa fayl əldə olsun
      return 'downloaded_fallback';
    }
  }
  download(file);
  return 'downloaded';
}

/** Paylaşma üçün JSON-u .txt kimi verir — Chromium text/plain-i paylaşır, application/json-u yox. İdxal məzmuna baxır. */
export function asShareableText(file: File): File {
  return new File([file], file.name.replace(/\.json$/i, '.txt'), { type: 'text/plain' });
}
