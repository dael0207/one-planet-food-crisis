import test from 'node:test';
import assert from 'node:assert/strict';

import {advanceTurn, createGame, getAction, SITE_DEFS, SITE_KINDS, siteView} from '../dist/engine.mjs';
import {runSiteEffects, siteAction} from '../dist/site-operations.mjs';
import {loadGame, saveGame} from '../dist/storage.mjs';

const values=new Map();
globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
const conflict=(playerId,foreignIds)=>({id:'site-blockade',status:'active',type:'trade_sanctions',initiatorId:foreignIds[0],targetId:playerId,sanctionMembers:foreignIds,responseMembers:[playerId],formedTurn:1,startTurn:1,endTurn:20,duration:19,playerStance:null,stanceTurn:null,events:[],reason:'항만 봉쇄'});

test('V24 site upgrade commands expose the canonical action contract', () => {
  const state = createGame('marin');
  const action = getAction(state, 'site:farm:upgrade');

  assert.equal(action.id, 'site:farm:upgrade');
  assert.equal(action.cost, 12);
  assert.equal(action.foodCost, 0);
  assert.deepEqual(action.site, {kind: 'farm', operation: 'upgrade'});
  assert.match(action.forecast, /분기/);
});

test('V24 site construction takes two quarters and starts producing on completion', () => {
  let state = createGame('marin');
  state = advanceTurn(state, 'site:farm:upgrade');

  assert.equal(state.siteLevels.farm, 0);
  assert.equal(state.projects.some(project => project.type === 'site' && project.siteKind === 'farm'), true);
  assert.equal(siteView(state,'marin','farm').stage,'started');

  const afterOneQuarter = advanceTurn(state, 'maintain');
  assert.equal(afterOneQuarter.siteLevels.farm, 0);
  assert.equal(siteView(afterOneQuarter,'marin','farm').stage,'building');

  const completed = advanceTurn(afterOneQuarter, 'maintain');
  const baseline = advanceTurn(advanceTurn(advanceTurn(createGame('marin'), 'maintain'), 'maintain'), 'maintain');

  assert.equal(completed.siteLevels.farm, 1);
  assert.equal(siteView(completed,'marin','farm').stage,'completed');
  assert.equal(completed.history.at(-1).siteDevelopment.completed[0].siteKind, 'farm');
  assert.equal(completed.countries.marin.food - baseline.countries.marin.food, 3);
  assert.equal(siteView(advanceTurn(completed,'maintain'),'marin','farm').stage,'operating');
});

test('site definitions and pure views distinguish owned local sites from foreign aggregate infrastructure',()=>{
 const state=createGame('marin');
 state.countries.cera.infrastructure=2;
 const before=structuredClone(state);
 assert.deepEqual(SITE_KINDS,['city','port','farm']);
 for(const kind of SITE_KINDS){assert.equal(typeof SITE_DEFS[kind].name,'string');assert.equal(typeof SITE_DEFS[kind].benefit,'string');assert.equal(typeof SITE_DEFS[kind].manageName,'string');}
 assert.deepEqual(siteView(state,'marin','city'),{kind:'city',countryId:'marin',name:SITE_DEFS.city.name,owned:true,level:0,aggregateInfrastructure:0,project:null,dueTurn:null,remaining:null,stage:'idle'});
 const foreign=siteView(state,'cera','farm');assert.equal(foreign.owned,false);assert.equal(foreign.level,null);assert.equal(foreign.aggregateInfrastructure,2);assert.equal(foreign.stage,'idle');
 assert.deepEqual(state,before,{message:'siteView must not mutate preview state'});
 assert.equal(siteView(state,'cera','unknown'),null);assert.equal(siteView(state,'unknown','farm'),null);
});

