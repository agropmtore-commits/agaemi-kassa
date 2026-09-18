// Faylı telefonun paylaşma menyusu ilə göndər (Telegram, Drive, WhatsApp…) və ya yüklə (kompüter).

export type DeliverMethod = 'share' | 'download';
export type DeliverResult = 'shared' | 'downloaded' | 'aborted';

export function canShareFiles(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';
}

export async function deliverFile(file: File, method: DeliverMethod): Promise<DeliverResult> {
  if (method === 'share' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'aborted'; // istifadəçi imtina etdi
      throw e;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
