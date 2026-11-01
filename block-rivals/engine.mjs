// Block Rivals: deterministic, dependency-free 4-player property trading engine.
// Original names/art; familiar property-trading mechanics.
export const GROUPS = {
  brown: {color:'#895c43',build:50}, sky: {color:'#63c9e5',build:50},
  rose: {color:'#d48ac0',build:100}, orange: {color:'#ee9a45',build:100},
  red: {color:'#e4686a',build:150}, yellow: {color:'#ebc75b',build:150},
  green: {color:'#59ad85',build:200}, navy: {color:'#506cc5',build:200}
};
const property=(name,group,price,rent)=>({type:'property',name,group,price,rent});
const station=(name)=>({type:'station',name,price:200});
const utility=(name)=>({type:'utility',name,price:150});
const special=(type,name,other={})=>({type,name,...other});
export const BOARD = [
  special('go','START'),
  property('Copper Lane','brown',60,[2,10,30,90,160,250]),
  special('chest','Community Fund'),
  property('Maple Row','brown',60,[4,20,60,180,320,450]),
  special('tax','Civic Tax',{amount:200}),
  station('Central Station'),
  property('Cloud Walk','sky',100,[6,30,90,270,400,550]),
  special('chance','Opportunity'),
  property('Canal Crescent','sky',100,[6,30,90,270,400,550]),
  property('Skyline Way','sky',120,[8,40,100,300,450,600]),
  special('jail','Jail / Just Visiting'),
  property('Orchid Street','rose',140,[10,50,150,450,625,750]),
  utility('Electric Co.'),
  property('Amethyst Ave','rose',140,[10,50,150,450,625,750]),
  property('Rose Garden','rose',160,[12,60,180,500,700,900]),
  station('East Station'),
  property('Citrus Court','orange',180,[14,70,200,550,750,950]),
  special('chest','Community Fund'),
  property('Amber Avenue','orange',180,[14,70,200,550,750,950]),
  property('Golden Plaza','orange',200,[16,80,220,600,800,1000]),
  special('parking','VACATION'),
  property('Scarlet Road','red',220,[18,90,250,700,875,1050]),
  special('chance','Opportunity'),
  property('Ruby Terrace','red',220,[18,90,250,700,875,1050]),
  property('Festival Street','red',240,[20,100,300,750,925,1100]),
  station('West Station'),
  property('Sunset Drive','yellow',260,[22,110,330,800,975,1150]),
  property('Lemon Square','yellow',260,[22,110,330,800,975,1150]),
  utility('Water Works'),
  property('Sunflower Blvd','yellow',280,[24,120,360,850,1025,1200]),
  special('toJail','GO TO JAIL'),
  property('Fern Boulevard','green',300,[26,130,390,900,1100,1275]),
  property('Pine Park','green',300,[26,130,390,900,1100,1275]),
  special('chest','Community Fund'),
  property('Emerald Court','green',320,[28,150,450,1000,1200,1400]),
  station('North Station'),
  special('chance','Opportunity'),
  property('Royal Crescent','navy',350,[35,175,500,1100,1300,1500]),
  special('tax','Luxury Tax',{amount:100}),
  property('Imperial Avenue','navy',400,[50,200,600,1400,1700,2000])
];
export const PLAYER_NAMES=['You','GPT · Ember','GPT · Sage','GPT · Onyx'];
export const PLAYER_COLORS=['#f5c86f','#ff9079','#7dcbb0','#9d9ce6'];
export const CARDS={
 chance:[
  {text:'Advance to START. Collect $200.',kind:'go'},
  {text:'Advance to Golden Plaza.',kind:'move',pos:19},
  {text:'Advance to Royal Crescent.',kind:'move',pos:37},
  {text:'Advance to nearest station; pay double rent if owned.',kind:'nearestStation',mult:2},
  {text:'Advance to nearest station; pay double rent if owned.',kind:'nearestStation',mult:2},
  {text:'Advance to nearest utility; pay 10× dice total if owned.',kind:'nearestUtility'},
  {text:'Head back three spaces.',kind:'back',steps:3},
  {text:'Go directly to jail. Do not pass START.',kind:'jail'},
  {text:'Get out of jail free. Keep this card.',kind:'card'},
  {text:'Dividend from the bank: collect $50.',kind:'collect',amount:50},
  {text:'Your investment matures. Collect $150.',kind:'collect',amount:150},
  {text:'Property upkeep: pay $25 per house and $100 per hotel.',kind:'repairs',house:25,hotel:100},
  {text:'Speeding fine. Pay $15 into Vacation Fund.',kind:'pay',amount:15},
  {text:'Advance to Central Station.',kind:'move',pos:5},
  {text:'Bank error in your favor. Collect $100.',kind:'collect',amount:100},
  {text:'Community donation. Pay $50 into Vacation Fund.',kind:'pay',amount:50}
 ],
 chest:[
  {text:'Advance to START. Collect $200.',kind:'go'},
  {text:'Bank error in your favor. Collect $200.',kind:'collect',amount:200},
  {text:'From the bank: collect $100.',kind:'collect',amount:100},
  {text:'Consultation fee: pay $50.',kind:'pay',amount:50},
  {text:'Get out of jail free. Keep this card.',kind:'card'},
  {text:'Go directly to jail. Do not pass START.',kind:'jail'},
  {text:'Tax refund: collect $20.',kind:'collect',amount:20},
  {text:'Life insurance matures: collect $100.',kind:'collect',amount:100},
  {text:'Holiday fund: collect $100.',kind:'collect',amount:100},
  {text:'Hospital fee: pay $100.',kind:'pay',amount:100},
  {text:'School fee: pay $50.',kind:'pay',amount:50},
  {text:'You inherit $100.',kind:'collect',amount:100},
  {text:'Stock sale: collect $50.',kind:'collect',amount:50},
  {text:'You won a prize: collect $10.',kind:'collect',amount:10},
  {text:'Street repairs: pay $40 per house and $115 per hotel.',kind:'repairs',house:40,hotel:115},
  {text:'Community service award: collect $25.',kind:'collect',amount:25}
 ]
};
export class RuleError extends Error {}
const invariant=(ok,msg)=>{if(!ok)throw new RuleError(msg)};
export const isOwnable=(idx)=>['property','station','utility'].includes(BOARD[idx]?.type);
const groupIds=(group)=>BOARD.flatMap((space,i)=>space.group===group?[i]:[]);
const currentPlayer=(s)=>s.players[s.turn];
const actorId=(s)=>s.phase==='auction'?s.auction.actor:s.phase==='trade'?s.trade.to:s.turn;
export const currentActor=actorId;
const log=(s,msg)=>{s.log.push(msg); if(s.log.length>140)s.log.shift()};
const nextRandom=s=>{s.seed=(Math.imul(1664525,s.seed)+1013904223)>>>0;return s.seed/4294967296};
const rollDice=s=>[1+Math.floor(nextRandom(s)*6),1+Math.floor(nextRandom(s)*6)];
const shuffle=(s,ids)=>{for(let i=ids.length-1;i>0;i--){const j=Math.floor(nextRandom(s)*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]]}return ids};
export function newGame(seed=Math.floor(Math.random()*4294967295)) {
 const s={version:1,seed:seed>>>0,players:PLAYER_NAMES.map((name,id)=>({id,name,cash:1500,pos:0,inJail:false,jailAttempts:0,doubles:0,cards:{chance:0,chest:0},bankrupt:false})),
  deeds:Object.fromEntries(BOARD.flatMap((sq,i)=>isOwnable(i)?[[i,{owner:null,mortgaged:false,buildings:0}]]:[])),
  decks:{chance:[],chest:[]},turn:0,round:1,phase:'pre',extraRoll:false,sideActions:0,lastRoll:[0,0],auction:null,trade:null,debt:null,pot:0,bankHouses:32,bankHotels:12,log:[],winner:null};
 s.decks.chance=shuffle(s,CARDS.chance.map((_,i)=>i));s.decks.chest=shuffle(s,CARDS.chest.map((_,i)=>i));
 log(s,'New game! Each player starts with $1,500. The Vacation Fund collects taxes and fines.');return s;
}
export const ownsSet=(s,player,group)=>groupIds(group).every(i=>s.deeds[i].owner===player);
export function calculateRent(s,idx,rollTotal=s.lastRoll[0]+s.lastRoll[1],mult=1) {
 const sq=BOARD[idx], d=s.deeds[idx];if(!d||d.owner===null||d.mortgaged)return 0;
 if(sq.type==='property'){let rent=sq.rent[d.buildings];if(d.buildings===0&&ownsSet(s,d.owner,sq.group))rent*=2;return rent*mult}
 if(sq.type==='station'){let count=BOARD.filter((x,i)=>x.type==='station'&&s.deeds[i].owner===d.owner).length;return 25*(2**(count-1))*mult}
 if(sq.type==='utility'){let count=BOARD.filter((x,i)=>x.type==='utility'&&s.deeds[i].owner===d.owner).length;return rollTotal*(mult===10?10:(count===2?10:4))}
 return 0;
}
const releaseBuildings=(s)=>{
 let houses=0,hotels=0;for(const [i,d] of Object.entries(s.deeds)){if(BOARD[i].type!=='property')continue;
  if(d.buildings===5)hotels++;else houses+=d.buildings}
 s.bankHouses=32-houses;s.bankHotels=12-hotels;
};
function settle(s,amount,recipient,reason,post={type:'landing'}) {
 const p=currentPlayer(s);invariant(amount>=0&&Number.isInteger(amount),'Invalid payment');
 if(amount===0){resume(s,post);return}
 if(p.cash>=amount){p.cash-=amount;if(recipient==='pot')s.pot+=amount;else if(typeof recipient==='number')s.players[recipient].cash+=amount;
 log(s,`${p.name} paid $${amount} ${recipient==='pot'?'into Vacation Fund':typeof recipient==='number'?`to ${s.players[recipient].name}`:'to the bank'} (${reason}).`);resume(s,post);return}
 s.debt={amount,to:recipient,reason,post};s.phase='debt';log(s,`${p.name} owes $${amount} (${reason}). Mortgage or sell buildings to raise cash.`);
}
function resume(s,post) {
 if(post?.type==='jailMove'){const p=currentPlayer(s);p.inJail=false;p.jailAttempts=0;move(s,post.steps);return}
 if(post?.type==='afterBail'){const p=currentPlayer(s);p.inJail=false;p.jailAttempts=0;s.phase='pre';return}
 finishLanding(s);
}
function finishLanding(s){s.phase=s.extraRoll?'pre':'post';}
function advance(s,pos,collectStart=true){const p=currentPlayer(s);if(collectStart&&pos<p.pos){p.cash+=200;log(s,`${p.name} passed START and collected $200.`)}p.pos=pos}
function move(s,steps,special={}){const p=currentPlayer(s),to=((p.pos+steps)%40+40)%40;advance(s,to,steps>0);log(s,`${p.name} landed on ${BOARD[to].name}.`);land(s,special)}
function goToJail(s){const p=currentPlayer(s);p.pos=10;p.inJail=true;p.jailAttempts=0;p.doubles=0;s.extraRoll=false;log(s,`${p.name} went to jail.`);finishLanding(s)}
function pickCard(s,type){if(!s.decks[type].length)s.decks[type]=shuffle(s,CARDS[type].map((_,i)=>i).filter(i=>CARDS[type][i].kind!=='card'||!s.players.some(p=>p.cards[type])));
 const n=s.decks[type].shift(),card=CARDS[type][n]; if(card.kind!=='card')s.decks[type].push(n);log(s,`${type==='chance'?'Opportunity':'Community Fund'}: ${card.text}`);return card}
