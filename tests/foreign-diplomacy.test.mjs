import test from 'node:test';
import assert from 'node:assert/strict';
import {COUNTRY_IDS,activeForeignTreaties,advanceTurn,createGame,foreignMarketSummary,marketContext} from '../dist/engine.mjs';
import {previewProposal} from '../dist/negotiations.mjs';
import {previewTreaty} from '../dist/treaties.mjs';
import {runForeignDiplomacy} from '../dist/foreign-diplomacy.mjs';

const play=(state,count)=>{for(let index=0;index<count;index++)state=advanceTurn(state,'maintain');return state;};
const total=(state,metric)=>COUNTRY_IDS.reduce((sum,id)=>sum+state.countries[id][metric],0);
const record=(overrides={})=>({id:'foreign-cera-nord-1-trade_sell',playerId:'cera',targetId:'nord',kind:'trade_sell',food:4,money:8,duration:4,status:'active',startTurn:1,endTurn:5,fulfilled:0,breaches:0,streak:0,lastOutcome:null,events:[],...overrides});

test('new worlds form deterministic foreign-only networks for every governed country',()=>{
 for(const playerId of COUNTRY_IDS){
  const first=advanceTurn(createGame(playerId),'maintain'),replay=advanceTurn(createGame(playerId),'maintain');
  assert.deepEqual(first.foreignTreaties,replay.foreignTreaties);assert.ok(first.foreignTreaties.length>0);
  assert.ok(first.foreignTreaties.every(item=>item.playerId!==playerId&&item.targetId!==playerId));
  assert.ok(first.lastForeignEvents.some(item=>item.type==='formed'&&item.playerImpact?.text.includes('제안 반응')));
 }
});

test('foreign trade fulfills under real limits and conserves transferred food and money',()=>{
 const state=createGame('altia');state.turn=2;state.foreignTreaties=[record({startTurn:2,endTurn:6})];state.countries.cera.food=70;state.countries.cera.treasury=40;state.countries.nord.food=40;state.countries.nord.treasury=40;
 const food=total(state,'food'),money=total(state,'treasury'),actions=[];runForeignDiplomacy(state,actions);
 assert.equal(state.foreignTreaties[0].fulfilled,1);assert.equal(total(state,'food'),food);assert.equal(total(state,'treasury'),money);
 assert.ok(actions.some(item=>item.source==='foreign_treaty'&&item.type==='trade'&&item.food===4&&item.money===8));
 assert.ok(Object.values(state.countries).every(country=>country.food>=0&&country.food<=100&&country.treasury>=0&&country.treasury<=100));
});

test('vulnerable foreign countries form food alliances and transfer only real donor resources',()=>{
 const formed=advanceTurn(createGame('lumen',{worldGoalStartTurn:999}),'maintain'),alliance=formed.foreignTreaties.find(item=>item.kind==='alliance');assert.ok(alliance);assert.ok(![alliance.playerId,alliance.targetId].includes('lumen'));
 const state=createGame('lumen');state.turn=2;state.foreignTreaties=[record({id:'foreign-cera-solis-1-alliance',targetId:'solis',kind:'alliance',food:5,money:2,startTurn:2,endTurn:6})];state.countries.cera.food=70;state.countries.cera.treasury=50;state.countries.solis.food=25;state.countries.solis.treasury=15;
 const food=total(state,'food'),money=total(state,'treasury'),actions=[];runForeignDiplomacy(state,actions);assert.equal(total(state,'food'),food);assert.equal(total(state,'treasury'),money);assert.equal(state.countries.solis.food,30);assert.equal(state.countries.solis.treasury,17);assert.ok(actions.some(item=>item.source==='foreign_treaty'&&item.type==='aid'));
});

