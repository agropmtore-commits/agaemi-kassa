import { db, DEFAULT_SETTINGS, type Settings } from './schema';

/** Bir ayarı oxu; yazılmayıbsa default. */
export async function getSetting<K extends keyof Settings>(key: K): Promise<Settings[K]> {
  const row = await db.settings.get(key);
  return row ? (row.value as Settings[K]) : DEFAULT_SETTINGS[key];
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  await db.settings.put({ key, value });
}

/** Bütün ayarlar — defaultlarla birləşdirilmiş. */
export async function getAllSettings(): Promise<Settings> {
  const rows = await db.settings.toArray();
  const overrides = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Partial<Settings>;
  return { ...DEFAULT_SETTINGS, ...overrides };
}
