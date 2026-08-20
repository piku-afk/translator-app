<script lang="ts">
  import Greeting from '$lib/components/greeting/greeting.svelte';
  import NovelCardSection from '$lib/components/novel-card/novel-card-section.svelte';
  import RecentActivity from '$lib/components/recent-activity/recent-activity.svelte';

  // Hardcoded novels data for the homepage prototype
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

  // Hardcoded activity data for the homepage prototype
  const activity = [
    { text: 'Chapter 89 translated', time: '4 min ago', color: 'bg-primary' },
    { text: 'Chapter 88 approved', time: '8 min ago', color: 'bg-primary' },
    { text: 'Chapter 87 needs review', time: '12 min ago', color: 'bg-primary' },
    { text: 'Glossary updated', time: '18 min ago', color: 'bg-primary' },
    { text: 'Chapter 38 translated', time: '21 min ago', color: 'bg-primary' },
  ];
</script>

<main class="max-w-5xl w-full mx-auto py-6 flex flex-col gap-10">
  <!-- Greeting -->
  <Greeting name="Alex" />

  <!-- Featured Novels -->
  <NovelCardSection {novels} />

  <!-- Recent Activity -->
  <RecentActivity {activity} />
</main>
