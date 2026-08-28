export interface ActivityItem {
  text: string;
  time: string;
  color: string;
}

// Mock data for the homepage prototype
export const activity: ActivityItem[] = [
  { text: "Chapter 89 translated", time: "4 min ago", color: "bg-primary" },
  { text: "Chapter 88 approved", time: "8 min ago", color: "bg-primary" },
  { text: "Chapter 87 needs review", time: "12 min ago", color: "bg-primary" },
  { text: "Glossary updated", time: "18 min ago", color: "bg-primary" },
  { text: "Chapter 38 translated", time: "21 min ago", color: "bg-primary" },
];

export const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const shouldFail = () => Math.random() < 0.3;

export function fetchActivity(): Promise<ActivityItem[]> {
  return delay(1000).then(() => {
    if (shouldFail()) {
      throw new Error("Failed to load activity");
    }
    return activity;
  });
}
