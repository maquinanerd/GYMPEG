// Instance without an AI key (self-hosting): what is missing and where to set
// it. A muted note on the page, like the offline one.
export function KeyMissingNotice({ title, hint }: { title: string; hint: string }) {
  return (
    <div role="status" className="flex flex-col gap-0.5 rounded-sm bg-muted px-3.5 py-3">
      <p className="text-caption font-semibold">{title}</p>
      <p className="text-caption text-muted-foreground">{hint}</p>
    </div>
  );
}
