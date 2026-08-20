import { json } from '@sveltejs/kit';

// Mock data for the homepage prototype
const novels = [
  {
    id: 1,
    title: 'The Beginning',
    languagePair: 'Korean → English',
    progress: 82,
    totalChapters: 120,
    currentChapter: 98,
    lastUpdated: '4 min ago',
    initial: 'T',
  },
  {
    id: 2,
    title: 'Another World',
    languagePair: 'Japanese → English',
    progress: 34,
    totalChapters: 62,
    currentChapter: 21,
    lastUpdated: 'yesterday',
    initial: 'A',
  },
  {
    id: 3,
    title: 'Midnight Shadows',
    languagePair: 'Korean → English',
    progress: 76,
    totalChapters: 95,
    currentChapter: 72,
    lastUpdated: '1 hour ago',
    initial: 'M',
  },
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const GET = async () => {
  await delay(1500);

  if (Math.random() < 0.3) {
    return json({ message: 'Failed to load novels' }, { status: 500 });
  }

  return json(novels);
};
