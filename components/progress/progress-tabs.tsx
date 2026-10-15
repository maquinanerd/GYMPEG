'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Tabs } from '@/components/ui/tabs';
import { OfflineNotice } from '@/components/ui/screen-state';
import { PROGRESS_TABS, type ProgressTab } from '@/components/progress/progress-tab-keys';

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

// Evolução's underlined tabs (Semana · Treino · Corpo · Recordes). The four
// panels are rendered on the server and switched here without a round trip;
// the choice is kept in ?tab= (replaceState) so a reload lands on it. Offline,
// a note says the numbers are the last loaded ones and logging needs the
// network.
export function ProgressTabs({
  initialTab,
  panels,
}: {
  initialTab: ProgressTab;
  panels: Record<ProgressTab, React.ReactNode>;
}) {
  const t = useTranslations('progress');
  const [tab, setTab] = useState<ProgressTab>(initialTab);
  const online = useOnline();

  function change(next: ProgressTab) {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === 'week') url.searchParams.delete('tab');
    else url.searchParams.set('tab', next);
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  return (
    <>
      <Tabs
        label={t('tabs.label')}
        idPrefix="progress"
        value={tab}
        onChange={change}
        options={PROGRESS_TABS.map((value) => ({ value, label: t(`tabs.${value}`) }))}
      />
      {!online && <OfflineNotice className="mx-5 mt-4">{t('offline')}</OfflineNotice>}
      {PROGRESS_TABS.map((value) => (
        <div
          key={value}
          role="tabpanel"
          id={`progress-panel-${value}`}
          aria-labelledby={`progress-tab-${value}`}
          hidden={value !== tab}
          tabIndex={0}
          className="px-5 pb-7 pt-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {panels[value]}
        </div>
      ))}
    </>
  );
}
