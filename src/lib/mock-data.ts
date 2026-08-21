export interface Novel {
  id: number;
  title: string;
  languagePair: string;
  progress: number;
  totalChapters: number;
  currentChapter: number;
  lastUpdated: string;
  initial: string;
}

export interface ActivityItem {
  text: string;
  time: string;
  color: string;
}

// Mock data for the homepage prototype
export const novels: Novel[] = [
  {
    id: 1,
    title: "The Beginning",
    languagePair: "Korean → English",
    progress: 82,
    totalChapters: 120,
    currentChapter: 98,
    lastUpdated: "4 min ago",
    initial: "T",
  },
  {
    id: 2,
    title: "Another World",
    languagePair: "Japanese → English",
    progress: 34,
    totalChapters: 62,
    currentChapter: 21,
    lastUpdated: "yesterday",
    initial: "A",
  },
  {
    id: 3,
    title: "Midnight Shadows",
    languagePair: "Korean → English",
    progress: 76,
    totalChapters: 95,
    currentChapter: 72,
    lastUpdated: "1 hour ago",
    initial: "M",
  },
];

export const activity: ActivityItem[] = [
  { text: "Chapter 89 translated", time: "4 min ago", color: "bg-primary" },
  { text: "Chapter 88 approved", time: "8 min ago", color: "bg-primary" },
  { text: "Chapter 87 needs review", time: "12 min ago", color: "bg-primary" },
  { text: "Glossary updated", time: "18 min ago", color: "bg-primary" },
  { text: "Chapter 38 translated", time: "21 min ago", color: "bg-primary" },
];

export const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const shouldFail = () => Math.random() < 0.3;

export function fetchNovels(): Promise<Novel[]> {
  return delay(1500).then(() => {
    if (shouldFail()) {
      throw new Error("Failed to load novels");
    }
    return novels;
  });
}

export function fetchActivity(): Promise<ActivityItem[]> {
  return delay(1000).then(() => {
    if (shouldFail()) {
      throw new Error("Failed to load activity");
    }
    return activity;
  });
}
