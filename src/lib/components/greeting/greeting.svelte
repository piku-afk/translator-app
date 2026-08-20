<script lang="ts">
  let {
    name,
    message = 'Continue where you left off',
  }: {
    name: string;
    message?: string;
  } = $props();
</script>

<div class="text-center">
  <h1 class="text-3xl font-semibold text-foreground">Good morning, {name}</h1>
  <p class="mt-2 text-muted-foreground">{message}</p>
</div>
