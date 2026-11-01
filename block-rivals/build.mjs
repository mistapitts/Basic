// Bundle a double-clickable offline HTML file. (API mode still needs a server.)
import {readFile,writeFile} from 'node:fs/promises';
const dir=new URL('./',import.meta.url);
const html=await readFile(new URL('index.html',dir),'utf8');
const css=await readFile(new URL('styles.css',dir),'utf8');
const engine=await readFile(new URL('engine.mjs',dir),'utf8');
const ui=await readFile(new URL('ui.mjs',dir),'utf8');
// Convert ESM exports into globals for the single offline script.
const engineScript=engine.replaceAll(/^export\s+(?=(?:const|class|function)\b)/gm,'');
const uiScript=ui.replace(/^import\s+\{[^}]+\}\s+from\s+['"]\.\/engine\.mjs['"];?/m,'');
const built=html.replace('<link rel="stylesheet" href="./styles.css">',`<style>${css.replaceAll('</style>','<\\/style>')}</style>`)
 .replace('<script type="module" src="./ui.mjs"></script>',`<script>${(engineScript+'\n'+uiScript).replaceAll('</script>','<\\/script>')}</script>`);
await writeFile(new URL('game.html',dir),built);
console.log(`Created game.html (${built.length} chars), ready to open from disk`);