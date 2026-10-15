'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PaperclipIcon, PaperPlaneRightIcon, PlusIcon } from '@/components/ui/icon';
import { IconButton, Spinner } from '@/components/ui/button';
import { ChipRow, FilterChip } from '@/components/ui/chip';
import { CoachText } from '@/components/ui/coach-text';
import { ErrorState, OfflineNotice } from '@/components/ui/screen-state';
import { Tag } from '@/components/ui/tag';
import { Textarea } from '@/components/ui/textarea';
import { useOnline } from '@/components/auth/use-online';
import { CoachMarkdown } from './coach-markdown';
import { KeyMissingNotice } from './key-missing-notice';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

interface Props {
  initialConversations: ConversationSummary[];
  initialActiveId: string | null;
  initialMessages: ChatMessage[];
  // Live session attached from the session runner (issue #111), or null for a
  // normal chat. Sent with each message so the coach sees the workout so far.
  sessionId?: string | null;
  hasApiKey: boolean;
  providerLabel: string;
  apiKeyEnvVar: string;
}

const SUGGESTIONS = ['plateau', 'deload', 'swap'] as const;
const SESSION_SUGGESTIONS = ['load', 'swap', 'rest'] as const;

// What failed last: a message the coach did not answer (resent by "Tentar de
// novo") or a conversation that did not load (reopened).
type Failure = { kind: 'send'; text: string } | { kind: 'load'; id: string };

