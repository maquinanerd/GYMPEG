'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { SettingsHeading } from './settings-ui';

export function BackupSection() {
  const t = useTranslations('settings.backup');
  const common = useTranslations('common');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmingFile, setConfirmingFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch('/api/backup');
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gympeg-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t('exportDone'));
    } catch {
      toast.error(t('exportError'));
    } finally {
      setExporting(false);
    }
  }

  function pickFile() {
    fileRef.current?.click();
  }

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (file) setConfirmingFile(file);
  }

  async function confirmImport() {
    if (!confirmingFile) return;
    setImporting(true);
    try {
      const text = await confirmingFile.text();
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error(t('invalidJson'));
      }
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload, confirmReplace: true }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      toast.success(t('importDone'));
      setConfirmingFile(null);
      // Refresh the page to start from a clean state.
      setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('importError'));
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-6">
      <SettingsHeading description={t('description')}>{t('title')}</SettingsHeading>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" onClick={handleExport} loading={exporting} disabled={exporting}>
          {t('export')}
        </Button>
        <Button variant="outline" onClick={pickFile} disabled={importing}>
          {t('import')}
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={onFilePicked}
      />

      {confirmingFile && (
        <div role="alert" className="flex flex-col gap-2 rounded-sm bg-warning px-3.5 py-3 text-warning-foreground">
          <p className="text-caption font-semibold">{t('confirmTitle')}</p>
          <p className="text-[0.8125rem] font-medium">
            {t('confirmDescription', { file: confirmingFile.name })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="ink"
              size="sm"
              className="h-11"
              onClick={confirmImport}
              loading={importing}
              disabled={importing}
            >
              {t('replace')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-11 hover:bg-transparent hover:underline"
              onClick={() => setConfirmingFile(null)}
              disabled={importing}
            >
              {common('actions.cancel')}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