test('two resource failures cancel a foreign treaty and one natural relation collapse breaks another',()=>{
 const failed=createGame('marin');failed.turn=2;failed.foreignTreaties=[record({startTurn:1,endTurn:8})];failed.countries.cera.food=20;runForeignDiplomacy(failed,[]);failed.turn=3;runForeignDiplomacy(failed,[]);
 assert.equal(failed.foreignTreaties[0].status,'cancelled');assert.ok(failed.lastForeignEvents.some(item=>item.type==='cancelled'));
 const broken=createGame('altia');broken.turn=3;broken.foreignTreaties=[record({startTurn:1,endTurn:8,fulfilled:1})];broken.relations['cera:nord']=20;runForeignDiplomacy(broken,[]);
 assert.equal(broken.foreignTreaties[0].status,'broken');assert.ok(broken.lastForeignEvents.some(item=>item.type==='broken'));
});

test('foreign treaty completes exactly at its exclusive end and remains in bounded history',()=>{
 const state=createGame('solis');state.foreignTreaties=[record({startTurn:2,endTurn:6})];state.countries.cera.food=90;state.countries.nord.food=20;state.countries.nord.treasury=80;
 for(const turn of [2,3,4,5]){state.turn=turn;runForeignDiplomacy(state,[]);}
 assert.equal(state.foreignTreaties[0].status,'completed');assert.equal(state.foreignTreaties[0].fulfilled,4);assert.ok(state.foreignTreatyHistory.some(item=>item.id===state.foreignTreaties[0].id));
 assert.ok(state.lastForeignEvents.some(item=>item.type==='completed'));
});

test('network commitments change proposal and treaty scores with the same factual reason',()=>{
 const state=createGame('lumen');state.foreignTreaties=[record({food:6,money:8})];
 const context=marketContext(state,'cera','buy');assert.equal(context.reservedFood,6);assert.ok(context.scoreDelta<0);
 const without=createGame('lumen'),spot={targetId:'cera',kind:'buy',food:3,money:8},long={targetId:'cera',kind:'trade_buy',food:3,money:8,duration:4};
 assert.ok(previewProposal(state,spot).score<previewProposal(without,spot).score);assert.ok(previewTreaty(state,long).score<previewTreaty(without,long).score);
 assert.ok(previewProposal(state,spot).reasons.some(reason=>reason.includes('이미 약속')));assert.ok(previewTreaty(state,long).reasons.some(reason=>reason.includes('기존 외국 간 공급')));
});

test('fulfilled foreign routes have an explicit numeric effect on governed trade income',()=>{
 const marin=createGame('marin');marin.turn=2;marin.foreignTreaties=[record({startTurn:2,endTurn:6})];marin.countries.cera.food=80;marin.countries.nord.food=30;const before=marin.countries.marin.treasury,treasury=total(marin,'treasury');runForeignDiplomacy(marin,[]);
 assert.equal(marin.countries.marin.treasury,before+1);assert.equal(total(marin,'treasury'),treasury);assert.equal(foreignMarketSummary(marin).playerTreasuryDelta,1);assert.ok(marin.lastForeignEvents.some(item=>item.type==='market'&&item.playerImpact.treasury===1));
 const lumen=createGame('lumen');lumen.turn=2;lumen.foreignTreaties=[record({startTurn:2,endTurn:6})];lumen.countries.cera.food=80;lumen.countries.nord.food=30;const lumenBefore=lumen.countries.lumen.treasury,lumenTreasury=total(lumen,'treasury'),lumenActions=[];runForeignDiplomacy(lumen,lumenActions);assert.equal(lumen.countries.lumen.treasury,lumenBefore-1);assert.equal(total(lumen,'treasury'),lumenTreasury);assert.equal(foreignMarketSummary(lumen).playerTreasuryDelta,-1);assert.ok(lumenActions.some(item=>item.source==='foreign_network'&&item.type==='market'));assert.ok(!lumenActions.some(item=>item.source==='foreign_network'&&item.type==='trade'));
});

