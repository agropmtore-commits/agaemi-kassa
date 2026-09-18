import { useCallback, useEffect, useState } from 'react';

// README §5.4 — tətbiq açılanda və N dəqiqə arxa planda qalandan sonra PIN soruşulur.
// Son aktiv vaxt sessionStorage-dədir: tətbiq tam bağlananda silinir (açılışda kilid),
// arxa plana keçəndə qalır (vaxta görə kilid). Dev-də səhifə yenilənəndə hər dəfə soruşmur.

const KEY = 'kassa.lastActiveAt';

function lastActiveAt(): number | null {
  try {
    const v = sessionStorage.getItem(KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

/** Sessiyanı aktiv işarələ — PIN qoyulan anda çağırılır ki, yeni PIN dərhal soruşulmasın. */
export function markActive(): void {
  touch();
}

function touch(): void {
  try {
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // private rejim və s. — kilid sadəcə hər açılışda soruşulur
  }
}

function shouldLock(timeoutMin: number): boolean {
  const last = lastActiveAt();
  if (last === null) return true;
  return Date.now() - last >= timeoutMin * 60_000;
}

/** `hasPin` undefined ikən (ayarlar yüklənir) `locked` də undefined-dır. */
export function useLock(hasPin: boolean | undefined, timeoutMin: number): { locked: boolean | undefined; unlock: () => void } {
  const [locked, setLocked] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (hasPin === undefined) return;
    setLocked(hasPin ? shouldLock(timeoutMin) : false);
  }, [hasPin, timeoutMin]);

  useEffect(() => {
    if (!hasPin) return;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') touch();
      else if (shouldLock(timeoutMin)) setLocked(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', touch);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', touch);
    };
  }, [hasPin, timeoutMin]);

  const unlock = useCallback(() => {
    touch();
    setLocked(false);
  }, []);

  return { locked, unlock };
}
