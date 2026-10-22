import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../dist/engine.mjs';
import {renderForeignStrategy,renderStrategyResults} from '../dist/foreign-strategy-ui.mjs';

const fixture=()=>({...createGame(),turn:4,foreignStrategyStartTurn:1,foreignStrategies:{nord:{mode:'food',label:'공급선 다변화',reason:'비축 감소로 수입선을 바꿉니다.',sinceTurn:3,lastTurn:4,previousMode:'trade',previousAction:{id:'secure_imports',name:'장기 수입선 확보',turn:3},trend:{food:-6,treasury:-4},posture:'contain',postureReason:'수출 제한을 기억합니다.',postureUntil:5,observedPolicy:'embargo'}}});

test('strategy intel exposes real memory and calendar without changing state',()=>{
 const state=fixture(),before=structuredClone(state),html=renderForeignStrategy(state,'nord');
 assert.match(html,/공급선 다변화/);assert.match(html,/견제/);assert.match(html,/전략을 바꾼 이유/);
 assert.match(html,/장기 수입선 확보/);assert.match(html,/식량 [-−]6/);assert.match(html,/국고 [-−]4억/);
 assert.match(html,/2032년 1분기/);assert.deepEqual(state,before);
 assert.equal(renderForeignStrategy(state,'lumen'),'');assert.equal(renderForeignStrategy(createGame(),'nord'),'');
});

test('foreign strategy copy is escaped and expired posture is not claimed active',()=>{
 const state=fixture();state.foreignStrategies.nord.label='<img src=x>';state.foreignStrategies.nord.reason='<script>x</script>';
 let html=renderForeignStrategy(state,'nord');assert.doesNotMatch(html,/<img|<script>/);assert.match(html,/&lt;img/);
 state.turn=6;html=renderForeignStrategy(state,'nord');assert.doesNotMatch(html,/견제 중/);assert.match(html,/중립/);
});

test('strategy results distinguish actual transfers from supply withheld and cap prominent rows',()=>{
 const state=fixture();state.history=[{worldActions:[
  {countryId:'nord',source:'foreign_strategy',type:'strategy',title:'협력 재검토',reason:'이전 결정의 여파',text:'다른 공급국과 협력을 검토합니다.',playerImpact:{relationDelta:-2}},
  {countryId:'cera',source:'foreign_site',operation:'withheld',title:'공개시장 공급 축소',text:'예정 외 시장 물량 2를 보류했습니다.',withheldFood:2,playerImpact:{text:'실제 식량 이전 없음'}},
  {countryId:'marin',source:'foreign_strategy',type:'strategy',title:'항로 회복',text:'협력을 재개합니다.',playerImpact:{relationDelta:2}},
 ]}];
 const html=renderStrategyResults(state);assert.match(html,/다른 나라의 전략 변화/);assert.match(html,/관계 [-−]2/);
 assert.match(html,/공급 보류 2/);assert.match(html,/실제 식량 이전 없음/);assert.doesNotMatch(html,/식량 −2/);
 assert.match(html,/나머지 대응 1건/);assert.equal((html.match(/class="strategy-reaction"/g)??[]).length,3);
});

test('prominent reactions retain every mode change and neutral expiry in the disclosure',()=>{
 const state=fixture();state.history=[{worldActions:[
  {countryId:'altia',source:'foreign_strategy',type:'strategy',mode:'fiscal',posture:'neutral',title:'재정 회복 전환',reason:'국고 부족'},
  {countryId:'marin',source:'foreign_strategy',type:'strategy',mode:'trade',posture:'neutral',previousPosture:'contain',title:'견제 종료',reason:'대응 기간 종료'},
  {countryId:'nord',source:'foreign_strategy',type:'strategy',mode:'food',posture:'contain',title:'공급선 조정',reason:'수출 제한'},
  {countryId:'cera',source:'foreign_site',operation:'withheld',withheldFood:2,text:'시장 선적 보류'},
 ]}];
 const html=renderStrategyResults(state);assert.match(html,/나머지 대응 2건/);
 for(const id of ['altia','marin','nord','cera'])assert.match(html,new RegExp(`data-strategy-country="${id}"`));
 assert.ok(html.includes('대응 기간 종료'));assert.ok(html.includes('국고 부족'));
 state.history[0].worldActions=state.history[0].worldActions.slice(0,2).concat({countryId:'solis',source:'foreign_strategy',type:'strategy',mode:'resilience',posture:'neutral',reason:'생산 기반 회복'});
 assert.match(renderStrategyResults(state),/나머지 대응 1건/);
});
