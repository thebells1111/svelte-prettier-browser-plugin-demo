<script>
  import sveltePlugin from "./newPlugin.js";

  let code =
    `<script>
    let firstName = 'world';

  function loaded(){
console.log("loaded")
  }; let red = false; let greeter;


<` +
    `/` +
    `script>

<h1 class='greeting' class:red on:click={()=>red=!red} use:loaded bind.this={greeter}>Hello {name}!</h1>`;

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
</script>

<svelte:window on:keydown={handleKeydown} />
<textarea bind:value={code} style="height:50%; width: 50%; margins: 1em auto" />
<button on:click={format}>Format</button>
