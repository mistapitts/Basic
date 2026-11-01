// Optional localhost host and OpenAI Responses API bridge.
// No API key is ever embedded in, or served to, the browser.
import http from 'node:http';
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {gameSummary,assertInvariants,currentActor,legalActions} from './engine.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const files=new Map([['/','index.html'],['/index.html','index.html'],['/engine.mjs','engine.mjs'],['/ui.mjs','ui.mjs'],['/styles.css','styles.css']]);
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))};
const prompt=`You are the strategic mind controlling three different players in a four-seat property trading board game against a human at seat 0. They are GPT Ember (bold, seeks monopolies and exciting auctions), GPT Sage (cautious, saves for critical expenses), and GPT Onyx (opportunistic, prefers leverage and rent traps). You must choose exactly ONE legal action for the current acting player by its array index. Work solely from the given snapshot. Try to win, but do not cheat or infer information not in the snapshot. Aim to build full sets, collect rent, use mortgages prudently. Prioritize paying debt before bankruptcy. Do not choose property improvements forever when you need to roll or end. Keep banter witty, under 100 characters. Output JSON conforming to the schema, no markdown.`;
function checksum(s){const raw=JSON.stringify(gameSummary(s));let hash=2166136261;for(let i=0;i<raw.length;i++){hash^=raw.charCodeAt(i);hash=Math.imul(hash,16777619)}return(hash>>>0).toString(36)}
export function createServer({apiKey=process.env.OPENAI_API_KEY,model=process.env.OPENAI_MODEL||'gpt-6.1-sol',fetchImpl=fetch,relayDir=root}={}){
 const relayRequestPath=path.join(relayDir,'relay-turn-request.json');
 const relayResponsePath=path.join(relayDir,'relay-turn-response.json');
 const readRelay=async file=>{try{return JSON.parse(await readFile(file,'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e}};
 const writeRelay=async(file,value)=>{await mkdir(relayDir,{recursive:true});const tmp=file+'.tmp.'+process.pid+'.'+Date.now();await writeFile(tmp,JSON.stringify(value,null,2)+'\n','utf8');await rename(tmp,file)};
 return http.createServer(async(req,res)=>{
  // Requiring JSON prevents cross-site form POSTs from spending API credits.
  if(req.headers.origin&&!['http://localhost:'+req.socket.localPort,'http://127.0.0.1:'+req.socket.localPort].includes(req.headers.origin))return json(res,403,{error:'Origin not allowed'});
  if(req.method==='GET'&&req.url==='/api/status')return json(res,200,{apiMode:!!apiKey,model:apiKey?model:null,desktopRelay:true});
  if(req.method==='POST'&&req.url==='/api/relay/request'){
   if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'JSON request required'});
   try{
    let body='';for await(const chunk of req){body+=chunk;if(body.length>260000)throw new Error('Request too large')}
    const data=JSON.parse(body);assertInvariants(data.state);
    if(data.state.version!==1||data.state.phase==='gameover'||currentActor(data.state)===0)throw new Error('Not a GPT turn');
    const key=checksum(data.state);
    if(data.stateKey!==key||typeof data.sessionId!=='string'||!/^[-a-zA-Z0-9_]{12,80}$/.test(data.sessionId))throw new Error('Invalid relay identifier or stale state');
    const saved={version:1,sessionId:data.sessionId,stateKey:key,submittedAt:new Date().toISOString(),snapshot:gameSummary(data.state),legalActions:legalActions(data.state),state:data.state};
    await writeRelay(relayRequestPath,saved);return json(res,200,{ok:true,stateKey:key});
   }catch(e){return json(res,400,{error:String(e.message||e).slice(0,220)})}
  }
  if(req.method==='GET'&&req.url==='/api/relay/response'){
   try{const answer=await readRelay(relayResponsePath);return json(res,200,answer||{ready:false})}
   catch{return json(res,500,{error:'Cannot read ChatGPT response'})}
  }
  if(req.method==='GET'&&req.url==='/api/relay/status'){
   try{const request=await readRelay(relayRequestPath);return json(res,200,{waiting:!!request,sessionId:request?.sessionId||null,stateKey:request?.stateKey||null})}
   catch{return json(res,500,{error:'Cannot read relay status'})}
  }
  if(req.method==='POST'&&req.url==='/api/choose'){
   if(!apiKey)return json(res,503,{error:'No server-side OPENAI_API_KEY configured. Use ChatGPT chat relay mode.'});
   if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'JSON request required'});
   try{
    let data='';for await(const chunk of req){data+=chunk;if(data.length>260000)throw new Error('Request too large')}
    const state=JSON.parse(data).state;assertInvariants(state);
    if(!state||state.version!==1)throw new Error('Unsupported game save');
    const id=currentActor(state);if(id===0||state.phase==='gameover')throw new Error('Not a GPT turn');
    const choices=legalActions(state);if(!choices.length)throw new Error('No legal actions');
    const snapshot=gameSummary(state),key=checksum(state);
    const response=await fetchImpl('https://api.openai.com/v1/responses',{
     method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
     signal:AbortSignal.timeout(55000),
     body:JSON.stringify({model,instructions:prompt,input:JSON.stringify({snapshot,choices:choices.map((choice,index)=>({index,...choice}))}),
      max_output_tokens:500,reasoning:{effort:'low'},
      text:{format:{type:'json_schema',name:'board_game_action',strict:true,schema:{type:'object',properties:{choice:{type:'integer'},banter:{type:'string'}},required:['choice','banter'],additionalProperties:false}}}})
    });
    const out=await response.json();if(!response.ok)throw new Error(out.error?.message||`OpenAI HTTP ${response.status}`);
    const contents=(out.output||[]).flatMap(item=>item.type==='message'?(item.content||[]):[]).filter(item=>item.type==='output_text');
    if(!contents.length)throw new Error('Model returned no text');const decision=JSON.parse(contents.map(c=>c.text).join(''));
    if(!Number.isInteger(decision.choice)||decision.choice<0||decision.choice>=choices.length)throw new Error('Model returned an invalid legal action');
    return json(res,200,{stateKey:key,choice:decision.choice,banter:String(decision.banter||'').slice(0,180)});
   }catch(e){return json(res,400,{error:String(e.message||e).slice(0,300)})}
  }
  if(req.method==='GET'&&files.has(req.url)){
   const name=files.get(req.url);try{const body=await readFile(path.join(root,name));res.writeHead(200,{'Content-Type':mime[path.extname(name)],'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(body)}catch{json(res,404,{error:'File unavailable'})}
  }else json(res,404,{error:'Not found'});
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT||8787),host='127.0.0.1';const server=createServer();server.listen(port,host,()=>{
  console.log(`Block Rivals: http://${host}:${port}`);
  console.log(process.env.OPENAI_API_KEY?`OpenAI model: ${process.env.OPENAI_MODEL||'gpt-6.1-sol'}`:'Chat relay only (OPENAI_API_KEY not set).');
 });
}