function applyCard(s,card,type){const p=currentPlayer(s);
 switch(card.kind){
 case 'go':{const startedHere=p.pos===0;advance(s,0,true);if(startedHere)p.cash+=200;finishLanding(s);break}
 case 'move':advance(s,card.pos,true);land(s);break;
 case 'back':move(s,-card.steps);break;
 case 'nearestStation':{const stations=[5,15,25,35];const pos=stations.find(x=>x>p.pos)??5;advance(s,pos,true);land(s,{rentMult:card.mult});break}
 case 'nearestUtility':{const utilities=[12,28];const pos=utilities.find(x=>x>p.pos)??12;advance(s,pos,true);const dice=rollDice(s);log(s,`Opportunity utility dice: ${dice[0]} + ${dice[1]}.`);land(s,{rentMult:10,utilityDice:dice[0]+dice[1]});break}
 case 'jail':goToJail(s);break;
 case 'card':p.cards[type]++;finishLanding(s);break;
 case 'collect':p.cash+=card.amount;log(s,`${p.name} received $${card.amount} from the bank.`);finishLanding(s);break;
 case 'pay':settle(s,card.amount,'pot',card.text);break;
 case 'repairs':{let amount=0;for(const [idx,d] of Object.entries(s.deeds))if(d.owner===p.id&&BOARD[idx].type==='property')amount+=d.buildings===5?card.hotel:d.buildings*card.house;settle(s,amount,'pot','property repairs');break}
 default:throw new Error('Unknown card')
 }
}
function land(s,special={}){const p=currentPlayer(s),idx=p.pos,sq=BOARD[idx],d=s.deeds[idx];
 if(d){if(d.owner===null){s.phase='purchase';log(s,`${sq.name} is available for $${sq.price}. Buy or auction it.`)}
 else if(d.owner!==p.id&&!d.mortgaged){const amt=calculateRent(s,idx,special.utilityDice??s.lastRoll[0]+s.lastRoll[1],special.rentMult||1);settle(s,amt,d.owner,`rent at ${sq.name}`)}
 else finishLanding(s);
 return;}
 switch(sq.type){case 'tax':settle(s,sq.amount,'pot',sq.name);break;
 case 'parking':{const payout=s.pot;s.pot=0;p.cash+=payout;log(s,`${p.name} collected $${payout} from Vacation Fund!`);finishLanding(s);break}
 case 'toJail':goToJail(s);break;
 case 'chance':case 'chest':applyCard(s,pickCard(s,sq.type),sq.type);break;
 default:finishLanding(s);
 }
}
function nextTurn(s){const prev=s.turn;let x=prev;do{x=(x+1)%s.players.length;if(x===0)s.round++}while(s.players[x].bankrupt&&x!==prev);if(x===prev){s.winner=x;s.phase='gameover';return}
 s.turn=x;const p=currentPlayer(s);p.doubles=0;s.sideActions=0;s.extraRoll=false;s.lastRoll=[0,0];s.phase='pre';log(s,`Turn ${s.round}: ${p.name}'s move.`)}
