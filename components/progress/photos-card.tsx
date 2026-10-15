'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CaretDownIcon, PlusIcon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetTitle,
} from '@/components/ui/bottom-sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Section } from '@/components/ui/section';

// One progress photo, as serialized at the Server Component boundary. The
// bytes are only reachable through the ownership-scoped image route.
export interface ProgressPhotoView {
  id: string;
  takenAt: string; // ISO
  note: string | null;
}

interface Props {
  // The user's photos, newest first.
  photos: ProgressPhotoView[];
}

// Formatted in the active UI locale but in the browser's own time zone, as
// before: a photo's day must not shift with the server zone.
function formatDate(iso: string, locale: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale, options).format(new Date(iso));
}
const SHORT: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' };
const LONG: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };

function imageUrl(id: string) {
  return `/api/progress-photos/${id}/image`;
}

const SELECT =
  'flex h-12 w-full rounded-md border border-input bg-card px-3.5 text-caption font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

// Progress photos (issue #269, Corpo tab): a 3-column grid of 3:4 thumbnails
// (radius 8) with their date and a dashed "Adicionar" tile that opens the
// upload sheet. A thumbnail opens the photo with its note and delete; two or
// more photos can be compared side by side. Photos stay private: stored on
// the server, served only to their owner through the image route.
export function PhotosCard({ photos }: Props) {
  const t = useTranslations('progress.photos');
  const router = useRouter();
  const locale = useLocale();
  const fileRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<ProgressPhotoView | null>(null);
  const [note, setNote] = useState('');
  const [takenAt, setTakenAt] = useState('');
  const [busy, setBusy] = useState(false);
  // Before/after compare: ids of the two selected photos. Defaults pick the
  // oldest and newest so one click shows the widest span.
  const [beforeId, setBeforeId] = useState('');
  const [afterId, setAfterId] = useState('');

  const short = (iso: string) => formatDate(iso, locale, SHORT);
  const long = (iso: string) => formatDate(iso, locale, LONG);
  const oldest = photos[photos.length - 1];
  const newest = photos[0];
  const before = photos.find((p) => p.id === (beforeId || oldest?.id));
  const after = photos.find((p) => p.id === (afterId || newest?.id));

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error(t('chooseFirst'));
      return;
    }
    setBusy(true);
    try {
      const params = new URLSearchParams();
      if (takenAt) {
        params.set('takenAt', new Date(`${takenAt}T12:00:00`).toISOString());
      }
      if (note.trim()) params.set('note', note.trim());
      const queryString = params.toString();
      const query = queryString ? `?${queryString}` : '';
      // Raw bytes as the body (not multipart): the server caps the size while
      // reading and decides the real type from the magic bytes.
      const res = await fetch(`/api/progress-photos${query}`, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? t('uploadError'));
        return;
      }
      toast.success(t('uploaded'));
      setNote('');
      setTakenAt('');
      if (fileRef.current) fileRef.current.value = '';
      setAdding(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deletePhoto(photo: ProgressPhotoView) {
    if (!confirm(t('deleteConfirm', { date: long(photo.takenAt) }))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/progress-photos/${photo.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? t('deleteError'));
        return;
      }
      toast.success(t('deleted'));
      setViewing(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section size="sm" divider title={t('title')} aside={t('private')}>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setViewing(p)}
              aria-label={t('open', { date: long(p.takenAt) })}
              className="relative block aspect-[3/4] w-full overflow-hidden rounded-sm bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl(p.id)}
                alt=""
                className="absolute inset-0 size-full object-cover"
                loading="lazy"
              />
              <span className="absolute bottom-1.5 left-1.5 rounded-xs bg-card px-1.5 py-0.5 text-small font-semibold text-card-foreground">
                {short(p.takenAt)}
              </span>
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-1 rounded-sm border-[1.5px] border-dashed border-subtle text-[0.8125rem] font-semibold transition-colors duration-[120ms] ease-out-quart hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <PlusIcon aria-hidden className="size-[18px]" />
            {t('add')}
          </button>
        </li>
      </ul>
      {photos.length === 0 && (
        <p className="text-caption text-muted-foreground text-pretty">{t('empty')}</p>
      )}

      {/* Before/after side-by-side compare */}
      {photos.length >= 2 && (
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xs text-caption font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            {t('compare')}
            <CaretDownIcon
              aria-hidden
              className="size-4 text-subtle transition-transform duration-[120ms] ease-out-quart group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <div className="grid grid-cols-2 gap-3 pt-2">
            {(
              [
                { key: 'before', photo: before, value: beforeId || oldest?.id || '', set: setBeforeId },
                { key: 'after', photo: after, value: afterId || newest?.id || '', set: setAfterId },
              ] as const
            ).map(({ key, photo, value, set }) => (
              <div key={key} className="flex flex-col gap-2">
                <Label htmlFor={`progress-photo-${key}`}>{t(key)}</Label>
                <select
                  id={`progress-photo-${key}`}
                  className={SELECT}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                >
                  {photos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {long(p.takenAt)}
                      {p.note ? ` - ${p.note}` : ''}
                    </option>
                  ))}
                </select>
                {photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl(photo.id)}
                    alt={t('compareAlt', { label: t(key), date: long(photo.takenAt) })}
                    className="w-full rounded-sm object-contain"
                  />
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Upload: photo file + optional date and note */}
      <BottomSheet open={adding} onOpenChange={setAdding}>
        <BottomSheetContent>
          <BottomSheetTitle>{t('sheetTitle')}</BottomSheetTitle>
          <BottomSheetDescription>{t('private')}</BottomSheetDescription>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void upload();
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="progress-photo-file">{t('file')}</Label>
              <Input
                id="progress-photo-file"
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="pt-3"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="progress-photo-date">{t('date')}</Label>
              <Input
                id="progress-photo-date"
                type="date"
                value={takenAt}
                onChange={(e) => setTakenAt(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="progress-photo-note">{t('note')}</Label>
              <Input
                id="progress-photo-note"
                value={note}
                maxLength={500}
                placeholder={t('notePlaceholder')}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <Button type="submit" variant="ink" loading={busy}>
              {busy ? t('uploading') : t('upload')}
            </Button>
          </form>
        </BottomSheetContent>
      </BottomSheet>

      {/* One photo, large, with its note and delete */}
      <Dialog open={viewing != null} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent>
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="text-heading">{long(viewing.takenAt)}</DialogTitle>
              </DialogHeader>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl(viewing.id)}
                alt={t('alt', { date: long(viewing.takenAt) })}
                className="max-h-[60vh] w-full rounded-sm object-contain"
              />
              {viewing.note && <p className="text-caption">{viewing.note}</p>}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                aria-label={t('deleteAria', { date: long(viewing.takenAt) })}
                onClick={() => void deletePhoto(viewing)}
                disabled={busy}
              >
                {t('delete')}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Section>
  );
}
