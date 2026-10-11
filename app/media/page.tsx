export default function MediaPage() {
  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-ink">Media</h1>
        <a
          href="https://media.erendirasboutique.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-sand bg-cream px-3 py-1.5 text-sm text-taupe hover:bg-sand/40"
        >
          Open in new tab ↗
        </a>
      </div>
      <iframe
        src="https://media.erendirasboutique.com/"
        title="Media uploads"
        allow="clipboard-write"
        className="w-full flex-1 rounded-xl border border-sand bg-cream"
      />
    </div>
  );
}
