import ReactMarkdown, { type Components } from 'react-markdown';

// The AI's headings stay inside its text: a bold line, not a page heading, so
// the screen outline is the app's own.
function Heading({ children }: { children?: React.ReactNode }) {
  return <p className="font-semibold">{children}</p>;
}

const COMPONENTS: Components = {
  h1: Heading,
  h2: Heading,
  h3: Heading,
  h4: Heading,
  h5: Heading,
  h6: Heading,
};

// Markdown written by the coach. Inherits the italic and size of CoachText;
// only spacing and lists are styled here (no prose theme, no extra colors).
export function CoachMarkdown({ children }: { children: string }) {
  return (
    <div className="flex flex-col gap-2 [&_a]:underline [&_a]:underline-offset-4 [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown components={COMPONENTS}>{children}</ReactMarkdown>
    </div>
  );
}