const ownDeeds=(s,id)=>Object.keys(s.deeds).map(Number).filter(i=>s.deeds[i].owner===id);
function manageActions(s,id){const p=s.players[id];if(s.sideActions>=35)return [];const actions=[];
 for(const idx of ownDeeds(s,id)){
 const sq=BOARD[idx],d=s.deeds[idx];
 if(sq.type==='property'&&d.buildings>0){const members=groupIds(sq.group).map(i=>s.deeds[i].buildings);if(d.buildings===Math.max(...members)&&(d.buildings!==5||s.bankHouses>=4))actions.push({type:'sell',property:idx})}
 if(!d.mortgaged&& (sq.type!=='property'||groupIds(sq.group).every(i=>s.deeds[i].buildings===0)))actions.push({type:'mortgage',property:idx});
 if(d.mortgaged&&p.cash>=Math.ceil(sq.price*0.55))actions.push({type:'unmortgage',property:idx});
 if(sq.type==='property'&&d.buildings<5&&!d.mortgaged&&ownsSet(s,id,sq.group)&&groupIds(sq.group).every(i=>!s.deeds[i].mortgaged)
 &&d.buildings===Math.min(...groupIds(sq.group).map(i=>s.deeds[i].buildings))&&p.cash>=GROUPS[sq.group].build
 &&(d.buildings===4?s.bankHotels>0:s.bankHouses>0))actions.push({type:'build',property:idx});
 }
 return actions;
}
const uniqueBids=(s)=>{const a=s.auction,p=s.players[a.actor],price=BOARD[a.property].price,min=a.bid+1;
 const amounts=[min,Math.max(min,Math.ceil((a.bid+10)/10)*10),Math.max(min,a.bid+25),Math.max(min,a.bid+50),Math.round(price*.5),Math.round(price*.75),price,Math.min(p.cash,Math.round(price*1.1))];
 return [...new Set(amounts.filter(n=>Number.isInteger(n)&&n>=min&&n<=p.cash))].sort((a,b)=>a-b).map(amount=>({type:'bid',amount}));};
