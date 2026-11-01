import {BOARD,GROUPS,PLAYER_COLORS,newGame,legalActions,applyAction,gameSummary,assertInvariants,playerNetWorth,currentActor} from './engine.mjs';
const $=sel=>document.querySelector(sel);
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'$'+Number(n||0).toLocaleString('en-US');
const storageKey='block-rivals-v1';
let state;
try{const raw=JSON.parse(localStorage.getItem(storageKey));if(raw){assertInvariants(raw);state=raw}}catch(e){console.warn('Save unavailable:',e)}
state ||=newGame();
let selected=state.players[0].pos;
let apiReady=false,apiModel='';let aiBusy=false,stopAi=false,aiCount=0,lastBanter='';
let relayReady=false,relayRequestedKey='',relayPosting=false,relayPolling=false;
let relaySessionId;try{relaySessionId=localStorage.getItem('block-rivals-relay-session')}catch{}
if(!relaySessionId){relaySessionId='game-'+(globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2)+Date.now().toString(36));try{localStorage.setItem('block-rivals-relay-session',relaySessionId)}catch{}}

let toastTimeout;
function notify(message,error=false){const el=$('#toast');el.textContent=message;el.className='toast'+(error?' error':'');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.className='toast hidden',4200)}
function save(){try{localStorage.setItem(storageKey,JSON.stringify(state))}catch(e){console.warn('Cannot autosave:',e)}}
function phaseLabel(){return ({pre:'Ready to roll',post:state.extraRoll?'Roll again':'Finish your turn',purchase:'Buy or auction?',auction:'Live auction',debt:'Payment due',trade:'Trade proposal',gameover:'Game over'})[state.phase]||state.phase}
function phaseHelp(){const p=state.players[state.turn],space=BOARD[p.pos];switch(state.phase){case 'pre':return p.inJail?'Pay a $50 fine, play a jail pass, or attempt doubles.':'Roll the dice, or improve/mortgage a property first.';case 'post':return state.extraRoll?'Doubles! You earned an extra roll.':'You can manage your portfolio, offer a trade, or end your turn.';case 'purchase':return `${space.name} can be purchased for ${money(space.price)}. Decline and it goes to an open ascending auction.`;case 'debt':return `${p.name} owes ${money(state.debt.amount)} (${state.debt.reason}). Raise cash to pay, or go bankrupt.`;case 'trade':return `${state.players[state.trade.from].name} made an offer to ${state.players[state.trade.to].name}.`;case 'auction':return `${BOARD[state.auction.property].name} • highest bid ${money(state.auction.bid)}${state.auction.high!==null?' by '+state.players[state.auction.high].name:''}.`;default:return 'The last solvent player wins.'}}
function tilePos(id){if(id<=10)return {col:11-id,row:11};if(id<=20)return {col:1,row:11-(id-10)};if(id<=30)return {col:id-20+1,row:1};return {col:11,row:id-30+1}}
function iconFor(sq){return ({go:'↗',jail:'🔒',toJail:'🚓',parking:'🏝',chance:'?',chest:'🎁',tax:'$',station:'🚆',utility:'⚡',property:'⌂'})[sq.type]||'•'}
function renderBoard(){const pieces=state.players.filter(p=>!p.bankrupt).reduce((o,p)=>(o[p.pos]??=[]).push(p.id)&&o,{});let tiles='';
 BOARD.forEach((sq,id)=>{const pos=tilePos(id),d=state.deeds[id],color=d?.owner!==null&&d?.owner!==undefined?PLAYER_COLORS[d.owner]:null;
 const pegs=(pieces[id]||[]).map(p=>`<span class="pawn" title="${escapeHtml(state.players[p].name)}" style="background:${PLAYER_COLORS[p]}"></span>`).join('');
 const band=sq.group?`<span class="color-band" style="background:${GROUPS[sq.group].color}"></span>`:'';
 const status=d?.buildings?`<span class="towers">${d.buildings===5?'🏨':'⌂ ×'+d.buildings}</span>`:'';
 tiles+=`<button class="tile ${['go','jail','toJail','parking'].includes(sq.type)?'corner':sq.type} ${d?.mortgaged?'mortgaged':''} ${id===selected?'selected':''}" style="grid-column:${pos.col};grid-row:${pos.row}" data-tile="${id}" title="${escapeHtml(sq.name)}">
 ${band}<span class="tile-icon">${iconFor(sq)}</span><span class="tile-name">${escapeHtml(sq.name)}</span>${sq.price?`<span class="tile-price">${money(sq.price)}</span>`:''}
 ${color?`<span class="owner-mark" style="background:${color}"></span>`:''}<span class="pawn-stack">${pegs}</span>${status}</button>`});
 const chips=state.players.map(p=>`<span class="chip ${currentActor(state)===p.id?'active':''}"><i class="pawn" style="background:${PLAYER_COLORS[p.id]}"></i>${escapeHtml(p.name)}</span>`).join('');
 const dice=state.lastRoll[0]===0?'—':state.lastRoll.join(' + ');
 const center=`<div class="board-center"><div class="hero-icon">🎩</div><div class="center-title">BLOCK<br>RIVALS</div><div class="subtitle">A property game against GPT</div><div class="center-boxes"><div class="center-box"><strong>${money(state.pot)}</strong><span>🏝 Vacation Fund</span></div><div class="center-box"><strong>${dice}</strong><span>🎲 Last roll</span></div></div><div class="center-chips">${chips}</div></div>`;
 $('#board').innerHTML=tiles+center;
 document.querySelectorAll('[data-tile]').forEach(el=>el.addEventListener('click',()=>{selected=+el.dataset.tile;render()}));
}
function renderPlayers(){const active=currentActor(state);$('#players').innerHTML=state.players.map(p=>`<div class="player ${active===p.id?'active':''} ${p.bankrupt?'broke':''}"><div class="player-line"><span class="player-dot" style="background:${PLAYER_COLORS[p.id]}"></span><span class="player-name">${escapeHtml(p.name)}</span></div><div class="player-money">${money(p.cash)}</div><div class="player-sub">${money(playerNetWorth(state,p.id))} net worth · ${Object.values(state.deeds).filter(d=>d.owner===p.id).length} deeds ${p.inJail?'· 🔒 Jail':''} ${p.bankrupt?'· OUT':''}</div></div>`).join('')}
function chooseAction(type,rest={}){if(aiBusy)return;try{state=applyAction(state,{type,...rest});save();render()}catch(e){notify(e.message,true)}}
function actionLabel(a){if(a.type==='bid')return `Bid ${money(a.amount)}`;return ({roll:'🎲 Roll dice',tryDoubles:'🎲 Try for doubles',payBail:'Pay $50 bail',useCard:'Use jail pass',buy:'🏠 Buy property',startAuction:'🔨 Start auction',passAuction:'Pass / leave auction',end:'End turn →',mortgage:'Mortgage',unmortgage:'Redeem mortgage',build:'Build house / hotel',sell:'Sell building',payDebt:'Pay full debt',bankrupt:'Declare bankruptcy',acceptTrade:'Accept trade',declineTrade:'Decline trade'})[a.type]||a.type}
function makeButton(parent,a,label,style=''){const btn=document.createElement('button');btn.className='btn '+style;btn.textContent=label||actionLabel(a);btn.onclick=()=>chooseAction(a.type,Object.fromEntries(Object.entries(a).filter(([k])=>k!=='type')));parent.appendChild(btn);return btn}
function renderControls(){const actId=currentActor(state),p=state.players[actId],isHuman=actId===0,choices=legalActions(state);
 $('#turnwho').textContent=state.phase==='gameover'?`${state.players[state.winner]?.name||'Unknown'} wins!`:p.name;
 $('#turnphase').textContent=`ROUND ${state.round} • ${phaseLabel().toUpperCase()}`;$('#turnhelp').textContent=phaseHelp();
 const actionBox=$('#actions');actionBox.innerHTML='';$('#auctionControls').innerHTML='';$('#aiPanel').classList.toggle('hidden',isHuman||state.phase==='gameover');
 $('#humanSubpanels').classList.toggle('hidden',!isHuman||state.phase==='gameover');
 $('#relayBox').classList.toggle('hidden',!relayReady||isHuman||state.phase==='gameover');
 if(state.phase==='gameover'){$('#actions').innerHTML='<div class="winner">🏆 Winner: '+escapeHtml(state.players[state.winner]?.name||'Nobody')+'</div>';return}
 if(!isHuman){$('#aiActor').textContent=`${p.name}'s decision`;$('#aiType').textContent=relayReady?'Live sync sends this position to ChatGPT through Desktop Commander.':'Copy your current position into ChatGPT (or run the local server for automatic live sync).';
  $('#relayBox').classList.toggle('hidden',!relayReady);
  if(relayReady)$('#relayStatus').textContent=relayRequestedKey===summaryId()?'Board delivered. Say “Your turn” in ChatGPT; the response will appear here automatically.':'Sending the latest board to ChatGPT…';
  $('#apiControls').classList.toggle('hidden',!apiReady);$('#apiModel').textContent=apiModel;$('#aiBusy').classList.toggle('hidden',!aiBusy);return;}
 if(state.phase==='auction'){
  const min=state.auction.bid+1,body=$('#auctionControls');body.innerHTML=`<label class="label" for="bidAmount">Your next bid (minimum ${money(min)}; cash ${money(p.cash)})</label><div class="row"><input class="input small" id="bidAmount" type="number" min="${min}" max="${p.cash}" value="${Math.min(p.cash,Math.max(min,Math.round(min/10)*10))}" step="1"><button class="btn primary" id="submitBid">Bid now</button></div>`;
  $('#submitBid').onclick=()=>chooseAction('bid',{amount:Number($('#bidAmount').value)});
  makeButton(actionBox,{type:'passAuction'},'Pass auction','ghost');return;
 }
 const featured=choices.filter(a=>!['mortgage','unmortgage','build','sell','bid'].includes(a.type));
 for(const a of featured)makeButton(actionBox,a,null,['roll','buy','payDebt','acceptTrade'].includes(a.type)?'primary':['bankrupt','declineTrade'].includes(a.type)?'red':'');
 if(state.phase==='debt'){
  const m=choices.filter(a=>['mortgage','sell'].includes(a.type));if(m.length){const hint=document.createElement('div');hint.className='hint';hint.textContent='Available ways to raise cash:';actionBox.appendChild(hint)}for(const a of m)makeButton(actionBox,a,`${actionLabel(a)} · ${BOARD[a.property].name}`,'tiny');}
}
function renderInspector(){const sq=BOARD[selected],d=state.deeds[selected],owner=d?.owner===null?'Bank':d?.owner!==undefined?state.players[d.owner].name:'—';
 const color=sq.group?GROUPS[sq.group].color:sq.type==='station'?'#819cae':sq.type==='utility'?'#b99ac9':'#c3b99c';
 let details=`<div class="inspector"><div class="inspector-band" style="background:${color}"></div><div><h2>${escapeHtml(sq.name)} <small>#${selected}</small></h2><div class="inspector-cost">${sq.price?money(sq.price):'Special square'}</div><p class="hint">${sq.type==='property'?'Color group: '+sq.group+'.':'Type: '+sq.type+'.'} ${d?'Owner: '+escapeHtml(owner)+'.':''}</p>`;
 if(sq.type==='property'){
  const lvl=d.buildings;const rent= lvl===0&&d.owner!==null? 'Base ×2 with a complete set': money(sq.rent[lvl]);
  details+=`<div class="stats"><span class="stat">Base rent <strong>${money(sq.rent[0])}</strong></span><span class="stat">Current rent<strong>${rent}</strong></span><span class="stat">House cost<strong>${money(GROUPS[sq.group].build)}</strong></span><span class="stat">Buildings<strong>${lvl===5?'Hotel':lvl}</strong></span></div>`;
 }else if(sq.type==='station')details+='<p class="hint">Rent: $25 / $50 / $100 / $200 based on number of stations held.</p>';
 else if(sq.type==='utility')details+='<p class="hint">Rent: 4× or 10× dice total depending on utilities owned.</p>';
 if(d){details+=`<p class="hint">Mortgage: ${money(sq.price/2)}${d.mortgaged?' · CURRENTLY MORTGAGED':''}</p>`}
 details+='</div></div>';
 $('#inspectorBody').innerHTML=details;
 const box=$('#inspectorActions');box.innerHTML='';if(currentActor(state)===0){for(const a of legalActions(state).filter(a=>a.property===selected))makeButton(box,a,null,'tiny')}
}
function renderTrade(){const box=$('#tradePane');const can=state.turn===0&&currentActor(state)===0&&['pre','post'].includes(state.phase)&&!state.players[0].inJail;
 box.classList.toggle('hidden',!can);if(!can)return;
 const target=$('#tradeTarget');const old=target.value;target.innerHTML=state.players.filter(p=>p.id!==0&&!p.bankrupt).map(p=>`<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');if([...target.options].some(o=>o.value===old))target.value=old;
 const id=+target.value||1;
 const allMine=Object.entries(state.deeds).filter(([i,d])=>d.owner===0).map(([i])=>+i),allTheirs=Object.entries(state.deeds).filter(([i,d])=>d.owner===id).map(([i])=>+i);
 const checks=(ids,name)=>ids.length?ids.map(i=>`<label class="trade-check"><input type="checkbox" class="${name}" value="${i}">${escapeHtml(BOARD[i].name)}</label>`).join(''):'<span class="muted">None</span>';
 $('#tradeYours').innerHTML=checks(allMine,'tradeGive');$('#tradeTheirs').innerHTML=checks(allTheirs,'tradeTake');
}
function summaryId(){const raw=JSON.stringify(gameSummary(state));let hash=2166136261;for(let i=0;i<raw.length;i++){hash^=raw.charCodeAt(i);hash=Math.imul(hash,16777619)}return (hash>>>0).toString(36)}
function createPrompt(){const s=gameSummary(state),token=summaryId();return `BLOCK RIVALS — LIVE GAME DECISION (for the current ChatGPT conversation).\nYou are directly playing all three GPT seats (${state.players.slice(1).map(p=>p.name).join(', ')}) against me (seat 0). Be a smart, competitive opponent. Give each seat an independent personality: Ember bold, Sage cautious, Onyx opportunistic.\nFor the player named in "acting", pick ONE LEGAL ACTION by its zero-based index in legalActions. Do not claim the move is applied; I will paste your reply back into the game. Favor sensible moves; trade is available by an explicit in-game offer. Buying, mortgaging, building, auction bidding, and jail choices are yours.\nReply with JSON only: {"stateKey":"${token}","choice":NUMBER,"banter":"A short in-character sentence"}.\nCURRENT GAME SNAPSHOT:\n${JSON.stringify(s)}`;}
async function copyText(text){try{await navigator.clipboard.writeText(text);return true}catch{const el=document.createElement('textarea');el.value=text;el.style.position='fixed';el.style.left='-9999px';document.body.appendChild(el);el.select();const ok=document.execCommand('copy');el.remove();return ok}}
function parseResponse(raw){let data;const trimmed=raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');try{data=JSON.parse(trimmed)}catch{const match=trimmed.match(/\{[\s\S]*\}/);if(!match)throw new Error('Paste valid JSON with "choice".');data=JSON.parse(match[0])}
 if(!data||data.stateKey!==summaryId())throw new Error('That reply is for a different game position. Copy a fresh prompt.');const choices=legalActions(state);
 if(!Number.isInteger(data.choice)||data.choice<0||data.choice>=choices.length)throw new Error('The action number is not legal.');return {choice:choices[data.choice],banter:String(data.banter||'').slice(0,180)}}
function renderLog(){const lines=state.log.slice(-13).reverse();$('#gameLog').innerHTML=lines.map(l=>`<li>${escapeHtml(l)}</li>`).join('');$('#lastBanter').textContent=lastBanter?'💬 '+lastBanter:'';}
function render(){renderBoard();renderPlayers();renderControls();renderInspector();renderTrade();renderLog();$('#houseSupply').textContent=`${state.bankHouses} houses · ${state.bankHotels} hotels left`;$('#apiStatus').textContent=relayReady?'Desktop relay connected':apiReady?'API model available':'Chat relay ready';$('#round').textContent='Round '+state.round;if(relayReady)void offerRelayTurn()}
async function offerRelayTurn(){
 if(!relayReady||aiBusy||relayPosting||state.phase==='gameover'||currentActor(state)===0)return;
 const key=summaryId();if(relayRequestedKey===key)return;
 relayPosting=true;
 try{const res=await fetch('/api/relay/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:relaySessionId,stateKey:key,state})});const data=await res.json();if(!res.ok)throw new Error(data.error||'Relay request failed');
  relayRequestedKey=key;$('#relayStatus').textContent='Board delivered. Say “Your turn” in ChatGPT; it can reply directly to the game.';
 }catch(e){$('#relayStatus').textContent='Relay connection failed: '+e.message;relayRequestedKey=''}finally{relayPosting=false}
}
async function pollRelay(){
 if(!relayReady||aiBusy||relayPolling||relayPosting||state.phase==='gameover'||currentActor(state)===0)return;
 const key=summaryId();if(relayRequestedKey!==key)return;
 relayPolling=true;
 try{const res=await fetch('/api/relay/response',{cache:'no-store'});if(!res.ok)return;
  const data=await res.json();if(data.sessionId!==relaySessionId||data.stateKey!==key||!Number.isInteger(data.choice))return;
  const moves=legalActions(state);if(data.choice<0||data.choice>=moves.length)return;
  const actor=state.players[currentActor(state)].name;lastBanter=actor+': '+String(data.banter||'').slice(0,180);
  state=applyAction(state,moves[data.choice]);relayRequestedKey='';save();render();
 }catch(e){console.warn('Relay polling:',e)}finally{relayPolling=false}
}
setInterval(()=>{void pollRelay()},2200);
async function apiChoose(){const res=await fetch('/api/choose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state})});const data=await res.json().catch(()=>({error:'Unexpected response'}));if(!res.ok)throw new Error(data.error||`HTTP ${res.status}`);
 if(data.stateKey!==summaryId())throw new Error('API returned a move for a stale board.');const opts=legalActions(state);if(!Number.isInteger(data.choice)||data.choice<0||data.choice>=opts.length)throw new Error('API returned an invalid move.');return {choice:opts[data.choice],banter:String(data.banter||'').slice(0,180)}}
async function runAutomatic(){if(!apiReady||aiBusy)return;aiBusy=true;stopAi=false;$('#aiBusy').classList.remove('hidden');render();let steps=0;
 try{while(!stopAi&&state.phase!=='gameover'&&currentActor(state)!==0&&steps++<50){const a=await apiChoose();lastBanter=`${state.players[currentActor(state)].name}: ${a.banter}`;state=applyAction(state,a.choice);save();aiCount++;render();await new Promise(resolve=>setTimeout(resolve,180));}
 if(steps>=50)notify('Paused after 50 model decisions to avoid unexpected API charges.');
 }catch(e){notify('AI request failed: '+e.message,true)}finally{aiBusy=false;render()}}
$('#copyPrompt').addEventListener('click',async()=>{const prompt=createPrompt();const ok=await copyText(prompt);if(ok)notify('Copied! Paste into this ChatGPT chat and return with my JSON move.');else{$('#pasteMove').value=prompt;notify('Clipboard denied. Copy the generated text from the box.',true)}});
$('#applyMove').addEventListener('click',()=>{if(aiBusy)return;try{const a=parseResponse($('#pasteMove').value);lastBanter=`${state.players[currentActor(state)].name}: ${a.banter}`;state=applyAction(state,a.choice);$('#pasteMove').value='';save();render();notify('GPT move applied.')}catch(e){notify(e.message,true)}});
$('#autoPlay').addEventListener('click',runAutomatic);$('#stopAuto').addEventListener('click',()=>{stopAi=true;notify('Will stop after the current model request finishes.')});
$('#tradeTarget').addEventListener('change',()=>renderTrade());
$('#sendTrade').addEventListener('click',()=>{
 const to=Number($('#tradeTarget').value),give=[...document.querySelectorAll('.tradeGive:checked')].map(el=>+el.value),take=[...document.querySelectorAll('.tradeTake:checked')].map(el=>+el.value);
 chooseAction('offerTrade',{to,give,take,giveCash:Number($('#giveCash').value),takeCash:Number($('#takeCash').value)});
});
$('#restart').addEventListener('click',()=>{if(!confirm('Start a new game? Your current saved game will be replaced.'))return;state=newGame();selected=0;lastBanter='';relayRequestedKey='';save();render();notify('New game started. Good luck!')});
$('#export').addEventListener('click',()=>{const b=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(b);const a=document.createElement('a');a.href=url;a.download='block-rivals-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)});
$('#import').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const raw=JSON.parse(await file.text());assertInvariants(raw);if(!raw.version||raw.version!==1)throw new Error('Unsupported save version');state=raw;selected=state.players[0].pos;relayRequestedKey='';save();render();notify('Saved game imported')}catch(e){notify('Save rejected: '+e.message,true)}e.target.value=''});
async function discoverAPI(){if(location.protocol==='file:')return;try{const r=await fetch('/api/status',{cache:'no-store'});const j=await r.json();apiReady=!!j.apiMode;apiModel=j.model||'';relayReady=!!j.desktopRelay;render()}catch{apiReady=false;relayReady=false;render()}}
render();discoverAPI();