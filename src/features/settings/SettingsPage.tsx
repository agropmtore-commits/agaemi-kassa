import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ConfirmSheet, Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { clearPin, setPin, verifyPin } from '../../db/pin';
import { PinEntry, PinSetup } from '../pin/PinPad';
import { markActive } from '../../hooks/useLock';
import { Card, SectionTitle, Segmented, TopBar } from '../../components/ui';
import { inputClass } from '../../components/pickers';
import { db, type Theme } from '../../db/schema';
import { setSetting } from '../../db/settings';
import { useSettings } from '../../hooks/useData';
import { useTheme } from '../../hooks/useTheme';
import { shortDate, todayLocal } from '../../domain/dates';
import { t } from '../../i18n/az';

const REMINDER_OPTIONS = [0, 7, 14, 30] as const;
const TIMEOUT_OPTIONS = [0, 1, 5, 15, 30] as const;

type PinFlow = { kind: 'set' } | { kind: 'change'; verified: boolean } | { kind: 'remove' };

/** README §4.5 — tema, PIN, backup xatırlatması, məlumat, sıfırlama, haqqında. */
export function SettingsPage() {
  const settings = useSettings();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const txCount = useLiveQuery(() => db.transactions.count(), []);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetWord, setResetWord] = useState('');
  const [resetError, setResetError] = useState('');
  const [pinFlow, setPinFlow] = useState<PinFlow | null>(null);
  const [pinError, setPinError] = useState<string | undefined>();
  const hasPin = Boolean(settings?.pin_hash);

  async function checkCurrent(pin: string) {
    if (!(await verifyPin(pin))) {
      setPinError(t.pin.wrong);
      return;
    }
    setPinError(undefined);
    if (pinFlow?.kind === 'remove') {
      await clearPin();
      setPinFlow(null);
      toast({ message: t.pin.removed });
    } else if (pinFlow?.kind === 'change') {
      setPinFlow({ kind: 'change', verified: true });
    }
  }

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
      <Card className="p-3">
        <p className="text-sm">
          {t.pin.title}: <span className={`font-semibold ${hasPin ? 'text-income' : 'text-(--app-muted)'}`}>{hasPin ? t.pin.enabled : t.pin.disabled}</span>
        </p>
        <div className="mt-3 flex gap-2">
          {hasPin ? (
            <>
              <button type="button" onClick={() => { setPinError(undefined); setPinFlow({ kind: 'change', verified: false }); }} className="flex-1 rounded-xl border border-(--app-border) py-2.5 text-sm font-semibold">
                {t.pin.change}
              </button>
              <button type="button" onClick={() => { setPinError(undefined); setPinFlow({ kind: 'remove' }); }} className="flex-1 rounded-xl border border-expense py-2.5 text-sm font-semibold text-expense">
                {t.pin.remove}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setPinFlow({ kind: 'set' })} className="w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white">
              {t.pin.set}
            </button>
          )}
        </div>
        {hasPin && (
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-xs font-semibold text-(--app-muted)">{t.pin.timeout}</span>
            <select value={settings?.lock_timeout_min ?? 5} onChange={(e) => void setSetting('lock_timeout_min', Number(e.target.value))} className={inputClass}>
              {TIMEOUT_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {t.pin.timeouts[m]}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="mt-3 text-xs text-(--app-muted)">{t.pin.honest}</p>
      </Card>

      <SectionTitle>{t.settings.data}</SectionTitle>
      <Card className="p-3">
        <p className="text-sm">
          {t.settings.dataStats(txCount ?? 0, settings?.installed_at ? shortDate(todayLocal(new Date(settings.installed_at))) : '—')}
        </p>
        <button type="button" onClick={() => setResetOpen(true)} className="mt-3 w-full rounded-xl border border-expense py-2.5 text-sm font-semibold text-expense">
          {t.settings.reset}
        </button>
        <p className="mt-2 text-xs text-(--app-muted)">{t.settings.resetHint}</p>
      </Card>

      <SectionTitle>{t.settings.about}</SectionTitle>
      <Card className="p-3 text-sm text-(--app-muted)">{t.settings.version(__APP_VERSION__)}</Card>

      <Sheet open={pinFlow !== null} onClose={() => setPinFlow(null)} title={pinFlow?.kind === 'remove' ? t.pin.remove : pinFlow?.kind === 'change' ? t.pin.change : t.pin.set}>
        {pinFlow?.kind === 'set' || (pinFlow?.kind === 'change' && pinFlow.verified) ? (
          <PinSetup
            onDone={async (pin, recovery) => {
              markActive(); // yeni qurulan PIN dərhal soruşulmasın
              await setPin(pin, recovery);
              setPinFlow(null);
              toast({ message: t.pin.saved });
            }}
          />
        ) : pinFlow ? (
          <PinEntry title={t.pin.enter} error={pinError} onComplete={(p) => void checkCurrent(p)} />
        ) : null}
      </Sheet>

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
          // Latın "SIL" (ingilis klaviaturası) da qəbul olunur
          const word = resetWord.trim().toLocaleUpperCase('az').replace(/I/g, 'İ');
          if (word !== t.settings.resetWord) {
            setResetError(t.settings.resetMismatch);
            return;
          }
          await resetAll();
        }}
      >
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold text-(--app-muted)">{t.settings.resetConfirm}</span>
          <input value={resetWord} onChange={(e) => { setResetWord(e.target.value); setResetError(''); }} className={inputClass} autoCapitalize="characters" />
          {resetError && <span className="mt-1 block text-xs text-expense">{resetError}</span>}
        </label>
      </ConfirmSheet>
    </>
  );
}
