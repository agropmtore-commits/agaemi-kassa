import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_SETTINGS, type Theme } from '../db/schema';
import { setSetting } from '../db/settings';

const media = () => window.matchMedia('(prefers-color-scheme: dark)');

function apply(theme: Theme) {
  const resolved = theme === 'system' ? (media().matches ? 'dark' : 'light') : theme;
  document.documentElement.dataset.theme = resolved;
}

/** Ayardakı temanı <html data-theme> kimi tətbiq edir; "system" dəyişəndə izləyir. */
export function useTheme(): { theme: Theme; setTheme: (t: Theme) => Promise<void> } {
  const theme = useLiveQuery(
    async () => ((await db.settings.get('theme'))?.value as Theme | undefined) ?? DEFAULT_SETTINGS.theme,
    [],
    DEFAULT_SETTINGS.theme,
  );

  useEffect(() => {
    apply(theme);
    if (theme !== 'system') return;
    const mq = media();
    const onChange = () => apply('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  return { theme, setTheme: (t) => setSetting('theme', t) };
}