test('parallel local projects do not block each other or the legacy national facility',()=>{
 let state=createGame('lumen');
 state=advanceTurn(state,'site:city:upgrade');
 assert.ok(getAction(state,'site:port:upgrade'));
 assert.ok(getAction(state,'invest'));
 state=advanceTurn(state,'site:port:upgrade');
 assert.equal(siteView(state,'lumen','city').stage,'building');
 state=advanceTurn(state,'invest');
 assert.equal(state.siteLevels.city,1);assert.equal(state.siteLevels.port,0);assert.equal(state.farmLevel,0);
 assert.equal(state.history.at(-1).development.completed.length,0);
 assert.equal(state.history.at(-1).siteDevelopment.completed[0].siteKind,'city');
 state=advanceTurn(state,'maintain');
 assert.equal(state.siteLevels.port,1);assert.equal(state.farmLevel,0);
 state=advanceTurn(state,'maintain');
 assert.equal(state.farmLevel,1);
 assert.equal(state.history.at(-1).development.completed[0].type,'facility');
 assert.equal(state.history.at(-1).siteDevelopment.completed.length,0);
});

test('site upgrade levels cap at three with canonical escalating costs',()=>{
 const state=createGame('altia');
 assert.equal(siteAction(state,'site:city:upgrade').cost,10);
 assert.equal(siteAction(state,'site:farm:upgrade').cost,12);
 assert.equal(siteAction(state,'site:port:upgrade').cost,14);
 state.siteLevels={city:2,port:2,farm:2};
 assert.equal(siteAction(state,'site:city:upgrade').cost,18);
 assert.equal(siteAction(state,'site:farm:upgrade').cost,20);
 assert.equal(siteAction(state,'site:port:upgrade').cost,24);
 state.siteLevels={city:3,port:3,farm:3};
 for(const kind of SITE_KINDS)assert.equal(siteAction(state,`site:${kind}:upgrade`),null);
 for(const invalid of ['site:city:upgrade:foreign','site:nord:city:upgrade','site:mine:upgrade','site:farm:delete'])assert.equal(siteAction(state,invalid),null);
});

test('farm and city management apply their distinct reviewed tradeoffs',()=>{
 const farm=createGame('solis'),farmBaseline=advanceTurn(createGame('solis'),'maintain'),farmNext=advanceTurn(farm,'site:farm:manage');
 assert.equal(farmNext.countries.solis.food-farmBaseline.countries.solis.food,5);
 assert.equal(farmNext.countries.solis.approval-farmBaseline.countries.solis.approval,-2);
 assert.match(farmNext.history.at(-1).siteOperations[0].text,/식량 \+5/);
 const cityBaseline=advanceTurn(createGame('nord'),'maintain'),cityNext=advanceTurn(createGame('nord'),'site:city:manage');
 assert.ok(cityNext.countries.nord.price<cityBaseline.countries.nord.price);
 assert.equal(cityNext.countries.nord.approval-cityBaseline.countries.nord.approval,3);
 assert.match(getAction(createGame('nord'),'site:city:manage').forecast,/생활물가 −12/);
});

test('port management transfers only real surplus, refunds unavailable prepaid cost and preserves totals',()=>{
 // Isolate V24 port accounting from V29 strategy changing the seller's same-quarter goal action.
 const state=createGame('marin',{foreignStrategyStartTurn:999});
 for(const id of Object.keys(state.countries))if(id!=='marin')state.countries[id].food=20;
 state.countries.cera.food=22;
 const action=getAction(state,'site:port:manage');
 assert.equal(action.cost,5);assert.equal(action.site.amount,2);assert.equal(action.cost-action.site.payment,3);
 const beforeFood=Object.values(state.countries).reduce((sum,country)=>sum+country.food,0),beforeMoney=Object.values(state.countries).reduce((sum,country)=>sum+country.treasury,0);
 const baseline=advanceTurn(structuredClone(state),'maintain'),next=advanceTurn(state,'site:port:manage'),record=next.history.at(-1).siteOperations[0];
 assert.equal(next.countries.marin.food-baseline.countries.marin.food,2);
 assert.equal(next.countries.marin.treasury-baseline.countries.marin.treasury,-2);
 assert.equal(record.food,2);assert.equal(record.money,-2);assert.equal(record.refund,3);
 assert.equal(Object.values(next.countries).reduce((sum,country)=>sum+country.food,0),Object.values(baseline.countries).reduce((sum,country)=>sum+country.food,0));
 assert.equal(Object.values(next.countries).reduce((sum,country)=>sum+country.treasury,0),Object.values(baseline.countries).reduce((sum,country)=>sum+country.treasury,0));
 assert.ok(beforeFood>0&&beforeMoney>0);
});

