import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const page=await readFile(new URL('../game.html',import.meta.url),'utf8');
test('standalone HTML bundles a complete and syntactically valid inline game',()=>{
 assert(page.includes('id="board"'));
 assert(page.includes('id="pasteMove"'));
 assert(!page.includes('src="./ui.mjs"'));
 assert(!page.includes('href="./styles.css"'));
 const src=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert(src&&src.length>35000,'Full engine and UI present');
 assert(src.includes("const money=n=>'$'+Number"),'Money formatter not corrupted by template substitution');
 assert(!src.includes('export function'),'ESM syntax removed');
 assert(!src.includes("from './engine.mjs'"),'Module import removed');
 new vm.Script(src,{filename:'game.html'});
});