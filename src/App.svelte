<script>
  import prettier from "./prettier/src/standalone.js";
  import sveltePlugin from "./plugin.js";

  let code;
  code = `<div><p>Hello</p>
  <button>World</button></div>`;
  code =
    `<script>	let jobNames = ['Job1', 'Job2', 'Job3']
	let jobHours = Array.from(Array(3), () => Array.from(Array(2)));	
	let cell = Array.from(Array(3), () => Array.from(Array(3)));
	let newText = false
	
	function changeInput(e) {
    let value = e.target.value;
    let input = value.slice(-1); 
		if (newText) {
      newText = false;
      e.target.value = input;
    }

    if (e.target.type === 'number') {
      if (!Number(input) && Number(input) !== 0) {
        e.target.value = '';
      }

      if (Number(value) > 24) {
        e.target.value = input;
      }
    }
		
		console.log(jobNames)
  }<` +
    "/" +
    "script>";

  function format() {
    code = prettier.format(code, {
      parser: "svelte",
      plugins: [sveltePlugin],
    });
  }
</script>

<textarea bind:value={code} style="height:50%; width: 50%; margins: 1em auto" />
<button on:click={format}>FORMAT</button>
