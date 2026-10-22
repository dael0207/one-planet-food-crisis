import test from 'node:test';
import assert from 'node:assert/strict';
import {COUNTRY_IDS,activeTreaties,advanceTurn,createGame,getAction,getReliability,previewTreaty,treatyCommand} from '../dist/engine.mjs';
import {getRelation} from '../dist/negotiations.mjs';
import {runTreaties} from '../dist/treaties.mjs';

const play=(state,ids)=>ids.reduce((current,id)=>advanceTurn(current,id),state);
const active=(state,overrides={})=>({id:'treaty-test',playerId:state.playerId,targetId:'nord',kind:'trade_buy',food:4,money:8,duration:4,status:'active',startTurn:1,endTurn:5,fulfilled:0,breaches:0,streak:0,lastOutcome:null,events:[],...overrides});
const execute=(state,treaty)=>{state.treaties=[treaty];state.lastTreatyEvents=[];const parts=[],actions=[];runTreaties(state,parts,actions);return {parts,actions,treaty};};

test('treaty commands are canonical and invalid duplicates or ranges cannot advance time',()=>{
 const state=createGame(),draft={targetId:'nord',kind:'trade_buy',food:3,money:6,duration:4},command=treatyCommand(draft);
 assert.equal(command,'treaty:nord:trade_buy:3:6:4');assert.ok(getAction(state,command));
 for(const id of ['treaty:nord:trade_buy:03:6:4','treaty:lumen:trade_buy:3:6:4','treaty:nord:trade_buy:9:6:4','treaty:nord:alliance:3:7:4','treaty:nord:trade_buy:3:6:6'])assert.equal(getAction(state,id),null);
 const accepted=advanceTurn(state,command);assert.equal(getAction(accepted,command),null);assert.equal(state.turn,0);
 assert.ok(getAction(accepted,'treaty:nord:alliance:3:2:4'));
});

test('relation reliability stock price and duration determine a meaningful response',()=>{
 const draft={targetId:'nord',kind:'trade_buy',food:3,money:6,duration:4},friendly=createGame(),hostile=createGame();
 hostile.relations['lumen:nord']=5;hostile.reliability.lumen=10;hostile.countries.nord.food=24;
 const yes=previewTreaty(friendly,draft),no=previewTreaty(hostile,{...draft,duration:12,money:2});
 assert.equal(yes.response,'accept');assert.equal(no.response,'reject');assert.ok(yes.score>no.score);assert.ok(no.reasons.length>=4);
});

test('four eight and twelve quarter treaties execute exactly their stated duration and complete',()=>{
 for(const duration of [4,8,12]){
  let state=createGame(),command=treatyCommand({targetId:'nord',kind:'trade_buy',food:1,money:3,duration});state=advanceTurn(state,command);
  assert.equal(activeTreaties(state)[0].fulfilled,1);state=play(state,Array(duration-1).fill('maintain'));
  const treaty=state.treaties.find(item=>item.id.includes('treaty-lumen-nord'));assert.equal(treaty.fulfilled,duration);assert.equal(treaty.status,'completed');assert.equal(treaty.endTurn,treaty.startTurn+duration);
  const food=state.countries.lumen.food;state=advanceTurn(state,'maintain');assert.equal(state.treaties.find(item=>item.id===treaty.id).fulfilled,duration);assert.ok(Number.isFinite(food));
 }
});

test('trade conserves food and money and charges proportional payment on partial delivery',()=>{
 const state=createGame();state.turn=1;state.countries.nord.food=23;state.countries.nord.treasury=40;state.countries.lumen.food=50;state.countries.lumen.treasury=100;
 const treaty=active(state),beforeFood=state.countries.nord.food+state.countries.lumen.food,beforeMoney=state.countries.nord.treasury+state.countries.lumen.treasury;
 execute(state,treaty);assert.equal(state.countries.nord.food+state.countries.lumen.food,beforeFood);assert.equal(state.countries.nord.treasury+state.countries.lumen.treasury,beforeMoney);
 assert.equal(treaty.lastOutcome.food,3);assert.equal(treaty.lastOutcome.money,6);assert.equal(treaty.breaches,1);assert.equal(treaty.lastOutcome.actorId,'nord');
});

test('trade respects seller cash ceiling and never drives any resource outside bounds',()=>{
 const state=createGame();state.turn=1;state.countries.nord.food=80;state.countries.nord.treasury=99;state.countries.lumen.food=98;state.countries.lumen.treasury=80;
 const treaty=active(state);execute(state,treaty);assert.equal(treaty.lastOutcome.food,0);assert.equal(treaty.lastOutcome.actorId,'nord');
 for(const country of Object.values(state.countries))for(const metric of ['food','treasury'])assert.ok(country[metric]>=0&&country[metric]<=100,`${country.id} ${metric}`);
});

test('partial delivery does not misidentify a seller whose full nominal payment still fits',()=>{
 const state=createGame();state.turn=1;state.countries.nord.food=80;state.countries.nord.treasury=91;state.countries.lumen.food=98;state.countries.lumen.treasury=80;
 const treaty=active(state);execute(state,treaty);assert.equal(treaty.lastOutcome.food,2);assert.equal(treaty.lastOutcome.money,4);assert.equal(treaty.lastOutcome.actorId,'lumen');
});