test('export income changes only when a real Lumen or Cera structural buyer switches demand',()=>{
 for(const playerId of ['lumen','cera']){
  for(const targetId of ['altia',playerId==='lumen'?'cera':'lumen']){
   const state=createGame(playerId);state.turn=2;state.foreignTreaties=[record({id:`foreign-marin-${targetId}-1-trade_sell`,playerId:'marin',targetId,startTurn:2,endTurn:6})];state.countries.marin.food=80;state.countries[targetId].food=30;state.countries[targetId].treasury=50;
   const before=state.countries[playerId].treasury,treasury=total(state,'treasury'),actions=[];runForeignDiplomacy(state,actions);assert.equal(state.countries[playerId].treasury,before);assert.equal(total(state,'treasury'),treasury);assert.ok(!state.lastForeignEvents.some(item=>item.type==='market'&&item.playerImpact?.treasury<0));assert.ok(!actions.some(item=>item.source==='foreign_network'&&item.playerImpact?.treasury<0));
  }
 }
 for(const playerId of ['lumen','cera']){
  // This long-run fixture isolates the pre-V29 structural-buyer seam; V29 strategy has its own replay coverage.
  let state=createGame(playerId,{foreignSiteStartTurn:201,foreignStrategyStartTurn:999});for(let turn=0;turn<200;turn++)state=advanceTurn(state,'maintain');
  const negative=state.history.flatMap(item=>item.worldActions).filter(item=>item.source==='foreign_network'&&item.playerImpact?.treasury<0);assert.ok(negative.length>0);assert.ok(negative.every(item=>['nord','marin','solis'].includes(item.countryId)));assert.ok(negative.every(item=>item.type==='market'));
 }
});

test('Lumen embargo cannot lose export income that the policy already reduced to zero',()=>{
 const state=createGame('lumen');state.turn=2;state.activePolicy='embargo';state.foreignTreaties=[record({startTurn:2,endTurn:6})];state.countries.cera.food=80;state.countries.nord.food=30;state.countries.nord.treasury=50;
 const before=state.countries.lumen.treasury,treasury=total(state,'treasury'),actions=[];runForeignDiplomacy(state,actions);
 assert.equal(state.countries.lumen.treasury,before);assert.equal(total(state,'treasury'),treasury);assert.equal(foreignMarketSummary(state).playerTreasuryDelta,0);assert.ok(!state.lastForeignEvents.some(item=>item.type==='market'&&item.playerImpact?.treasury<0));assert.ok(!actions.some(item=>item.source==='foreign_network'&&item.playerImpact?.treasury<0));
});

test('missing activation marker is legacy-disabled and a later cutoff preserves old quarters',()=>{
 const legacy=createGame('nord',{networkStartTurn:4}),reference=createGame('nord',{networkStartTurn:4});delete legacy.networkStartTurn;
 assert.deepEqual(advanceTurn(legacy,'maintain').countries,advanceTurn(reference,'maintain').countries);assert.equal(advanceTurn(legacy,'maintain').foreignTreaties.length,0);
 let delayed=createGame('nord',{networkStartTurn:4});for(let turn=0;turn<3;turn++)delayed=advanceTurn(delayed,'maintain');assert.equal(delayed.foreignTreaties.length,0);delayed=advanceTurn(delayed,'maintain');assert.ok(delayed.foreignTreaties.length>0);
});

test('sixty quarters remain deterministic bounded and never assign autonomous player policy',()=>{
 for(const playerId of COUNTRY_IDS){const initial=createGame(playerId),first=play(initial,60),second=play(createGame(playerId),60);assert.deepEqual(first,second);assert.ok(first.foreignTreaties.length<=50);assert.ok(first.foreignTreatyHistory.length<=30);assert.ok(first.foreignTreaties.every(item=>item.playerId!==playerId&&item.targetId!==playerId));assert.ok(first.history.flatMap(item=>item.worldActions).filter(item=>item.source==='foreign_treaty').every(item=>item.countryId!==playerId&&item.targetId!==playerId));}
});
