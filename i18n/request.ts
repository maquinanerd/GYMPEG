import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { localeCookieName, resolveLocale } from './config';
import { loadMessages } from './messages';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  // No cookie (or an unrecognized one) falls back to the default locale; a
  // loosely formatted tag such as "pt" or "pt_BR" still resolves to pt-BR.
  const locale = resolveLocale(cookieStore.get(localeCookieName)?.value);

  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
});
