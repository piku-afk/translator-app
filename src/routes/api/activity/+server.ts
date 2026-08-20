import { json } from '@sveltejs/kit';

// Mock data for the homepage prototype
const activity = [
  { text: 'Chapter 89 translated', time: '4 min ago', color: 'bg-primary' },
  { text: 'Chapter 88 approved', time: '8 min ago', color: 'bg-primary' },
  { text: 'Chapter 87 needs review', time: '12 min ago', color: 'bg-primary' },
  { text: 'Glossary updated', time: '18 min ago', color: 'bg-primary' },
  { text: 'Chapter 38 translated', time: '21 min ago', color: 'bg-primary' },
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const GET = async () => {
  await delay(1000);

  if (Math.random() < 0.3) {
    return json({ message: 'Failed to load activity' }, { status: 500 });
  }

  return json(activity);
};
