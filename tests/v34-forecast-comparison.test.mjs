import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';

import {COUNTRY_IDS,advanceTurn,createGame} from '../dist/engine.mjs';
import {commandPreview} from '../dist/command-preview.mjs';
import {attachForecast,forecastComparison,forecastSnapshot} from '../dist/forecast-comparison.mjs';
import {renderForecastComparison} from '../dist/forecast-comparison-ui.mjs';
import {renderOutcome} from '../dist/experience.mjs';
import {loadGame,saveGame} from '../dist/storage.mjs';
import {jointCommand} from '../dist/joint-investments.mjs';

const quiet={networkStartTurn:999,policyStartTurn:1,objectiveStartTurn:999,worldGoalStartTurn:999,conflictStartTurn:999,mediationStartTurn:999,peaceOfferStartTurn:999,peaceComplianceStartTurn:999,peaceResponseStartTurn:999,foreignSiteStartTurn:999,jointStartTurn:999,foreignStrategyStartTurn:999};
const values=new Map();
globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
beforeEach(()=>values.clear());

const executeWithDisplayedForecast=(state,command)=>{
 const preview=commandPreview(state,command),snapshot=forecastSnapshot(preview,state,command);
 return attachForecast(advanceTurn(state,command),snapshot);
};

test('the exact displayed forecast compares equal for all six countries without mutating inputs',()=>{
 for(const playerId of COUNTRY_IDS){
  const state=createGame(playerId,quiet),before=structuredClone(state),preview=commandPreview(state,'maintain');
  const snapshot=forecastSnapshot(preview,state,'maintain'),next=attachForecast(advanceTurn(state,'maintain'),snapshot),resultBefore=structuredClone(next),model=forecastComparison(next);
  assert.equal(model.status,'matched');
  assert.equal(model.summary,'예상대로');
  assert.ok(model.rows.some(row=>row.key==='food'&&row.difference===0));
  assert.ok(model.rows.some(row=>row.key==='treasury'&&row.difference===0));
  assert.deepEqual(state,before);
  assert.deepEqual(next,resultBefore);
 }
});

test('the committed snapshot preserves the last displayed projection instead of regenerating it',()=>{
 const state=createGame('nord',quiet),preview=commandPreview(state,'maintain'),displayed=structuredClone(preview.projection.metrics);
 state.countries.nord.food+=9;
 const snapshot=forecastSnapshot(preview,state,'maintain');
 assert.deepEqual(snapshot.projection.metrics,displayed);
});

test('a preview from another country or turn cannot be restamped onto the current command',()=>{
 const lumen=createGame('lumen',quiet),preview=commandPreview(lumen,'maintain');
 const nextLumen=advanceTurn(lumen,'maintain'),nord=createGame('nord',quiet);
 assert.equal(forecastSnapshot(preview,nextLumen,'maintain'),null);
 assert.equal(forecastSnapshot(preview,nord,'maintain'),null);
 assert.equal(forecastSnapshot(preview,lumen,'balanced'),null);
});

test('normal world actions remain matched when the saved outcome evidence is present',()=>{
 for(const playerId of COUNTRY_IDS){
  const state=createGame(playerId),next=executeWithDisplayedForecast(state,'maintain'),model=forecastComparison(next);
  assert.equal(model.status,'matched',playerId);
  assert.deepEqual(model.reasons,[]);
 }
});

test('changed climate and trade components explain only their recorded differences',()=>{
 const state=createGame('lumen',quiet),preview=commandPreview(state,'maintain');
 const snapshot=forecastSnapshot(preview,state,'maintain');
 snapshot.projection.foodBreakdown=snapshot.projection.foodBreakdown.map((part,index)=>index===0?{...part,value:part.value+3}:part);
 const climate=forecastComparison(attachForecast(advanceTurn(state,'maintain'),snapshot));
 assert.equal(climate.status,'different');
 assert.match(climate.reasons.join(' '),/기후·수확: 예상 [−+]?\d+ → 실제 [−+]?\d+ \([−+]3\)\./);
 assert.doesNotMatch(climate.reasons.join(' '),/확인되지/);

 const tradeSnapshot=forecastSnapshot(preview,state,'maintain');
 tradeSnapshot.projection.foodBreakdown=[...tradeSnapshot.projection.foodBreakdown,{label:'무역 공급',value:4}];
 const trade=forecastComparison(attachForecast(advanceTurn(state,'maintain'),tradeSnapshot));
 assert.match(trade.reasons.join(' '),/무역/);
 assert.doesNotMatch(trade.reasons.join(' '),/기후/);
 const differentHtml=renderForecastComparison(attachForecast(advanceTurn(state,'maintain'),snapshot));
 assert.match(differentHtml,/<details open><summary>차이가 난 이유<\/summary>/);
 assert.match(differentHtml,/기후·수확: 예상/);
});

test('changed command cost is attributed while an unsupported treasury gap stays explicitly unconfirmed',()=>{
 const state=createGame('lumen',quiet),preview=commandPreview(state,'balanced');
 const costSnapshot=forecastSnapshot(preview,state,'balanced');
 costSnapshot.projection.actionCost+=2;
 costSnapshot.projection.metrics.treasury-=2;
 const cost=forecastComparison(attachForecast(advanceTurn(state,'balanced'),costSnapshot));
 assert.match(cost.reasons.join(' '),/명령 비용/);

 const unknownSnapshot=forecastSnapshot(preview,state,'balanced');
 unknownSnapshot.projection.metrics.treasury+=5;
 const unknown=forecastComparison(attachForecast(advanceTurn(state,'balanced'),unknownSnapshot));
 assert.match(unknown.reasons.join(' '),/확인되지 않았/);
});

