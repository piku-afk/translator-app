export const load = async (event) => {
  const novels = event.fetch('/api/novels').then(async (res) => {
    if (!res.ok) throw new Error('Failed to load novels');
    return res.json();
  });

  const activity = event.fetch('/api/activity').then(async (res) => {
    if (!res.ok) throw new Error('Failed to load activity');
    return res.json();
  });

  return { novels, activity };
};
