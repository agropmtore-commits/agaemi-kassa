// README §5.4 — PIN kilidi. Ekran kilididir, şifrələmə deyil (dürüst qeyd README-də).
// Hash: PBKDF2-SHA256 (Web Crypto), hər qurulmada yeni salt. 4 rəqəmli PIN üçün offline brute-force
// onsuz da trivialdır — məqsəd telefonu əlinə alanın bir toxunuşla açmamasıdır.

export const PIN_LENGTH = 4;
const ITERATIONS = 100_000;

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin); // PIN_LENGTH = 4
}

/** Bərpa sözü: boşluqlar kəsilir, kiçik hərfə (Azərbaycan qaydası ilə: İ→i, I→ı) çevrilir. */
export function normalizeRecovery(word: string): string {
  return word.trim().replace(/\s+/g, ' ').toLocaleLowerCase('az');
}

export function isValidRecovery(word: string): boolean {
  return normalizeRecovery(word).length >= 3;
}

export function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return hex(bytes);
}

export async function hashSecret(secret: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: ITERATIONS }, key, 256);
  return hex(new Uint8Array(bits));
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
