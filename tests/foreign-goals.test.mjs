import test from 'node:test';
import assert from 'node:assert/strict';
import {COUNTRY_IDS,initialCountries} from '../dist/country-data.mjs';
import {createForeignGoals,finishForeignGoals,foreignGoalView,goalActorActive,runForeignGoalPolicies} from '../dist/foreign-goals.mjs';

const state=(playerId='lumen')=>({playerId,turn:0,worldGoalStartTurn:1,countries:initialCountries(),foreignGoals:createForeignGoals(playerId),lastTreatyEvents:[],lastForeignEvents:[]});
const quarter=before=>{const next=structuredClone(before);next.turn++;const actions=[];runForeignGoalPolicies(next,before,[],actions);finishForeignGoals(next,before,actions);return {next,actions};};

test('foreign goal actors cover every non-player country with distinct zero-progress plans',()=>{
 for(const playerId of COUNTRY_IDS){const current=state(playerId);assert.deepEqual(Object.keys(current.foreignGoals),COUNTRY_IDS.filter(id=>id!==playerId));assert.equal(foreignGoalView(current,playerId),null);for(const id of Object.keys(current.foreignGoals)){const view=foreignGoalView(current,id);assert.equal(view.stage,1);assert.ok(view.title);assert.ok(view.requirements.every(item=>item.current>=0));}}
 assert.equal(new Set(COUNTRY_IDS.map(id=>foreignGoalView(state(id==='lumen'?'nord':'lumen'),id).title)).size,6);
});

test('activation is explicit and absent or future markers prevent all actions',()=>{
 const absent=state();delete absent.worldGoalStartTurn;const unchanged=structuredClone(absent),actions=[];runForeignGoalPolicies(unchanged,absent,[],actions);finishForeignGoals(unchanged,absent,actions);assert.equal(goalActorActive(absent),false);assert.deepEqual(unchanged,absent);assert.deepEqual(actions,[]);
 const future=state();future.worldGoalStartTurn=3;const result=quarter(future);assert.deepEqual(result.actions,[]);assert.deepEqual(result.next.foreignGoals,future.foreignGoals);
});

test('goal policies are deterministic, immutable to before and differ by national mandate',()=>{
 const before=state('marin'),snapshot=structuredClone(before),a=quarter(before),b=quarter(before);
 assert.deepEqual(before,snapshot);assert.deepEqual(a,b);assert.ok(a.actions.length>=4);assert.ok(a.actions.every(item=>item.source==='national_goal'));
 const ids=new Set(Object.values(a.next.foreignGoals).map(actor=>actor.lastAction?.id));assert.ok(ids.has('balanced'));assert.ok(ids.has('secure_imports'));assert.ok(ids.has('export_push'));assert.ok(ids.has('research'));assert.ok(ids.has('resilience'));
});

test('foreign-only trades conserve food and cash and preserve seller reserve and recipient capacity',()=>{
 const before=state('lumen');before.countries.cera.food=95;before.countries.nord.food=30;before.countries.altia.food=40;before.countries.marin.food=40;before.countries.solis.food=40;
 const food=Object.values(before.countries).reduce((sum,item)=>sum+item.food,0),cash=Object.values(before.countries).reduce((sum,item)=>sum+item.treasury,0),{next,actions}=quarter(before);
 assert.equal(next.countries.lumen.food,before.countries.lumen.food);assert.equal(next.countries.lumen.treasury,before.countries.lumen.treasury);
 assert.ok(Object.values(next.countries).every(item=>item.food>=0&&item.food<=100&&item.treasury>=0&&item.treasury<=100));
 const trades=actions.filter(item=>item.type==='trade');assert.ok(trades.length);assert.ok(trades.every(item=>item.countryId!=='lumen'&&item.targetId!=='lumen'&&item.food>0&&item.money>=0));
 const expectedFoodGain=10;assert.equal(Object.values(next.countries).reduce((sum,item)=>sum+item.food,0)-food,expectedFoodGain);
 const expectedPolicySpend=2+15+10;assert.equal(cash-Object.values(next.countries).reduce((sum,item)=>sum+item.treasury,0),expectedPolicySpend);
 assert.ok(Object.values(next.countries).every(item=>item.food>=20||item.id==='nord'));
});

