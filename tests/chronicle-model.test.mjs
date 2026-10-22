import test from 'node:test';
import assert from 'node:assert/strict';
import {COUNTRY_IDS,PROFILES,advanceTurn,createGame} from '../dist/engine.mjs';
import {buildChronicle,quarterLabel} from '../dist/chronicle-model.mjs';

const play=(state,commands)=>commands.reduce((current,command)=>advanceTurn(current,command),state);
const metrics=country=>Object.fromEntries(['food','treasury','price','trust','approval'].map(key=>[key,country[key]]));
const ownRelations=state=>Object.fromEntries(COUNTRY_IDS.filter(id=>id!==state.playerId).map(id=>[id,state.relations[[id,state.playerId].sort().join(':')]]));

test('a direct relation effect survives when world events cancel its net change',()=>{
 const commands=['propose:nord:sell:6:20','propose:marin:aid_out:3:10','propose:altia:buy:3:30','treaty:cera:trade_buy:3:20:4','balanced','balanced','maintain','propose:marin:buy:6:10','balanced','balanced','treaty:solis:trade_buy:3:10:4','treaty:marin:trade_buy:6:3:4','maintain','propose:altia:buy:3:3','treaty:nord:trade_buy:1:20:8'];
 const state=play(createGame('lumen',{worldGoalStartTurn:999,foreignSiteStartTurn:999}),commands),point=buildChronicle(state).points.at(-1);
 assert.deepEqual(state.history.at(-1).policyRelationEffects.find(item=>item.countryId==='cera'),{countryId:'cera',before:41,after:41,effect:-1});
 assert.deepEqual(point.relationEffects.find(item=>item.countryId==='cera'),{countryId:'cera',before:41,after:41,delta:0,policyEffect:-1});
});

test('quarter labels start at the real campaign baseline',()=>{
 assert.equal(quarterLabel(0),'운영 시작');assert.equal(quarterLabel(1),'2031년 1분기');assert.equal(quarterLabel(4),'2031년 4분기');assert.equal(quarterLabel(5),'2032년 1분기');
});

test('six national replays end at the exact metrics and bilateral relations',()=>{
 for(const playerId of COUNTRY_IDS){
  const state=play(createGame(playerId),Array(16).fill('maintain')),before=structuredClone(state),chronicle=buildChronicle(state),last=chronicle.points.at(-1);
  assert.deepEqual(state,before);assert.equal(chronicle.playerId,playerId);assert.equal(chronicle.totalTurns,16);assert.equal(chronicle.points.length,17);
  assert.deepEqual(last.metrics,metrics(state.countries[playerId]));assert.deepEqual(last.relations,ownRelations(state));assert.deepEqual(last.beforeMetrics,metrics(state.history.at(-1).beforeCountries[playerId]));
 }
});

test('legacy activation boundaries replay the original world and policy rules',()=>{
 let state=createGame('lumen',{networkStartTurn:5,policyStartTurn:3});state=play(state,['balanced','balanced','balanced',...Array(5).fill('maintain')]);
 const chronicle=buildChronicle(state);
 assert.equal(chronicle.points[1].investmentCost,0);assert.equal(chronicle.points[1].policyEffect.treasury,0);assert.equal(chronicle.points[1].relationEffects.length,0);
 assert.equal(chronicle.points[3].policyEffect.treasury,-4);assert.ok(chronicle.points[3].relationEffects.some(item=>item.countryId==='nord'&&item.policyEffect>0));
 assert.deepEqual(chronicle.points.at(-1).metrics,metrics(state.countries.lumen));assert.deepEqual(chronicle.points.at(-1).relations,ownRelations(state));
});

test('chronicle keeps every quarter beyond the bounded 80-record history',()=>{
 const state=play(createGame('nord'),Array(105).fill('maintain')),chronicle=buildChronicle(state);
 assert.equal(state.history.length,80);assert.equal(chronicle.points.length,106);assert.deepEqual(chronicle.points.map(point=>point.turn),Array.from({length:106},(_,turn)=>turn));
});

