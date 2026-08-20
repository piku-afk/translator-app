<script lang="ts">
  import '@fontsource-variable/geist/wght.css';
  import favicon from '$lib/assets/favicon.svg';
  import Header from '$lib/components/header/header.svelte';
  import '../app.css';

  let { children, data } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<Header credits={data.credits} />
<main class="mt-16.75 mx-auto p-6 max-w-5xl flex flex-col gap-4">
  {@render children()}
</main>
