# I want Prettier... for Svelte... in the Browser!!!

The main file for this is newPlugin.js. That's the heart of the formatter. Everything else is for displaying in the browser.

I'm muddling through making this work with `prettier/standalone.js`.

I'm not quite sure how all of this `AST` stuff works. Maybe you know, and can help make this thing super awesome.

Right now it use `escodegen` to parse through the `script` code. I don't know if that's entirely necessary, and it adds another dependency, but it works.

Maybe some testing. I don't know anything about testing.

A lot of this borrows from [https://github.com/sveltejs/prettier-plugin-svelte](https://github.com/sveltejs/prettier-plugin-svelte). Maybe there's a way to just get that to start working with `prettier/standalone.js`.