export function ChatClient({
  initialConversations,
  initialActiveId,
  initialMessages,
  sessionId = null,
  hasApiKey,
  providerLabel,
  apiKeyEnvVar,
}: Props) {
  const t = useTranslations('coach');
  const online = useOnline();
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(initialActiveId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Keep the latest turn in view (the composer is docked over the bottom).
  useEffect(() => {
    if (messages.length === 0) return;
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages]);

  const canSend = hasApiKey && online && !streaming;

  function appendToAssistant(chunk: string) {
    setMessages((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (last && last.role === 'assistant') {
        copy[copy.length - 1] = { ...last, content: last.content + chunk };
      }
      return copy;
    });
  }

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || !canSend) return;

    setInput('');
    setFailure(null);
    setStreaming(true);
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text },
      { role: 'assistant', content: '' },
    ]);

    try {
      const res = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeId ?? undefined,
          message: text,
          sessionId: sessionId ?? undefined,
        }),
      });

      if (!res.ok || !res.body) throw new Error(String(res.status));

      const newId = res.headers.get('X-Conversation-Id');
      if (newId && newId !== activeId) {
        setActiveId(newId);
        if (!conversations.some((c) => c.id === newId)) {
          setConversations((prev) => [
            { id: newId, title: text.slice(0, 60), updatedAt: new Date().toISOString() },
            ...prev,
          ]);
        }
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        appendToAssistant(decoder.decode(value, { stream: true }));
      }
    } catch {
      // Drop the unanswered turn: "Tentar de novo" sends it again.
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        const trimmed = last?.role === 'assistant' && last.content === '' ? prev.slice(0, -1) : prev;
        const user = trimmed[trimmed.length - 1];
        return user?.role === 'user' && user.content === text ? trimmed.slice(0, -1) : trimmed;
      });
      setFailure({ kind: 'send', text });
    } finally {
      setStreaming(false);
    }
  }

  async function openConversation(id: string) {
    if (streaming) return;
    setActiveId(id);
    setFailure(null);
    try {
      const res = await fetch(`/api/coach/chat/${id}`);
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json()) as {
        messages: { role: 'USER' | 'ASSISTANT'; content: string }[];
      };
      setMessages(
        j.messages.map((m) => ({
          role: m.role === 'ASSISTANT' ? 'assistant' : 'user',
          content: m.content,
        })),
      );
    } catch {
      setMessages([]);
      setFailure({ kind: 'load', id });
    }
  }

  function newConversation() {
    if (streaming) return;
    setActiveId(null);
    setMessages([]);
    setFailure(null);
  }

  function pickSuggestion(text: string) {
    setInput(text);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  const suggestions = sessionId
    ? SESSION_SUGGESTIONS.map((key) => t(`chat.sessionSuggestions.${key}`))
    : SUGGESTIONS.map((key) => t(`chat.suggestions.${key}`));

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-[18px] px-5 pb-3 pt-[18px]">
        {!hasApiKey && (
          <KeyMissingNotice
            title={t('client.keyMissing', { provider: providerLabel })}
            hint={t('chat.apiKey', { variable: apiKeyEnvVar })}
          />
        )}
        {!online && <OfflineNotice>{t('offline')}</OfflineNotice>}

        {conversations.length > 0 && (
          <ChipRow role="group" aria-label={t('chat.conversations')}>
            <FilterChip onClick={newConversation} disabled={streaming} aria-pressed={undefined}>
              <PlusIcon />
              {t('chat.new')}
            </FilterChip>
            {conversations.map((c) => (
              <FilterChip
                key={c.id}
                selected={c.id === activeId}
                onClick={() => openConversation(c.id)}
                disabled={streaming}
                className="max-w-[16rem]"
              >
                <span className="truncate">{c.title}</span>
              </FilterChip>
            ))}
          </ChipRow>
        )}

        <ol className="flex flex-col gap-[18px]" aria-busy={streaming || undefined}>
          {messages.length === 0 && failure?.kind !== 'load' ? (
            <li className="max-w-[92%]">
              <CoachText>{sessionId ? t('chat.emptySession') : t('chat.empty')}</CoachText>
            </li>
          ) : (
            messages.map((m, i) =>
              m.role === 'assistant' ? (
                <li key={i} className="max-w-[92%]">
                  <CoachText>
                    {m.content === '' && streaming ? (
                      <span className="text-muted-foreground">{t('chat.thinking')}</span>
                    ) : (
                      <CoachMarkdown>{m.content}</CoachMarkdown>
                    )}
                  </CoachText>
                </li>
              ) : (
                <li
                  key={i}
                  className="max-w-[80%] self-end whitespace-pre-wrap rounded-[12px_12px_4px_12px] bg-ink px-3.5 py-2.5 text-body leading-[1.4] text-ink-foreground"
                >
                  {m.content}
                </li>
              ),
            )
          )}
        </ol>

        {failure && (
          <ErrorState
            className="py-0"
            message={failure.kind === 'send' ? t('chat.error') : t('chat.loadError')}
            onRetry={() =>
              failure.kind === 'send' ? void send(failure.text) : void openConversation(failure.id)
            }
          />
        )}

        {/* The chat has no write path. Say so in the UI as well as in the
            system prompt, so a trainee who asks for a program change does not
            leave believing it was applied. */}
        <p className="text-small text-muted-foreground">{t('chat.advisory')}</p>
        <div ref={endRef} />
      </div>

      {/* Docked right above the tab bar (65px + the safe area), on top of the
          page content while the thread scrolls under it. */}
      <div className="sticky bottom-[calc(4.0625rem+env(safe-area-inset-bottom))] z-20 -mb-[0.4375rem] border-t border-border bg-card">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2.5 px-5 pb-3 pt-2">
          <ChipRow role="group" aria-label={t('chat.suggestionsLabel')}>
            {suggestions.map((text) => (
              <FilterChip
                key={text}
                aria-pressed={undefined}
                onClick={() => pickSuggestion(text)}
                disabled={!canSend}
                className="h-9 px-3 font-medium"
              >
                {text}
              </FilterChip>
            ))}
          </ChipRow>

          {sessionId && (
            <Tag icon={PaperclipIcon}>
              {t('chat.liveSession')}
              <span className="sr-only"> {t('chat.liveSessionDescription')}</span>
            </Tag>
          )}

          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <label htmlFor="coach-message" className="sr-only">
              {t('chat.messageLabel')}
            </label>
            <Textarea
              id="coach-message"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder={t('chat.placeholder')}
              disabled={!hasApiKey || streaming}
              className="max-h-40 resize-none [field-sizing:content] focus-visible:ring-offset-0"
            />
            <IconButton
              type="submit"
              aria-label={t('chat.send')}
              disabled={!canSend || input.trim() === ''}
              className="rounded-md bg-ink text-ink-foreground hover:bg-ink hover:brightness-[.96] [&_svg]:size-5"
            >
              {streaming ? <Spinner /> : <PaperPlaneRightIcon />}
            </IconButton>
          </form>
        </div>
      </div>
    </div>
  );
}
