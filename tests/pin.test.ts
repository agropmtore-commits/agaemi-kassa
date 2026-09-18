import { beforeEach, describe, expect, it } from 'vitest';
import { KassaDB } from '../src/db/schema';
import { clearPin, hasPin, setPin, verifyPin, verifyRecovery } from '../src/db/pin';
import { hashSecret, isValidPin, isValidRecovery, normalizeRecovery, randomSalt } from '../src/domain/pin';
import { createBackup } from '../src/db/backup';

let db: KassaDB;

beforeEach(async () => {
  db = new KassaDB(`test-${crypto.randomUUID()}`);
  await db.open();
});

describe('domain/pin', () => {
  it('validates 4-digit PINs and ≥3-char recovery words', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
    expect(isValidPin('12345')).toBe(false);
    expect(isValidRecovery('  ab ')).toBe(false);
    expect(isValidRecovery('ana')).toBe(true);
  });

  it('normalizes recovery words with Azerbaijani casing', () => {
    expect(normalizeRecovery('  İLK   Maşın ')).toBe('ilk maşın');
    expect(normalizeRecovery('ISTANBUL')).toBe('ıstanbul');
  });

  it('hashes deterministically per salt and differently across salts', async () => {
    const salt = randomSalt();
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    const a = await hashSecret('1234', salt);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashSecret('1234', salt)).toBe(a);
    expect(await hashSecret('1235', salt)).not.toBe(a);
    expect(await hashSecret('1234', randomSalt())).not.toBe(a);
  });
});

describe('db/pin', () => {
  it('sets, verifies, recovers and clears', async () => {
    expect(await hasPin(db)).toBe(false);
    expect(await verifyPin('1234', db)).toBe(false);
    await setPin('1234', 'Anam Gülnarə', db);
    expect(await hasPin(db)).toBe(true);
    expect(await verifyPin('1234', db)).toBe(true);
    expect(await verifyPin('0000', db)).toBe(false);
    expect(await verifyRecovery('anam gülnarə', db)).toBe(true);
    expect(await verifyRecovery('ANAM   GÜLNARƏ', db)).toBe(true);
    expect(await verifyRecovery('atam', db)).toBe(false);
    await setPin('9999', 'yeni söz', db);
    expect(await verifyPin('1234', db)).toBe(false);
    expect(await verifyPin('9999', db)).toBe(true);
    await clearPin(db);
    expect(await hasPin(db)).toBe(false);
  });

  it('rejects bad input and never leaks into a backup', async () => {
    await expect(setPin('12', 'söz', db)).rejects.toThrow();
    await expect(setPin('1234', 'ab', db)).rejects.toThrow();
    await setPin('1234', 'söz', db);
    const keys = (await createBackup(db)).data.settings.map((s) => s.key);
    expect(keys).not.toContain('pin_hash');
    expect(keys).not.toContain('pin_salt');
    expect(keys).not.toContain('recovery_hash');
  });
});
