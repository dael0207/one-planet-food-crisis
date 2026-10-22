import test from 'node:test';
import assert from 'node:assert/strict';
import {renderDevelopment} from '../dist/development-ui.mjs';
import {advanceTurn,createGame} from '../dist/engine.mjs';
import {renderOutcome} from '../dist/experience.mjs';

const project=(dueTurn,level)=>({type:'facility',countryId:'lumen',dueTurn,...(level?{level}:{})});
function state({turn=1,farmLevel=0,projects=[],policyId='maintain',actionCost=0,development,foodBreakdown=[]}={}){
 return {turn,playerId:'lumen',farmLevel,projects,history:[{policyId,actionCost,development,foodBreakdown}]};
}

test('started facility shows actual cost, level, completion date and two-quarter timeline',()=>{
 const item=project(3,1),html=renderDevelopment(state({policyId:'invest',actionCost:16,projects:[item],development:{levelBefore:0,levelAfter:0,started:[item],completed:[],ongoing:[item]}}));
 assert.match(html,/data-development-stage="started"/);assert.match(html,/관개 시설 1단계 착공 완료/);
 assert.match(html,/이번 분기 실제 지출 <b>16억<\/b>/);assert.match(html,/2031년 3분기 · 3분기 결과/);
 assert.match(html,/완공 뒤 추가 생산 <b>\+4\/분기<\/b>/);assert.match(html,/완공 뒤 시설 총 \+4\/분기/);
 assert.match(html,/착공<\/span>.*2분기 남음.*1분기 남음.*완공/s);
});

test('ongoing facility countdown persists after an unrelated action',()=>{
 const item=project(3,1),html=renderDevelopment(state({turn:2,projects:[item],policyId:'balanced',actionCost:4,development:{levelBefore:0,levelAfter:0,started:[],completed:[],ongoing:[item]}}));
 assert.match(html,/data-development-stage="building"/);assert.match(html,/건설 중 · 1분기 남음/);
 assert.doesNotMatch(html,/이번 분기 실제 지출 <b>16억/);
});

test('completion enables operation and reports the actual facility contribution',()=>{
 const item=project(3,1),html=renderDevelopment(state({turn:3,farmLevel:1,development:{levelBefore:0,levelAfter:1,started:[],completed:[item],ongoing:[]},foodBreakdown:[{label:'국가 생산 시설 1단계',value:4}]}));
 assert.match(html,/data-development-stage="completed"/);assert.match(html,/관개 시설 1단계 완공/);
 assert.match(html,/운영 시작/);assert.match(html,/완공 시점 <b>2031년 3분기 · 3분기 결과<\/b>/);assert.match(html,/이번 분기 시설 생산 <b>\+4<\/b>/);
 assert.match(html,/기후·소비·교역/);
});

test('operating facility remains visible on later turns and identifies base production',()=>{
 const html=renderDevelopment(state({turn:7,farmLevel:2,policyId:'aid',foodBreakdown:[{label:'국가 생산 시설 2단계',value:8}]}));
 assert.match(html,/data-development-stage="operating"/);assert.match(html,/관개 시설 2단계 운영 중/);
 assert.match(html,/시설 총 기본 생산 <b>\+8\/분기<\/b>/);assert.match(html,/이번 분기 시설 생산 <b>\+8<\/b>/);
});

test('next tier benefit is four while the facility cap is three',()=>{
 const item=project(11,3),html=renderDevelopment(state({turn:9,farmLevel:2,projects:[item],policyId:'invest',actionCost:24,development:{levelBefore:2,levelAfter:2,started:[item],completed:[],ongoing:[item]}}));
 assert.match(html,/완공 뒤 추가 생산 <b>\+4\/분기<\/b>/);assert.match(html,/완공 뒤 시설 총 \+12\/분기/);assert.match(html,/총 3단계가 최대/);
 const capped=renderDevelopment(state({turn:12,farmLevel:3,foodBreakdown:[{label:'국가 생산 시설 3단계',value:12}]}));
 assert.match(capped,/최대 3단계/);assert.doesNotMatch(capped,/다음 단계/);
});

test('legacy project metadata uses current project state without inventing completion',()=>{
 const html=renderDevelopment(state({turn:4,projects:[{dueTurn:5}],policyId:'maintain'}));
 assert.match(html,/data-development-stage="building"/);assert.match(html,/1분기 남음/);
 assert.doesNotMatch(html,/착공 완료|운영 시작|이번 분기 완공/);
});

test('one-off actions do not create a fake persistent development panel',()=>{
 assert.equal(renderDevelopment(state({policyId:'research',actionCost:14,foodBreakdown:[{label:'고수확 종자 연구 성과',value:5}]})), '');
 assert.equal(renderDevelopment(state({policyId:'subsidy',actionCost:12})), '');
});

test('quarterly result places development before aggregate outcomes regardless of legacy step',()=>{
 const game=advanceTurn(createGame('lumen'),'invest');
 for(const step of [0,3]){
  const html=renderOutcome(game,step);
  assert.ok(html.indexOf('development-panel')>0);
  assert.ok(html.indexOf('development-panel')<html.indexOf('quarterly-delta-strip'));
 }
});
