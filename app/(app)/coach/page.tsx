import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { getLlmProvider } from '@/lib/llm';
import { buildCoachPayload } from '@/lib/coach';
import { summarizeCoachPayload } from '@/lib/coach-context';
import {
  CoachClient,
  type ProgramExerciseDefaults,
} from '@/components/coach/coach-client';
import {
  ChatClient,
  type ChatMessage,
  type ConversationSummary,
} from '@/components/coach/chat-client';
import { CoachContextCard } from '@/components/coach/coach-context-card';
import { CoachNoteCard } from '@/components/coach/coach-note-card';
import { SegmentedLinks } from '@/components/ui/segmented';
import { SparkleIcon } from '@/components/ui/icon';
import { getRuntimeEnv } from '@/lib/runtime-env';

interface SearchParams {
  tab?: string;
  sessionId?: string;
}

// The coach is one section with two tabs: Conversa (the chat, the default and
// where the session runner sends a live workout) and Análises (the weekly
// debriefs). /chat redirects here.
export default async function CoachPage(props: { searchParams: Promise<SearchParams> }) {
  const t = await getTranslations('coach');
  const searchParams = await props.searchParams;
  const auth = await requireSession();
  const provider = getLlmProvider(await getRuntimeEnv());
  // A live session always opens the conversation.
  const tab = searchParams.tab === 'analyses' && !searchParams.sessionId ? 'analyses' : 'chat';

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-ai">
            <SparkleIcon className="size-5" />
          </span>
          <div>
            <h1 className="text-title">{t('title')}</h1>
            <p className="text-caption text-muted-foreground">
              {tab === 'chat' ? t('chatDescription') : t('description')}
            </p>
          </div>
        </div>

        <SegmentedLinks
          label={t('tabs.label')}
          items={[
            { href: '/coach', label: t('tabs.conversation'), active: tab === 'chat' },
            {
              href: '/coach?tab=analyses',
              label: t('tabs.analyses'),
              active: tab === 'analyses',
            },
          ]}
        />

        {tab === 'chat' ? (
          <CoachConversation
            userId={auth.userId}
            requestedSessionId={searchParams.sessionId ?? null}
            fallbackTitle={t('conversation')}
            provider={provider}
          />
        ) : (
          <CoachAnalyses userId={auth.userId} provider={provider} />
        )}
      </div>
    </main>
  );
}

type Provider = ReturnType<typeof getLlmProvider>;

async function CoachConversation({
  userId,
  requestedSessionId,
  fallbackTitle,
  provider,
}: {
  userId: string;
  requestedSessionId: string | null;
  fallbackTitle: string;
  provider: Provider;
}) {
  // In-session chat (issue #111): the session runner links here with
  // ?sessionId=... . Only forward an id that belongs to the caller; anything
  // else degrades to a normal chat (the API re-checks ownership anyway).
  let sessionId: string | null = null;
  if (requestedSessionId) {
    const owned = await db.session.findFirst({
      where: { id: requestedSessionId, userId },
      select: { id: true },
    });
    sessionId = owned?.id ?? null;
  }

  const conversations = await db.conversation.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: { id: true, title: true, updatedAt: true },
  });

  // With a live session attached, start on a fresh conversation so the
  // mid-workout question is not appended to an old thread.
  const active = sessionId ? null : (conversations[0] ?? null);
  let initialMessages: ChatMessage[] = [];
  if (active) {
    const msgs = await db.message.findMany({
      where: { conversationId: active.id },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    });
    initialMessages = msgs.map((m) => ({
      role: m.role === 'ASSISTANT' ? 'assistant' : 'user',
      content: m.content,
    }));
  }

  const initialConversations: ConversationSummary[] = conversations.map((c) => ({
    id: c.id,
    title: c.title ?? fallbackTitle,
    updatedAt: c.updatedAt.toISOString(),
  }));

  return (
    <ChatClient
      initialConversations={initialConversations}
      initialActiveId={active?.id ?? null}
      initialMessages={initialMessages}
      sessionId={sessionId}
      hasApiKey={provider.isConfigured()}
      providerLabel={provider.label}
      apiKeyEnvVar={provider.apiKeyEnvVar}
    />
  );
}

async function CoachAnalyses({ userId, provider }: { userId: string; provider: Provider }) {
  const [history, activeProgram, coachPayload] = await Promise.all([
    db.coachSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        weekStart: true,
        weekEnd: true,
        response: true,
        appliedAt: true,
        createdAt: true,
      },
    }),
    db.program.findFirst({
      where: { userId, isActive: true },
      include: {
        workouts: {
          include: {
            exercises: {
              include: { exercise: { select: { name: true } } },
            },
          },
        },
      },
    }),
    // "What your coach sees" (issue #154): the SAME builder the debrief and
    // chat routes use, so the card cannot drift from the payload the AI gets.
    buildCoachPayload(userId),
  ]);

  const coachContext = summarizeCoachPayload(coachPayload);

  // Map exerciseName -> current program values (to pre-fill adjustments when
  // the coach does not provide an explicit value).
  const programDefaults: Record<string, ProgramExerciseDefaults> = {};
  if (activeProgram) {
    for (const w of activeProgram.workouts) {
      for (const pe of w.exercises) {
        const key = pe.exercise.name;
        if (programDefaults[key]) continue;
        programDefaults[key] = {
          targetRepsMin: pe.targetRepsMin,
          targetRepsMax: pe.targetRepsMax,
          targetSets: pe.targetSets,
          targetRIR: pe.targetRIR,
          restSec: pe.restSec,
        };
      }
    }
  }

  // Pre-serialize the dates for the client component.
  const initialHistory = history.map((h) => ({
    id: h.id,
    weekStart: h.weekStart.toISOString(),
    weekEnd: h.weekEnd.toISOString(),
    response: h.response,
    appliedAt: h.appliedAt?.toISOString() ?? null,
    createdAt: h.createdAt.toISOString(),
  }));

  return (
    <>
      <CoachContextCard summary={coachContext} />

      <CoachNoteCard initialNote={coachPayload.userProfile.coachNote} />

      <CoachClient
        initialHistory={initialHistory}
        hasApiKey={provider.isConfigured()}
        providerLabel={provider.label}
        apiKeyEnvVar={provider.apiKeyEnvVar}
        programDefaults={programDefaults}
      />
    </>
  );
}
