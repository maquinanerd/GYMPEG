import { redirect } from 'next/navigation';

// The chat is the Conversa tab of /coach. Old links (and bookmarks) keep
// working, a live session included.
export default async function ChatPage(props: { searchParams: Promise<{ sessionId?: string }> }) {
  const { sessionId } = await props.searchParams;
  redirect(sessionId ? `/coach?sessionId=${encodeURIComponent(sessionId)}` : '/coach');
}