test('deferred site construction compares the displayed start status without claiming completion',()=>{
 const state=createGame('lumen',quiet),next=executeWithDisplayedForecast(state,'site:farm:upgrade');
 const model=forecastComparison(next),facility=model.rows.find(row=>row.key.startsWith('facility:'));
 assert.ok(facility);
 assert.match(facility.expected,/착공/);
 assert.match(facility.expected,/착공 예정 · 2분기 뒤/);
 assert.match(facility.actual,/착공 · 2분기 뒤/);
 assert.doesNotMatch(facility.actual,/완공/);

 const jointState=createGame('lumen',{...quiet,foreignSiteStartTurn:1,jointStartTurn:1});
 const joint=jointCommand({targetId:'nord',kind:'farm',capital:20,share:25,duration:8});
 const jointModel=forecastComparison(executeWithDisplayedForecast(jointState,joint));
 const jointFacility=jointModel.rows.find(row=>row.key==='facility:nord:farm:started');
 assert.equal(jointModel.status,'matched');
 assert.equal(jointFacility.label,'노르드 지역 농경지');
 assert.match(jointFacility.expected,/착공 예정/);
 assert.match(jointFacility.actual,/착공/);
});

test('comparison UI appears first-class, stays compact and tells the truth for legacy results',()=>{
 const exact=executeWithDisplayedForecast(createGame('cera',quiet),'maintain');
 const html=renderForecastComparison(exact);
 assert.match(html,/예상과 실제/);assert.match(html,/예상대로/);
 assert.match(html,/지표/);assert.match(html,/예상/);assert.match(html,/실제/);assert.match(html,/차이/);
 assert.match(html,/data-forecast-key="food"[^>]*>[\s\S]*?<i role="cell" data-tone="matched">0<\/i>/);
 assert.equal((html.match(/예상대로/g)??[]).length,1);
 assert.match(html,/<details/);assert.doesNotMatch(html,/type="submit"/);
 const result=renderOutcome(exact,0);
 assert.ok(result.indexOf('forecast-comparison')<result.indexOf('result-cause'));
 const legacy=renderForecastComparison(advanceTurn(createGame('cera',quiet),'maintain'));
 assert.match(legacy,/실행 전 예상 기록이 없습니다/);
 assert.doesNotMatch(legacy,/예상대로/);
});

test('facility comparison renders compact status words and one shared match label on narrow surfaces',()=>{
 const state=createGame('lumen',quiet),html=renderForecastComparison(executeWithDisplayedForecast(state,'site:farm:upgrade'));
 const row=html.match(/<div class="forecast-comparison-row"[^>]*data-forecast-key="facility:lumen:farm:started"[\s\S]*?<\/div>/)?.[0]??'';
 assert.match(row,/>착공<\/b>/);
 assert.match(row,/>착공<\/strong>/);
 assert.match(row,/>일치<\/i>/);
 assert.doesNotMatch(row,/2분기|예정|예상대로/);
});

test('a missing actual facility record stays unknown instead of being compacted into a false start',()=>{
 const completed=executeWithDisplayedForecast(createGame('lumen',quiet),'site:farm:upgrade');
 const last=completed.history.at(-1),missing={...completed,history:[...completed.history.slice(0,-1),{...last,siteDevelopment:{...last.siteDevelopment,started:[]}}]};
 const html=renderForecastComparison(missing);
 const row=html.match(/<div class="forecast-comparison-row"[^>]*data-forecast-key="facility:lumen:farm:started"[\s\S]*?<\/div>/)?.[0]??'';
 assert.match(row,/<b role="cell" data-value="expected">착공<\/b>/);
 assert.match(row,/<strong role="cell" data-value="actual">기록 없음<\/strong>/);
 assert.match(row,/>확인 필요<\/i>/);
 assert.equal((row.match(/>착공</g)??[]).length,1);
});

test('validated snapshots survive reload per country while legacy, malformed, switching and restart stay isolated',()=>{
 const lumen=executeWithDisplayedForecast(createGame('lumen'),'maintain');
 saveGame(lumen,{phase:'result',step:0});
 const restored=loadGame('lumen').state;
 assert.equal(forecastComparison(restored).status,'matched');

 const solis=executeWithDisplayedForecast(createGame('solis'),'maintain');
 saveGame(solis,{phase:'result',step:0});
 assert.equal(loadGame('lumen').state.history.at(-1).forecast.playerId,'lumen');
 assert.equal(loadGame('solis').state.history.at(-1).forecast.playerId,'solis');

 saveGame(createGame('solis'));
 assert.equal(loadGame('solis').state.turn,0);
 assert.equal(loadGame('lumen').state.history.at(-1).forecast.playerId,'lumen');

 const root=JSON.parse(values.get('one-planet-food-crisis-v4'));
 root.games.lumen.lastForecast={playerId:'solis',commandId:'maintain',sourceTurn:0,resultTurn:1,projection:{}};
 values.set('one-planet-food-crisis-v4',JSON.stringify(root));
 assert.equal(loadGame('lumen').state.history.at(-1).forecast,undefined);

 root.games.lumen.lastForecast={bad:true};
 values.set('one-planet-food-crisis-v4',JSON.stringify(root));
 assert.equal(loadGame('lumen').status,'restored');
 assert.equal(forecastComparison(loadGame('lumen').state).status,'missing');

 root.games.lumen.lastForecast={playerId:'lumen',commandId:'maintain',sourceTurn:0,resultTurn:1,projection:{metrics:{food:57,treasury:63},actionCost:0,foodBreakdown:'bad',relations:{},foreign:1,facilities:false,outcomes:'bad'}};
 values.set('one-planet-food-crisis-v4',JSON.stringify(root));
 assert.equal(loadGame('lumen').status,'restored');
});
