<script lang="ts">
  import '@fontsource-variable/geist/wght.css';
  import { invalidateAll } from '$app/navigation';
  import favicon from '$lib/assets/favicon.svg';
  import Header from '$lib/components/header/header.svelte';
  import Sidebar from '$lib/components/sidebar/sidebar.svelte';
  import '../app.css';

  let { children, data } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<Header credits={data.credits} />
<main class="mt-16.75 mr-70 p-6 flex flex-col gap-4">
  {@render children()}
</main>
<Sidebar />
