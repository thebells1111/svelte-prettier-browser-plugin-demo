<script>
  import sveltePlugin from "./plugin.js";
  let formatted = "";

  let code;
  code = `<button
  on:click={() => {
    startCount += 10;
    endCount += 10;
  }}>count</button>`;

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
      formatted = "formatted";
      setTimeout(() => (formatted = ""), 1000);
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />
<textarea bind:value={code} style="height:50%; width: 50%; margins: 1em auto" />
<p>{formatted}</p>
