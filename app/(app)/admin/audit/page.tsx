import { getFormatter, getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AUDIT_ACTIONS, requireAdminPage, type AuditAction } from '@/lib/admin';
import { listAuditLog, type AuditRow } from '@/lib/admin-stats';

const LIMIT = 100;

function isAuditAction(action: string): action is AuditAction {
  return (AUDIT_ACTIONS as readonly string[]).includes(action);
}

function valueOf(json: unknown, field: string): string | null {
  if (json && typeof json === 'object' && field in json) {
    const value = (json as Record<string, unknown>)[field];
    return value === null || value === undefined ? null : String(value);
  }
  return null;
}

// Audit: the last admin actions, newest first (who, what, on which account
// or setting). Passwords and keys are never recorded, so never shown.
export default async function AdminAuditPage() {
  await requireAdminPage();
  const [t, format, rows] = await Promise.all([
    getTranslations('admin.audit'),
    getFormatter(),
    listAuditLog(LIMIT),
  ]);

  function target(row: AuditRow): string {
    if (row.entity === 'User') return row.targetEmail ?? t('erasedAccount');
    return row.entityId;
  }

  function detail(row: AuditRow): string | null {
    const empty = t('empty');
    switch (row.action) {
      case 'SETTING_UPDATE':
        return t('changed', {
          from: valueOf(row.oldValue, 'value') ?? empty,
          to: valueOf(row.newValue, 'value') ?? empty,
        });
      case 'ADMIN_SET_ROLE':
        return t('changed', {
          from: valueOf(row.oldValue, 'role') ?? empty,
          to: valueOf(row.newValue, 'role') ?? empty,
        });
      case 'ADMIN_SET_PASSWORD':
      case 'ADMIN_BLOCK_USER': {
        const count = Number(valueOf(row.newValue, 'signedOutSessions') ?? 0);
        return t('signedOut', { count });
      }
      default:
        return null;
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <h2 className="text-base font-semibold">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('description', { limit: LIMIT })}</p>
      </CardHeader>
      <CardContent className="py-1">
        {rows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">{t('none')}</p>
        ) : (
          <ol>
            {rows.map((row) => {
              const extra = detail(row);
              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-0.5 border-b border-border py-3 last:border-b-0"
                >
                  <span className="text-body">
                    {isAuditAction(row.action) ? t(`actions.${row.action}`) : row.action}
                    {' · '}
                    <span className="break-all">{target(row)}</span>
                  </span>
                  <span className="text-small text-muted-foreground">
                    {t('by', {
                      actor: row.actorEmail ?? t('erasedAccount'),
                      date: format.dateTime(new Date(row.createdAt), {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      }),
                    })}
                    {extra ? ` · ${extra}` : ''}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
