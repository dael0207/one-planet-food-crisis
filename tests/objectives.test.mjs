import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceObjectives,createObjectives,getObjectivePlan,getObjectiveView,OBJECTIVE_PLANS,unlockedPolicies} from '../dist/objectives.mjs';

const country=(food=60,treasury=80,price=105)=>({food,treasury,price,trust:60,approval:60});
const state=(playerId='lumen',overrides={})=>({
 playerId,turn:0,objectiveStartTurn:1,farmLevel:0,countries:{[playerId]:country()},history:[],lastTreatyEvents:[],objectives:createObjectives(playerId),...overrides,
});
const step=(before,actionId,overrides={})=>{
 const next=structuredClone(before);next.turn=before.turn+1;next.history=[...(before.history??[]),{turn:next.turn,policyId:actionId}];Object.assign(next,overrides);
 next.objectives=advanceObjectives(before,next,actionId);return next;
};

test('objective state is finite, isolated and activation-boundary aware',()=>{
 const initial=createObjectives('nord');
 assert.deepEqual(initial,{playerId:'nord',completed:[],counts:{},stableQuarters:0,pendingEvent:null});
 const before=state('nord',{turn:4,objectiveStartTurn:6}),next={...structuredClone(before),turn:5};
 assert.deepEqual(advanceObjectives(before,next,'secure_imports'),initial);
 assert.deepEqual(before.objectives,initial);
 const legacy=state('nord',{turn:4});delete legacy.objectiveStartTurn;
 const activated={...structuredClone(legacy),turn:5,countries:{nord:country(55)}};
 assert.equal(advanceObjectives(legacy,activated,'secure_imports').counts.secure_imports,1);
});

test('each country has exact attainable first-stage requirements',()=>{
 const cases=[
  ['lumen',['balanced'],{farmLevel:1}],
  ['nord',['secure_imports','strategic_reserve'],{countries:{nord:country(52)}}],
  ['cera',['export_push','export_push'],{countries:{cera:country(45,70)}}],
  ['altia',['research','research'],{farmLevel:1}],
  ['marin',['expand_routes','emergency_import'],{countries:{marin:country(52)}}],
  ['solis',['resilience'],{farmLevel:1,countries:{solis:country(43)}}],
 ];
 for(const [id,actions,final] of cases){
  let current=state(id);for(const action of actions)current=step(current,action);
  current=step(current,'maintain',final);
  assert.equal(current.objectives.completed[0]?.stage,1,id);
  assert.equal(current.objectives.completed.length,1,id);
 }
});

test('only one permanent stage completes per turn and unlocks are own-country only',()=>{
 let before=state('lumen',{farmLevel:1});before.objectives.counts.balanced=1;
 let next=step(before,'maintain');
 assert.deepEqual(next.objectives.completed.map(item=>item.stage),[1]);
 assert.deepEqual(unlockedPolicies(next).map(item=>item.id),['mandate_lumen_1']);
 next.objectives.counts.mandate_lumen_1=2;next.objectives.stableQuarters=1;
 next.countries.lumen=country(70,90,95);next=step(next,'maintain');
 assert.deepEqual(next.objectives.completed.map(item=>item.stage),[1,2]);
 assert.deepEqual(unlockedPolicies(next).map(item=>item.id),['mandate_lumen_1','mandate_lumen_2']);
 assert.deepEqual(next.objectives.pendingEvent.options,['mandate_lumen_2','mandate_lumen_1','maintain']);
 assert.equal(next.objectives.pendingEvent.title,'공동 수확단을 세울 기회');
 assert.match(next.objectives.pendingEvent.description,/수확 손실 방지단/);assert.match(next.objectives.pendingEvent.description,/브리핑 뒤에도 국내 정책에서 계속 선택/);
 const wrong={...next,playerId:'nord'};assert.deepEqual(unlockedPolicies(wrong),[]);
 const expired=step(next,'mandate_lumen_1');assert.equal(expired.objectives.pendingEvent,null);
});

