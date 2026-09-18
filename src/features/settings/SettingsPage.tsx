import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ConfirmSheet } from '../../components/Sheet';
import { Card, SectionTitle, Segmented, TopBar } from '../../components/ui';
import { inputClass } from '../../components/pickers';
import { db, type Theme } from '../../db/schema';
import { setSetting } from '../../db/settings';
import { useSettings } from '../../hooks/useData';
import { useTheme } from '../../hooks/useTheme';
import { shortDate } from '../../domain/dates';
import { t } from '../../i18n/az';

const REMINDER_OPTIONS = [0, 7, 14, 30] as const;

/** README §4.5 — tema, backup xatırlatması, məlumat, sıfırlama, haqqında. PIN — Mərhələ 5. */
export function SettingsPage() {
  const settings = useSettings();
  const { theme, setTheme } = useTheme();
  const txCount = useLiveQuery(() => db.transactions.count(), []);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetWord, setResetWord] = useState('');

  async function resetAll() {
    await db.delete();
    // Service worker qalır — səhifə yenidən açılanda boş baza yaranır və onboarding gəlir
    window.location.replace(import.meta.env.BASE_URL);
  }

  return (
    <>
      <TopBar title={t.settings.title} />

      <SectionTitle>{t.settings.theme}</SectionTitle>
      <Card className="p-3">
        <Segmented<Theme>
          value={theme}
          onChange={(v) => void setTheme(v)}
          options={[
            { value: 'system', label: t.settings.themes.system! },
            { value: 'light', label: t.settings.themes.light! },
            { value: 'dark', label: t.settings.themes.dark! },
          ]}
        />
      </Card>

      <SectionTitle>{t.settings.backupReminder}</SectionTitle>
      <Card className="p-3">
        <select
          value={settings?.backup_reminder_days ?? 7}
          onChange={(e) => void setSetting('backup_reminder_days', Number(e.target.value))}
          aria-label={t.settings.backupReminder}
          className={inputClass}
        >
          {REMINDER_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {t.settings.reminderOptions[d]}
            </option>
          ))}
        </select>
      </Card>

      <SectionTitle>{t.settings.pin}</SectionTitle>
      <Card className="p-3 text-sm text-(--app-muted)">{t.common.comingSoon(5)}</Card>

      <SectionTitle>{t.settings.data}</SectionTitle>
      <Card className="p-3">
        <p className="text-sm">
          {t.settings.dataStats(txCount ?? 0, settings?.installed_at ? shortDate(settings.installed_at.slice(0, 10)) : '—')}
        </p>
        <button type="button" onClick={() => setResetOpen(true)} className="mt-3 w-full rounded-xl border border-expense py-2.5 text-sm font-semibold text-expense">
          {t.settings.reset}
        </button>
        <p className="mt-2 text-xs text-(--app-muted)">{t.settings.resetHint}</p>
      </Card>

      <SectionTitle>{t.settings.about}</SectionTitle>
      <Card className="p-3 text-sm text-(--app-muted)">{t.settings.version(__APP_VERSION__)}</Card>

      <ConfirmSheet
        open={resetOpen}
        onClose={() => {
          setResetOpen(false);
          setResetWord('');
        }}
        title={t.settings.reset}
        text={t.settings.resetHint}
        confirmLabel={t.settings.reset}
        danger
        onConfirm={async () => {
          if (resetWord.trim().toLocaleUpperCase('az') !== t.settings.resetWord) return;
          await resetAll();
        }}
      >
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold text-(--app-muted)">{t.settings.resetConfirm}</span>
          <input value={resetWord} onChange={(e) => setResetWord(e.target.value)} className={inputClass} autoCapitalize="characters" />
        </label>
      </ConfirmSheet>
    </>
  );
}
