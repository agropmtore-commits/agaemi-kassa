import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Download, Share2, Upload } from 'lucide-react';
import { ConfirmSheet } from '../../components/Sheet';
import { Card, PrimaryButton, SectionTitle, Segmented, TopBar } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { backupFileName, BackupError, createBackup, importBackup, parseBackup, serializeBackup, type BackupFile, type ImportMode } from '../../db/backup';
import { setSetting } from '../../db/settings';
import { useSetting } from '../../hooks/useData';
import { shortDate, todayLocal } from '../../domain/dates';
import { t } from '../../i18n/az';

/** README §6 — JSON ixrac (paylaş / yüklə) və idxal (əvəz et / birləşdir). */
export function BackupPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const lastBackupAt = useSetting('last_backup_at');
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ backup: BackupFile; name: string } | null>(null);
  const [mode, setMode] = useState<ImportMode>('replace');
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');

  async function exportBackup(method: 'share' | 'download') {
    setBusy(true);
    try {
      const text = serializeBackup(await createBackup());
      const name = backupFileName();
      const file = new File([text], name, { type: 'application/json' });
      if (method === 'share' && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: name });
        } catch (e) {
          if ((e as DOMException).name === 'AbortError') return; // istifadəçi imtina etdi — backup sayılmır
          throw e;
        }
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
      await setSetting('last_backup_at', new Date().toISOString());
      toast({ message: t.backup.exported });
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    setError('');
    setPending(null);
    if (!file) return;
    try {
      const backup = parseBackup(await file.text());
      setPending({ backup, name: file.name });
    } catch (e) {
      setError(e instanceof BackupError ? t.backup.errors[e.code]! : t.backup.errors.read!);
    }
    if (fileInput.current) fileInput.current.value = '';
  }

  async function runImport() {
    if (!pending) return;
    setBusy(true);
    try {
      const result = await importBackup(pending.backup, mode);
      setConfirm(false);
      setPending(null);
      toast({ message: t.backup.imported(result.transactions) });
      navigate('/', { replace: true });
    } finally {
      setBusy(false);
    }
  }

  const canShare = typeof navigator.canShare === 'function';
  const lastLabel = lastBackupAt ? t.backup.daysAgo(daysSince(lastBackupAt)) : t.backup.never;

  return (
    <>
      <TopBar title={t.backup.title} />
      <p className="mb-4 text-sm text-(--app-muted)">{t.backup.why}</p>

      <Card className="p-4">
        <p className="text-xs text-(--app-muted)">{t.backup.lastBackup}</p>
        <p className="mb-3 font-semibold">{lastLabel}</p>
        <p className="mb-3 text-xs text-(--app-muted)">{t.backup.exportHint}</p>
        <div className="flex gap-2">
          {canShare && (
            <PrimaryButton disabled={busy} onClick={() => void exportBackup('share')}>
              <span className="inline-flex items-center gap-2">
                <Share2 size={18} aria-hidden /> {t.common.share}
              </span>
            </PrimaryButton>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void exportBackup('download')}
            className={`inline-flex items-center justify-center gap-2 rounded-xl border border-(--app-border) py-3.5 font-semibold disabled:opacity-40 ${canShare ? 'px-4' : 'w-full'}`}
          >
            <Download size={18} aria-hidden /> {t.common.download}
          </button>
        </div>
      </Card>

      <section className="mt-5">
        <SectionTitle>{t.backup.import}</SectionTitle>
        <Card className="p-4">
          <p className="mb-3 text-xs text-(--app-muted)">{t.backup.importHint}</p>
          <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-(--app-border) py-3 font-semibold"
          >
            <Upload size={18} aria-hidden /> {t.backup.chooseFile}
          </button>
          {error && <p className="mt-3 text-sm text-expense">{error}</p>}
          {pending && (
            <div className="mt-4 space-y-3">
              <p className="text-sm">
                <span className="font-medium">{pending.name}</span>
                <br />
                <span className="text-(--app-muted)">
                  {t.backup.preview(pending.backup.data.transactions.length, pending.backup.data.wallets.length, shortDate(pending.backup.exported_at.slice(0, 10)))}
                </span>
              </p>
              <Segmented
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'replace', label: t.backup.modeReplace, activeClass: 'bg-expense' },
                  { value: 'merge', label: t.backup.modeMerge },
                ]}
              />
              <p className="text-xs text-(--app-muted)">{mode === 'replace' ? t.backup.modeReplaceHint : t.backup.modeMergeHint}</p>
              <PrimaryButton disabled={busy} onClick={() => (mode === 'replace' ? setConfirm(true) : void runImport())} className={mode === 'replace' ? 'bg-expense' : ''}>
                {mode === 'replace' ? t.backup.modeReplace : t.backup.modeMerge}
              </PrimaryButton>
            </div>
          )}
        </Card>
      </section>

      <ConfirmSheet open={confirm} onClose={() => setConfirm(false)} title={t.backup.modeReplace} text={t.backup.confirmReplace} confirmLabel={t.backup.modeReplace} danger onConfirm={runImport} />
    </>
  );
}

function daysSince(iso: string): number {
  const d = new Date(iso);
  const today = todayLocal();
  const then = todayLocal(d);
  return Math.round((Date.parse(today) - Date.parse(then)) / 86_400_000);
}
