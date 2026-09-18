import { db, newId, nowIso, type Attachment, type KassaDB } from './schema';
import { compressImage } from '../domain/image';

// README §5.7 — qəbz şəkilləri IndexedDB-də Blob kimi; əməliyyat silinəndə "Geri al" pəncərəsi üçün dərhal
// silinmir — yetim qalanlar açılışda təmizlənir (cleanupOrphanAttachments).

export const MAX_ATTACHMENTS_PER_TX = 5;

export async function addAttachment(transactionId: string, file: Blob, database: KassaDB = db): Promise<Attachment> {
  const count = await database.attachments.where('transaction_id').equals(transactionId).count();
  if (count >= MAX_ATTACHMENTS_PER_TX) throw new Error(`Ən çox ${MAX_ATTACHMENTS_PER_TX} şəkil`);
  const { blob, width, height } = await compressImage(file);
  const attachment: Attachment = { id: newId(), transaction_id: transactionId, blob, mime: blob.type || 'image/jpeg', width, height, size: blob.size, created_at: nowIso() };
  await database.attachments.add(attachment);
  return attachment;
}

export function deleteAttachment(id: string, database: KassaDB = db): Promise<void> {
  return database.attachments.delete(id);
}

export function listAttachments(transactionId: string, database: KassaDB = db): Promise<Attachment[]> {
  return database.attachments.where('transaction_id').equals(transactionId).sortBy('created_at');
}

/** Əməliyyatı olmayan şəkilləri sil — açılışda bir dəfə. */
export async function cleanupOrphanAttachments(database: KassaDB = db): Promise<number> {
  const txIds = new Set(await database.transactions.toCollection().primaryKeys());
  const ids: string[] = [];
  await database.attachments.each((a) => {
    if (!txIds.has(a.transaction_id)) ids.push(a.id);
  });
  if (ids.length) await database.attachments.bulkDelete(ids);
  return ids.length;
}