test('import actions describe the actual seller-to-buyer route and retain the goal actor',()=>{
 const before=state('marin'),sellerFood=before.countries.cera.food,buyerFood=before.countries.nord.food,sellerCash=before.countries.cera.treasury,buyerCash=before.countries.nord.treasury,{next,actions}=quarter(before);
 const route=actions.find(item=>item.actorId==='nord'&&item.type==='trade');assert.ok(route);assert.equal(route.countryId,'cera');assert.equal(route.targetId,'nord');assert.match(route.text,/세라 → 노르드/);
 assert.equal(sellerFood-next.countries.cera.food,route.food+actions.filter(item=>item.countryId==='cera'&&item.actorId==='cera').reduce((sum,item)=>sum+(item.food??0),0));
 assert.equal(next.countries.nord.food-buyerFood,route.food);assert.ok(next.countries.cera.treasury>=sellerCash+route.money);assert.equal(buyerCash-next.countries.nord.treasury,route.money);
});

test('real actions advance stages once and achievements are explicit world actions',()=>{
 let current=state('marin'),achievement=[];
 for(let i=0;i<16&&!current.foreignGoals.lumen.objectives.completed.length;i++){const result=quarter(current);current=result.next;achievement.push(...result.actions.filter(item=>item.type==='goal_achievement'));}
 assert.equal(current.foreignGoals.lumen.objectives.completed[0]?.stage,1);assert.equal(current.foreignGoals.lumen.objectives.counts.balanced,1);assert.ok(current.countries.lumen.infrastructure>=1);
 assert.equal(achievement.filter(item=>item.countryId==='lumen'&&item.stage===1).length,1);assert.equal(foreignGoalView(current,'lumen').stage,2);
});

test('stage two spends the exact first unlocked policy cost instead of waiting for stage-three cash',()=>{
 const before=state('nord'),actor=before.foreignGoals.altia;actor.objectives.completed=[{stage:1,turn:1,title:'연구 성과를 농지로',unlockId:'mandate_altia_1'}];before.countries.altia.treasury=11;before.countries.altia.food=60;before.countries.cera.food=100;
 const next=structuredClone(before);next.turn=2;const actions=[];runForeignGoalPolicies(next,before,[],actions);
 assert.equal(next.foreignGoals.altia.lastAction.id,'mandate_altia_1');assert.equal(next.foreignGoals.altia.lastAction.name,'정밀 재배 보급');assert.equal(next.countries.altia.treasury,0);assert.ok(!actions.some(item=>item.actorId==='altia'&&item.type==='austerity'));
});

test('fulfilled treaty credit is participant-filtered and standby never advances cooperation goals',()=>{
 const before=state('lumen');const actor=before.foreignGoals.nord;actor.objectives.completed=[{stage:1,turn:1,title:'a',unlockId:'mandate_nord_1'},{stage:2,turn:2,title:'b',unlockId:'mandate_nord_2'}];actor.objectives.counts.mandate_nord_2=1;actor.objectives.counts.fulfilledTreaties=3;
 const next=structuredClone(before);next.turn=4;next.lastForeignEvents=[{type:'standby',countryId:'nord',targetId:'cera'},{type:'fulfilled',countryId:'cera',targetId:'nord'},{type:'fulfilled',countryId:'altia',targetId:'solis'}];const actions=[];finishForeignGoals(next,before,actions);
 assert.equal(next.foreignGoals.nord.objectives.counts.fulfilledTreaties,4);assert.equal(next.foreignGoals.nord.objectives.completed.at(-1).stage,3);assert.equal(next.foreignGoals.solis.objectives.counts.fulfilledTreaties??0,1);assert.equal(next.foreignGoals.altia.objectives.counts.fulfilledTreaties??0,1);assert.equal(next.foreignGoals.cera.objectives.counts.fulfilledTreaties??0,1);assert.equal(actions.filter(item=>item.type==='goal_achievement').length,1);
});
