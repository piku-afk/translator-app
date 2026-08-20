<script lang="ts">
interface Novel {
  id: number;
  title: string;
  languagePair: string;
  progress: number;
  totalChapters: number;
  currentChapter: number;
  lastUpdated: string;
  initial: string;
}

let { novel }: { novel: Novel } = $props();
</script>

<article class="border rounded-md border-border p-4 hover:bg-card hover:border-black transition-colors cursor-pointer focus:outline-ring focus-visible:outline-2 focus-visible:outline-ring">
  <div class="flex items-start gap-3">
    <div class="flex-1 min-w-0">
      <h3 class="text-lg font-medium text-foreground line-clamp-2">
        {novel.title}
      </h3>
      <p class="mt-1 text-sm text-muted-foreground line-clamp-1">
        {novel.languagePair}
      </p>
    </div>
  </div>

  <div class="mt-3 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <span class="text-xs text-muted-foreground">Active</span>
    </div>
    <div class="text-right">
      <p class="text-sm font-medium text-foreground">
        {novel.currentChapter} / {novel.totalChapters} chapters
      </p>
      <p class="text-xs text-muted-foreground">{novel.lastUpdated}</p>
    </div>
  </div>
</article>
