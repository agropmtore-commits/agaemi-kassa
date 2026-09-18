import { db, type KassaDB } from './schema';
import { hashSecret, isValidPin, isValidRecovery, normalizeRecovery, randomSalt } from '../domain/pin';

/** PIN + bərpa sözü qoy (və ya dəyiş). Hər dəfə yeni salt — hər iki hash yenidən hesablanır. */
export async function setPin(pin: string, recoveryWord: string, database: KassaDB = db): Promise<void> {
  if (!isValidPin(pin)) throw new Error('PIN 4 rəqəm olmalıdır');
  if (!isValidRecovery(recoveryWord)) throw new Error('Bərpa sözü ən azı 3 hərf olmalıdır');
  const salt = randomSalt();
  const [pin_hash, recovery_hash] = await Promise.all([hashSecret(pin, salt), hashSecret(normalizeRecovery(recoveryWord), salt)]);
  await database.settings.bulkPut([
    { key: 'pin_salt', value: salt },
    { key: 'pin_hash', value: pin_hash },
    { key: 'recovery_hash', value: recovery_hash },
  ]);
}

export async function clearPin(database: KassaDB = db): Promise<void> {
  await database.settings.bulkDelete(['pin_salt', 'pin_hash', 'recovery_hash']);
}

export async function hasPin(database: KassaDB = db): Promise<boolean> {
  return Boolean((await database.settings.get('pin_hash'))?.value);
}

export async function verifyPin(pin: string, database: KassaDB = db): Promise<boolean> {
  const [salt, hash] = await Promise.all([database.settings.get('pin_salt'), database.settings.get('pin_hash')]);
  if (!salt?.value || !hash?.value) return false;
  return (await hashSecret(pin, String(salt.value))) === hash.value;
}

export async function verifyRecovery(word: string, database: KassaDB = db): Promise<boolean> {
  const [salt, hash] = await Promise.all([database.settings.get('pin_salt'), database.settings.get('recovery_hash')]);
  if (!salt?.value || !hash?.value) return false;
  return (await hashSecret(normalizeRecovery(word), String(salt.value))) === hash.value;
}