test('facility cost and actual production accumulate without an immediate benefit and stop at level three',()=>{
 const commands=['invest','maintain','maintain','invest','maintain','maintain','invest','maintain','maintain',...Array(3).fill('maintain')];
 const state=play(createGame('lumen'),commands),chronicle=buildChronicle(state),points=chronicle.points;
 assert.equal(points[1].investmentCost,PROFILES.lumen.investmentCost);assert.equal(points[1].facilityProduction,0);assert.equal(points[2].facilityProduction,0);assert.equal(points[3].facilityProduction,4);
 assert.equal(points[4].investmentCost,PROFILES.lumen.investmentCost+4);assert.equal(points[6].facilityProduction,8);assert.equal(points[9].facilityProduction,12);assert.equal(points.at(-1).facilityLevel,3);
 assert.equal(points.at(-1).cumulativeInvestmentCost,PROFILES.lumen.investmentCost+(PROFILES.lumen.investmentCost+4)+(PROFILES.lumen.investmentCost+8));
 assert.equal(points.at(-1).cumulativeFacilityProduction,points.reduce((sum,point)=>sum+point.facilityProduction,0));
 assert.deepEqual(chronicle.projects,state.projects);
});

test('relation effects report every actual bilateral change and distinguish direct policy effect',()=>{
 const state=advanceTurn(createGame('lumen'),'balanced'),point=buildChronicle(state).points[1],nord=point.relationEffects.find(item=>item.countryId==='nord');
 assert.deepEqual(nord,{countryId:'nord',before:73,after:79,delta:6,policyEffect:6});
 assert.ok(point.relationEffects.every(item=>item.delta!==0));assert.equal(point.worldEvents.length,state.history.at(-1).worldActions.filter(item=>item.text).length);
});

test('building a four-hundred-quarter chronicle is bounded and immutable',()=>{
 const state=play(createGame('cera'),Array(400).fill('maintain')),before=structuredClone(state),started=performance.now(),chronicle=buildChronicle(state),elapsed=performance.now()-started;
 assert.equal(chronicle.points.length,401);assert.deepEqual(state,before);assert.ok(elapsed<10000,`chronicle replay took ${elapsed.toFixed(0)}ms`);
});

test('repeated inspection reuses one chronology while a new state gets a fresh result',()=>{
 const state=play(createGame('marin'),Array(20).fill('maintain')),first=buildChronicle(state),second=buildChronicle(state);
 assert.equal(second,first);assert.equal(first.coverage,'complete');assert.equal(first.startTurn,0);assert.equal(first.cumulativeScope,'campaign');
 const next=advanceTurn(state,'maintain'),fresh=buildChronicle(next);assert.notEqual(fresh,first);assert.equal(fresh.totalTurns,21);assert.deepEqual(fresh.points.at(-1).metrics,metrics(next.countries.marin));
});

test('invalid commands surface an error and commandless history is explicitly partial',()=>{
 const invalid={...advanceTurn(createGame('lumen'),'maintain'),commands:['missing']};
 assert.throws(()=>buildChronicle(invalid),/알 수 없거나 만료|명령 기록/);
 const complete=play(createGame('nord'),Array(85).fill('maintain')),partial=structuredClone(complete);delete partial.commands;
 for(const record of partial.history)delete record.development;
 const chronicle=buildChronicle(partial);
 assert.equal(chronicle.coverage,'partial');assert.equal(chronicle.startTurn,6);assert.equal(chronicle.cumulativeScope,'available-history');assert.equal(chronicle.points.length,80);
 assert.equal(chronicle.points[0].facilityLevel,null);assert.deepEqual(chronicle.points[0].development,{levelBefore:null,levelAfter:null,started:[],completed:[],ongoing:[]});assert.deepEqual(chronicle.points[0].relations,{});
 assert.deepEqual(chronicle.points.at(-1).relations,ownRelations(complete));
});