test('seller embargo and buyer cash or capacity default name the responsible country',()=>{
 const embargo=createGame();embargo.turn=1;embargo.activePolicy='embargo';const sell=active(embargo,{kind:'trade_sell'});execute(embargo,sell);assert.equal(sell.lastOutcome.food,0);assert.equal(sell.lastOutcome.actorId,'lumen');
 const cash=createGame();cash.turn=1;cash.countries.lumen.treasury=0;const buy=active(cash);execute(cash,buy);assert.equal(buy.lastOutcome.actorId,'lumen');
 const cap=createGame();cap.turn=1;cap.countries.lumen.food=100;const capped=active(cap);execute(cap,capped);assert.equal(capped.lastOutcome.actorId,'lumen');
});

test('mutual alliance sends real aid in either direction and standby creates nothing',()=>{
 const first=createGame();first.turn=1;first.countries.nord.food=30;const a=active(first,{kind:'alliance',food:5,money:3});execute(first,a);assert.equal(a.lastOutcome.actorId,'lumen');assert.equal(a.lastOutcome.promisedMoney,0);assert.equal(first.countries.nord.food,35);
 const second=createGame();second.turn=1;second.countries.lumen.food=30;const b=active(second,{kind:'alliance',food:5,money:3});execute(second,b);assert.equal(b.lastOutcome.actorId,'nord');assert.equal(second.countries.lumen.food,35);
 const standby=createGame();standby.turn=1;const total=COUNTRY_IDS.reduce((sum,id)=>sum+standby.countries[id].food,0),c=active(standby,{kind:'alliance'});execute(standby,c);assert.equal(c.fulfilled,0);assert.equal(c.lastOutcome.type,'standby');assert.equal(standby.lastTreatyEvents.at(-1).type,'standby');assert.equal(COUNTRY_IDS.reduce((sum,id)=>sum+standby.countries[id].food,0),total);
});

test('two consecutive breaches cancel a treaty and affect relations with named observers',()=>{
 const state=createGame();state.turn=1;state.countries.nord.food=20;const treaty=active(state),beforeReliability=getReliability(state,'nord'),beforeObserver=getRelation(state,'cera','nord');execute(state,treaty);
 state.turn=2;execute(state,treaty);assert.equal(treaty.status,'cancelled');assert.equal(treaty.breaches,2);assert.equal(getReliability(state,'nord'),beforeReliability-12);assert.equal(getRelation(state,'cera','nord'),beforeObserver-2);
 assert.ok(state.lastTreatyEvents.some(event=>event.type==='breach'&&event.observers?.some(observer=>observer.countryId==='cera')));assert.ok(treaty.events.some(event=>event.type==='cancelled'));
});

test('voluntary break ends obligations before execution and causes broad reputation penalties',()=>{
 let state=createGame(),command=treatyCommand({targetId:'nord',kind:'trade_buy',food:3,money:6,duration:8});state=advanceTurn(state,command);const treaty=activeTreaties(state)[0],relation=getRelation(state,'lumen','nord'),reliability=getReliability(state,'lumen'),observer=getRelation(state,'lumen','cera');
 const fulfilled=treaty.fulfilled;state=advanceTurn(state,`break:${treaty.id}`);const broken=state.treaties.find(item=>item.id===treaty.id);
 assert.equal(broken.status,'broken');assert.equal(broken.fulfilled,fulfilled);assert.equal(getRelation(state,'lumen','nord'),relation-12);assert.equal(getReliability(state,'lumen'),reliability-12);assert.equal(getRelation(state,'lumen','cera'),observer-2);assert.equal(getAction(state,`break:${treaty.id}`),null);
});

test('completed commitments improve bilateral and third-country confidence',()=>{
 let state=createGame('lumen',{worldGoalStartTurn:999}),before=getRelation(state,'lumen','nord'),observer=getRelation(state,'lumen','cera'),reliability=getReliability(state,'lumen');state=advanceTurn(state,'treaty:nord:trade_buy:1:3:4');state=play(state,Array(3).fill('maintain'));
 const treaty=state.treaties.find(item=>item.kind==='trade_buy');assert.equal(treaty.status,'completed');assert.equal(getRelation(state,'lumen','nord'),before+7);assert.equal(getRelation(state,'lumen','cera'),observer+1);assert.equal(getReliability(state,'lumen'),reliability+treaty.duration+2);
});

test('all six campaigns replay treaty commands deterministically',()=>{
 for(const playerId of COUNTRY_IDS){const state=createGame(playerId),targetId=COUNTRY_IDS.find(id=>id!==playerId),draft={targetId,kind:'alliance',food:1,money:0,duration:4},command=treatyCommand(draft);const next=play(state,[command,'maintain','maintain']);assert.deepEqual(next,play(createGame(playerId),next.commands));}
});

test('a legacy V5 state with no treaties keeps the same country outcomes',()=>{
 const current=createGame(),legacy=structuredClone(current);legacy.version=5;delete legacy.treaties;delete legacy.lastTreatyEvents;delete legacy.reliability;
 const modern=advanceTurn(current,'maintain'),migrated=advanceTurn(legacy,'maintain');assert.deepEqual(migrated.countries,modern.countries);assert.deepEqual(migrated.relations,modern.relations);assert.equal(migrated.treaties.length,0);
});