export function legalActions(s){if(s.phase==='gameover')return [];const id=actorId(s),p=s.players[id];
 if(s.phase==='trade')return [{type:'acceptTrade'},{type:'declineTrade'}];
 if(s.phase==='auction')return [...uniqueBids(s),{type:'passAuction'}];
 if(s.phase==='debt')return [...manageActions(s,id).filter(a=>['mortgage','sell'].includes(a.type)),...(p.cash>=s.debt.amount?[{type:'payDebt'}]:[]),{type:'bankrupt'}];
 const m=manageActions(s,id);
 if(s.phase==='purchase')return [...(p.cash>=BOARD[p.pos].price?[{type:'buy'}]:[]),{type:'startAuction'},...m];
 if(s.phase==='pre')return [...(p.inJail?[{type:'tryDoubles'},{type:'payBail'},...(p.cards.chance+p.cards.chest?[{type:'useCard'}]:[])]:[{type:'roll'}]),...m];
 if(s.phase==='post')return [...(s.extraRoll?[{type:'roll'}]:[{type:'end'}]),...m];
 return [];
}
const auctionNext=s=>{const a=s.auction;
 if(a.active.length===0){log(s,`${BOARD[a.property].name} was not sold at auction.`);s.auction=null;finishLanding(s);return}
 if(a.active.length===1&&a.high===a.active[0]){const winner=a.high;const price=a.bid;invariant(s.players[winner].cash>=price,'Winner lacks cash');s.players[winner].cash-=price;s.deeds[a.property].owner=winner;log(s,`${s.players[winner].name} won ${BOARD[a.property].name} for $${price}.`);s.auction=null;finishLanding(s);return}
 const all=a.active.filter(id=>id!==a.high);
 if(!all.length){if(a.high!==null){a.active=[a.high];auctionNext(s)}else{s.auction=null;finishLanding(s)}return}
 for(let i=1;i<=4;i++){const id=(a.actor+i)%4;if(all.includes(id)){a.actor=id;return}}
 throw new RuleError('Auction cannot advance');
};
const validateOffer=(s,a)=>{const from=s.turn,to=a.to;invariant(Number.isInteger(to)&&to>=0&&to<4&&to!==from&&!s.players[to].bankrupt,'Invalid partner');
 const give=a.give||[],take=a.take||[],giveCash=a.giveCash||0,takeCash=a.takeCash||0;
 invariant(Array.isArray(give)&&Array.isArray(take)&&new Set(give).size===give.length&&new Set(take).size===take.length,'Invalid deed list');
 invariant(Number.isInteger(giveCash)&&giveCash>=0&&Number.isInteger(takeCash)&&takeCash>=0,'Invalid trade cash');
 invariant(giveCash<=s.players[from].cash&&takeCash<=s.players[to].cash,'Trade cash not available');
 for(const [ids,owner] of [[give,from],[take,to]])for(const id of ids){invariant(isOwnable(id)&&s.deeds[id].owner===owner,'Cannot trade unowned deed');
 if(BOARD[id].group)invariant(groupIds(BOARD[id].group).every(k=>!s.deeds[k].buildings),'Sell all buildings in the set before trading')}
 invariant(give.length+take.length+giveCash+takeCash>0,'Empty trade');
 let toInterest=give.reduce((v,id)=>v+(s.deeds[id].mortgaged?Math.ceil(BOARD[id].price*.05):0),0);
 let fromInterest=take.reduce((v,id)=>v+(s.deeds[id].mortgaged?Math.ceil(BOARD[id].price*.05):0),0);
 invariant(s.players[from].cash-giveCash+takeCash>=fromInterest&&s.players[to].cash-takeCash+giveCash>=toInterest,'Not enough cash for mortgage transfer fees');
 return {...a,give,take,giveCash,takeCash,from,to,fromInterest,toInterest};};
