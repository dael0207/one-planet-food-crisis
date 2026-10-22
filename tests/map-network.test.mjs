import test from 'node:test';
import assert from 'node:assert/strict';
import {COUNTRY_IDS,advanceTurn,createGame} from '../dist/engine.mjs';
import {mapTreatyChanges,mapTreatyLinks} from '../dist/map-network.mjs';
import {actualShipmentRoutes} from '../dist/map.mjs';

const own=(overrides={})=>({id:'own-nord-trade',playerId:'lumen',targetId:'nord',kind:'trade_buy',food:3,money:6,duration:4,status:'active',startTurn:2,endTurn:6,fulfilled:1,breaches:0,events:[],...overrides});
const foreign=(overrides={})=>({id:'foreign-cera-nord',playerId:'cera',targetId:'nord',kind:'trade_sell',food:4,money:8,duration:4,status:'active',startTurn:3,endTurn:7,fulfilled:0,breaches:0,events:[],...overrides});

test('actual player acceptance and foreign formation expose their real first-execution timing',()=>{
 for(const playerId of COUNTRY_IDS){
  const targetId=COUNTRY_IDS.find(id=>id!==playerId),player=advanceTurn(createGame(playerId,{networkStartTurn:99}),`treaty:${targetId}:trade_buy:1:20:4`),accepted=mapTreatyLinks(player).find(link=>link.source==='player');
  assert.deepEqual([accepted.fromId,accepted.toId,accepted.kind,accepted.status,accepted.remaining,accepted.startsIn],[targetId,playerId,'trade','new',3,0]);
  const formedState=advanceTurn(createGame(playerId),'maintain'),formedRecord=formedState.foreignTreaties[0],formed=mapTreatyLinks(formedState).find(link=>link.id===formedRecord.id);
  assert.equal(formed.status,'new');assert.equal(formed.source,'foreign');assert.equal(formed.startsIn,1);assert.equal(formed.remaining,formedRecord.duration);
 }
});

test('trade direction and alliance canonicalization preserve coexisting relationship types',()=>{
 const state={turn:2,playerId:'lumen',treaties:[own(),own({id:'own-cera-sell',targetId:'cera',kind:'trade_sell'}),own({id:'own-nord-alliance',kind:'alliance',money:2})]};
 const links=mapTreatyLinks(state),buy=links.find(link=>link.id==='own-nord-trade'),sell=links.find(link=>link.id==='own-cera-sell'),alliance=links.find(link=>link.kind==='alliance');
 assert.deepEqual([buy.fromId,buy.toId],['nord','lumen']);assert.deepEqual([sell.fromId,sell.toId],['lumen','cera']);assert.deepEqual([alliance.fromId,alliance.toId],['lumen','nord']);
 assert.equal(links.filter(link=>new Set([link.fromId,link.toId]).has('lumen')&&new Set([link.fromId,link.toId]).has('nord')).length,2);
 assert.deepEqual(mapTreatyLinks(state,'alliance').map(link=>link.id),['own-nord-alliance']);assert.equal(mapTreatyLinks(state,'trade').length,2);
});

test('a real close remains for its event quarter and leaves no stale ghost next quarter',()=>{
 const record=own({status:'broken',resolvedTurn:4,events:[{treatyId:'own-nord-trade',turn:4,type:'broken',text:'파기'}]});
 const state={turn:4,treaties:[record],lastTreatyEvents:[record.events[0]]};
 assert.equal(mapTreatyLinks(state)[0].status,'broken');assert.deepEqual(mapTreatyChanges(state).map(link=>link.id),[record.id]);
 state.turn=5;state.lastTreatyEvents=[];assert.deepEqual(mapTreatyLinks(state),[]);assert.deepEqual(mapTreatyChanges(state),[]);
});

test('exclusive expiry counts future executions exactly and completion appears only when honored',()=>{
 const activeState={turn:4,treaties:[own({startTurn:2,endTurn:6})]};
 assert.equal(mapTreatyLinks(activeState)[0].remaining,1);
 const completed=own({status:'completed',startTurn:2,endTurn:6,fulfilled:4,events:[{treatyId:'own-nord-trade',turn:5,type:'completed',text:'완료'}]});
 assert.equal(mapTreatyLinks({turn:5,treaties:[completed],lastTreatyEvents:completed.events})[0].status,'completed');
 assert.deepEqual(mapTreatyLinks({turn:6,treaties:[own({startTurn:2,endTurn:6})]}),[]);
});

test('rejected, self-targeted, expired and one-shot negotiations never fabricate links',()=>{
 const state={turn:5,playerId:'lumen',treaties:[own({status:'rejected'}),own({id:'self',targetId:'lumen'}),own({id:'expired',endTurn:5})],negotiations:[{id:'one-shot',playerId:'lumen',targetId:'nord',kind:'trade_buy',status:'accepted'}],requests:[{id:'offer',fromId:'cera',type:'trade',status:'pending'}],history:[{worldActions:[{countryId:'cera',targetId:'nord',type:'trade'}]}]};
 assert.deepEqual(mapTreatyLinks(state),[]);
});

test('legacy supply agreements include trade only and duplicate records prefer canonical treaty data',()=>{
 const duplicate=foreign(),state={turn:3,foreignTreaties:[duplicate],foreignTreatyHistory:[{...duplicate,food:99}],agreements:[{id:'legacy-trade',fromId:'cera',targetId:'lumen',type:'trade',startTurn:1,endTurn:5,food:3,treasury:4},{id:'legacy-tech',fromId:'altia',targetId:'lumen',type:'technology',startTurn:1,endTurn:5,food:3,treasury:4},{id:duplicate.id,fromId:'marin',targetId:'lumen',type:'trade',startTurn:1,endTurn:5,food:88,treasury:88}]};
 const links=mapTreatyLinks(state);
 assert.equal(links.find(link=>link.id===duplicate.id).food,4);assert.equal(links.filter(link=>link.id===duplicate.id).length,1);
 assert.equal(links.find(link=>link.id==='legacy-trade').source,'supply');assert.ok(!links.some(link=>link.id==='legacy-tech'));
});

test('partial inputs are pure and output order is deterministic',()=>{
 assert.deepEqual(mapTreatyLinks(null),[]);assert.deepEqual(mapTreatyLinks({turn:1,treaties:[null,{}]}),[]);
 const state={turn:3,treaties:[own({id:'z',targetId:'cera'}),own({id:'a'})],foreignTreaties:[foreign()]},before=structuredClone(state);
 const first=mapTreatyLinks(state),second=mapTreatyLinks(state);
 assert.deepEqual(first,second);assert.deepEqual(state,before);assert.deepEqual(first.map(link=>link.id),['z','foreign-cera-nord','a']);
});

test('shipment mode shows executions only, never baseline or undelivered promises',()=>{
 const initial={turn:0,playerId:'lumen',activePolicy:null,history:[],agreements:[]};
 const promised={...initial,turn:2,agreements:[{id:'supply',type:'trade',fromId:'cera',targetId:'lumen',startTurn:1,endTurn:5}]};
 const delivered={...promised,history:[{worldActions:[{countryId:'cera',targetId:'lumen',type:'trade',food:4,text:'식량 4 운송'}]}]};
 assert.deepEqual(actualShipmentRoutes(initial),[]);
 assert.deepEqual(actualShipmentRoutes(promised),[]);
 assert.deepEqual(actualShipmentRoutes(delivered).map(route=>[route.countryId,route.targetId,route.liveAction]),[['cera','lumen',true]]);
});
