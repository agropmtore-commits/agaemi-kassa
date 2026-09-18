import { useCallback, useEffect, useState } from 'react';

// README §5.4 — tətbiq açılanda və N dəqiqə arxa planda qalandan sonra PIN soruşulur.
// sessionStorage: `unlockedAt` (son açılma / PIN qurulma), `hiddenAt` (arxa plana keçmə).
// Kilid yalnız real arxa plan hadisəsindən sonra qiymətləndirilir — ayarlarda vaxtı dəyişmək kilidləmir;
// "Dərhal" (0) = hər arxa plandan qayıdanda. Tətbiq tam bağlananda sessionStorage silinir → açılışda kilid.

const UNLOCKED_KEY = 'kassa.unlockedAt';
const HIDDEN_KEY = 'kassa.hiddenAt';

function read(key: string): number | null {
  try {
    const v = sessionStorage.getItem(key);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: number | null): void {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, String(value));
  } catch {
    // private rejim və s. — kilid sadəcə hər açılışda soruşulur
  }
}

/** Sessiyanı açıq işarələ — PIN qurulan anda və hər açılmada. */
export function markActive(): void {
  write(UNLOCKED_KEY, Date.now());
  write(HIDDEN_KEY, null);
}

function shouldLock(timeoutMin: number): boolean {
  const unlockedAt = read(UNLOCKED_KEY);
  if (unlockedAt === null) return true; // təzə sessiya
  const hiddenAt = read(HIDDEN_KEY);
  if (hiddenAt === null || hiddenAt < unlockedAt) return false; // açılandan bəri arxa plana keçməyib
  return Date.now() - hiddenAt >= timeoutMin * 60_000;
}

/** `hasPin` undefined ikən (ayarlar yüklənir) `locked` də undefined-dır. */
export function useLock(hasPin: boolean | undefined, timeoutMin: number): { locked: boolean | undefined; unlock: () => void } {
  const [locked, setLocked] = useState<boolean | undefined>(undefined);

  // İlkin qiymətləndirmə yalnız PIN vəziyyəti məlum olanda / dəyişəndə; vaxt limiti dəyişəndə yox
  useEffect(() => {
    if (hasPin === undefined) return;
    setLocked(hasPin ? shouldLock(timeoutMin) : false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPin]);

  useEffect(() => {
    if (!hasPin) return;
    const onHidden = () => write(HIDDEN_KEY, Date.now());
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHidden();
      else if (shouldLock(timeoutMin)) setLocked(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onHidden);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onHidden);
    };
  }, [hasPin, timeoutMin]);

  const unlock = useCallback(() => {
    markActive();
    setLocked(false);
  }, []);

  return { locked, unlock };
}
