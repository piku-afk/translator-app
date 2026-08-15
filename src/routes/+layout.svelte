<script lang="ts">
  import '@fontsource-variable/geist/wght.css';
  import favicon from '$lib/assets/favicon.svg';
  import Header from '$lib/components/Header.svelte';

  import '../app.css';

  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<Header />
<main class="pt-17.25">
  {@render children()}
</main>
