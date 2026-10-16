'use client';

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { CopyIcon, TrashIcon } from '@/components/ui/icon';
import { toast } from 'sonner';
import { Button, IconButton, Spinner } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

export interface McpTokenSummary {
  id: string;
  name: string;
  tokenPrefix: string;
  canWrite: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

interface Props {
  initialTokens: McpTokenSummary[];
}

export function McpSection({ initialTokens }: Props) {
  const t = useTranslations('settings.mcp');
  const format = useFormatter();
  const [tokens, setTokens] = useState(initialTokens);
  const [name, setName] = useState('ChatGPT');
  // Least privilege: new connections start read-only; the user opts in to write.
  const [canWrite, setCanWrite] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [connectorUrl, setConnectorUrl] = useState<string | null>(null);

  async function createToken() {
    setCreating(true);
    try {
      const res = await fetch('/api/mcp-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, canWrite }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        token?: McpTokenSummary;
        connectorUrl?: string;
      };
      if (!res.ok || !body.token || !body.connectorUrl) {
        throw new Error(body.error ?? t('createError'));
      }
      setTokens((current) => [body.token!, ...current]);
      setConnectorUrl(body.connectorUrl);
      toast.success(t('created'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('createError'));
    } finally {
      setCreating(false);
    }
  }

  async function revokeToken(id: string) {
    setRevokingId(id);
    try {
      const res = await fetch(`/api/mcp-tokens/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(t('revokeError'));
      setTokens((current) => current.filter((token) => token.id !== id));
      toast.success(t('revoked'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('revokeError'));
    } finally {
      setRevokingId(null);
    }
  }

  async function copyConnectorUrl() {
    if (!connectorUrl) return;
    await navigator.clipboard.writeText(connectorUrl);
    toast.success(t('copied'));
  }

  return (
    <>
      <section className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-caption font-semibold">{t('keyName')}</span>
          <Input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
        </label>

        <label className="flex items-center justify-between gap-4 border-y border-border py-3">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-body font-semibold">{t('writeAccess')}</span>
            <span className="text-[0.8125rem] font-medium text-muted-foreground text-pretty">
              {t('writeAccessDescription')}
            </span>
          </span>
          <Switch checked={canWrite} onCheckedChange={setCanWrite} />
        </label>

        <Button
          type="button"
          variant="ink"
          onClick={createToken}
          loading={creating}
          disabled={creating || name.trim().length === 0}
          className="w-full sm:w-auto sm:self-start"
        >
          {t('create')}
        </Button>

        {connectorUrl && (
          <div role="status" className="flex flex-col gap-2 rounded-sm bg-accent px-3.5 py-3 text-accent-foreground">
            <p className="text-caption font-semibold">{t('readyTitle')}</p>
            <p className="text-[0.8125rem] font-medium">{t('readyDescription')}</p>
            <div className="flex gap-2">
              <Input
                value={connectorUrl}
                readOnly
                aria-label={t('readyTitle')}
                className="min-w-0 font-mono text-caption"
              />
              <IconButton
                type="button"
                tone="outline"
                onClick={copyConnectorUrl}
                aria-label={t('copy')}
                className="bg-card"
              >
                <CopyIcon />
              </IconButton>
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col">
        <h2 className="mb-1 text-subtitle">{t('activeKeys')}</h2>
        {tokens.length === 0 ? (
          <p className="border-t border-border py-3 text-caption text-muted-foreground">
            {t('noKeys')}
          </p>
        ) : (
          <ul>
            {tokens.map((token) => (
              <li
                key={token.id}
                className="flex items-center justify-between gap-3 border-t border-border py-3"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="truncate text-body font-semibold">{token.name}</p>
                  <p className="font-mono text-small text-muted-foreground">{token.tokenPrefix}</p>
                  <p className="text-[0.8125rem] font-medium text-muted-foreground">
                    {token.canWrite ? t('readWrite') : t('readOnly')}
                    {token.lastUsedAt
                      ? ` · ${t('lastUsed', {
                          date: format.dateTime(new Date(token.lastUsedAt), {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          }),
                        })}`
                      : ''}
                  </p>
                </div>
                <IconButton
                  type="button"
                  onClick={() => revokeToken(token.id)}
                  disabled={revokingId === token.id}
                  aria-label={t('revoke')}
                  className="text-destructive-text"
                >
                  {revokingId === token.id ? <Spinner /> : <TrashIcon />}
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
