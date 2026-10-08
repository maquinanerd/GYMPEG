// Reads a Server-Sent Events body line by line and yields the text deltas that
// `extract` pulls out of each line. Lines can be split across network chunks,
// so the trailing partial line is buffered until the next chunk (or the end).
export async function* readSseDeltas(
  body: ReadableStream<Uint8Array>,
  extract: (line: string) => string | null,
): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const delta = extract(line);
      if (delta) yield delta;
    }
  }
  buffer += decoder.decode();
  const tail = extract(buffer);
  if (tail) yield tail;
}