test('stage-two stability counts consecutive healthy quarters only while stage two is current',()=>{
 let current=state('solis',{farmLevel:1,countries:{solis:country(45,50,130)}});
 current=step(current,'resilience');
 assert.equal(current.objectives.completed[0].stage,1);
 assert.equal(current.objectives.stableQuarters,0);
 current=step(current,'mandate_solis_1');assert.equal(current.objectives.stableQuarters,1);
 current=step(current,'maintain',{countries:{solis:country(38,50,140)}});assert.equal(current.objectives.stableQuarters,0);
 current=step(current,'mandate_solis_1',{countries:{solis:country(45,50,130)}});assert.equal(current.objectives.stableQuarters,1);
 current=step(current,'maintain');assert.equal(current.objectives.completed.at(-1).stage,2);
});

test('fulfilled treaty events accumulate for cooperation goals while standby does not',()=>{
 let current=state('nord');current.objectives.completed=[
  {stage:1,turn:1,title:'1',unlockId:'mandate_nord_1'},
  {stage:2,turn:2,title:'2',unlockId:'mandate_nord_2'},
 ];
 current.objectives.counts.mandate_nord_2=1;
 current.objectives.counts.fulfilledTreaties=3;
 current=step(current,'maintain',{lastTreatyEvents:[{type:'standby'},{type:'fulfilled'}]});
 assert.equal(current.objectives.counts.fulfilledTreaties,4);
 assert.equal(current.objectives.completed.at(-1).stage,3);
 assert.equal(getObjectiveView(current).done,true);
 assert.equal(getObjectiveView(current).stage,4);
 assert.equal(getObjectiveView(current).stageTitle,'국가 목표 달성');
});

test('objective view exposes numeric progress and unlocked policies have generic domestic effects',()=>{
 const current=state('cera',{countries:{cera:country(43,68)}});current.objectives.counts.export_push=1;
 const view=getObjectiveView(current);
 assert.equal(view.title,'수출 수익을 국민의 식탁으로');assert.equal(view.stage,1);assert.equal(view.done,false);
 assert.deepEqual(view.requirements.map(item=>[item.current,item.target,item.met]),[[1,2,false],[68,65,true],[43,40,true]]);
 const policies=[];
 for(const id of ['lumen','nord','cera','altia','marin','solis']){
  const own=state(id);own.objectives.completed=[{stage:1,turn:1,title:'x',unlockId:`mandate_${id}_1`},{stage:2,turn:2,title:'y',unlockId:`mandate_${id}_2`}];policies.push(...unlockedPolicies(own));
 }
 assert.equal(policies.length,12);assert.equal(new Set(policies.map(item=>JSON.stringify([item.cost,item.goalEffects]))).size,12);
 for(const policy of policies){assert.equal(policy.foodCost,0);assert.ok(policy.cost>=6&&policy.cost<=16);assert.deepEqual(Object.keys(policy.goalEffects),['food','price','trust','approval']);}
 const roadmap=getObjectivePlan('cera');assert.equal(roadmap.stages.length,3);assert.equal(roadmap.stages[0].unlockId,'mandate_cera_1');assert.ok(Object.isFrozen(OBJECTIVE_PLANS.cera));
 assert.equal(new Set(Object.values(OBJECTIVE_PLANS).map(item=>item.title)).size,6);
 assert.equal(new Set(Object.values(OBJECTIVE_PLANS).flatMap(item=>item.stages.map(stage=>stage.title))).size,18);
});

test('unlock lookup derives authority from attained stages instead of persisted unlock text',()=>{
 const current=state('marin');current.objectives.completed=[{stage:1,turn:1,title:'x',unlockId:'mandate_marin_2'}];
 assert.deepEqual(unlockedPolicies(current).map(item=>item.id),['mandate_marin_1']);
});