const mortgageProperty=(s,id)=>{const d=s.deeds[id],sq=BOARD[id];d.mortgaged=true;const gain=sq.price/2;s.players[s.turn].cash+=gain;log(s,`${currentPlayer(s).name} mortgaged ${sq.name} for $${gain}.`)};
const sellBuilding=(s,id)=>{const d=s.deeds[id],cost=GROUPS[BOARD[id].group].build;s.players[s.turn].cash+=cost/2;
 if(d.buildings===5){d.buildings=4;s.bankHotels++;s.bankHouses-=4}else{d.buildings--;s.bankHouses++}
 log(s,`${currentPlayer(s).name} sold one building on ${BOARD[id].name} for $${cost/2}.`)};
function bankrupt(s){const p=currentPlayer(s),debt=s.debt,creditor=typeof debt.to==='number'?debt.to:null;invariant(p.cash<debt.amount,'You can pay the debt instead of declaring bankruptcy');
 for(const idx of ownDeeds(s,p.id)){
  const d=s.deeds[idx];if(BOARD[idx].type==='property'&&d.buildings){p.cash+=d.buildings*GROUPS[BOARD[idx].group].build/2;d.buildings=0}
  d.owner=creditor; // if the debt is owed to a player, that creditor inherits deeds.
  if(creditor===null){d.mortgaged=false}
 }
 releaseBuildings(s);
 if(creditor!==null)s.players[creditor].cash+=p.cash;else if(debt.to==='pot')s.pot+=p.cash;
 p.cash=0;p.bankrupt=true;p.inJail=false;p.cards={chance:0,chest:0};s.debt=null;log(s,`${p.name} is bankrupt${creditor!==null?` and transferred assets to ${s.players[creditor].name}`:''}.`);
 const survivors=s.players.filter(x=>!x.bankrupt);if(survivors.length<=1){s.winner=survivors[0]?.id??null;s.phase='gameover';log(s,`${survivors[0]?.name||'Nobody'} wins!`)}else nextTurn(s);
}
export function applyAction(input,action){invariant(input&&action&&typeof action.type==='string','Invalid action');const s=structuredClone(input);const id=actorId(s),p=s.players[id];invariant(id>=0&&!p.bankrupt,'Player is not available');
 const allowed=legalActions(s);let ok=allowed.some(a=>a.type===action.type&&a.property===action.property&&a.amount===action.amount);
 if(action.type==='bid'&&s.phase==='auction')ok=Number.isInteger(action.amount)&&action.amount>=s.auction.bid+1&&action.amount<=p.cash;
 if(action.type==='offerTrade'&&['pre','post'].includes(s.phase)&&!p.inJail)ok=true;
 invariant(ok,`Illegal action: ${action.type}`);
 switch(action.type){
 case 'roll':{const dice=rollDice(s),dbl=dice[0]===dice[1];p.doubles=dbl?p.doubles+1:0;s.lastRoll=dice;s.extraRoll=dbl;log(s,`${p.name} rolled ${dice[0]} + ${dice[1]}${dbl?' (doubles)':''}.`);
  if(p.doubles>=3){goToJail(s);break}move(s,dice[0]+dice[1]);break}
 case 'tryDoubles':{const dice=rollDice(s),dbl=dice[0]===dice[1];s.lastRoll=dice;s.extraRoll=false;log(s,`${p.name} rolled ${dice[0]} + ${dice[1]} trying to leave jail.`);
  if(dbl){p.inJail=false;p.jailAttempts=0;log(s,'Doubles! Released from jail.');move(s,dice[0]+dice[1])}
  else{p.jailAttempts++;if(p.jailAttempts>=3){settle(s,50,'pot','mandatory jail fine',{type:'jailMove',steps:dice[0]+dice[1]})}else{s.phase='post';log(s,`${p.name} remains in jail (${p.jailAttempts}/3 failed attempts).`)}}
  break}
 case 'payBail':settle(s,50,'pot','jail bail',{type:'afterBail'});break;
 case 'useCard':{let deck=p.cards.chance?'chance':'chest';invariant(p.cards[deck]>0,'No card');p.cards[deck]--;s.decks[deck].push(CARDS[deck].findIndex(c=>c.kind==='card'));p.inJail=false;p.jailAttempts=0;s.phase='pre';log(s,`${p.name} used a get-out-of-jail card.`);break}
 case 'buy':p.cash-=BOARD[p.pos].price;s.deeds[p.pos].owner=id;log(s,`${p.name} bought ${BOARD[p.pos].name} for $${BOARD[p.pos].price}.`);finishLanding(s);break;
 case 'startAuction':s.phase='auction';s.auction={property:p.pos,bid:0,high:null,actor:s.turn,active:s.players.filter(x=>!x.bankrupt).map(x=>x.id)};log(s,`Auction started for ${BOARD[p.pos].name}.`);break;
 case 'bid':{const a=s.auction;invariant(a.actor===id,'Not your auction turn');a.bid=action.amount;a.high=id;log(s,`${p.name} bid $${a.bid}.`);auctionNext(s);break}
 case 'passAuction':{const a=s.auction;a.active=a.active.filter(x=>x!==id);log(s,`${p.name} passed the auction.`);auctionNext(s);break}
 case 'mortgage':mortgageProperty(s,action.property);s.sideActions++;break;
 case 'unmortgage':{const d=s.deeds[action.property],amount=Math.ceil(BOARD[action.property].price*.55);p.cash-=amount;d.mortgaged=false;s.sideActions++;log(s,`${p.name} redeemed ${BOARD[action.property].name} for $${amount}.`);break}
 case 'build':{const idx=action.property,d=s.deeds[idx],cost=GROUPS[BOARD[idx].group].build;p.cash-=cost;
  if(d.buildings===4){d.buildings=5;s.bankHotels--;s.bankHouses+=4}else{d.buildings++;s.bankHouses--}
  s.sideActions++;log(s,`${p.name} built ${d.buildings===5?'a hotel':'a house'} on ${BOARD[idx].name} for $${cost}.`);break}
 case 'sell':sellBuilding(s,action.property);s.sideActions++;break;
 case 'payDebt':{const debt=s.debt;s.debt=null;settle(s,debt.amount,debt.to,debt.reason,debt.post);break}
 case 'bankrupt':bankrupt(s);break;
 case 'end':nextTurn(s);break;
 case 'offerTrade':{const offer=validateOffer(s,action);s.trade=offer;s.phase='trade';log(s,`${p.name} offered a trade to ${s.players[offer.to].name}.`);break}
 case 'acceptTrade':{const a=s.trade;const src=s.players[a.from],dest=s.players[a.to];src.cash+=a.takeCash-a.giveCash-a.fromInterest;dest.cash+=a.giveCash-a.takeCash-a.toInterest;s.pot+=a.fromInterest+a.toInterest;
  for(const i of a.give)s.deeds[i].owner=a.to;for(const i of a.take)s.deeds[i].owner=a.from;
  s.trade=null;s.phase=s.extraRoll?'pre':s.lastRoll[0]===0?'pre':'post';log(s,`${dest.name} accepted the trade from ${src.name}.`);break}
 case 'declineTrade':{const partner=s.players[s.trade.to];s.trade=null;s.phase=s.extraRoll?'pre':s.lastRoll[0]===0?'pre':'post';log(s,`${partner.name} declined the trade.`);break}
 default:throw new RuleError('Unknown action');
 }
 assertInvariants(s);return s;
}
export function assertInvariants(s){invariant(s.players.length===4,'Requires four players');invariant(s.pot>=0&&Number.isInteger(s.pot),'Invalid pot');
 for(const p of s.players){invariant(Number.isInteger(p.cash)&&p.cash>=0,'Invalid balance');invariant(p.pos>=0&&p.pos<40,'Bad position')}
 let houses=0,hotels=0;for(const [idx,d] of Object.entries(s.deeds)){invariant(d.owner===null||Number.isInteger(d.owner)&&d.owner>=0&&d.owner<4,'Bad owner');invariant(d.buildings>=0&&d.buildings<=5,'Bad building count');if(d.buildings===5)hotels++;else houses+=d.buildings;
  if(BOARD[idx].type!=='property')invariant(d.buildings===0,'Buildings only on streets');
  if(d.buildings>0){invariant(!d.mortgaged,'Cannot build on mortgaged land');invariant(ownsSet(s,d.owner,BOARD[idx].group),'Building without color set')}
 }
 invariant(s.bankHouses===32-houses&&s.bankHotels===12-hotels,'Bank building inventory mismatch');
 for(const g of Object.keys(GROUPS)){const ids=groupIds(g),d=ids.map(i=>s.deeds[i]);if(d.some(x=>x.buildings)){const b=d.map(x=>x.buildings);invariant(Math.max(...b)-Math.min(...b)<=1,'Uneven construction')}}
 return true;
}
export function gameSummary(s){const id=actorId(s);return {round:s.round,phase:s.phase,acting:s.players[id].name,turn:s.players[s.turn].name,lastRoll:s.lastRoll,pot:s.pot,bank:{houses:s.bankHouses,hotels:s.bankHotels},players:s.players.map(p=>({id:p.id,name:p.name,cash:p.cash,position:p.pos,space:BOARD[p.pos].name,bankrupt:p.bankrupt,inJail:p.inJail,jailAttempts:p.jailAttempts,cards:p.cards,properties:ownDeeds(s,p.id).map(i=>({id:i,name:BOARD[i].name,mortgaged:s.deeds[i].mortgaged,buildings:s.deeds[i].buildings}))})),currentSpace:s.phase==='auction'?BOARD[s.auction.property]:BOARD[s.players[s.turn].pos],auction:s.auction,trade:s.trade,debt:s.debt,legalActions:legalActions(s),recentLog:s.log.slice(-12)};}
export function playerNetWorth(s,id){const p=s.players[id];return p.cash+ownDeeds(s,id).reduce((v,i)=>v+(s.deeds[i].mortgaged?BOARD[i].price/2:BOARD[i].price)+(s.deeds[i].buildings||0)*(GROUPS[BOARD[i].group]?.build||0),0)}