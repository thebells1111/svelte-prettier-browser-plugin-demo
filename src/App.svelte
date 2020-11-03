<script>
  import { onMount } from "svelte";
  import sveltePlugin from "./newPlugin.js";

  let code;

  function format() {
    code = sveltePlugin.format(code, {
      parser: "svelte",
      plugins: [sveltePlugin],
    });
  }

  function handleKeydown(event) {
    if (
      event.shiftKey &&
      event.altKey &&
      (event.key === "f" || event.key === "F")
    ) {
      format();
    }
  }

  onMount(() => {
    code = localStorage.getItem("code");
  });

  $: if (code) {
    //localStorage.setItem("code", code);
  }
</script>

<svelte:window on:keydown={handleKeydown} />
<textarea
  bind:value={code}
  style="height:100%; width: 50%; margins: 1em auto" />
<button on:click={format}>Format</button>
