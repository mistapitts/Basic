import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {BOARD,GROUPS,PLAYER_COLORS,newGame,currentActor} from '../engine.mjs';

const ui=await readFile(new URL('../ui.mjs',import.meta.url),'utf8');
const css=await readFile(new URL('../styles.css',import.meta.url),'utf8');
const boardPart=ui.slice(ui.indexOf('function tilePos('),ui.indexOf('function renderPlayers()'));
const actionPart=ui.slice(ui.indexOf('function adoptAction('),ui.indexOf('function actionLabel('));
assert(boardPart.startsWith('function tilePos(')&&boardPart.includes('function renderBoard()'));
assert(actionPart.startsWith('function adoptAction(')&&actionPart.includes('function chooseAction('));

const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'$'+Number(n||0).toLocaleString('en-US');
function renderTestBoard(state,selected){
 const board={innerHTML:''};
 const document={querySelector:s=>s==='#board'?board:null,querySelectorAll:()=>[]};
 const ctx={state,selected,document,$:selector=>document.querySelector(selector),BOARD,GROUPS,PLAYER_COLORS,currentActor,money,escapeHtml};
 vm.runInNewContext(boardPart+'\nrenderBoard();',ctx,{timeout:1000});
 return board.innerHTML;
}
function findTile(html,id){
 const at=html.indexOf('data-tile="'+id+'"');
 assert(at>=0,'Tile #'+id+' exists on the board');
 const start=html.lastIndexOf('<button',at);
 const end=html.indexOf('</button>',at);
 assert(start>=0&&end>=0,'Tile #'+id+' has valid markup');
 return html.slice(start,end+'</button>'.length);
}
test('human position marker follows actual coordinates even when inspector still selects old tile',()=>{
 const state=newGame(123);state.players[0].pos=6;
 let html=renderTestBoard(state,0);
 assert.match(findTile(html,6),/human-location/);assert.match(findTile(html,6),/YOU ARE HERE/);
 assert.doesNotMatch(findTile(html,0),/human-location/);
 state.players[0].pos=11;
 html=renderTestBoard(state,6);
 assert.match(findTile(html,11),/human-location/);
 assert.match(findTile(html,11),/class="pawn board-pawn human-pawn"/);
 assert.match(findTile(html,6),/selected/);
 assert.doesNotMatch(findTile(html,6),/human-location/);
 state.players[0].pos=14;
 html=renderTestBoard(state,11);
 assert.match(findTile(html,14),/human-location/);
 assert.doesNotMatch(findTile(html,11),/human-location/);
});
test('all four pawns show identifiable labels and human location is highlighted',()=>{
 const state=newGame(1);
 state.players.forEach((p,i)=>{p.pos=6+i});
 const html=renderTestBoard(state,0);
 assert(findTile(html,6).includes('>YOU</span>'));
 for(const [i,letter] of [[7,'E'],[8,'S'],[9,'O']])assert(findTile(html,i).includes('>'+letter+'</span>'));
 assert(css.includes('.tile.human-location{'));
 assert(css.includes('.player-position{'));
});
test('applying a move keeps board selection in step with the position and informs human',()=>{
 const original=newGame(123),next=structuredClone(original);
 original.players[0].pos=6;next.players[0].pos=11;
 let saves=0,renders=0,messages=[];
 const ctx={state:original,selected:6,BOARD,save:()=>saves++,render:()=>renders++,notify:t=>messages.push(t)};
 const args={...ctx,next};
 vm.runInNewContext(actionPart+';adoptAction(next,0,6);',args,{timeout:1000});
 assert.equal(args.selected,11);
 assert.equal(args.state.players[0].pos,11);
 assert.equal(messages.length,1);
 assert.match(messages[0],/Orchid Street/);
 assert.equal(renders,1);assert.equal(saves,1);
});
