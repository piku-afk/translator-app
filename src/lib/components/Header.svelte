<script>
  import { Coins, RotateCcw } from '@lucide/svelte';
</script>

<header class="fixed bg-gray-100 border-b border-gray-300 w-full">
  <nav aria-label="main navigation" class="p-4 flex items-baseline">
    <div class="flex items-baseline gap-6">
      <a href="/" class="text-2xl font-semibold leading-none"> Translator</a>

      <ul class="flex items-baseline">
        <li>
          <a href="/projects" class="text-lg font-light leading-none"> Projects</a>
        </li>
      </ul>
    </div>

    <span
      class="ml-auto border border-gray-300 rounded-md flex items-stretch bg-white"
      aria-label="120 credits remaining"
    >
      <span class="py-1.5 px-3 flex items-center text-sm">
        <Coins size={18} />
        <span class="ml-2">100 credits</span>
      </span>
      <button
        type="button"
        class="border-l border-gray-300 py-1.5 px-3 cursor-pointer flex items-center"
        aria-label="Refresh credits"
      >
        <span aria-hidden="true" class="flex items-center">
          <RotateCcw size={16} />
        </span>
      </button>
    </span>
  </nav>
</header>
