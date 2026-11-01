import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../server.mjs';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {newGame,applyAction,gameSummary} from '../engine.mjs';
async function withServer(options,fn){const server=createServer(options);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;try{await fn(url)}finally{await new Promise(resolve=>server.close(resolve))}}
test('web server serves game assets, status, no key exposure',()=>withServer({apiKey:''},async url=>{
 const status=await (await fetch(url+'/api/status')).json();assert.deepEqual(status,{apiMode:false,model:null,desktopRelay:true});
 const page=await (await fetch(url+'/')).text();assert(page.includes('Block Rivals'));assert(page.includes('ui.mjs'));
 const js=await (await fetch(url+'/engine.mjs')).text();assert(js.includes('legalActions'));
 const hidden=await fetch(url+'/server.mjs');assert.equal(hidden.status,404);
 const unavailable=await fetch(url+'/api/choose',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(unavailable.status,503);
}));
test('server validates OpenAI action and never accepts a human turn',()=>withServer({apiKey:'test-key',fetchImpl:async()=>{throw new Error('Should never be called on human turn')}},async url=>{
 const status=await (await fetch(url+'/api/status')).json();assert.equal(status.apiMode,true);
 const bad=await fetch(url+'/api/choose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:newGame(1)})});assert.equal(bad.status,400);
 const wrongOrigin=await fetch(url+'/api/choose',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://evil.example'},body:JSON.stringify({state:newGame(1)})});assert.equal(wrongOrigin.status,403);
}));
test('AI bridge makes structured model request, returns in-bounds decision',()=>withServer({apiKey:'test-key',model:'test-model',fetchImpl:async(url,init)=>{
 assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(init.headers.Authorization,'Bearer test-key');
 const req=JSON.parse(init.body);assert.equal(req.model,'test-model');assert.equal(req.text.format.type,'json_schema');const parsed=JSON.parse(req.input);assert(parsed.choices.length>0);assert.equal(parsed.snapshot.acting,'GPT · Ember');
 return {ok:true,json:async()=>({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({choice:0,banter:'The streets will be mine.'})}]}]})};
 }},async url=>{let s=newGame(1);s.turn=1;const r=await fetch(url+'/api/choose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:s})});assert.equal(r.status,200);const data=await r.json();assert.equal(data.choice,0);assert.equal(data.banter,'The streets will be mine.');assert.match(data.stateKey,/^[a-z0-9]+$/)}));
test('OpenAI invalid choice rejected (never secretly executes scripted substitute)',()=>withServer({apiKey:'test-key',fetchImpl:async()=>({ok:true,json:async()=>({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({choice:999,banter:''})}]}]})})},async url=>{let s=newGame(1);s.turn=1;const r=await fetch(url+'/api/choose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:s})});assert.equal(r.status,400);assert.match((await r.json()).error,/invalid legal action/)}));
test('Desktop Commander relay stores validated turn state and serves the matching GPT reply',async()=>{
 const relayDir=await mkdtemp(path.join(os.tmpdir(),'block-rivals-relay-'));
 try{await withServer({apiKey:'',relayDir},async url=>{
  const state=newGame(1);state.turn=1;
  const {gameSummary}=await import('../engine.mjs');
  const raw=JSON.stringify(gameSummary(state));let hash=2166136261;for(let i=0;i<raw.length;i++){hash^=raw.charCodeAt(i);hash=Math.imul(hash,16777619)}const stateKey=(hash>>>0).toString(36);
  const payload={sessionId:'game-1234567890abcd',stateKey,state};
  const post=await fetch(url+'/api/relay/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  assert.equal(post.status,200);
  const stored=JSON.parse(await readFile(path.join(relayDir,'relay-turn-request.json'),'utf8'));
  assert.equal(stored.stateKey,stateKey);assert.equal(stored.sessionId,payload.sessionId);
  assert.equal(stored.snapshot.acting,'GPT · Ember');assert.equal(stored.legalActions[0].type,'roll');
  const answer={sessionId:payload.sessionId,stateKey,choice:0,banter:'I came to own the block.'};
  await writeFile(path.join(relayDir,'relay-turn-response.json'),JSON.stringify(answer));
  const reply=await (await fetch(url+'/api/relay/response')).json();assert.deepEqual(reply,answer);
  const wrong=await fetch(url+'/api/relay/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,stateKey:'stale'})});assert.equal(wrong.status,400);
  const human=await fetch(url+'/api/relay/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,state:newGame(2)})});assert.equal(human.status,400);
 });}finally{await rm(relayDir,{recursive:true,force:true})}
});
