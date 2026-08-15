<script lang="ts">
  import '@fontsource-variable/geist/wght.css';

  import favicon from '$lib/assets/favicon.svg';
  import CreditsBadge from '$lib/components/credits-badge/credits-badge.svelte';
  import '../app.css';

  let { children, data } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<header class="fixed bg-gray-100 border-b border-gray-300 py-4 px-6 w-full">
  <nav aria-label="main navigation" class="flex items-baseline">
    <div class="flex items-baseline gap-6">
      <a href="/" class="text-2xl font-semibold leading-none"> Translator</a>

      <ul class="flex items-baseline">
        <li>
          <a
            href="/projects"
            class="text-lg font-light leading-none text-gray-500 hover:text-black"
          >
            Projects</a
          >
        </li>
      </ul>
    </div>

    <div class="ml-auto">
      {#await data.credits}
        <CreditsBadge loading={true} />
      {:then credits}
        <CreditsBadge credits={credits.balance} />
      {:catch error}
        <CreditsBadge error="something went wrong" />
      {/await}
    </div>
  </nav>
</header>
<main class="pt-16.25">
  {@render children()}
</main>
