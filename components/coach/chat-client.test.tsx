import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ChatClient } from './chat-client';

const base = {
  initialConversations: [],
  initialActiveId: null,
  initialMessages: [],
  hasApiKey: true,
  providerLabel: 'Gemini',
  apiKeyEnvVar: 'GEMINI_API_KEY',
};

beforeAll(() => {
  // jsdom has no layout: the thread keeps the last turn in view with this.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => vi.unstubAllGlobals());

function streamResponse(text: string, conversationId = 'conv-1') {
  return new Response(text, {
    status: 200,
    headers: { 'X-Conversation-Id': conversationId },
  });
}

describe('ChatClient', () => {
  it('greets in the coach voice and offers suggestions that fill the composer', async () => {
    const user = userEvent.setup();
    render(<ChatClient {...base} />);

    expect(screen.getByText('Coach')).toBeInTheDocument();
    expect(screen.getByText(/Ask about breaking a plateau/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Should I take a deload?' }));
    expect(screen.getByLabelText('Message to the coach')).toHaveValue('Should I take a deload?');
  });

  it('shows the attached live session above the composer', () => {
    render(<ChatClient {...base} sessionId="session-1" />);
    expect(screen.getByText('Live session attached.')).toBeInTheDocument();
  });

  it('streams the answer under the lifter’s message', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => streamResponse('Keep the load and add a rep.'));
    vi.stubGlobal('fetch', fetchMock);
    render(<ChatClient {...base} />);

    await user.type(screen.getByLabelText('Message to the coach'), 'Next set?');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Keep the load and add a rep.')).toBeInTheDocument();
    // The lifter's bubble in the thread (the new conversation's chip says it too).
    expect(screen.getByText('Next set?', { selector: 'li' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/coach/chat',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('says when the coach did not answer and sends the message again on retry', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 502 }))
      .mockResolvedValueOnce(streamResponse('Take a deload week.'));
    vi.stubGlobal('fetch', fetchMock);
    render(<ChatClient {...base} />);

    await user.type(screen.getByLabelText('Message to the coach'), 'Deload?');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The coach did not answer.');
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Take a deload week.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // The failed turn was dropped, not duplicated.
    expect(screen.getAllByText('Deload?', { selector: 'li' })).toHaveLength(1);
  });

  it('does not let a lifter without an AI key send anything', () => {
    render(<ChatClient {...base} hasApiKey={false} />);
    expect(screen.getByText('Gemini key missing')).toBeInTheDocument();
    expect(screen.getByLabelText('Message to the coach')).toBeDisabled();
  });

  it('reopens an earlier conversation from its chip', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ messages: [{ role: 'ASSISTANT', content: 'Earlier answer.' }] }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(
      <ChatClient
        {...base}
        initialConversations={[
          { id: 'c1', title: 'Bench plateau', updatedAt: '2026-10-01T10:00:00.000Z' },
        ]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Bench plateau' }));
    await waitFor(() => expect(screen.getByText('Earlier answer.')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith('/api/coach/chat/c1');
  });
});
