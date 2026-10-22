import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTurn,createGame} from '../dist/engine.mjs';
import {COUNTRY_IDS} from '../dist/country-data.mjs';
import {foreignGoalView} from '../dist/foreign-goals.mjs';
import {renderForeignGoalIntel,renderGoalConsequences,renderWorldGoals} from '../dist/world-goals-ui.mjs';
import {renderCountryIntel} from '../dist/room-map-ui.mjs';
import {renderForeignNetwork} from '../dist/network-ui.mjs';
import {renderOutcome} from '../dist/experience.mjs';

test('foreign inspection names the real mandate and keeps opening progress honest',()=>{
 const state=createGame('lumen'),before=structuredClone(state);
 const html=renderForeignGoalIntel(state,'nord'),view=foreignGoalView(state,'nord');
 assert.match(html,/data-foreign-goal="nord"/);
 assert.ok(html.includes(view.title));
 assert.match(html,/0\/3 달성/);
 assert.match(html,/첫 분기 행동 대기/);
 for(const item of view.requirements)assert.ok(html.includes(`${item.current}/${item.target}`));
 assert.equal(renderForeignGoalIntel(state,'lumen'),'');
 assert.deepEqual(state,before);
});

test('foreign inspection exposes each actual policy, reason and quarter after play',()=>{
 const state=advanceTurn(createGame('marin'),'maintain');
 for(const id of COUNTRY_IDS.filter(id=>id!=='marin')){
  const action=state.foreignGoals[id].lastAction,html=renderForeignGoalIntel(state,id);
  assert.ok(action);
  assert.ok(html.includes(action.name));
  assert.ok(html.includes(action.reason));
  assert.ok(html.includes(`${action.turn}분기`));
 }
});

test('legacy activation boundary is explicit and does not invent prior actions',()=>{
 const state=createGame('cera');
 delete state.worldGoalStartTurn;
 for(const actor of Object.values(state.foreignGoals))actor.lastAction=null;
 const html=renderForeignGoalIntel(state,'altia');
 assert.match(html,/기존 기록은 다음 분기부터/);
 assert.doesNotMatch(html,/최근 실제 행동 · \d+분기/);
});

test('world detail lists five inspectable mandates plus actual quarterly goal dispatch',()=>{
 const state=advanceTurn(createGame('solis'),'maintain'),before=structuredClone(state);
 const html=renderWorldGoals(state);
 assert.equal((html.match(/data-world-goal=/g)??[]).length,5);
 for(const id of COUNTRY_IDS.filter(id=>id!=='solis')){
  assert.ok(html.includes(state.foreignGoals[id].lastAction.name));
  assert.ok(html.includes(foreignGoalView(state,id).title));
 }
 assert.match(html,/이번 분기 목표 행동과 달성 기록/);
 assert.match(html,/data-goal-action=/);
 assert.deepEqual(state,before);
});

test('world dispatch labels a goal trade by its actor rather than the food seller',()=>{
 const state=advanceTurn(createGame('lumen'),'maintain');
 state.history.at(-1).worldActions=[{source:'national_goal',type:'trade',actorId:'marin',countryId:'nord',targetId:'marin',text:'노르드 → 마린: 목표 비상 조달 식량 5.'}];
 const html=renderWorldGoals(state);
 assert.match(html,/data-goal-action="trade"><span>마린<\/span><p>노르드 → 마린/);
});

test('main result shows only material own impact, escapes text and limits prominent rows',()=>{
 const state=createGame('lumen');
 state.lastGoalEvents=[
  {type:'competition',countryId:'cera',targetId:'marin',title:'수출 <경쟁>',reason:'시장 & 충돌',text:'실제 발주 대금 <3> 감소',playerImpact:{treasury:-3,scoreDelta:-2,text:'국고 감소'}},
  {type:'cooperation',countryId:'nord',targetId:'lumen',title:'공급 <협력>',reason:'목표가 겹침',playerImpact:{relationDelta:4}},
  {type:'competition',countryId:'altia',targetId:'solis',title:'종자 경쟁',reason:'조달 경쟁',playerImpact:{food:-1}},
  {type:'competition',countryId:'marin',targetId:'cera',title:'항로 경쟁',reason:'운임 경쟁',playerImpact:{treasury:-1}},
  {type:'competition',countryId:'nord',targetId:'solis',title:'관찰만',reason:'직접 영향 없음',playerImpact:{}},
 ];
 const before=structuredClone(state);
 const html=renderGoalConsequences(state);
 assert.equal((html.match(/class="goal-consequence"/g)??[]).length,4);
 assert.match(html,/나머지 파급 1건/);
 assert.match(html,/국고 −3억 · 협상 반응 −2점/);
 assert.match(html,/관계 \+4점/);
 assert.match(html,/같은 구매국을 두고 수출 경쟁/);
 assert.match(html,/공급 &lt;협력&gt;/);
 assert.match(html,/시장 &amp; 충돌/);
 assert.match(html,/실제 발주 대금 &lt;3&gt; 감소/);
 assert.doesNotMatch(html,/관찰만/);
 assert.deepEqual(state,before);
});

test('quiet opening adds no result narrative before a material event exists',()=>{
 assert.equal(renderGoalConsequences(createGame('nord')),'');
});

test('unrelated foreign cooperation text stays out of the main result',()=>{
 const state=createGame('lumen');
 state.lastGoalEvents=[{type:'cooperation',countryId:'altia',targetId:'solis',title:'공동 사업',reason:'목표가 맞음',text:'두 나라가 협력했습니다.',playerImpact:{text:'즉시 자원 이전 없음'}}];
 assert.equal(renderGoalConsequences(state),'');
});

test('a new goal offer appears only on arrival and never claims proposed costs were paid',()=>{
 const state=createGame('lumen');state.turn=4;
 state.requests.push({id:'goal-offer',fromId:'altia',type:'technology',title:'알티아의 목표 기술 협력',goalTitle:'연구실에서 모든 농지로',goalReason:'연구 성과를 실제 농지에 보급합니다.',createdTurn:4,expiresTurn:7,status:'pending',terms:{food:3,treasury:12,duration:4}});
 const html=renderGoalConsequences(state);
 assert.match(html,/알티아의 목표 기술 협력/);
 assert.match(html,/연구비 12억 · 4분기 동안 생산 \+3/);
 assert.match(html,/검토 대기 · 수락 전 자원 이동 없음/);
 assert.doesNotMatch(html,/국고 −12/);
 state.turn=5;
 assert.equal(renderGoalConsequences(state),'');
});

test('country, world and result surfaces place goal evidence in their existing flow',()=>{
 const state=advanceTurn(createGame('lumen'),'maintain');
 state.lastGoalEvents=[{type:'competition',countryId:'lumen',targetId:'cera',title:'수출 목표 경쟁',reason:'같은 발주가 겹쳤습니다.',playerImpact:{treasury:-1}}];
 const intel=renderCountryIntel(state,'nord','result');
 const world=renderForeignNetwork(state);
 const result=renderOutcome(state,0);
 assert.ok(intel.indexOf('foreign-goal-intent')<intel.indexOf('<footer>'));
 assert.ok(world.indexOf('world-goals')<world.indexOf('현재 이행 중'));
 assert.ok(result.indexOf('result-continuation-rail')<result.indexOf('goal-consequences'));
 assert.ok(result.indexOf('goal-consequences')<result.indexOf('quarterly-delta-strip'));
});
