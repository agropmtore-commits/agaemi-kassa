import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Camera, X } from 'lucide-react';
import { db, type Attachment } from '../../db/schema';
import { MAX_ATTACHMENTS_PER_TX } from '../../db/attachments';
import { t } from '../../i18n/az';

// README §5.7 — qəbz şəkilləri: kiçik önizləmə, toxunanda tam ekran, kamera/qalereya ilə əlavə.

export function useAttachments(transactionId: string | undefined): Attachment[] | undefined {
  return useLiveQuery(
    async (): Promise<Attachment[]> => (transactionId ? db.attachments.where('transaction_id').equals(transactionId).sortBy('created_at') : []),
    [transactionId],
  );
}

/** Şəkli olan əməliyyat id-ləri — siyahıda 📎 üçün. Yalnız indeks açarları oxunur, bloblar yox. */
export function useAttachmentTxIds(): Set<string> | undefined {
  return useLiveQuery(async () => {
    try {
      return new Set((await db.attachments.orderBy('transaction_id').uniqueKeys()) as string[]);
    } catch (e) {
      console.warn('attachments keys', e); // iOS IndexedDB kursor xətası — siyahı 📎-siz də açılsın
      return new Set<string>();
    }
  }, []);
}

function useObjectUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

function Thumb({ blob, onOpen, onRemove }: { blob: Blob; onOpen: () => void; onRemove: () => void }) {
  const url = useObjectUrl(blob);
  return (
    <div className="relative size-16 shrink-0">
      <button type="button" onClick={onOpen} aria-label={t.receipts.view} className="size-16 overflow-hidden rounded-lg border border-(--app-border) bg-(--app-surface)">
        {url && <img src={url} alt="" className="size-full object-cover" />}
      </button>
      <button type="button" onClick={onRemove} aria-label={t.receipts.remove} className="absolute -top-1.5 -right-1.5 rounded-full bg-expense p-0.5 text-white shadow">
        <X size={12} aria-hidden />
      </button>
    </div>
  );
}

export interface ReceiptItem {
  key: string;
  blob: Blob;
}

/** Önizləmə zolağı + "Qəbz" düyməsi. Fayl seçimi kamera və ya qalereya (Android seçim verir). */
export function ReceiptStrip({ items, onAdd, onRemove }: { items: ReceiptItem[]; onAdd: (files: File[]) => void; onRemove: (key: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [viewing, setViewing] = useState<Blob | null>(null);
  const full = items.length >= MAX_ATTACHMENTS_PER_TX;

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none]">
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          if (files.length) onAdd(files.slice(0, MAX_ATTACHMENTS_PER_TX - items.length));
          e.target.value = '';
        }}
      />
      {items.map((it) => (
        <Thumb key={it.key} blob={it.blob} onOpen={() => setViewing(it.blob)} onRemove={() => onRemove(it.key)} />
      ))}
      <button
        type="button"
        disabled={full}
        onClick={() => input.current?.click()}
        title={full ? t.receipts.max(MAX_ATTACHMENTS_PER_TX) : t.receipts.addHint}
        className="flex h-16 shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-(--app-border) px-3 text-sm text-(--app-muted) disabled:opacity-40"
      >
        <Camera size={18} aria-hidden /> {t.receipts.add}
      </button>
      {viewing && <ImageViewer blob={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

/** Tam ekran görüntü — arxa fona toxunanda bağlanır. */
export function ImageViewer({ blob, onClose }: { blob: Blob; onClose: () => void }) {
  const url = useObjectUrl(blob);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={t.receipts.view} onClick={onClose} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-2">
      {url && <img src={url} alt="" className="max-h-full max-w-full object-contain" />}
      <button type="button" onClick={onClose} aria-label={t.receipts.close} className="absolute top-[max(env(safe-area-inset-top),12px)] right-3 rounded-full bg-white/20 p-2 text-white">
        <X size={22} aria-hidden />
      </button>
    </div>
  );
}
