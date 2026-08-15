<script>
  import { Coins, RotateCcw } from '@lucide/svelte';
</script>

<header class="border-b border-gray-300">
  <nav aria-label="main navigation" class=" p-4 flex items-baseline">
    <a href="/" class="text-2xl font-semibold">Translator</a>

    <ul class="ml-6 list-none flex items-center font-light">
      <li><a href="/projects" class="text-lg"> Projects </a></li>
    </ul>

    <span
      class="ml-auto border border-gray-300 rounded-md px-3 flex items-center bg-white"
      aria-label="120 credits remaining"
    >
      <span class="py-1.5 flex items-center">
        <Coins size={18} />
        <span class="ml-2 text-sm">100 credits</span>
      </span>

      <button
        type="button"
        class="ml-2 border-l border-gray-300 py-1.5 pl-3 cursor-pointer"
        aria-label="Refresh credits"
      >
        <span aria-hidden="true">
          <RotateCcw size={16} />
        </span>
      </button>
    </span>
  </nav>
</header>
