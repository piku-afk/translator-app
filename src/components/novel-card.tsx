import type { Novel } from "#/lib/mock-data";

export function NovelCard({ novel }: { novel: Novel }) {
  return (
    <article className="border rounded-md border-border p-4 hover:bg-card hover:border-black transition-colors cursor-pointer focus:outline-ring focus-visible:outline-2 focus-visible:outline-ring">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-medium text-foreground line-clamp-2">{novel.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{novel.languagePair}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Active</span>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-foreground">
            {novel.currentChapter} / {novel.totalChapters} chapters
          </p>
          <p className="text-xs text-muted-foreground">{novel.lastUpdated}</p>
        </div>
      </div>
    </article>
  );
}