test('port management is unavailable without open foreign surplus and affordability uses the standard engine gate',()=>{
 const noSupply=createGame('marin');for(const id of Object.keys(noSupply.countries))if(id!=='marin')noSupply.countries[id].food=20;
 assert.equal(getAction(noSupply,'site:port:manage'),null);
 const blocked=createGame('marin');blocked.goalConflicts=[conflict('marin',Object.keys(blocked.countries).filter(id=>id!=='marin'))];
 assert.equal(getAction(blocked,'site:port:manage'),null);
 for(const command of ['site:farm:manage','site:city:manage','site:port:upgrade']){
  const poor=createGame('marin');poor.countries.marin.treasury=0;
  assert.throws(()=>advanceTurn(poor,command),/국고가 부족/);assert.equal(poor.turn,0);
 }
});

test('passive site operation uses actual completed levels and never drives treasury below zero',()=>{
 const state=createGame('cera');state.siteLevels={city:2,port:1,farm:3};state.countries.cera.treasury=1;
 const actions=[],parts=[],effect=runSiteEffects(state,{actions,parts});
 assert.deepEqual(effect,{food:9,money:-1,price:-4,approval:2,service:3,upkeep:4});
 assert.equal(state.countries.cera.treasury,0);assert.equal(state.countries.cera.food,82);assert.equal(state.countries.cera.price,92);assert.equal(state.countries.cera.approval,66);
 assert.match(actions[0].text,/실제 유지비 −4/);
 const depleted=createGame('cera');depleted.siteLevels={city:1,port:0,farm:1};depleted.countries.cera.treasury=1;
 const bounded=runSiteEffects(depleted,{actions:[],parts:[]});assert.equal(depleted.countries.cera.treasury,0);assert.equal(bounded.upkeep,1);assert.equal(bounded.money,-1);
});

test('port procurement reserves only buyer capacity and refunds the rest',()=>{
 const state=createGame('marin');state.countries.marin.food=99;state.countries.cera.food=80;
 const action=getAction(state,'site:port:manage');
 assert.equal(action.site.amount,1);assert.equal(action.site.payment,1);assert.equal(action.cost-action.site.payment,4);
 const next=advanceTurn(state,action.id),record=next.history.at(-1).siteOperations[0];
 assert.equal(record.food,1);assert.equal(record.money,-1);assert.equal(record.refund,4);
});

test('site commands replay identically through all six storage slots while old commands remain deterministic',()=>{
 values.clear();
 for(const countryId of ['lumen','nord','cera','altia','marin','solis']){
  let state=createGame(countryId);state=advanceTurn(state,'site:farm:upgrade');state=advanceTurn(state,'site:city:manage');state=advanceTurn(state,'maintain');
  assert.equal(saveGame(state,{phase:'result',step:1}),true);assert.deepEqual(loadGame(countryId).state,state);
 }
 const oldCommands=['maintain','invest','maintain','maintain'];let old=createGame('lumen');for(const command of oldCommands)old=advanceTurn(old,command);
 assert.deepEqual(old.commands,oldCommands);assert.equal(old.siteLevels,undefined);assert.equal(siteView(old,'lumen','farm').level,0);assert.ok(old.history.every(item=>item.siteOperations===undefined&&item.siteDevelopment===undefined));
});
